import * as esbuild from "https://deno.land/x/esbuild@v0.19.2/mod.d.ts";

async function runEsbuild() {
  const result = await esbuild.build({
    //
    plugins
  });
}

Deno.test("Native - npm", async () => {
  console.log("hey");
});
