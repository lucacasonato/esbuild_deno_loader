import { type esbuild } from "./deps.ts";
import {
  denoPlugins,
  denoResolverPlugin,
  esbuildResolutionToURL,
} from "./mod.ts";
import { denoLoaderPlugin } from "./src/plugin_deno_loader.ts";
import { esbuildNative, esbuildWasm, join } from "./test_deps.ts";
import { assert, assertEquals, assertStringIncludes } from "./test_deps.ts";

await esbuildNative.initialize({});
await esbuildWasm.initialize({});

const LOADERS = ["native", "portable"] as const;
const PLATFORMS = { "native": esbuildNative, "wasm": esbuildWasm };

const DEFAULT_OPTS = {
  write: false,
  format: "esm",
  // TODO(lucacasonato): remove when https://github.com/evanw/esbuild/pull/2968 is fixed
  absWorkingDir: Deno.cwd(),
} as const;

async function testLoader(
  t: Deno.TestContext,
  loaders: readonly ("native" | "portable")[],
  fn: (
    esbuild: typeof esbuildNative,
    loader: "native" | "portable",
  ) => Promise<void>,
) {
  for (const [platform, esbuild] of Object.entries(PLATFORMS)) {
    for (const loader of loaders) {
      if (platform === "wasm" && Deno.build.os === "windows") continue;
      await t.step({
        name: `[${loader}, ${platform}]`,
        ignore: platform === "wasm" && Deno.build.os === "windows",
        fn: () => fn(esbuild, loader),
      });
    }
  }
}

Deno.test("remote ts", async (t) => {
  await testLoader(t, LOADERS, async (esbuild, loader) => {
    const res = await esbuild.build({
      ...DEFAULT_OPTS,
      plugins: [...denoPlugins({ loader })],
      entryPoints: ["https://deno.land/std@0.185.0/collections/without_all.ts"],
    });
    assertEquals(res.warnings, []);
    assertEquals(res.errors, []);
    assertEquals(res.errors, []);
    assertEquals(res.outputFiles.length, 1);
    const output = res.outputFiles[0];
    assertEquals(output.path, "<stdout>");
    const dataURL = `data:application/javascript;base64,${btoa(output.text)}`;
    const { withoutAll } = await import(dataURL);
    assertEquals(withoutAll([1, 2, 3], [2, 3, 4]), [1]);
  });
});

Deno.test("local ts", async (t) => {
  await testLoader(t, LOADERS, async (esbuild, loader) => {
    const res = await esbuild.build({
      ...DEFAULT_OPTS,
      plugins: [...denoPlugins({ loader })],
      entryPoints: ["./testdata/mod.ts"],
    });
    assertEquals(res.warnings, []);
    assertEquals(res.errors, []);
    assertEquals(res.errors, []);
    assertEquals(res.outputFiles.length, 1);
    const output = res.outputFiles[0];
    assertEquals(output.path, "<stdout>");
    const dataURL = `data:application/javascript;base64,${btoa(output.text)}`;
    const { bool } = await import(dataURL);
    assertEquals(bool, "asd2");
  });
});

Deno.test("remote mts", async (t) => {
  await testLoader(t, LOADERS, async (esbuild, loader) => {
    const res = await esbuild.build({
      ...DEFAULT_OPTS,
      plugins: [...denoPlugins({ loader })],
      entryPoints: [
        "https://gist.githubusercontent.com/lucacasonato/4ad57db57ee8d44e4ec08d6a912e93a7/raw/f33e698b4445a7243d72dbfe95afe2d004c7ffc6/mod.mts",
      ],
    });
    assertEquals(res.warnings, []);
    assertEquals(res.errors, []);
    assertEquals(res.outputFiles.length, 1);
    const output = res.outputFiles[0];
    assertEquals(output.path, "<stdout>");
    const dataURL = `data:application/javascript;base64,${btoa(output.text)}`;
    const { bool } = await import(dataURL);
    assertEquals(bool, "asd2");
  });
});

Deno.test("local mts", async (t) => {
  await testLoader(t, LOADERS, async (esbuild, loader) => {
    const res = await esbuild.build({
      ...DEFAULT_OPTS,
      plugins: [...denoPlugins({ loader })],
      entryPoints: ["./testdata/mod.mts"],
    });
    assertEquals(res.warnings, []);
    assertEquals(res.errors, []);
    assertEquals(res.outputFiles.length, 1);
    const output = res.outputFiles[0];
    assertEquals(output.path, "<stdout>");
    const dataURL = `data:application/javascript;base64,${btoa(output.text)}`;
    const { bool } = await import(dataURL);
    assertEquals(bool, "asd2");
  });
});

