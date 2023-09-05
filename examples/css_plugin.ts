import * as esbuild from "https://deno.land/x/esbuild@v0.17.19/mod.js";
import { denoPlugins } from "../mod.ts";
import { join, dirname } from "https://deno.land/std@0.200.0/path/mod.ts";

import { get } from "https://deno.land/x/emoji@0.2.1/mod.ts";

const deno_css_plugin: esbuild.Plugin = {
  name: "deno_css_plugin",
  setup(build) {
    build.onResolve({ filter: /\.css/ }, (args) => {
      console.log('deno_css_plugin, build.onResolve', args);
      return { path: join(args.resolveDir, args.path) };
    });
  },
};

// const importMap = {
//   imports: {
//     "wave-emoji": "emoji:waving_hand",
//   },
// };
// const importMapURL = `data:application/json,${JSON.stringify(importMap)}`;

const plugins1 = [deno_css_plugin, ...denoPlugins()];
const plugins2 = [deno_css_plugin];

const plugins3 = denoPlugins();
const plugins4 = [deno_css_plugin, plugins3[1]];
const plugins5 = [plugins3[0]];

const res = await esbuild.build({
  plugins: plugins3,
  entryPoints: ["../../src/css_test.tsx"],
  bundle: true,
  outdir: 'dist',
  format: 'esm',
});

console.log(res);

// console.log(res.outputFiles[0].text); // export default "\u{1F44B}";

// const { default: emoji } = await import(
//   "data:text/javascript," + res.outputFiles[0].text
// );
// console.log(emoji); // 👋

esbuild.stop();
