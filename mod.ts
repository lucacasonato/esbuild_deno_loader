import { esbuild } from "./deps.ts";

import {
  denoResolverPlugin,
  type DenoResolverPluginOptions,
  type ImportMap,
  type Scopes,
  type SpecifierMap,
} from "./src/plugin_deno_resolver.ts";
export {
  denoResolverPlugin,
  DenoResolverPluginOptions,
  ImportMap,
  Scopes,
  SpecifierMap,
};

import {
  DEFAULT_LOADER,
  denoLoaderPlugin,
  type DenoLoaderPluginOptions,
} from "./src/plugin_deno_loader.ts";
export { DEFAULT_LOADER, denoLoaderPlugin, DenoLoaderPluginOptions };

export {
  type EsbuildResolution,
  esbuildResolutionToURL,
  urlToEsbuildResolution,
} from "./src/shared.ts";

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
   * Specify whether to generate and use a local `node_modules` directory when
   * using the `native` loader. This is equivalent to the `--node-modules-dir`
   * flag to the Deno executable.
   *
   * This option is ignored when using the `portable` loader, as the portable
   * loader always uses a local `node_modules` directory.
   */
  nodeModulesDir?: boolean;
}

export function denoPlugins(opts: DenoPluginsOptions = {}): esbuild.Plugin[] {
  return [
    denoResolverPlugin(opts),
    denoLoaderPlugin(opts),
  ];
}
