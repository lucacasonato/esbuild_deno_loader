import * as esbuild from "https://deno.land/x/esbuild@v0.19.11/mod.js";
import { denoPlugins } from "../mod.ts";

import { get } from "https://deno.land/x/emoji@0.3.0/mod.ts";

const EMOJI_PLUGIN: esbuild.Plugin = {
  name: "emoji",
  setup(build) {
    build.onResolve({ filter: /.*/, namespace: "emoji" }, (args) => {
      return { path: args.path, namespace: "emoji" };
    });

    build.onLoad({ filter: /.*/, namespace: "emoji" }, (args) => {
      return {
        contents: `export default "${get(args.path)}";`,
        loader: "ts",
      };
    });
  },
};

const importMap = {
  imports: {
    "wave-emoji": "emoji:waving_hand",
  },
};
const importMapURL = `data:application/json,${JSON.stringify(importMap)}`;

const res = await esbuild.build({
  plugins: [...denoPlugins({ importMapURL }), EMOJI_PLUGIN],
  entryPoints: ["wave-emoji"],
  write: false,
});
console.log(res.outputFiles[0].text); // export default "\u{1F44B}";
const { default: emoji } = await import(
  "data:text/javascript," + res.outputFiles[0].text
);
console.log(emoji); // 👋
esbuild.stop();
