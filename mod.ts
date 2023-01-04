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

      const infoCache = new Map<string, ModuleEntry>();
      const npmModulesCache = new Map<string, NpmPackageReference>();
      let importMap: ImportMap | null = null;

      const skipResolved = {};
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

        if(args.pluginData == skipResolved) {
          return;
        }
        const npm = args.path.startsWith("npm:");
        if (npm) return { path: args.path, namespace: "npm" };

        // Finding Node packages, if package not start with "." it consider as Node Package
        if (args.kind === "require-call") {
          const isNodeMod = !args.path.startsWith(".");
          if (isNodeMod) throw Error(`Cant Import Node Module ${args.path}`);
        }
        const resolveDir = args.resolveDir
          ? `${toFileUrl(args.resolveDir).href}/`
          : "";
        const referrer = args.importer
          ? `${args.namespace}:${args.importer}`
          : resolveDir;


        
        let resolved: URL;
        if (importMap !== null) {
          const res = resolveModuleSpecifier(
            args.path,
            importMap,
            new URL(referrer) || undefined,
          );
          resolved = new URL(res);
        } 
        else if(referrer.startsWith("npm:")){
          const ref = npmModulesCache.get(args.importer);
          const specifier = ref?.name;
          const version = ref?.versionReq;
          const moduleDirPath =
            `${npmCache}/registry.npmjs.org/${specifier}/${version}/`;
            const res = await build.resolve(args.path, { resolveDir: moduleDirPath, pluginData: skipResolved});
              return {
                path: res.path
              }
        }
        else {
            resolved = new URL(args.path, referrer);
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
      async function loadNpm(
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
      build.onLoad({ filter: /.*/, namespace: "npm" }, loadNpm);
    },
  };
}