Deno.test("remote js", async (t) => {
  await testLoader(t, LOADERS, async (esbuild, loader) => {
    const res = await esbuild.build({
      ...DEFAULT_OPTS,
      plugins: [...denoPlugins({ loader })],
      entryPoints: ["https://crux.land/266TSp"],
    });
    assertEquals(res.warnings, []);
    assertEquals(res.errors, []);
    assertEquals(res.outputFiles.length, 1);
    const output = res.outputFiles[0];
    assertEquals(output.path, "<stdout>");
    const dataURL = `data:application/javascript;base64,${btoa(output.text)}`;
    const { bool } = await import(dataURL);
    assertEquals(bool, "asd");
  });
});

Deno.test("local js", async (t) => {
  await testLoader(t, LOADERS, async (esbuild, loader) => {
    const res = await esbuild.build({
      ...DEFAULT_OPTS,
      plugins: [...denoPlugins({ loader })],
      entryPoints: ["./testdata/mod.js"],
    });
    assertEquals(res.warnings, []);
    assertEquals(res.errors, []);
    assertEquals(res.outputFiles.length, 1);
    const output = res.outputFiles[0];
    assertEquals(output.path, "<stdout>");
    const dataURL = `data:application/javascript;base64,${btoa(output.text)}`;
    const { bool } = await import(dataURL);
    assertEquals(bool, "asd");
  });
});

Deno.test("remote mjs", async (t) => {
  await testLoader(t, LOADERS, async (esbuild, loader) => {
    const res = await esbuild.build({
      ...DEFAULT_OPTS,
      plugins: [...denoPlugins({ loader })],
      entryPoints: [
        "https://gist.githubusercontent.com/lucacasonato/4ad57db57ee8d44e4ec08d6a912e93a7/raw/f33e698b4445a7243d72dbfe95afe2d004c7ffc6/mod.mjs",
      ],
    });
    assertEquals(res.warnings, []);
    assertEquals(res.errors, []);
    assertEquals(res.outputFiles.length, 1);
    const output = res.outputFiles[0];
    assertEquals(output.path, "<stdout>");
    const dataURL = `data:application/javascript;base64,${btoa(output.text)}`;
    const { bool } = await import(dataURL);
    assertEquals(bool, "asd");
  });
});

Deno.test("local mjs", async (t) => {
  await testLoader(t, LOADERS, async (esbuild, loader) => {
    const res = await esbuild.build({
      ...DEFAULT_OPTS,
      plugins: [...denoPlugins({ loader })],
      entryPoints: ["./testdata/mod.mjs"],
    });
    assertEquals(res.warnings, []);
    assertEquals(res.errors, []);
    assertEquals(res.outputFiles.length, 1);
    const output = res.outputFiles[0];
    assertEquals(output.path, "<stdout>");
    const dataURL = `data:application/javascript;base64,${btoa(output.text)}`;
    const { bool } = await import(dataURL);
    assertEquals(bool, "asd");
  });
});

Deno.test("remote jsx", async (t) => {
  await testLoader(t, LOADERS, async (esbuild, loader) => {
    const res = await esbuild.build({
      ...DEFAULT_OPTS,
      plugins: [...denoPlugins({ loader })],
      entryPoints: ["https://crux.land/GeaWJ"],
    });
    assertEquals(res.warnings, []);
    assertEquals(res.errors, []);
    assertEquals(res.outputFiles.length, 1);
    const output = res.outputFiles[0];
    assertEquals(output.path, "<stdout>");
    const dataURL = `data:application/javascript;base64,${btoa(output.text)}`;
    const m = await import(dataURL);
    assertEquals(m.default, "foo");
  });
});

Deno.test("local jsx", async (t) => {
  await testLoader(t, LOADERS, async (esbuild, loader) => {
    const res = await esbuild.build({
      ...DEFAULT_OPTS,
      plugins: [...denoPlugins({ loader })],
      entryPoints: ["./testdata/mod.jsx"],
    });
    assertEquals(res.warnings, []);
    assertEquals(res.errors, []);
    assertEquals(res.outputFiles.length, 1);
    const output = res.outputFiles[0];
    assertEquals(output.path, "<stdout>");
    const dataURL = `data:application/javascript;base64,${btoa(output.text)}`;
    const m = await import(dataURL);
    assertEquals(m.default, "foo");
  });
});

