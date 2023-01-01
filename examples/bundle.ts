import * as esbuild from "https://deno.land/x/esbuild@v0.14.51/mod.js";
// import { denoPlugin } from "https://deno.land/x/esbuild_deno_loader@0.6.0/mod.ts";
import { denoPlugin } from "../mod.ts";

await esbuild.build({
  plugins: [denoPlugin()],
  entryPoints: ["./example.js"],
  outfile: "./dist/bundled.js",
  bundle: true,
  format: "esm",
});
esbuild.stop();
