import { esbuild, fromFileUrl } from "../deps.ts";
import * as deno from "./deno.ts";
import {
  Loader,
  LoaderResolution,
  mediaTypeToLoader,
  parseNpmSpecifier,
  transformRawIntoContent,
} from "./shared.ts";

export interface NativeLoaderOptions {
  infoOptions?: deno.InfoOptions;
}

export class NativeLoader implements Loader {
  #infoCache: deno.InfoCache;

  constructor(options: NativeLoaderOptions) {
    this.#infoCache = new deno.InfoCache(options.infoOptions);
  }

  async resolve(specifier: URL): Promise<LoaderResolution> {
    const entry = await this.#infoCache.get(specifier.href);
    if ("error" in entry) throw new Error(entry.error);

    if (entry.kind === "npm") {
      // TODO(lucacasonato): remove parsing once https://github.com/denoland/deno/issues/18043 is resolved
      const parsed = parseNpmSpecifier(new URL(entry.specifier));
      return {
        kind: "npm",
        packageName: parsed.name,
        path: parsed.path ?? "",
      };
    } else if (entry.kind === "node") {
      return {
        kind: "node",
        path: entry.specifier,
      };
    }

    return { kind: "esm", specifier: new URL(entry.specifier) };
  }

  async loadEsm(specifier: URL): Promise<esbuild.OnLoadResult> {
    const entry = await this.#infoCache.get(specifier.href);
    if ("error" in entry) throw new Error(entry.error);

    if (!("local" in entry)) {
      throw new Error("[unreachable] Not an ESM module.");
    }
    if (!entry.local) throw new Error("Module not downloaded yet.");
    const loader = mediaTypeToLoader(entry.mediaType);

    const raw = await Deno.readFile(entry.local);
    const contents = transformRawIntoContent(raw, entry.mediaType);

    const res: esbuild.OnLoadResult = { contents, loader };
    if (specifier.protocol === "file:") {
      res.watchFiles = [fromFileUrl(specifier)];
    }
    return res;
  }
}
