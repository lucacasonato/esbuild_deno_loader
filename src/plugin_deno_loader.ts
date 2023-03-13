import { esbuild } from "../deps.ts";
import { NativeLoader } from "./loader_native.ts";
import { PortableLoader } from "./loader_portable.ts";
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
 * DENO_DIR, DENO_AUTH_TOKENS, and all similar loading configuration.
 *
 * When the plugin is configured to use the native loader, it can auto-discover
 * deno.lock and all similar configuration files if the `cwd` option is set.
 *
 * ### Portable Loader
 *
 * The portable loader does module downloading and caching with only Web APIs.
 * Requires `--allow-read` and/or `--allow-net`. This mode does not respect
 * deno.lock, DENO_DIR, DENO_AUTH_TOKENS, or any other loading configuration. It
 * does not cache downloaded files. It will re-download files on every build.
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
      let loaderImpl: Loader;

      build.onStart(function onStart() {
        switch (loader) {
          case "native":
            loaderImpl = new NativeLoader({
              infoOptions: {
                config: options.configPath,
                importMap: options.importMapURL,
                // TODO(lucacasonato): https://github.com/denoland/deno/issues/18159
                // lock: options.lockPath,
              },
            });
            break;
          case "portable":
            loaderImpl = new PortableLoader();
        }
      });

      async function onResolve(
        args: esbuild.OnResolveArgs,
      ): Promise<esbuild.OnResolveResult | null | undefined> {
        const specifier = esbuildResolutionToURL(args);

        // Once we have an absolute path, let the loader resolver figure out
        // what to do with it.
        const res = await loaderImpl.resolve(specifier);

        switch (res.kind) {
          case "esm": {
            const { specifier } = res;
            return urlToEsbuildResolution(specifier);
          }
        }
      }
      build.onResolve({ filter: /.*/, namespace: "file" }, onResolve);
      build.onResolve({ filter: /.*/, namespace: "http" }, onResolve);
      build.onResolve({ filter: /.*/, namespace: "https" }, onResolve);
      build.onResolve({ filter: /.*/, namespace: "data" }, onResolve);

      function onLoad(
        args: esbuild.OnLoadArgs,
      ): Promise<esbuild.OnLoadResult | null> {
        const specifier = esbuildResolutionToURL(args);
        return loaderImpl.loadEsm(specifier);
      }
      // TODO(lucacasonato): once https://github.com/evanw/esbuild/pull/2968 is fixed, remove the catch all "file" handler
      // build.onLoad({ filter: /.*\.json/, namespace: "file" }, onLoad);
      build.onLoad({ filter: /.*/, namespace: "file" }, onLoad);
      build.onLoad({ filter: /.*/, namespace: "http" }, onLoad);
      build.onLoad({ filter: /.*/, namespace: "https" }, onLoad);
      build.onLoad({ filter: /.*/, namespace: "data" }, onLoad);
    },
  };
}
