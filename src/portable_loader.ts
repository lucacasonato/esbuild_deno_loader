import { esbuild, extname, fromFileUrl } from "../deps.ts";
import * as deno from "./deno.ts";

export interface LoadOptions {
  importMapFile?: string;
}

export async function load(
  url: URL,
  _options: LoadOptions,
): Promise<esbuild.OnLoadResult | null> {
  switch (url.protocol) {
    case "http:":
    case "https:":
    case "data:":
      return await loadWithFetch(url);
    case "file:": {
      const res = await loadWithFetch(url);
      res.watchFiles = [fromFileUrl(url.href)];
      return res;
    }
  }
  return null;
}

async function loadWithFetch(
  specifier: URL,
): Promise<esbuild.OnLoadResult> {
  const specifierRaw = specifier.href;

  // TODO(lucacasonato): redirects!
  const resp = await fetch(specifierRaw);
  if (!resp.ok) {
    throw new Error(
      `Encountered status code ${resp.status} while fetching ${specifierRaw}.`,
    );
  }

  const contentType = resp.headers.get("content-type");
  const mediaType = mapContentType(
    new URL(resp.url || specifierRaw),
    contentType,
  );
  const contents = new Uint8Array(await resp.arrayBuffer());

  let loader: esbuild.Loader;
  switch (mediaType) {
    case "JavaScript":
      loader = "js";
      break;
    case "JSX":
      loader = "jsx";
      break;
    case "TypeScript":
      loader = "ts";
      break;
    case "TSX":
      loader = "tsx";
      break;
    default:
      throw new Error(
        `Unhandled media type ${mediaType}. Content type is ${contentType}.`,
      );
  }

  return { contents, loader };
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
    case ".tsx":
      return "TSX";
    case ".ts":
      if (path.endsWith(".d.ts")) {
        return "Dts";
      } else {
        return defaultType;
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
    case ".tsx":
      return "TSX";
    case ".js":
    case ".mjs":
    case ".cjs":
      return "JavaScript";
    case ".jsx":
      return "JSX";
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
