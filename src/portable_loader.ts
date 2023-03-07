import { esbuild, extname, fromFileUrl } from "../deps.ts";
import * as deno from "./deno.ts";
import {
  Loader,
  LoaderResolution,
  mediaTypeToLoader,
  transformRawIntoContent,
} from "./shared.ts";

interface Module {
  specifier: string;
  mediaType: deno.MediaType;
  data: Uint8Array;
}

export class PortableLoader implements Loader {
  #fetchOngoing = new Map<string, Promise<void>>();

  #fetchModules = new Map<string, Module>();
  #fetchRedirects = new Map<string, string>();

  async resolve(specifier: URL): Promise<LoaderResolution> {
    switch (specifier.protocol) {
      case "file:": {
        return { kind: "esm", specifier };
      }
      case "http:":
      case "https:":
      case "data:": {
        const module = await this.#loadRemote(specifier.href);
        return { kind: "esm", specifier: new URL(module.specifier) };
      }
      default:
        throw new Error(`Unsupported scheme: '${specifier.protocol}'`);
    }
  }

  async loadEsm(specifier: string): Promise<esbuild.OnLoadResult> {
    const url = new URL(specifier);
    let module: Module;
    switch (url.protocol) {
      case "file:": {
        module = await this.#loadLocal(url);
        break;
      }
      case "http:":
      case "https:":
      case "data:": {
        module = await this.#loadRemote(specifier);
        break;
      }
      default:
        throw new Error("[unreachable] unsupported esm scheme " + url.protocol);
    }

    const loader = mediaTypeToLoader(module.mediaType);
    const contents = transformRawIntoContent(module.data, module.mediaType);

    const res: esbuild.OnLoadResult = { contents, loader };
    if (module.specifier.startsWith("file://")) {
      res.watchFiles = [fromFileUrl(module.specifier)];
    }
    return res;
  }

  #resolveRemote(specifier: string): string {
    return this.#fetchRedirects.get(specifier) ?? specifier;
  }

  async #loadRemote(specifier: string): Promise<Module> {
    for (let i = 0; i < 10; i++) {
      specifier = this.#resolveRemote(specifier);
      const module = this.#fetchModules.get(specifier);
      if (module) return module;

      let promise = this.#fetchOngoing.get(specifier);
      if (!promise) {
        promise = this.#fetch(specifier);
        this.#fetchOngoing.set(specifier, promise);
      }

      await promise;
    }

    throw new Error("Too many redirects. Last one: " + specifier);
  }

  async #fetch(specifier: string): Promise<void> {
    const resp = await fetch(specifier, {
      redirect: "manual",
    });
    if (resp.status < 200 && resp.status >= 400) {
      throw new Error(
        `Encountered status code ${resp.status} while fetching ${specifier}.`,
      );
    }

    if (resp.status >= 300 && resp.status < 400) {
      await resp.body?.cancel();
      const location = resp.headers.get("location");
      if (!location) {
        throw new Error(
          `Redirected without location header while fetching ${specifier}.`,
        );
      }

      const url = new URL(location, specifier);
      if (url.protocol !== "https:" && url.protocol !== "http:") {
        throw new Error(
          `Redirected to unsupported protocol '${url.protocol}' while fetching ${specifier}.`,
        );
      }

      this.#fetchRedirects.set(specifier, url.href);
      return;
    }

    const contentType = resp.headers.get("content-type");
    const mediaType = mapContentType(new URL(specifier), contentType);

    const data = new Uint8Array(await resp.arrayBuffer());
    this.#fetchModules.set(specifier, {
      specifier,
      mediaType,
      data,
    });
  }

  async #loadLocal(specifier: URL): Promise<Module> {
    const path = fromFileUrl(specifier);

    const mediaType = mapContentType(specifier, null);
    const data = await Deno.readFile(path);

    return { specifier: specifier.href, mediaType, data };
  }
}

function mapContentType(
  specifier: URL,
  contentType: string | null,
): deno.MediaType {
  if (contentType !== null) {
    const contentTypes = contentType.split(";");
    const mediaType = contentTypes[0].toLowerCase();
    switch (mediaType) {
      case "application/typescript":
      case "text/typescript":
      case "video/vnd.dlna.mpeg-tts":
      case "video/mp2t":
      case "application/x-typescript":
        return mapJsLikeExtension(specifier, "TypeScript");
      case "application/javascript":
      case "text/javascript":
      case "application/ecmascript":
      case "text/ecmascript":
      case "application/x-javascript":
      case "application/node":
        return mapJsLikeExtension(specifier, "JavaScript");
      case "text/jsx":
        return "JSX";
      case "text/tsx":
        return "TSX";
      case "application/json":
      case "text/json":
        return "Json";
      case "application/wasm":
        return "Wasm";
      case "text/plain":
      case "application/octet-stream":
        return mediaTypeFromSpecifier(specifier);
      default:
        return "Unknown";
    }
  } else {
    return mediaTypeFromSpecifier(specifier);
  }
}

function mapJsLikeExtension(
  specifier: URL,
  defaultType: deno.MediaType,
): deno.MediaType {
  const path = specifier.pathname;
  switch (extname(path)) {
    case ".jsx":
      return "JSX";
    case ".mjs":
      return "Mjs";
    case ".cjs":
      return "Cjs";
    case ".tsx":
      return "TSX";
    case ".ts":
      if (path.endsWith(".d.ts")) {
        return "Dts";
      } else {
        return defaultType;
      }
    case ".mts": {
      if (path.endsWith(".d.mts")) {
        return "Dmts";
      } else {
        return defaultType == "JavaScript" ? "Mjs" : "Mts";
      }
    }
    case ".cts": {
      if (path.endsWith(".d.cts")) {
        return "Dcts";
      } else {
        return defaultType == "JavaScript" ? "Cjs" : "Cts";
      }
    }
    default:
      return defaultType;
  }
}

function mediaTypeFromSpecifier(specifier: URL): deno.MediaType {
  const path = specifier.pathname;
  switch (extname(path)) {
    case "":
      if (path.endsWith("/.tsbuildinfo")) {
        return "TsBuildInfo";
      } else {
        return "Unknown";
      }
    case ".ts":
      if (path.endsWith(".d.ts")) {
        return "Dts";
      } else {
        return "TypeScript";
      }
    case ".mts":
      if (path.endsWith(".d.mts")) {
        return "Dmts";
      } else {
        return "Mts";
      }
    case ".cts":
      if (path.endsWith(".d.cts")) {
        return "Dcts";
      } else {
        return "Cts";
      }
    case ".tsx":
      return "TSX";
    case ".js":
      return "JavaScript";
    case ".jsx":
      return "JSX";
    case ".mjs":
      return "Mjs";
    case ".cjs":
      return "Cjs";
    case ".json":
      return "Json";
    case ".wasm":
      return "Wasm";
    case ".tsbuildinfo":
      return "TsBuildInfo";
    case ".map":
      return "SourceMap";
    default:
      return "Unknown";
  }
}