Deno.test("remote tsx", async (t) => {
  await testLoader(t, LOADERS, async (esbuild, loader) => {
    const res = await esbuild.build({
      ...DEFAULT_OPTS,
      plugins: [...denoPlugins({ loader })],
      entryPoints: ["https://crux.land/2Qjyo7"],
    });
    assertEquals(res.warnings, []);
    assertEquals(res.errors, []);
    assertEquals(res.outputFiles.length, 1);
    const output = res.outputFiles[0];
    assertEquals(output.path, "<stdout>");
    const dataURL = `data:application/javascript;base64,${btoa(output.text)}`;
    const m = await import(dataURL);
    assertEquals(m.default, "foo");
  });
});

Deno.test("local tsx", async (t) => {
  await testLoader(t, LOADERS, async (esbuild, loader) => {
    const res = await esbuild.build({
      ...DEFAULT_OPTS,
      plugins: [...denoPlugins({ loader })],
      entryPoints: ["./testdata/mod.tsx"],
    });
    assertEquals(res.warnings, []);
    assertEquals(res.errors, []);
    assertEquals(res.outputFiles.length, 1);
    const output = res.outputFiles[0];
    assertEquals(output.path, "<stdout>");
    const dataURL = `data:application/javascript;base64,${btoa(output.text)}`;
    const m = await import(dataURL);
    assertEquals(m.default, "foo");
  });
});

Deno.test("bundle remote imports", async (t) => {
  await testLoader(t, LOADERS, async (esbuild, loader) => {
    const res = await esbuild.build({
      ...DEFAULT_OPTS,
      plugins: [...denoPlugins({ loader })],
      bundle: true,
      platform: "neutral",
      entryPoints: ["https://deno.land/std@0.185.0/uuid/mod.ts"],
    });
    assertEquals(res.warnings, []);
    assertEquals(res.errors, []);
    assertEquals(res.outputFiles.length, 1);
    const output = res.outputFiles[0];
    assertEquals(output.path, "<stdout>");
    const dataURL = `data:application/javascript;base64,${btoa(output.text)}`;
    const { v1 } = await import(dataURL);
    assert(v1.validate(v1.generate()));
  });
});

Deno.test("local json", async (t) => {
  await testLoader(t, LOADERS, async (esbuild, loader) => {
    const res = await esbuild.build({
      ...DEFAULT_OPTS,
      plugins: [...denoPlugins({ loader })],
      entryPoints: ["./testdata/data.json"],
    });
    assertEquals(res.warnings, []);
    assertEquals(res.errors, []);
    assertEquals(res.outputFiles.length, 1);
    const output = res.outputFiles[0];
    assertEquals(output.path, "<stdout>");
    const dataURL = `data:application/javascript;base64,${btoa(output.text)}`;
    const { default: data } = await import(dataURL);
    assertEquals(data, {
      "hello": "world",
      ["__proto__"]: {
        "sky": "universe",
      },
    });
  });
});

Deno.test("npm specifiers global resolver - preact", async (t) => {
  await testLoader(t, ["native"], async (esbuild, loader) => {
    if (esbuild === PLATFORMS.wasm) return;
    const res = await esbuild.build({
      ...DEFAULT_OPTS,
      plugins: [...denoPlugins({ loader })],
      bundle: true,
      entryPoints: ["./testdata/npm/preact.tsx"],
    });
    assertEquals(res.warnings, []);
    assertEquals(res.errors, []);
    assertEquals(res.outputFiles.length, 1);
    const output = res.outputFiles[0];
    assertEquals(output.path, "<stdout>");
    assert(!output.text.includes(`npm:`));
    const dataURL = `data:application/javascript;base64,${btoa(output.text)}`;
    const { default: html } = await import(dataURL);
    assertEquals(html, "<div>hello world</div>");
  });
});

Deno.test("npm specifiers global resolver - react", async (t) => {
  await testLoader(t, ["native"], async (esbuild, loader) => {
    if (esbuild === PLATFORMS.wasm) return;
    const res = await esbuild.build({
      ...DEFAULT_OPTS,
      plugins: [...denoPlugins({ loader })],
      bundle: true,
      entryPoints: ["./testdata/npm/react.tsx"],
    });
    assertEquals(res.warnings, []);
    assertEquals(res.errors, []);
    assertEquals(res.outputFiles.length, 1);
    const output = res.outputFiles[0];
    assertEquals(output.path, "<stdout>");
    assert(!output.text.includes(`npm:`));
    const dataURL = `data:application/javascript;base64,${btoa(output.text)}`;
    const { default: html } = await import(dataURL);
    assertEquals(html, "<div>hello world</div>");
  });
});

