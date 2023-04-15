import { esbuild, fromFileUrl } from "../deps.ts";
import * as deno from "./deno.ts";
import {
  Loader,
  LoaderResolution,
  mapContentType,
  mediaTypeToLoader,
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

    if (entry.kind === "npm" || entry.kind === "node") {
      throw new Error("Unsupported module kind: " + entry.kind);
    }

    return { kind: "esm", specifier: new URL(entry.specifier) };
  }

  async loadEsm(specifier: URL): Promise<esbuild.OnLoadResult> {
    if (specifier.protocol === "data:") {
      const resp = await fetch(specifier);
      const raw = new Uint8Array(await resp.arrayBuffer());
      const contentType = resp.headers.get("content-type");
      const mediaType = mapContentType(specifier, contentType);
      const contents = transformRawIntoContent(raw, mediaType);
      const loader = mediaTypeToLoader(mediaType);
      return { contents, loader };
    }
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
