import { esbuild, join } from "../deps.ts";
import { NativeLoader } from "./loader_native.ts";
import { PortableLoader } from "./loader_portable.ts";
import {
  IN_NODE_MODULES,
  IN_NODE_MODULES_RESOLVED,
} from "./plugin_deno_resolver.ts";
import {
  esbuildResolutionToURL,
  Loader,
  urlToEsbuildResolution,
} from "./shared.ts";

export interface DenoLoaderPluginOptions {
  /**
   * Specify which loader to use. By default this will use the `native` loader,
   * unless the `--allow-run` permission has not been given.
   *
   * See {@link denoLoaderPlugin} for more information on the different loaders.
   */
  loader?: "native" | "portable";

  /**
   * Specify the path to a deno.json config file to use. This is equivalent to
   * the `--config` flag to the Deno executable. This path must be absolute.
   *
   * NOTE: Import maps in the config file are not used to inform resolution, as
   * this has already been done by the `denoResolverPlugin`. This option is only
   * used when specifying `loader: "native"` to more efficiently load modules
   * from the cache. When specifying `loader: "native"`, this option must be in
   * sync with the `configPath` option for `denoResolverPlugin`.
   */
  configPath?: string;
  /**
   * Specify a URL to an import map file to use when resolving import
   * specifiers. This is equivalent to the `--import-map` flag to the Deno
   * executable. This URL may be remote or a local file URL.
   *
   * If this option is not specified, the deno.json config file is consulted to
   * determine what import map to use, if any.
   *
   * NOTE: Import maps in the config file are not used to inform resolution, as
   * this has already been done by the `denoResolverPlugin`. This option is only
   * used when specifying `loader: "native"` to more efficiently load modules
   * from the cache. When specifying `loader: "native"`, this option must be in
   * sync with the `importMapURL` option for `denoResolverPlugin`.
   */
  importMapURL?: string;
  // TODO(lucacasonato): https://github.com/denoland/deno/issues/18159
  // /**
  //  * Specify the path to a lock file to use. This is equivalent to the `--lock`
  //  * flag to the Deno executable. This path must be absolute.
  //  *
  //  * If this option is not specified, the deno.json config file is consulted to
  //  * determine what import map to use, if any.
  //  *
  //  * NOTE: when using `loader: "portable"`, lock checks are not performed for
  //  * ESM modules.
  //  */
  // lockPath?: string;
  /**
   * Specify whether to generate and use a local `node_modules` directory when
   * using the `native` loader. This is equivalent to the `--node-modules-dir`
   * flag to the Deno executable.
   *
   * This option is ignored when using the `portable` loader, as the portable
   * loader always uses a local `node_modules` directory.
   */
  nodeModulesDir?: boolean;
}

const LOADERS = ["native", "portable"] as const;

/** The default loader to use. */
export const DEFAULT_LOADER: typeof LOADERS[number] =
  await Deno.permissions.query({ name: "run" })
      .then((res) => res.state !== "granted")
    ? "portable"
    : "native";

/**
 * The Deno loader plugin for esbuild. This plugin will load fully qualified
 * `file`, `http`, `https`, and `data` URLs.
 *
 * **Note** that this plugin does not do relative->absolute specifier
 * resolution, or import map resolution. You must use the `denoResolverPlugin`
 * _before_ the `denoLoaderPlugin` to do that.
 *
 * This plugin can be backed by two different loaders, the `native` loader and
 * the `portable` loader.
 *
 * ### Native Loader
 *
 * The native loader shells out to the Deno executable under the hood to load
 * files. Requires `--allow-read` and `--allow-run`. In this mode the download
 * cache is shared with the Deno executable. This mode respects deno.lock,
 * DENO_DIR, DENO_AUTH_TOKENS, and all similar loading configuration. Files are
 * cached on disk in the same Deno cache as the Deno executable, and will not be
 * re-downloaded on subsequent builds.
 *
 * NPM specifiers can be used in the native loader without requiring a local
 * `node_modules` directory. NPM packages are resolved, downloaded, cached, and
 * loaded in the same way as the Deno executable does.
 *
 * ### Portable Loader
 *
 * The portable loader does module downloading and caching with only Web APIs.
 * Requires `--allow-read` and/or `--allow-net`. This mode does not respect
 * deno.lock, DENO_DIR, DENO_AUTH_TOKENS, or any other loading configuration. It
 * does not cache downloaded files. It will re-download files on every build.
 *
 * NPM specifiers can be used in the portable loader, but require a local
 * `node_modules` directory. The `node_modules` directory must be created prior
 * using Deno's `--node-modules-dir` flag.
 */
