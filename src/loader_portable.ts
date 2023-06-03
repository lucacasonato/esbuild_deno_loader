import { esbuild, fromFileUrl } from "../deps.ts";
import * as deno from "./deno.ts";
import {
  Loader,
  LoaderResolution,
  mapContentType,
  mediaTypeToLoader,
  parseNpmSpecifier,
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
      case "npm:": {
        const npmSpecifier = parseNpmSpecifier(specifier);
        return {
          kind: "npm",
          packageId: "",
          packageName: npmSpecifier.name,
          path: npmSpecifier.path ?? "",
        };
      }
      case "node:": {
        return { kind: "node", path: specifier.pathname };
      }
      default:
        throw new Error(`Unsupported scheme: '${specifier.protocol}'`);
    }
  }

  async loadEsm(url: URL): Promise<esbuild.OnLoadResult> {
    let module: Module;
    switch (url.protocol) {
      case "file:": {
        module = await this.#loadLocal(url);
        break;
      }
      case "http:":
      case "https:":
      case "data:": {
        module = await this.#loadRemote(url.href);
        break;
      }
      default:
        throw new Error("[unreachable] unsupported esm scheme " + url.protocol);
    }

    const loader = mediaTypeToLoader(module.mediaType);

    const res: esbuild.OnLoadResult = { contents: module.data, loader };
    if (url.protocol === "file:") {
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
