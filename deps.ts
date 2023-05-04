import type * as esbuild from "https://deno.land/x/esbuild@v0.17.18/mod.d.ts";
export type { esbuild };
export {
  fromFileUrl,
  resolve,
  toFileUrl,
} from "https://deno.land/std@0.185.0/path/mod.ts";
export { basename, extname } from "https://deno.land/std@0.185.0/path/mod.ts";
export * as JSONC from "https://deno.land/std@0.185.0/jsonc/mod.ts";
export {
  resolveImportMap,
  resolveModuleSpecifier,
} from "https://deno.land/x/importmap@0.2.1/mod.ts";
export type {
  ImportMap,
  Scopes,
  SpecifierMap,
} from "https://deno.land/x/importmap@0.2.1/mod.ts";