Deno.test("npm specifiers global resolver - @preact/signals", async (t) => {
  await testLoader(t, ["native"], async (esbuild, loader) => {
    if (esbuild === PLATFORMS.wasm) return;
    const res = await esbuild.build({
      ...DEFAULT_OPTS,
      plugins: [...denoPlugins({ loader })],
      bundle: true,
      entryPoints: ["./testdata/npm/preact-signals.ts"],
    });
    assertEquals(res.warnings, []);
    assertEquals(res.errors, []);
    assertEquals(res.outputFiles.length, 1);
    const output = res.outputFiles[0];
    assertEquals(output.path, "<stdout>");
    assert(!output.text.includes(`npm:`));
    const dataURL = `data:application/javascript;base64,${btoa(output.text)}`;
    const { default: signal } = await import(dataURL);
    assertEquals(signal.value, 0);
  });
});

Deno.test("npm specifiers global resolver - is-number", async (t) => {
  await testLoader(t, ["native"], async (esbuild, loader) => {
    if (esbuild === PLATFORMS.wasm) return;
    const res = await esbuild.build({
      ...DEFAULT_OPTS,
      plugins: [...denoPlugins({ loader })],
      bundle: true,
      entryPoints: ["npm:is-number"],
    });
    assertEquals(res.warnings, []);
    assertEquals(res.errors, []);
    assertEquals(res.outputFiles.length, 1);
    const output = res.outputFiles[0];
    assertEquals(output.path, "<stdout>");
    assert(!output.text.includes(`npm:`));
    const dataURL = `data:application/javascript;base64,${btoa(output.text)}`;
    const { default: isNumber } = await import(dataURL);
    assertEquals(isNumber(1), true);
  });
});

Deno.test("npm specifiers global resolver - @oramacloud/client", async (t) => {
  await testLoader(t, ["native"], async (esbuild, loader) => {
    if (esbuild === PLATFORMS.wasm) return;
    const res = await esbuild.build({
      ...DEFAULT_OPTS,
      plugins: [...denoPlugins({ loader })],
      bundle: true,
      entryPoints: ["./testdata/npm/oramacloud.ts"],
    });
    assertEquals(res.warnings, []);
    assertEquals(res.errors, []);
    assertEquals(res.outputFiles.length, 1);
    const output = res.outputFiles[0];
    assertEquals(output.path, "<stdout>");
    assert(!output.text.includes(`npm:`));
    const dataURL = `data:application/javascript;base64,${btoa(output.text)}`;
    const { OramaClient } = await import(dataURL);
    assertEquals(typeof OramaClient, "function");
  });
});

Deno.test("npm specifiers global resolver - typo-js", async (t) => {
  await testLoader(t, ["native"], async (esbuild, loader) => {
    if (esbuild === PLATFORMS.wasm) return;
    const res = await esbuild.build({
      ...DEFAULT_OPTS,
      plugins: [...denoPlugins({ loader })],
      bundle: true,
      entryPoints: ["npm:typo-js"],
    });
    assertEquals(res.warnings, []);
    assertEquals(res.errors, []);
    assertEquals(res.outputFiles.length, 1);
    const output = res.outputFiles[0];
    assertEquals(output.path, "<stdout>");
    assert(!output.text.includes(`npm:`));
    const dataURL = `data:application/javascript;base64,${btoa(output.text)}`;
    const { default: Typo } = await import(dataURL);
    assertEquals(typeof Typo, "function");
  });
});

Deno.test("npm specifiers global resolver - express", async (t) => {
  await testLoader(t, ["native"], async (esbuild, loader) => {
    if (esbuild === PLATFORMS.wasm) return;
    const res = await esbuild.build({
      ...DEFAULT_OPTS,
      plugins: [...denoPlugins({ loader })],
      bundle: true,
      entryPoints: ["npm:express@4"],
      platform: "node",
    });
    assertEquals(res.warnings, []);
    assertEquals(res.errors, []);
    assertEquals(res.outputFiles.length, 1);
    const output = res.outputFiles[0];
    assertEquals(output.path, "<stdout>");
    assert(!output.text.includes(`npm:`));
    const blobURL = URL.createObjectURL(
      new Blob([
        "import { createRequire } from 'node:module';\nimport process from 'node:process';\nconst require = createRequire('file:///');\n",
        output.text,
      ], { type: "text/javascript" }),
    );
    const { default: express } = await import(blobURL);
    URL.revokeObjectURL(blobURL);
    assertEquals(typeof express, "function");
  });
});

