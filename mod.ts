import type * as esbuild from "./src/esbuild_types.ts";

import {
  denoResolverPlugin,
  type DenoResolverPluginOptions,
} from "./src/plugin_deno_resolver.ts";
export { denoResolverPlugin, type DenoResolverPluginOptions };

import {
  DEFAULT_LOADER,
  denoLoaderPlugin,
  type DenoLoaderPluginOptions,
} from "./src/plugin_deno_loader.ts";
export { DEFAULT_LOADER, denoLoaderPlugin, type DenoLoaderPluginOptions };

export {
  type EsbuildResolution,
  esbuildResolutionToURL,
  urlToEsbuildResolution,
} from "./src/shared.ts";

/** Options for the {@link denoPlugins} function. */
export interface DenoPluginsOptions {
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
   * If not specified, the plugin will attempt to find the nearest deno.json and
   * use that. If the deno.json is part of a workspace, the plugin will
   * automatically find the workspace root. 
   */
  configPath?: string;
  /**
   * Specify a URL to an import map file to use when resolving import
   * specifiers. This is equivalent to the `--import-map` flag to the Deno
   * executable. This URL may be remote or a local file URL.
   *
   * If this option is not specified, the deno.json config file is consulted to
   * determine what import map to use, if any.
   */
  importMapURL?: string;
  /**
   * Specify the path to a deno.lock file to use. This is equivalent to the
   * `--lock` flag to the Deno executable. This path must be absolute.
   *
   * If this option is not specified, the deno.json config file is consulted to
   * determine what lock file to use, if any.
   *
   * A lockfile must be present to resolve `jsr:` specifiers with the `portable`
   * loader. When using the `native` loader, a lockfile is not required, but to
   * ensure dependencies are de-duplicated correctly, it is recommended to use a
   * lockfile.
   */
  lockPath?: string;
  /**
   * Specify how the loader should handle NPM packages. By default and if this
   * option is set to `none`, the loader will use the global cache to resolve
   * NPM packages. If this option is set to `manual`, the loader will use a
   * manually managed `node_modules` directory. If this option is set to `auto`,
   * the loader will use a local `node_modules` directory.
   *
   * If this option is not specified, the deno.json config file is consulted to
   * determine which mode to use.
   *
   * This option is ignored when using the `portable` loader, as the portable
   * loader always uses a manual `node_modules` directory (equivalent of
   * `nodeModulesDir: "manual"`).
   */
  nodeModulesDir?: "auto" | "manual" | "none";
}

/**
 * A convenience function to enable both the Deno resolver plugin, and Deno
 * loader plugin.
 */
export function denoPlugins(opts: DenoPluginsOptions = {}): esbuild.Plugin[] {
  return [
    denoResolverPlugin(opts),
    denoLoaderPlugin(opts),
  ];
}
