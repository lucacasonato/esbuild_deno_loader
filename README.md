# esbuild-deno-loader

Deno module resolution for `esbuild`.

- Support for `file:`, `https:`, and `data:` specifiers
- Support for `npm:` specifiers
- Support for `jsr:` specifiers
- Support for import maps (including embedded into `deno.json`)
- Native loader using Deno's global cache directory
- Portable loader that words in environments with limited permissions

## Example

This example bundles an entrypoint into a single ESM output.

```js
import * as esbuild from "npm:esbuild@0.20.2";
// Import the WASM build on platforms where running subprocesses is not
// permitted, such as Deno Deploy, or when running without `--allow-run`.
// import * as esbuild from "https://deno.land/x/esbuild@v0.20.2/wasm.js";

import { denoPlugins } from "jsr:@luca/esbuild-deno-loader@^0.10.3";

const result = await esbuild.build({
  plugins: [...denoPlugins()],
  entryPoints: ["https://deno.land/std@0.185.0/bytes/mod.ts"],
  outfile: "./dist/bytes.esm.js",
  bundle: true,
  format: "esm",
});

console.log(result.outputFiles);

esbuild.stop();
```

## Limitations

- The `"portable"` loader does not use the Deno module cache, so all remote
  specifiers are downloaded on every run.
- When using the `"portable"` loader, all `npm:` dependencies must be
  pre-downloaded into a local `node_modules/` directory.
- When using the `"portable"` loader with `jsr:` specifiers, a lockfile must be
  present and passed to the loader (either using `configPath` or `lockPath`).
- `npm:` specifiers are not supported on WASM esbuild builds due to FS access
  limitations (see https://github.com/evanw/esbuild/pull/2968).

## Documentation

The Deno integration for Deno consists of two separate plugins (that are however
most commonly used together):

1. The resolver, which resolves specifiers within a file relative to the file
   itself (absolutization), taking into account import maps.
2. The loader, which takes a fully resolved specifier, and attempts to load it.
   If the loader encounters redirects, these are processed until a final module
   is found.

Most commonly these two plugins are used together, chained directly after each
other using the `denoPlugins()` function. This function returns an array of
`esbuild.Plugin` instances, which can be spread directly into the `plugins`
array of the esbuild build options.

In depth documentation for each of the plugins, and the `denoPlugins()` function
can be found in the
[generated docs](https://jsr.io/@luca/esbuild-deno-loader/doc).

### Using with other plugins

For some use-cases these plugins should be manually instantiated. For example if
you want to add your own loader plugins that handles specific file extensions or
URL schemes, you should insert these plugins between the Deno resolver, and Deno
loader.

**In most cases, the `denoResolverPlugin` should be the first plugin in the
plugin array.**

The resolver performs initial resolution on the path. This includes making
relative specifiers absolute and processing import maps. It will then send the
fully resolved specifiers back into esbuild's resolver stack to be processed by
other plugins. In the second path, the representation of the module is a fully
qualified URL. The `namespace` of the second resolve pass is the scheme of the
URL. The `path` is the remainder of the URL. The second resolve pass does not
have a `resolveDir` property, as the URL is fully qualified already.

The `denoLoaderPlugin` registers resolvers that are hit in the secondary resolve
pass for the schemes `http`, `https`, `data`, and `file`.

The output of the second resolve pass is then passed to the loader stack. The
loader stack is responsible for loading the module. Just like in the resolver
stack, the `namespace` of the loader stack is the scheme of the URL, and the
`path` is the remainder of the URL.

The `denoLoaderPlugin` registers loaders that are hit in the secondary resolve
pass for the schemes `http`, `https`, `data`, and `file`.

The examples directory contains an example for how to integrate with custom
plugins. The `examples/custom_scheme_plugin.ts` example shows how to add a
plugin that handles a custom scheme.

## Permissions

This plugins requires the following permissions:

- `--allow-read` if you need to resolve local files.
- `--allow-net` if you need to resolve remote files.

If the program is run with `--allow-run`, the plugin will use the `deno` binary
to resolve remote files. This allows the plugin to re-use the Deno module cache.