Deno.test("npm specifiers local resolver - preact", async (t) => {
  await testLoader(t, LOADERS, async (esbuild, loader) => {
    if (esbuild === PLATFORMS.wasm) return;
    const entryPoint =
      new URL("./testdata/npm/preact.tsx", import.meta.url).href;
    const tmp = Deno.makeTempDirSync();
    if (loader === "portable") {
      new Deno.Command(Deno.execPath(), {
        args: ["cache", "--node-modules-dir", entryPoint],
        cwd: tmp,
      }).outputSync();
    }
    const res = await esbuild.build({
      ...DEFAULT_OPTS,
      plugins: [...denoPlugins({ loader, nodeModulesDir: true })],
      bundle: true,
      absWorkingDir: tmp,
      entryPoints: [entryPoint],
    });
    assertEquals(res.warnings, []);
    assertEquals(res.errors, []);
    assertEquals(res.outputFiles.length, 1);
    const output = res.outputFiles[0];
    assertEquals(output.path, "<stdout>");
    assert(!output.text.includes(`npm:`));
    const dataURL = `data:application/javascript;base64,${btoa(output.text)}`;
    const { default: html } = await import(dataURL);
    assertEquals(html, "<div>hello world</div>");
  });
});

Deno.test("npm specifiers local resolver - react", async (t) => {
  await testLoader(t, LOADERS, async (esbuild, loader) => {
    if (esbuild === PLATFORMS.wasm) return;
    const tmp = Deno.makeTempDirSync();
    const entryPoint =
      new URL("./testdata/npm/preact.tsx", import.meta.url).href;
    if (loader === "portable") {
      new Deno.Command(Deno.execPath(), {
        args: ["cache", "--node-modules-dir", entryPoint],
        cwd: tmp,
      }).outputSync();
    }
    const res = await esbuild.build({
      ...DEFAULT_OPTS,
      plugins: [...denoPlugins({ loader, nodeModulesDir: true })],
      bundle: true,
      absWorkingDir: tmp,
      entryPoints: [entryPoint],
    });
    assertEquals(res.warnings, []);
    assertEquals(res.errors, []);
    assertEquals(res.outputFiles.length, 1);
    const output = res.outputFiles[0];
    assertEquals(output.path, "<stdout>");
    assert(!output.text.includes(`npm:`));
    const dataURL = `data:application/javascript;base64,${btoa(output.text)}`;
    const { default: html } = await import(dataURL);
    assertEquals(html, "<div>hello world</div>");
  });
});

Deno.test("npm specifiers local resolver - @preact/signals", async (t) => {
  await testLoader(t, LOADERS, async (esbuild, loader) => {
    if (esbuild === PLATFORMS.wasm) return;
    const entryPoint =
      new URL("./testdata/npm/preact-signals.ts", import.meta.url).href;
    const tmp = Deno.makeTempDirSync();
    if (loader === "portable") {
      new Deno.Command(Deno.execPath(), {
        args: ["cache", "--node-modules-dir", entryPoint],
        cwd: tmp,
      }).outputSync();
    }
    const res = await esbuild.build({
      ...DEFAULT_OPTS,
      plugins: [...denoPlugins({ loader, nodeModulesDir: true })],
      bundle: true,
      absWorkingDir: tmp,
      entryPoints: [entryPoint],
    });
    assertEquals(res.warnings, []);
    assertEquals(res.errors, []);
    assertEquals(res.outputFiles.length, 1);
    const output = res.outputFiles[0];
    assertEquals(output.path, "<stdout>");
    assert(!output.text.includes(`npm:`));
    const dataURL = `data:application/javascript;base64,${btoa(output.text)}`;
    const { default: signal } = await import(dataURL);
    assertEquals(signal.value, 0);
  });
});

Deno.test("npm specifiers local resolver - @oramacloud/client", async (t) => {
  await testLoader(t, LOADERS, async (esbuild, loader) => {
    if (esbuild === PLATFORMS.wasm) return;
    const entryPoint =
      new URL("./testdata/npm/oramacloud.ts", import.meta.url).href;
    const tmp = Deno.makeTempDirSync();
    if (loader === "portable") {
      new Deno.Command(Deno.execPath(), {
        args: ["cache", "--node-modules-dir", entryPoint],
        cwd: tmp,
      }).outputSync();
    }
    const res = await esbuild.build({
      ...DEFAULT_OPTS,
      plugins: [...denoPlugins({ loader, nodeModulesDir: true })],
      bundle: true,
      absWorkingDir: tmp,
      entryPoints: [entryPoint],
    });
    assertEquals(res.warnings, []);
    assertEquals(res.errors, []);
    assertEquals(res.outputFiles.length, 1);
    const output = res.outputFiles[0];
    assertEquals(output.path, "<stdout>");
    assert(!output.text.includes(`npm:`));
    const dataURL = `data:application/javascript;base64,${btoa(output.text)}`;
    const { OramaClient } = await import(dataURL);
    assertEquals(typeof OramaClient, "function");
  });
});

