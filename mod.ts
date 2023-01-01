import {
  esbuild,
  fromFileUrl,
  ImportMap,
  resolveImportMap,
  resolveModuleSpecifier,
  toFileUrl,
} from "./deps.ts";
import { load as nativeLoad } from "./src/native_loader.ts";
import { load as portableLoad } from "./src/portable_loader.ts";
import { checkExistNpmMod, ModuleEntry } from "./src/deno.ts";
import { getCacheLocation } from "./src/deno.ts";
import {
  isEntry,
  NpmPackageReference,
  npmPackageReference,
} from "./src/npm_specifier.ts";

export interface DenoPluginOptions {
  /**
   * Specify the URL to an import map to use when resolving import specifiers.
   * The URL must be fetchable with `fetch`.
   */
  importMapURL?: URL;
  /**
   * Specify which loader to use. By default this will use the `native` loader,
   * unless the `--allow-run` permission has not been given.
   *
   * - `native`:     Shells out to the Deno execuatble under the hood to load
   *                 files. Requires --allow-read and --allow-run.
   * - `portable`:   Do module downloading and caching with only Web APIs.
   *                 Requires --allow-read and/or --allow-net.
   */
  loader?: "native" | "portable";
}

/** The default loader to use. */
export const DEFAULT_LOADER: "native" | "portable" =
  await Deno.permissions.query({ name: "run" }).then((res) =>
      res.state !== "granted"
    )
    ? "portable"
    : "native";

export function denoPlugin(options: DenoPluginOptions = {}): esbuild.Plugin {
  const loader = options.loader ?? DEFAULT_LOADER;

  return {
    name: "deno",
    async setup(build) {
      const npmCache = (await getCacheLocation()).replaceAll("\\", "/");

      const skipResolve = {};
      const infoCache = new Map<string, ModuleEntry>();
      const npmModulesCache = new Map<string, NpmPackageReference>();
      let importMap: ImportMap | null = null;

      build.onStart(async function onStart() {
        if (options.importMapURL !== undefined) {
          const resp = await fetch(options.importMapURL.href);
          const txt = await resp.text();
          importMap = resolveImportMap(JSON.parse(txt), options.importMapURL);
        } else {
          importMap = null;
        }
      });

      build.onResolve({ filter: /.*/ }, async function onResolve(
        args: esbuild.OnResolveArgs,
      ): Promise<esbuild.OnResolveResult | null | undefined> {
        if (args.kind === "require-call") {
          const isNodeMod = args.path.split("/").length < 2;

          if (isNodeMod) throw Error(`Cant Import Node Module ${args.path}`);
        }
        const resolveDir = args.resolveDir
          ? `${toFileUrl(args.resolveDir).href}/`
          : "";
        const referrer = args.importer
          ? `${args.namespace}:${args.importer}`
          : resolveDir;

        const npm = args.path.startsWith("npm:");

        if (npm) return { path: args.path, namespace: "node" };
        let resolved: URL;
        if (importMap !== null) {
          const res = resolveModuleSpecifier(
            args.path,
            importMap,
            new URL(referrer) || undefined,
          );
          resolved = new URL(res);
        } else {
          try {
            resolved = new URL(args.path, referrer);

            //These are thrown whenever it receives a non-URL type e.g(require("./lib/route"))
          } catch {
            // This is For importing files from npm-packages.. Since they dint contain extensions
            // For Example, express's index.js file has "var route = require("./lib/route")",
            // Since route is route.js file..
            if (args.path.startsWith(".")) {
              const ref = npmModulesCache.get(args.importer);
              const specifier = ref?.name;
              const version = ref?.versionReq;
              const moduleDirPath =
                `${npmCache}/registry.npmjs.org/${specifier}/${version}`;

              if (isEntry(args.path)) {
                return {
                  path: `${moduleDirPath}/${args.path.substring(2)}.js`,
                  namespace: "file",
                };
              }
              return {
                path: `${moduleDirPath}/${args.path.substring(2)}`,
                namespace: "file",
              };
            }
            throw Error("Node Package Detected");
          }
        }
        const protocol = resolved.protocol;
        if (protocol === "file:") {
          const path = fromFileUrl(resolved);
          return { path, namespace: "file" };
        }
        const path = resolved.href.slice(protocol.length);
        return { path, namespace: protocol.slice(0, -1) };
      });

      function onLoad(
        args: esbuild.OnLoadArgs,
      ): Promise<esbuild.OnLoadResult | null> {
        let url;
        if (args.namespace === "file") {
          url = toFileUrl(args.path);
        } else {
          url = new URL(`${args.namespace}:${args.path}`);
        }
        switch (loader) {
          case "native":
            return nativeLoad(infoCache, url, options);
          case "portable":
            return portableLoad(url, options);
        }
      }
      async function nodePackage(
        args: esbuild.OnLoadArgs,
      ): Promise<esbuild.OnLoadResult | null | undefined> {
        let ref: NpmPackageReference | undefined = npmModulesCache
          .get(args.path);

        if (!ref) {
          ref = npmPackageReference(args.path);
          npmModulesCache.set(args.path, ref);
        }
        const specifier = ref.name;
        const version = ref.versionReq;

        if (!version) {
          throw new Error(`Version not specified for ${specifier}`);
        }

        const moduleDirPath =
          `${npmCache}/registry.npmjs.org/${specifier}/${version}`;

        //Make Sure the Package is cached at NPM Cache Else It will be downloaded See Func Definition..
        await checkExistNpmMod(args.path, moduleDirPath);

        const packageJson = JSON.parse(
          await Deno.readTextFile(
            `${moduleDirPath}/package.json`,
          ),
        );

        let file = packageJson.main ?? "index.js";
        if (ref.subPath) {
          file = `${ref.subPath}.js`;
        }
        return {
          contents: await Deno.readTextFile(`${moduleDirPath}/${file}`),
        };
      }
      build.onLoad({ filter: /.*\.json/, namespace: "file" }, onLoad);
      build.onLoad({ filter: /.*/, namespace: "http" }, onLoad);
      build.onLoad({ filter: /.*/, namespace: "https" }, onLoad);
      build.onLoad({ filter: /.*/, namespace: "data" }, onLoad);
      build.onLoad({ filter: /.*/, namespace: "node" }, nodePackage);
    },
  };
}
