import { esbuild, fromFileUrl, JSONC, toFileUrl } from "../deps.ts";
import { MediaType } from "./deno.ts";

export interface Loader {
  resolve(specifier: URL): Promise<LoaderResolution>;
  loadEsm(specifier: URL): Promise<esbuild.OnLoadResult>;
}

export type LoaderResolution = LoaderResolutionEsm;

export interface LoaderResolutionEsm {
  kind: "esm";
  specifier: URL;
}

export function mediaTypeToLoader(mediaType: MediaType): esbuild.Loader {
  switch (mediaType) {
    case "JavaScript":
    case "Mjs":
      return "js";
    case "JSX":
      return "jsx";
    case "TypeScript":
    case "Mts":
      return "ts";
    case "TSX":
      return "tsx";
    case "Json":
      return "js";
    default:
      throw new Error(`Unhandled media type ${mediaType}.`);
  }
}

export function transformRawIntoContent(
  raw: Uint8Array,
  mediaType: MediaType,
): string | Uint8Array {
  switch (mediaType) {
    case "Json":
      return jsonToESM(raw);
    default:
      return raw;
  }
}

function jsonToESM(source: Uint8Array): string {
  const sourceString = new TextDecoder().decode(source);
  let json = JSON.stringify(JSON.parse(sourceString), null, 2);
  json = json.replaceAll(`"__proto__":`, `["__proto__"]:`);
  return `export default ${json};`;
}

export interface EsbuildResolution {
  namespace: string;
  path: string;
}

export function urlToEsbuildResolution(url: URL): EsbuildResolution {
  if (url.protocol === "file:") {
    return { path: fromFileUrl(url), namespace: "file" };
  }

  const namespace = url.protocol.slice(0, -1);
  const path = url.href.slice(namespace.length + 1);
  return { path, namespace };
}

export function esbuildResolutionToURL(specifier: EsbuildResolution): URL {
  if (specifier.namespace === "file") {
    return toFileUrl(specifier.path);
  }

  return new URL(`${specifier.namespace}:${specifier.path}`);
}

interface DenoConfig {
  imports?: unknown;
  scopes?: unknown;
  lock?: string;
  importMap?: string;
}

export async function readDenoConfig(path: string): Promise<DenoConfig> {
  const file = await Deno.readTextFile(path);
  const res = JSONC.parse(file);
  if (typeof res !== "object" || res === null || Array.isArray(res)) {
    throw new Error(`Deno config at ${path} must be an object`);
  }
  if (
    "imports" in res &&
    (typeof res.imports !== "object" || res.imports === null ||
      Array.isArray(res.imports))
  ) {
    throw new Error(`Deno config at ${path} has invalid "imports" key`);
  }
  if (
    "scopes" in res &&
    (typeof res.scopes !== "object" || res.scopes === null ||
      Array.isArray(res.scopes))
  ) {
    throw new Error(`Deno config at ${path} has invalid "scopes" key`);
  }
  if ("lock" in res && typeof res.lock !== "string") {
    throw new Error(`Deno config at ${path} has invalid "lock" key`);
  }
  if ("importMap" in res && typeof res.importMap !== "string") {
    throw new Error(`Deno config at ${path} has invalid "importMap" key`);
  }
  return res;
}
