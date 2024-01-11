import { DenoDir, dirname, esbuild, fromFileUrl, join } from "../deps.ts";
import { DenoPluginsOptions } from "../mod.ts";
import { denoCache, denoInfo, isModuleEntryError } from "./deno.ts";
import {
  getLoaderFromPath,
  mapContentType,
  mediaTypeToLoader,
  readDenoConfig,
} from "./shared.ts";

class ResolveCacheEntry {
  constructor(
    public originalPath: string,
    public path: string,
    public loader: esbuild.Loader,
    public namespace: string,
  ) {}
}

interface Context {
  denoDir: string;
  configPath?: string;
  nodeModulesDir?: string;
  vendorRoot?: string;
  resolveCache: Map<string, ResolveCacheEntry>;
  importMap: Record<string, string>;
}

interface NpmSpecifer {
  scope: string | undefined;
  name: string;
  version: string;
  entry: string | undefined;
}

export function parseNpmSpecifier(str: string): NpmSpecifer {
  if (!str.startsWith("npm:")) {
    throw new Error(`Not an npm specifier: ${str}`);
  }

  let scope: string | undefined;
  let name: string;
  let version: string;
  let entry: string | undefined;

  const startIdx = str.startsWith("npm:/") ? 5 : 4;
  let nameIdx = 0;

  if (str[startIdx] === "@") {
    const scopeIdx = str.indexOf("/");
    if (scopeIdx === -1) throw new Error(`Invalid npm specifier: ${str}`);
    scope = str.slice(4, scopeIdx);

    nameIdx = str.indexOf("@", scopeIdx + 1);
    name = str.slice(scopeIdx + 1, nameIdx);
  } else {
    nameIdx = str.indexOf("@");
    if (nameIdx === -1) {
      throw new Error(`Missing version in npm specifier ${str}`);
    }

    name = str.slice(startIdx, nameIdx);
  }

  const versionIdx = str.indexOf("/", nameIdx);
  if (versionIdx === -1) {
    version = str.slice(nameIdx + 1);
  } else {
    version = str.slice(nameIdx + 1, versionIdx);
    entry = str.slice(versionIdx + 1);
  }

  return {
    entry,
    name,
    scope,
    version,
  };
}

async function loadModule(
  specifier: string,
  {
    nodeModulesDir,
    vendorRoot,
    denoDir,
    configPath,
    resolveCache,
  }: Context,
): Promise<esbuild.OnLoadResult> {
  let cached = resolveCache.get(specifier);

  if (!cached) {
    if (specifier.startsWith("npm:")) {
      await denoCache(specifier, {
        config: configPath,
        nodeModulesDir: nodeModulesDir !== undefined,
      });
    }

    const infoResult = await denoInfo(specifier, {
      config: configPath,
      nodeModulesDir: nodeModulesDir !== undefined,
    });

    for (let i = 0; i < infoResult.modules.length; i++) {
      const info = infoResult.modules[i];
      if (isModuleEntryError(info)) {
        throw new Error(`Error loading module: ${info.error}`);
      }

      if (info.kind === "esm") {
        if (!info.local) {
          throw new Error(`Module ${info.local} not downloaded.`);
        }

        resolveCache.set(
          info.specifier,
          new ResolveCacheEntry(
            info.specifier,
            info.local,
            mediaTypeToLoader(info.mediaType),
            "http",
          ),
        );
      } else if (info.kind === "npm") {
        const parsed = parseNpmSpecifier(specifier);

        if (nodeModulesDir !== undefined) {
          const packageDir = join(
            nodeModulesDir,
            ".deno",
            info.npmPackage,
            "node_modules",
            parsed.name,
          );

          const pkgJsonPath = join(packageDir, "package.json");
          const pkgJson = JSON.parse(await Deno.readTextFile(pkgJsonPath));
          const isEsmModule = pkgJson.type === "module";

          if (!isEsmModule) {
            parsed.entry = pkgJson.module || pkgJson.main;
          }

          if (parsed.entry === undefined) {
            console.log("NOOOO ENTRY");
            console.log(pkgJson);
            throw new Error(`NOO entry`);
          }

          const file = join(packageDir, parsed.entry);
          resolveCache.set(
            specifier,
            new ResolveCacheEntry(
              specifier,
              file,
              getLoaderFromPath(file),
              "npm",
            ),
          );
        }
      }
    }
  }

  cached = resolveCache.get(specifier);
  if (!cached) throw new Error(`Could not load ${specifier}.`);

  return {
    loader: cached.loader,
    resolveDir: dirname(cached.path),
    contents: await Deno.readFile(cached.path),
  };
}