Deno.test("npm specifiers local resolver - typo-js", async (t) => {
  await testLoader(t, ["portable"], async (esbuild, loader) => {
    if (esbuild === PLATFORMS.wasm) return;
    const tmp = Deno.makeTempDirSync();
    if (loader === "portable") {
      new Deno.Command(Deno.execPath(), {
        args: ["cache", "--node-modules-dir", "npm:typo-js"],
        cwd: tmp,
      }).outputSync();
    }
    const res = await esbuild.build({
      ...DEFAULT_OPTS,
      plugins: [...denoPlugins({ loader, nodeModulesDir: true })],
      bundle: true,
      absWorkingDir: tmp,
      entryPoints: ["npm:typo-js"],
    });
    assertEquals(res.warnings, []);
    assertEquals(res.errors, []);
    assertEquals(res.outputFiles.length, 1);
    const output = res.outputFiles[0];
    assertEquals(output.path, "<stdout>");
    assert(output.text.includes(`require("fs")`));
    const dataURL = `data:application/javascript;base64,${btoa(output.text)}`;
    const { default: Typo } = await import(dataURL);
    assertEquals(typeof Typo, "function");
  });
});

Deno.test("npm specifiers local resolver - express", async (t) => {
  await testLoader(t, ["portable"], async (esbuild, loader) => {
    if (esbuild === PLATFORMS.wasm) return;
    const tmp = Deno.makeTempDirSync();
    if (loader === "portable") {
      new Deno.Command(Deno.execPath(), {
        args: ["cache", "--node-modules-dir", "npm:express@4"],
        cwd: tmp,
      }).outputSync();
    }
    const res = await esbuild.build({
      ...DEFAULT_OPTS,
      plugins: [...denoPlugins({ loader, nodeModulesDir: true })],
      bundle: true,
      absWorkingDir: tmp,
      entryPoints: ["npm:express@4"],
      platform: "node",
    });
    assertEquals(res.warnings, []);
    assertEquals(res.errors, []);
    assertEquals(res.outputFiles.length, 1);
    const output = res.outputFiles[0];
    assertEquals(output.path, "<stdout>");
    const blobURL = URL.createObjectURL(
      new Blob([
        "import { createRequire } from 'node:module';\nimport process from 'node:process';\nconst require = createRequire('file:///');\n",
        output.text,
      ], { type: "text/javascript" }),
    );
    const { default: express } = await import(blobURL);
    URL.revokeObjectURL(blobURL);
    assertEquals(typeof express, "function");
  });
});

Deno.test("remote http redirects are de-duped", async (t) => {
  await testLoader(t, LOADERS, async (esbuild, loader) => {
    const res = await esbuild.build({
      ...DEFAULT_OPTS,
      plugins: [...denoPlugins({ loader })],
      bundle: true,
      entryPoints: ["./testdata/remote_redirects.js"],
    });
    assertEquals(res.warnings, []);
    assertEquals(res.errors, []);
    assertEquals(res.outputFiles.length, 1);
    const output = res.outputFiles[0];
    assertEquals(output.path, "<stdout>");
    const matches = [...output.text.matchAll(/0\.178\.0/g)];
    assertEquals(matches.length, 2); // once in the comment, once in the code
  });
});

const importMapURL =
  new URL("./testdata/import_map.json", import.meta.url).href;

Deno.test("bundle explicit import map", async (t) => {
  await testLoader(t, LOADERS, async (esbuild, loader) => {
    const res = await esbuild.build({
      ...DEFAULT_OPTS,
      plugins: [
        ...denoPlugins({ importMapURL, loader }),
      ],
      bundle: true,
      platform: "neutral",
      entryPoints: ["./testdata/mapped.js"],
    });
    assertEquals(res.warnings, []);
    assertEquals(res.errors, []);
    assertEquals(res.outputFiles.length, 1);
    const output = res.outputFiles[0];
    assertEquals(output.path, "<stdout>");
    const dataURL = `data:application/javascript;base64,${btoa(output.text)}`;
    const { bool } = await import(dataURL);
    assertEquals(bool, "asd2");
  });
});

