import * as esbuild from "https://deno.land/x/esbuild@v0.17.11/mod.js";
import { denoPlugin } from "../mod.ts";

await esbuild.build({
  plugins: [denoPlugin()],
  entryPoints: ["https://deno.land/std@0.178.0/bytes/mod.ts"],
  outfile: "./dist/bytes.esm.js",
  bundle: true,
  format: "esm",
});
esbuild.stop();