export function denoEsbuildPlugin(options: DenoPluginsOptions): esbuild.Plugin {
  const ctx: Context = {
    denoDir: Deno.env.get("DENO_DIR") ?? new DenoDir().root,
    nodeModulesDir: undefined,
    resolveCache: new Map(),
    configPath: options.configPath,
    vendorRoot: undefined,
    importMap: {},
  };

  return {
    name: "deno",
    async setup(build) {
      if (options.configPath) {
        const config = await readDenoConfig(options.configPath);

        const configDir = dirname(options.configPath);
        if (config.vendor) {
          ctx.nodeModulesDir = join(configDir, "node_modules");
          ctx.vendorRoot = join(configDir, "vendor");
        } else if (config.nodeModulesDir) {
          ctx.nodeModulesDir = join(configDir, "node_modules");
        }

        if (config.imports) {
          ctx.importMap = config.imports;
        }
        if (config.importMap) {
          // TODO
        }
      }

      console.log(build.initialOptions);

      build.onResolve({ filter: /.*/ }, async (args) => {
        const cached = ctx.resolveCache.get(args.path);
        if (cached) {
          console.log(cached);
          return {
            path: cached.path,
            loader: cached.loader,
            namespace: cached.namespace,
          };
        }

        if (args.path.startsWith("file:")) {
          return {
            path: fromFileUrl(args.path),
          };
        } else if (args.path.startsWith("data:")) {
          return {
            path: args.path,
            namespace: "data",
          };
        } else if (
          args.path.startsWith("http:") || args.path.startsWith("https:")
        ) {
          console.log("HTTP", args.path);
          return {
            path: args.path,
            namespace: "http",
            pluginData: {
              httpOrigin: new URL(args.path).origin,
            },
          };
        } else if (args.path.startsWith("/")) {
          // Sites like esm.sh reference imports via root relative
          // specifiers like `/v135/foo/bar.js`
          if (args?.pluginData?.httpOrigin) {
            const mapped = args.pluginData.httpOrigin + args.path;
            return {
              path: mapped,
              namespace: "http",
            };
          }

          if (args.path.startsWith("/v135")) {
            console.log("ROOT", args.path, args.pluginData, args);
            throw new Error(`FAILED ${args.path}`);
          }

          return undefined;
        } else if (args.path.startsWith("npm:")) {
          await denoCache(args.path, {
            config: ctx.configPath,
            nodeModulesDir: ctx.nodeModulesDir !== undefined,
          });

          return {
            path: args.path,
            namespace: "npm",
          };
        } else if (args.path.startsWith("node:")) {
          return {
            path: args.path,
            external: true,
          };
        }

        // Fully mapped path in import map
        if (args.path in ctx.importMap) {
          const mapped = ctx.importMap[args.path];
          console.log("reoslving mapped #1", mapped);
          return build.resolve(mapped, {
            kind: args.kind,
            importer: args.importer,
            resolveDir: args.resolveDir,
          });
        }

        // Partially mapped import map
        const keys = Object.keys(ctx.importMap);
        for (let i = 0; i < keys.length; i++) {
          const key = keys[i];
          if (args.path.startsWith(key)) {
            const value = ctx.importMap[key];

            const prefix = value.startsWith(".")
              ? join(dirname(options.configPath!), value)
              : value;

            const mapped = `${prefix}${args.path.slice(key.length)}`;

            console.log("reoslving mapped #2", mapped, args.importer);
            return build.resolve(mapped, {
              kind: args.kind,
              importer: args.importer,
              resolveDir: args.resolveDir,
              namespace:
                mapped.startsWith("http:") || mapped.startsWith("https:")
                  ? "http"
                  : "file",
              pluginData:
                mapped.startsWith("http:") || mapped.startsWith("https:")
                  ? {
                    httpOrigin: new URL(mapped).origin,
                  }
                  : undefined,
            });
          }
        }

        console.log("SKIP resolving", args.path);
        return undefined;
      });

      // Case: http://...
      // Case: https://...
      build.onLoad({ filter: /.*/, namespace: "http" }, async (args) => {
        const result = await loadModule(args.path, ctx);

        return {
          contents: result.contents,
          loader: result.loader,
          resolveDir: new URL(args.path).origin,
          pluginData: {
            httpOrigin: new URL(args.path).origin,
          },
        };
      });

      // Case: npm:...
      build.onLoad({ filter: /.*/, namespace: "npm" }, async (args) => {
        const result = await loadModule(args.path, ctx);
        return result;
      });

      // Case: data:...
      build.onLoad({ filter: /.*/, namespace: "data" }, async (args) => {
        const specifier = new URL(args.path);
        const resp = await fetch(specifier);
        const contents = new Uint8Array(await resp.arrayBuffer());
        const contentType = resp.headers.get("content-type");
        const mediaType = mapContentType(specifier, contentType);
        const loader = mediaTypeToLoader(mediaType);
        return { contents, loader };
      });
    },
  };
}
