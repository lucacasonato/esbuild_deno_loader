import * as esbuild from "https://deno.land/x/esbuild@v0.17.19/mod.js";
import { denoPlugins } from "../mod.ts";

await esbuild.build({
  plugins: [...denoPlugins()],
  entryPoints: ["https://deno.land/std@0.185.0/bytes/mod.ts"],
  outdir: "./dist/",
  bundle: true,
  format: "esm",
});
esbuild.stop();
