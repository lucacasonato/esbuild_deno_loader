import type * as esbuild from "https://deno.land/x/esbuild@v0.17.11/mod.d.ts";
export type { esbuild };
export {
  fromFileUrl,
  join,
  resolve,
  toFileUrl,
} from "https://deno.land/std@0.173.0/path/mod.ts";
export { basename, extname } from "https://deno.land/std@0.173.0/path/mod.ts";
export * as JSONC from "https://deno.land/std@0.173.0/encoding/jsonc.ts";
export {
  resolveImportMap,
  resolveModuleSpecifier,
} from "https://deno.land/x/importmap@0.2.1/mod.ts";
export type {
  ImportMap,
  Scopes,
  SpecifierMap,
} from "https://deno.land/x/importmap@0.2.1/mod.ts";