Deno.test("bundle config inline import map", async (t) => {
  await testLoader(t, LOADERS, async (esbuild, loader) => {
    const configPath = join(Deno.cwd(), "testdata", "config_inline.jsonc");
    const res = await esbuild.build({
      ...DEFAULT_OPTS,
      plugins: [
        ...denoPlugins({ configPath, loader }),
      ],
      bundle: true,
      platform: "neutral",
      entryPoints: ["./testdata/mapped.js"],
    });
    assertEquals(res.warnings, []);
    assertEquals(res.errors, []);
    assertEquals(res.outputFiles.length, 1);
    const output = res.outputFiles[0];
    assertEquals(output.path, "<stdout>");
    const dataURL = `data:application/javascript;base64,${btoa(output.text)}`;
    const { bool } = await import(dataURL);
    assertEquals(bool, "asd2");
  });
});

Deno.test("bundle config ref import map", async (t) => {
  await testLoader(t, LOADERS, async (esbuild, loader) => {
    const configPath = join(Deno.cwd(), "testdata", "config_ref.json");
    const res = await esbuild.build({
      ...DEFAULT_OPTS,
      plugins: [
        ...denoPlugins({ configPath, loader }),
      ],
      bundle: true,
      platform: "neutral",
      entryPoints: ["./testdata/mapped.js"],
    });
    assertEquals(res.warnings, []);
    assertEquals(res.errors, []);
    assertEquals(res.outputFiles.length, 1);
    const output = res.outputFiles[0];
    assertEquals(output.path, "<stdout>");
    const dataURL = `data:application/javascript;base64,${btoa(output.text)}`;
    const { bool } = await import(dataURL);
    assertEquals(bool, "asd2");
  });
});

Deno.test("bundle config inline import map with expansion", async (t) => {
  await testLoader(t, LOADERS, async (esbuild, loader) => {
    const configPath = join(
      Deno.cwd(),
      "testdata",
      "config_inline_expansion.json",
    );
    const res = await esbuild.build({
      ...DEFAULT_OPTS,
      plugins: [
        ...denoPlugins({ configPath, loader }),
      ],
      bundle: true,
      platform: "neutral",
      entryPoints: ["./testdata/mapped_jsr.js"],
    });
    assertEquals(res.warnings, []);
    assertEquals(res.errors, []);
    assertEquals(res.outputFiles.length, 1);
    const output = res.outputFiles[0];
    assertEquals(output.path, "<stdout>");
    const dataURL = `data:application/javascript;base64,${btoa(output.text)}`;
    const ns = await import(dataURL);
    assertEquals(ns.join("a", "b"), join("a", "b"));
  });
});

const COMPUTED_PLUGIN: esbuild.Plugin = {
  name: "computed",
  setup(build) {
    build.onResolve({ filter: /.*/, namespace: "computed" }, (args) => {
      return { path: args.path, namespace: "computed" };
    });
    build.onLoad({ filter: /.*/, namespace: "computed" }, (args) => {
      const url = esbuildResolutionToURL(args);
      return { contents: `export default ${url.pathname};`, loader: "js" };
    });
  },
};

Deno.test("custom plugin for scheme", async (t) => {
  +await testLoader(t, LOADERS, async (esbuild, loader) => {
    const res = await esbuild.build({
      ...DEFAULT_OPTS,
      plugins: [
        denoResolverPlugin(),
        COMPUTED_PLUGIN,
        denoLoaderPlugin({ loader }),
      ],
      entryPoints: ["computed:1+2"],
    });
    assertEquals(res.warnings, []);
    assertEquals(res.errors, []);
    assertEquals(res.outputFiles.length, 1);
    const output = res.outputFiles[0];
    assertEquals(output.path, "<stdout>");
    const dataURL = `data:application/javascript;base64,${btoa(output.text)}`;
    const { default: sum } = await import(dataURL);
    assertEquals(sum, 3);
  });
});

Deno.test("custom plugin for scheme with import map", async (t) => {
  await testLoader(t, LOADERS, async (esbuild, loader) => {
    const res = await esbuild.build({
      ...DEFAULT_OPTS,
      plugins: [
        denoResolverPlugin({ importMapURL }),
        COMPUTED_PLUGIN,
        denoLoaderPlugin({ importMapURL, loader }),
      ],
      bundle: true,
      entryPoints: ["./testdata/mapped-computed.js"],
    });
    assertEquals(res.warnings, []);
    assertEquals(res.errors, []);
    assertEquals(res.outputFiles.length, 1);
    const output = res.outputFiles[0];
    assertEquals(output.path, "<stdout>");
    const dataURL = `data:application/javascript;base64,${btoa(output.text)}`;
    const { default: sum } = await import(dataURL);
    assertEquals(sum, 3);
  });
});

