import * as esbuild from "https://deno.land/x/esbuild@v0.19.11/mod.js";
import { denoPlugins } from "../mod.ts";

await esbuild.build({
  plugins: [...denoPlugins({})],
  entryPoints: ["./testdata/workspace/a/main.ts"],
  outfile: "./dist/bytes.esm.js",
  bundle: true,
  format: "esm",
});
esbuild.stop();
