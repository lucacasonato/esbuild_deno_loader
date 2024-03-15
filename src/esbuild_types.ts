/**
 * This is a copy of the esbuild types that `deno_esbuild_loader` uses. This is
 * necessary because the `esbuild` package is not available on JSR yet.
 *
 * @module
 */

/** the type of import */
export type ImportKind =
  | "entry-point"
  // JS
  | "import-statement"
  | "require-call"
  | "dynamic-import"
  | "require-resolve"
  // CSS
  | "import-rule"
  | "composes-from"
  | "url-token";

/** Documentation: https://esbuild.github.io/api/#loader */
export type Loader =
  | "base64"
  | "binary"
  | "copy"
  | "css"
  | "dataurl"
  | "default"
  | "empty"
  | "file"
  | "js"
  | "json"
  | "jsx"
  | "local-css"
  | "text"
  | "ts"
  | "tsx";

/** Documentation: https://esbuild.github.io/plugins */
export interface Plugin {
  name: string;
  setup: (build: PluginBuild) => void | Promise<void>;
}

/** Documentation: https://esbuild.github.io/plugins */
export interface PluginBuild {
  /** Documentation: https://esbuild.github.io/plugins/#build-options */
  initialOptions: BuildOptions;

  /** Documentation: https://esbuild.github.io/plugins/#resolve */
  resolve(path: string, options?: ResolveOptions): Promise<ResolveResult>;

  /** Documentation: https://esbuild.github.io/plugins/#on-start */
  onStart(callback: () => Promise<void>): void;

  /** Documentation: https://esbuild.github.io/plugins/#on-resolve */
  onResolve(
    options: OnResolveOptions,
    callback: (args: OnResolveArgs) => Promise<OnResolveResult | undefined>,
  ): void;

  /** Documentation: https://esbuild.github.io/plugins/#on-load */
  onLoad(
    options: OnLoadOptions,
    callback: (args: OnLoadArgs) => Promise<OnLoadResult | null> | undefined,
  ): void;
}

/** Documentation: https://esbuild.github.io/api */
export interface BuildOptions {
  /** Documentation: https://esbuild.github.io/api/#external */
  external?: string[];
  /** Documentation: https://esbuild.github.io/api/#working-directory */
  absWorkingDir?: string;
}

/** Documentation: https://esbuild.github.io/plugins/#resolve-options */
export interface ResolveOptions {
  importer?: string;
  resolveDir?: string;
  namespace?: string;
  kind?: ImportKind;
}

/** Documentation: https://esbuild.github.io/plugins/#resolve-results */
export interface ResolveResult {
  path: string;
  namespace: string;
}

/** Documentation: https://esbuild.github.io/plugins/#on-resolve-options */
export interface OnResolveOptions {
  filter: RegExp;
  namespace?: string;
}

/** Documentation: https://esbuild.github.io/plugins/#on-resolve-arguments */
export interface OnResolveArgs {
  path: string;
  importer: string;
  namespace: string;
  resolveDir: string;
  kind: ImportKind;
}

export interface OnResolveResult {
  path?: string;
  external?: boolean;
  namespace?: string;
}

/** Documentation: https://esbuild.github.io/plugins/#on-load-options */
export interface OnLoadOptions {
  filter: RegExp;
  namespace?: string;
}

/** Documentation: https://esbuild.github.io/plugins/#on-load-arguments */
export interface OnLoadArgs {
  path: string;
  namespace: string;
}

/** Documentation: https://esbuild.github.io/plugins/#on-load-results */
export interface OnLoadResult {
  contents?: string | Uint8Array;
  resolveDir?: string;
  loader?: Loader;

  watchFiles?: string[];
}

/** Documentation: https://esbuild.github.io/plugins/#on-start-results */
// deno-lint-ignore no-empty-interface
export interface OnStartResult {
}