Deno.test("uncached data url", async (t) => {
  await testLoader(t, LOADERS, async (esbuild, loader) => {
    const configPath = join(Deno.cwd(), "testdata", "config_ref.json");
    const rand = Math.random();
    const res = await esbuild.build({
      ...DEFAULT_OPTS,
      plugins: [
        ...denoPlugins({ configPath, loader }),
      ],
      bundle: true,
      platform: "neutral",
      entryPoints: [
        `data:application/javascript;base64,${
          btoa(`export const value = ${rand};`)
        }`,
      ],
    });
    assertEquals(res.warnings, []);
    assertEquals(res.errors, []);
    assertEquals(res.outputFiles.length, 1);
    const output = res.outputFiles[0];
    assertEquals(output.path, "<stdout>");
    const dataURL = `data:application/javascript;base64,${btoa(output.text)}`;
    const { value } = await import(dataURL);
    assertEquals(value, rand);
  });
});

Deno.test("externals", async (t) => {
  await testLoader(t, LOADERS, async (esbuild, loader) => {
    const configPath = join(Deno.cwd(), "testdata", "config_ref.json");
    const res = await esbuild.build({
      ...DEFAULT_OPTS,
      plugins: [
        ...denoPlugins({ configPath, loader }),
      ],
      bundle: true,
      platform: "neutral",
      entryPoints: ["./testdata/externals.ts"],
      external: ["foo:bar", "foo:baz/*", "bar"],
    });
    assertEquals(res.warnings, []);
    assertEquals(res.errors, []);
    assertEquals(res.outputFiles.length, 1);
    const output = res.outputFiles[0];
    assertStringIncludes(output.text, "foo:bar");
    assertStringIncludes(output.text, "foo:baz/bar");
  });
});

Deno.test("jsr specifiers - auto discovered lock file", async (t) => {
  await testLoader(t, LOADERS, async (esbuild, loader) => {
    const configPath = join(Deno.cwd(), "testdata", "jsr", "deno.json");
    const res = await esbuild.build({
      ...DEFAULT_OPTS,
      plugins: [...denoPlugins({ loader, configPath })],
      bundle: true,
      platform: "neutral",
      entryPoints: ["jsr:@std/path@^0.213"],
    });
    assertEquals(res.warnings, []);
    assertEquals(res.errors, []);
    assertEquals(res.outputFiles.length, 1);
    const output = res.outputFiles[0];
    assertStringIncludes(
      output.text,
      "https://jsr.io/@std/path/0.213.1/mod.ts",
    );
    const ns = await import(
      `data:application/javascript;base64,${btoa(output.text)}`
    );
    assertEquals(ns.join("a", "b"), join("a", "b"));
  });
});

Deno.test("jsr specifiers - lock file referenced in deno.json", async (t) => {
  await testLoader(t, LOADERS, async (esbuild, loader) => {
    const configPath = join(Deno.cwd(), "testdata", "jsr_deno.json");
    const res = await esbuild.build({
      ...DEFAULT_OPTS,
      plugins: [...denoPlugins({ loader, configPath })],
      bundle: true,
      platform: "neutral",
      entryPoints: ["jsr:@std/path@^0.213"],
    });
    assertEquals(res.warnings, []);
    assertEquals(res.errors, []);
    assertEquals(res.outputFiles.length, 1);
    const output = res.outputFiles[0];
    assertStringIncludes(
      output.text,
      "https://jsr.io/@std/path/0.213.1/mod.ts",
    );
    const ns = await import(
      `data:application/javascript;base64,${btoa(output.text)}`
    );
    assertEquals(ns.join("a", "b"), join("a", "b"));
  });
});

Deno.test("jsr specifiers - no lockfile", async (t) => {
  await testLoader(t, ["native"], async (esbuild, loader) => {
    const tmp = Deno.makeTempDirSync();
    const res = await esbuild.build({
      ...DEFAULT_OPTS,
      plugins: [...denoPlugins({ loader })],
      bundle: true,
      platform: "neutral",
      entryPoints: ["jsr:@std/path@0.213.1"],
      absWorkingDir: tmp,
    });
    assertEquals(res.warnings, []);
    assertEquals(res.errors, []);
    assertEquals(res.outputFiles.length, 1);
    const output = res.outputFiles[0];
    assertStringIncludes(
      output.text,
      "https://jsr.io/@std/path/0.213.1/mod.ts",
    );
    const ns = await import(
      `data:application/javascript;base64,${btoa(output.text)}`
    );
    assertEquals(ns.join("a", "b"), join("a", "b"));
  });
});
