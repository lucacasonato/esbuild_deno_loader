import type * as esbuild from "https://deno.land/x/esbuild@v0.17.19/mod.d.ts";
export type { esbuild };
export {
  dirname,
  fromFileUrl,
  join,
  resolve,
  toFileUrl,
} from "https://deno.land/std@0.173.0/path/mod.ts";
export { copy } from "https://deno.land/std@0.173.0/fs/mod.ts";
export { basename, extname } from "https://deno.land/std@0.173.0/path/mod.ts";
export * as JSONC from "https://deno.land/std@0.173.0/encoding/jsonc.ts";
export { encode as base32Encode } from "https://deno.land/std@0.173.0/encoding/base32.ts";
export {
  resolveImportMap,
  resolveModuleSpecifier,
} from "https://deno.land/x/importmap@0.2.1/mod.ts";
export type {
  ImportMap,
  Scopes,
  SpecifierMap,
} from "https://deno.land/x/importmap@0.2.1/mod.ts";
export { DenoDir } from "https://deno.land/x/deno_cache@0.4.1/mod.ts";

import sass from "https://deno.land/x/denosass@1.0.5/mod.ts";
export { sass };