export function denoLoaderPlugin(
  options: DenoLoaderPluginOptions = {},
): esbuild.Plugin {
  const loader = options.loader ?? DEFAULT_LOADER;
  if (LOADERS.indexOf(loader) === -1) {
    throw new Error(`Invalid loader: ${loader}`);
  }
  return {
    name: "deno-loader",
    setup(build) {
      const cwd = build.initialOptions.absWorkingDir ?? Deno.cwd();

      let nodeModulesDir: string | null = null;
      if (options.nodeModulesDir) {
        nodeModulesDir = join(cwd, "node_modules");
      }

      let loaderImpl: Loader;

      const packageIdMapping = new Map<string, string>();

      build.onStart(function onStart() {
        packageIdMapping.clear();
        switch (loader) {
          case "native":
            loaderImpl = new NativeLoader({
              infoOptions: {
                cwd,
                config: options.configPath,
                importMap: options.importMapURL,
                // TODO(lucacasonato): https://github.com/denoland/deno/issues/18159
                // lock: options.lockPath,
                nodeModulesDir: options.nodeModulesDir,
              },
            });
            break;
          case "portable":
            loaderImpl = new PortableLoader();
        }
      });

      async function resolveInNodeModules(
        path: string,
        packageId: string,
        kind: esbuild.ImportKind,
        resolveDir: string,
        importer: string,
        namespace: string,
      ): Promise<esbuild.OnResolveResult> {
        const result = await build.resolve(path, {
          kind,
          resolveDir,
          importer,
          namespace,
          pluginData: IN_NODE_MODULES_RESOLVED,
        });
        result.pluginData = IN_NODE_MODULES;
        packageIdMapping.set(result.path, packageId);
        return result;
      }

      async function onResolve(
        args: esbuild.OnResolveArgs,
      ): Promise<esbuild.OnResolveResult | null | undefined> {
        if (args.namespace === "file" && args.pluginData === IN_NODE_MODULES) {
          if (nodeModulesDir) {
            const result = await build.resolve(args.path, {
              kind: args.kind,
              resolveDir: args.resolveDir,
              importer: args.importer,
              namespace: args.namespace,
              pluginData: IN_NODE_MODULES_RESOLVED,
            });
            result.pluginData = IN_NODE_MODULES;
            return result;
          } else if (
            loaderImpl.nodeModulesDirForPackage &&
            loaderImpl.packageIdFromNameInPackage
          ) {
            const parentPackageId = packageIdMapping.get(args.importer);
            if (!parentPackageId) {
              throw new Error(
                `Could not find package ID for importer: ${args.importer}`,
              );
            }
            if (args.path.startsWith(".")) {
              return resolveInNodeModules(
                args.path,
                parentPackageId,
                args.kind,
                args.resolveDir,
                args.importer,
                args.namespace,
              );
            } else {
              let packageName: string;
              let pathParts: string[];
              if (args.path.startsWith("@")) {
                const [scope, name, ...rest] = args.path.split("/");
                packageName = `${scope}/${name}`;
                pathParts = rest;
              } else {
                const [name, ...rest] = args.path.split("/");
                packageName = name;
                pathParts = rest;
              }
              const packageId = loaderImpl.packageIdFromNameInPackage(
                packageName,
                parentPackageId,
              );
              const resolveDir = await loaderImpl.nodeModulesDirForPackage(
                packageId,
              );
              const path = [packageName, ...pathParts].join("/");
              return resolveInNodeModules(
                path,
                parentPackageId,
                args.kind,
                resolveDir,
                args.importer,
                args.namespace,
              );
            }
          } else {
            throw new Error(
              `To use "npm:" specifiers, you must specify "nodeModulesDir: true", or use "loader: native".`,
            );
          }
        }
        const specifier = esbuildResolutionToURL(args);

        // Once we have an absolute path, let the loader resolver figure out
        // what to do with it.
        const res = await loaderImpl.resolve(specifier);

        switch (res.kind) {
          case "esm": {
            const { specifier } = res;
            return urlToEsbuildResolution(specifier);
          }
          case "npm": {
            let resolveDir: string;
            if (nodeModulesDir) {
              resolveDir = nodeModulesDir;
            } else if (loaderImpl.nodeModulesDirForPackage) {
              resolveDir = await loaderImpl.nodeModulesDirForPackage(
                res.packageId,
              );
            } else {
              throw new Error(
                `To use "npm:" specifiers, you must specify "nodeModulesDir: true", or use "loader: native".`,
              );
            }
            const path = `${res.packageName}${res.path ?? ""}`;
            return resolveInNodeModules(
              path,
              res.packageId,
              args.kind,
              resolveDir,
              args.importer,
              args.namespace,
            );
          }
          case "node": {
            return {
              path: res.path,
              external: true,
            };
          }
        }
      }
      build.onResolve({ filter: /.*/, namespace: "file" }, onResolve);
      build.onResolve({ filter: /.*/, namespace: "http" }, onResolve);
      build.onResolve({ filter: /.*/, namespace: "https" }, onResolve);
      build.onResolve({ filter: /.*/, namespace: "data" }, onResolve);
      build.onResolve({ filter: /.*/, namespace: "npm" }, onResolve);
      build.onResolve({ filter: /.*/, namespace: "node" }, onResolve);

      async function onLoad(
        args: esbuild.OnLoadArgs,
      ): Promise<esbuild.OnLoadResult | null> {
        if (args.namespace === "file" && args.pluginData === IN_NODE_MODULES) {
          const contents = await Deno.readFile(args.path);
          return { loader: "js", contents };
        }
        const specifier = esbuildResolutionToURL(args);
        return loaderImpl.loadEsm(specifier);
      }
      // TODO(lucacasonato): once https://github.com/evanw/esbuild/pull/2968 is fixed, remove the catch all "file" handler
      build.onLoad({ filter: /.*/, namespace: "file" }, onLoad);
      build.onLoad({ filter: /.*/, namespace: "http" }, onLoad);
      build.onLoad({ filter: /.*/, namespace: "https" }, onLoad);
      build.onLoad({ filter: /.*/, namespace: "data" }, onLoad);
    },
  };
}
