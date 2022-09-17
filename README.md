# esbuild_deno_loader

Deno module resolution for `esbuild`.

## Example

This example bundles an entrypoint into a single ESM output.

```js
import * as esbuild from "https://deno.land/x/esbuild@v0.15.7/mod.js";
// Import as wasm on platforms that don't support `Deno.run`
// Such as deno deploy
// import * as esbuild from "https://deno.land/x/esbuild@v0.15.7/wasm.js";
import { denoPlugin } from "https://deno.land/x/esbuild_deno_loader@0.5.2/mod.ts";

const result = await esbuild.build({
  plugins: [denoPlugin()],
  entryPoints: ["https://deno.land/std@0.150.0/hash/sha1.ts"],
  outfile: "./dist/sha1.esm.js",
  bundle: true,
  format: "esm",
});

// When using wasm version
console.log(result.outputFiles);
esbuild.stop();
```

## Performance

If you wish to gain a boost in performance run your application with the
`--allow-run` flag. If you do not give this permission then the library will
fall back on using the wasm version of esbuild.
