import type * as esbuild from "./esbuild_types.ts";
import { toFileUrl } from "@std/path";
import {
  findWorkspace,
  isNodeModulesResolution,
  urlToEsbuildResolution,
} from "./shared.ts";
import type { WasmWorkspaceResolver } from "./wasm/loader.generated.js";

/** Options for the {@link denoResolverPlugin}. */
export interface DenoResolverPluginOptions {
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
}

/**
 * The Deno resolver plugin performs relative->absolute specifier resolution
 * and import map resolution.
 *
 * If using the {@link denoLoaderPlugin}, this plugin must be used before the
 * loader plugin.
 */
export function denoResolverPlugin(
  options: DenoResolverPluginOptions = {},
): esbuild.Plugin {
  return {
    name: "deno-resolver",
    setup(build) {
      let resolver: WasmWorkspaceResolver | null = null;

      const externalRegexps: RegExp[] = (build.initialOptions.external ?? [])
        .map((external) => {
          const regexp = new RegExp(
            "^" + external.replace(/[-/\\^$+?.()|[\]{}]/g, "\\$&").replace(
              /\*/g,
              ".*",
            ) + "$",
          );
          return regexp;
        });

      build.onStart(async function onStart() {
        const cwd = build.initialOptions.absWorkingDir ?? Deno.cwd();

        const workspace = findWorkspace(
          cwd,
          build.initialOptions.entryPoints,
          options.configPath,
        );
        try {
          const importMapURL: string | undefined = options.importMapURL;
          let importMapValue: unknown | undefined;
          if (importMapURL !== undefined) {
            // If we have an import map URL, fetch it and parse it.
            const resp = await fetch(importMapURL);
            importMapValue = await resp.json();
          }

          resolver?.free();
          resolver = null;
          resolver = workspace.resolver(importMapURL, importMapValue);
        } finally {
          workspace.free();
        }
      });

      build.onResolve({ filter: /.*/ }, async function onResolve(args) {
        // Pass through any node_modules internal resolution.
        if (isNodeModulesResolution(args)) {
          return undefined;
        }

        // The first pass resolver performs synchronous resolution. This
        // includes relative to absolute specifier resolution and import map
        // resolution.

        // We have to first determine the referrer URL to use when resolving
        // the specifier. This is either the importer URL, or the resolveDir
        // URL if the importer is not specified (ie if the specifier is at the
        // root).
        let referrer: URL;
        if (args.importer !== "") {
          if (args.namespace === "") {
            throw new Error("[assert] namespace is empty");
          }
          referrer = new URL(`${args.namespace}:${args.importer}`);
        } else if (args.resolveDir !== "") {
          referrer = new URL(`${toFileUrl(args.resolveDir).href}/`);
        } else {
          return undefined;
        }

        // We can then resolve the specifier relative to the referrer URL, using
        // the workspace resolver.
        const resolved = new URL(
          resolver!.resolve(args.path, referrer.href),
        );

        for (const externalRegexp of externalRegexps) {
          if (externalRegexp.test(resolved.href)) {
            return {
              path: resolved.href,
              external: true,
            };
          }
        }

        // Now pass the resolved specifier back into the resolver, for a second
        // pass. Now plugins can perform any resolution they want on the fully
        // resolved specifier.
        const { path, namespace } = urlToEsbuildResolution(resolved);
        const res = await build.resolve(path, {
          namespace,
          kind: args.kind,
        });
        return res;
      });
    },
  };
}
