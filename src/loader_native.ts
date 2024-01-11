import {
  DenoDir,
  dirname,
  encodeBase32,
  esbuild,
  fromFileUrl,
  join,
} from "../deps.ts";
import * as deno from "./deno.ts";
import {
  Loader,
  LoaderResolution,
  mapContentType,
  mediaTypeToLoader,
  parseNpmSpecifier,
  readDenoConfig,
} from "./shared.ts";

let DENO_DIR: DenoDir | undefined;

export interface NativeLoaderOptions {
  infoOptions: deno.InfoOptions;
}

export class NativeLoader implements Loader {
  #infoCache: deno.InfoCache;
  #linkDirCache: Map<string, string> = new Map(); // mapping from package id -> link dir
  #options: NativeLoaderOptions;

  constructor(options: NativeLoaderOptions) {
    this.#options = options;
    this.#infoCache = new deno.InfoCache(options.infoOptions);
  }

  async resolve(specifier: URL): Promise<LoaderResolution> {
    const entry = await this.#infoCache.get(specifier.href);
    // console.log("resolve", specifier.href, "->", entry);
    if ("error" in entry) throw new Error(entry.error);

    if (entry.kind === "npm") {
      // TODO(lucacasonato): remove parsing once https://github.com/denoland/deno/issues/18043 is resolved
      const parsed = parseNpmSpecifier(new URL(entry.specifier));
      console.log("npm parsed", parsed, specifier.href, entry.specifier);
      return {
        kind: "npm",
        packageId: entry.npmPackage,
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
    if (specifier.protocol === "data:") {
      const resp = await fetch(specifier);
      const contents = new Uint8Array(await resp.arrayBuffer());
      const contentType = resp.headers.get("content-type");
      const mediaType = mapContentType(specifier, contentType);
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

    const contents = await Deno.readFile(entry.local);
    const res: esbuild.OnLoadResult = { contents, loader };
    if (specifier.protocol === "file:") {
      res.watchFiles = [fromFileUrl(specifier)];
    }
    return res;
  }

  async nodeModulesDirForPackage(npmPackageId: string): Promise<string> {
    const npmPackage = this.#infoCache.getNpmPackage(npmPackageId);
    if (!npmPackage) throw new Error("NPM package not found.");

    console.log(npmPackageId, npmPackage);
    let linkDir = this.#linkDirCache.get(npmPackageId);
    console.log({ linkDir });
    if (!linkDir) {
      linkDir = await this.#nodeModulesDirForPackageInner(
        npmPackageId,
        npmPackage,
      );
      this.#linkDirCache.set(npmPackageId, linkDir);
    }
    return linkDir;
  }

  async #nodeModulesDirForPackageInner(
    npmPackageId: string,
    npmPackage: deno.NpmPackage,
  ): Promise<string> {
    let name = npmPackage.name;
    if (name.toLowerCase() !== name) {
      name = `_${encodeBase32(new TextEncoder().encode(name))}`;
    }
    if (!DENO_DIR) DENO_DIR = new DenoDir();
    console.log(this.#options, DENO_DIR.root);
    // const config = await readDenoConfig(this.#options.infoOptions?.config);
    if (this.#options.infoOptions.nodeModulesDir) {
      console.log("local node modules");
    }
    const packageDir = join(
      DENO_DIR.root,
      "npm",
      "registry.npmjs.org",
      name,
      npmPackage.version,
    );
    const linkDir = join(
      DENO_DIR.root,
      "deno_esbuild",
      npmPackageId,
      "node_modules",
      name,
    );
    console.log({ packageDir, linkDir });
    const linkDirParent = dirname(linkDir);

    // check if the package is already linked, if so, return the link and skip
    // a bunch of work
    try {
      await Deno.stat(linkDir);
      this.#linkDirCache.set(npmPackageId, linkDir);
      return linkDir;
    } catch {
      // directory does not yet exist
    }

    // create a temporary directory, recursively hardlink the package contents
    // into it, and then rename it to the final location
    const tmpDir = await Deno.makeTempDir();
    await linkRecursive(packageDir, tmpDir);
    try {
      await Deno.mkdir(linkDirParent, { recursive: true });
      await Deno.rename(tmpDir, linkDir);
    } catch (err) {
      if (err instanceof Deno.errors.AlreadyExists) {
        // ignore
      } else {
        throw err;
      }
    }

    return linkDir;
  }

  packageIdFromNameInPackage(
    name: string,
    parentPackageId: string,
  ): string {
    const parentPackage = this.#infoCache.getNpmPackage(parentPackageId);
    if (!parentPackage) throw new Error("NPM package not found.");
    if (parentPackage.name === name) return parentPackageId;
    for (const dep of parentPackage.dependencies) {
      const depPackage = this.#infoCache.getNpmPackage(dep);
      if (!depPackage) throw new Error("NPM package not found.");
      if (depPackage.name === name) return dep;
    }
    throw new Error("NPM package not found.");
  }
}

async function linkRecursive(from: string, to: string) {
  const fromStat = await Deno.stat(from);
  if (fromStat.isDirectory) {
    await Deno.mkdir(to, { recursive: true });
    for await (const entry of Deno.readDir(from)) {
      await linkRecursive(join(from, entry.name), join(to, entry.name));
    }
  } else {
    await Deno.link(from, to);
  }
}
