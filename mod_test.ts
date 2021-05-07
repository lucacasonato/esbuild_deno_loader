import { denoPlugin } from "./mod.ts";
import { esbuild } from "./test_deps.ts";
import { assert, assertEquals } from "./test_deps.ts";

const ALL = ["native", "portable"] as const;
const ONLY_NATIVE = ["native"] as const;

function test(
  name: string,
  loaders: readonly ("native" | "portable")[],
  fn: (loader: "native" | "portable") => Promise<void>,
) {
  for (const loader of loaders) {
    Deno.test(`[${loader}] ${name}`, async () => {
      try {
        await esbuild.initialize({});
        await fn(loader);
      } finally {
        esbuild.stop();
      }
    });
  }
}

test("remote ts", ALL, async (loader) => {
  const res = await esbuild.build({
    plugins: [denoPlugin({ loader })],
    write: false,
    entryPoints: ["https://deno.land/std@0.95.0/hash/sha1.ts"],
  });
  assertEquals(res.warnings, []);
  assertEquals(res.outputFiles.length, 1);
  const output = res.outputFiles[0];
  assertEquals(output.path, "<stdout>");
  const dataURL = `data:application/javascript;base64,${btoa(output.text)}`;
  const { Sha1 } = await import(dataURL);
  const sha = new Sha1();
  sha.update("foobar");
  const digest = sha.hex();
  assertEquals(digest, "8843d7f92416211de9ebb963ff4ce28125932878");
});

test("local ts", ONLY_NATIVE, async (loader) => {
  const res = await esbuild.build({
    plugins: [denoPlugin({ loader })],
    write: false,
    entryPoints: ["./testdata/mod.ts"],
  });
  assertEquals(res.warnings, []);
  assertEquals(res.outputFiles.length, 1);
  const output = res.outputFiles[0];
  assertEquals(output.path, "<stdout>");
  const dataURL = `data:application/javascript;base64,${btoa(output.text)}`;
  const { bool } = await import(dataURL);
  assertEquals(bool, "asd2");
});

test("remote js", ALL, async (loader) => {
  if (loader === "native") return; // ignored (https://github.com/denoland/deno/issues/10528)
  const res = await esbuild.build({
    plugins: [denoPlugin({ loader })],
    write: false,
    entryPoints: ["https://crux.land/266TSp"],
  });
  assertEquals(res.warnings, []);
  assertEquals(res.outputFiles.length, 1);
  const output = res.outputFiles[0];
  assertEquals(output.path, "<stdout>");
  const dataURL = `data:application/javascript;base64,${btoa(output.text)}`;
  const { bool } = await import(dataURL);
  assertEquals(bool, "asd");
});

test("local js", ONLY_NATIVE, async (loader) => {
  const res = await esbuild.build({
    plugins: [denoPlugin({ loader })],
    write: false,
    entryPoints: ["./testdata/mod.js"],
  });
  assertEquals(res.warnings, []);
  assertEquals(res.outputFiles.length, 1);
  const output = res.outputFiles[0];
  assertEquals(output.path, "<stdout>");
  const dataURL = `data:application/javascript;base64,${btoa(output.text)}`;
  const { bool } = await import(dataURL);
  assertEquals(bool, "asd");
});

test("remote jsx", ALL, async (loader) => {
  if (loader === "native") return; // ignored (https://github.com/denoland/deno/issues/10528)
  const res = await esbuild.build({
    plugins: [denoPlugin({ loader })],
    write: false,
    entryPoints: ["https://crux.land/GeaWJ"],
  });
  assertEquals(res.warnings, []);
  assertEquals(res.outputFiles.length, 1);
  const output = res.outputFiles[0];
  assertEquals(output.path, "<stdout>");
  const dataURL = `data:application/javascript;base64,${btoa(output.text)}`;
  const m = await import(dataURL);
  assertEquals(m.default, "foo");
});

test("local jsx", ONLY_NATIVE, async (loader) => {
  const res = await esbuild.build({
    plugins: [denoPlugin({ loader })],
    write: false,
    entryPoints: ["./testdata/mod.jsx"],
  });
  assertEquals(res.warnings, []);
  assertEquals(res.outputFiles.length, 1);
  const output = res.outputFiles[0];
  assertEquals(output.path, "<stdout>");
  const dataURL = `data:application/javascript;base64,${btoa(output.text)}`;
  const m = await import(dataURL);
  assertEquals(m.default, "foo");
});

test("remote tsx", ALL, async (loader) => {
  if (loader === "native") return; // ignored (https://github.com/denoland/deno/issues/10528)
  const res = await esbuild.build({
    plugins: [denoPlugin({ loader })],
    write: false,
    entryPoints: ["https://crux.land/2Qjyo7"],
  });
  assertEquals(res.warnings, []);
  assertEquals(res.outputFiles.length, 1);
  const output = res.outputFiles[0];
  assertEquals(output.path, "<stdout>");
  const dataURL = `data:application/javascript;base64,${btoa(output.text)}`;
  const m = await import(dataURL);
  assertEquals(m.default, "foo");
});

test("local tsx", ONLY_NATIVE, async (loader) => {
  const res = await esbuild.build({
    plugins: [denoPlugin({ loader })],
    write: false,
    entryPoints: ["./testdata/mod.tsx"],
  });
  assertEquals(res.warnings, []);
  assertEquals(res.outputFiles.length, 1);
  const output = res.outputFiles[0];
  assertEquals(output.path, "<stdout>");
  const dataURL = `data:application/javascript;base64,${btoa(output.text)}`;
  const m = await import(dataURL);
  assertEquals(m.default, "foo");
});

test("bundle remote imports", ALL, async (loader) => {
  const res = await esbuild.build({
    plugins: [denoPlugin({ loader })],
    write: false,
    bundle: true,
    platform: "neutral",
    entryPoints: ["https://deno.land/std@0.95.0/uuid/mod.ts"],
  });
  assertEquals(res.warnings, []);
  assertEquals(res.outputFiles.length, 1);
  const output = res.outputFiles[0];
  assertEquals(output.path, "<stdout>");
  const dataURL = `data:application/javascript;base64,${btoa(output.text)}`;
  const { v4 } = await import(dataURL);
  assert(v4.validate(v4.generate()));
});

test("bundle import map", ONLY_NATIVE, async (loader) => {
  const res = await esbuild.build({
    plugins: [
      denoPlugin({ importMapFile: "./testdata/importmap.json", loader }),
    ],
    write: false,
    bundle: true,
    platform: "neutral",
    entryPoints: ["./testdata/importmap.js"],
  });
  assertEquals(res.warnings, []);
  assertEquals(res.outputFiles.length, 1);
  const output = res.outputFiles[0];
  assertEquals(output.path, "<stdout>");
  const dataURL = `data:application/javascript;base64,${btoa(output.text)}`;
  const { bool } = await import(dataURL);
  assertEquals(bool, "asd2");
});
