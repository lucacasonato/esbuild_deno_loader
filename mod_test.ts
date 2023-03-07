import { denoPlugin } from "./mod.ts";
import { esbuildNative, esbuildWasm } from "./test_deps.ts";
import { assert, assertEquals } from "./test_deps.ts";

const LOADERS = ["native", "portable"] as const;
const PLATFORMS = { "native": esbuildNative, "wasm": esbuildWasm };

const DEFAULT_OPTS = {
  write: false,
  format: "esm",
  // TODO(lucacasonato): remove when https://github.com/evanw/esbuild/pull/2968 is fixed
  absWorkingDir: Deno.cwd(),
} as const;

function test(
  name: string,
  loaders: readonly ("native" | "portable")[],
  fn: (
    esbuild: typeof esbuildNative,
    loader: "native" | "portable",
  ) => Promise<void>,
) {
  for (const [platform, esbuild] of Object.entries(PLATFORMS)) {
    for (const loader of loaders) {
      Deno.test({
        name: `[${loader}, ${platform}] ${name}`,
        ignore: platform === "wasm" && Deno.build.os === "windows",
        fn: async () => {
          try {
            await esbuild.initialize({});
            await fn(esbuild, loader);
          } finally {
            esbuild.stop();
          }
          // Let esbuild cleanup finish closing resources and cancelling async
          // tasks. This should take just 1 event loop tick.
          await new Promise((r) => setTimeout(r, 5));
        },
      });
    }
  }
}

test("remote ts", LOADERS, async (esbuild, loader) => {
  const res = await esbuild.build({
    ...DEFAULT_OPTS,
    plugins: [denoPlugin({ loader })],
    entryPoints: ["https://deno.land/std@0.173.0/collections/without_all.ts"],
  });
  assertEquals(res.warnings, []);
  assertEquals(res.errors, []);
  assertEquals(res.outputFiles.length, 1);
  const output = res.outputFiles[0];
  assertEquals(output.path, "<stdout>");
  const dataURL = `data:application/javascript;base64,${btoa(output.text)}`;
  const { withoutAll } = await import(dataURL);
  assertEquals(withoutAll([1, 2, 3], [2, 3, 4]), [1]);
});

test("local ts", LOADERS, async (esbuild, loader) => {
  const res = await esbuild.build({
    ...DEFAULT_OPTS,
    plugins: [denoPlugin({ loader })],
    entryPoints: ["./testdata/mod.ts"],
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

test("remote mts", LOADERS, async (esbuild, loader) => {
  const res = await esbuild.build({
    ...DEFAULT_OPTS,
    plugins: [denoPlugin({ loader })],
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

test("local mts", LOADERS, async (esbuild, loader) => {
  const res = await esbuild.build({
    ...DEFAULT_OPTS,
    plugins: [denoPlugin({ loader })],
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

test("remote js", LOADERS, async (esbuild, loader) => {
  const res = await esbuild.build({
    ...DEFAULT_OPTS,
    plugins: [denoPlugin({ loader })],
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

test("local js", LOADERS, async (esbuild, loader) => {
  const res = await esbuild.build({
    ...DEFAULT_OPTS,
    plugins: [denoPlugin({ loader })],
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

test("remote mjs", LOADERS, async (esbuild, loader) => {
  const res = await esbuild.build({
    ...DEFAULT_OPTS,
    plugins: [denoPlugin({ loader })],
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

test("local mjs", LOADERS, async (esbuild, loader) => {
  const res = await esbuild.build({
    ...DEFAULT_OPTS,
    plugins: [denoPlugin({ loader })],
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

test("remote jsx", LOADERS, async (esbuild, loader) => {
  const res = await esbuild.build({
    ...DEFAULT_OPTS,
    plugins: [denoPlugin({ loader })],
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

test("local jsx", LOADERS, async (esbuild, loader) => {
  const res = await esbuild.build({
    ...DEFAULT_OPTS,
    plugins: [denoPlugin({ loader })],
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

test("remote tsx", LOADERS, async (esbuild, loader) => {
  const res = await esbuild.build({
    ...DEFAULT_OPTS,
    plugins: [denoPlugin({ loader })],
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

test("local tsx", LOADERS, async (esbuild, loader) => {
  const res = await esbuild.build({
    ...DEFAULT_OPTS,
    plugins: [denoPlugin({ loader })],
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

test("bundle remote imports", LOADERS, async (esbuild, loader) => {
  const res = await esbuild.build({
    ...DEFAULT_OPTS,
    plugins: [denoPlugin({ loader })],
    bundle: true,
    platform: "neutral",
    entryPoints: ["https://deno.land/std@0.173.0/uuid/mod.ts"],
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

const importMapURL = new URL("./testdata/importmap.json", import.meta.url);

test("bundle import map", LOADERS, async (esbuild, loader) => {
  const res = await esbuild.build({
    ...DEFAULT_OPTS,
    plugins: [
      denoPlugin({ importMapURL, loader }),
    ],
    bundle: true,
    platform: "neutral",
    entryPoints: ["./testdata/importmap.js"],
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

test("local json", LOADERS, async (esbuild, loader) => {
  const res = await esbuild.build({
    ...DEFAULT_OPTS,
    plugins: [denoPlugin({ loader })],
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

test("remote http redirects are de-duped", ALL, async (loader) => {
  const res = await esbuild.build({
    plugins: [denoPlugin({ loader })],
    write: false,
    bundle: true,
    format: "esm",
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
