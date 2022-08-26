import * as esbuild from "https://deno.land/x/esbuild@v0.15.5/mod.js";
import { denoPlugin } from "https://deno.land/x/esbuild_deno_loader@0.5.2/mod.ts";

await esbuild.build({
  plugins: [denoPlugin()],
  entryPoints: ["https://deno.land/std@0.153.0/hash/sha1.ts"],
  outfile: "./dist/sha1.esm.js",
  bundle: true,
  format: "esm",
});
esbuild.stop();
