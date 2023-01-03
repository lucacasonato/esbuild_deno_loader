export interface NpmPackageReference {
  name: string;
  versionReq: string | null;
  subPath: string | null;
}

export function npmPackageReference(specifier: string): NpmPackageReference {
  if (!specifier.startsWith("npm:")) {
    throw new Error(`Invalid npm package reference: ${specifier}`);
  }

  specifier = specifier.substring(4);
  const parts = specifier.split("/");
  let namePartLen: number;
  if (specifier.startsWith("@")) {
    namePartLen = 2;
  } else {
    namePartLen = 1;
  }
  if (parts.length < namePartLen) {
    throw new Error(`Invalid npm package reference: ${specifier}`);
  }
  const nameParts = parts.slice(0, namePartLen);
  let lastNamePart = nameParts[nameParts.length - 1];
  const atIndex = lastNamePart.lastIndexOf("@");
  let version: string | undefined;
  let name: string;

  if (atIndex !== -1) {
    version = lastNamePart.substring(atIndex + 1);
    lastNamePart = lastNamePart.substring(0, atIndex);

    if (namePartLen === 1) {
      name = lastNamePart;
    } else {
      name = `${nameParts[0]}/${lastNamePart}`;
    }
  } else {
    name = nameParts.join("/");
  }

  let subPath = null;
  if (parts.length !== namePartLen) {
    subPath = parts.slice(namePartLen).join("/");
  }

  if (!name) {
    throw new Error(
      `Invalid npm package reference: ${specifier}. Did not contain a package name`,
    );

  }
  // Version is very important, because 
  // npm:express@4.18 resolves to npm:express@4.18.2
  // So the given npm specifier version must follow semantic verion
  if (!version || version.length < 5) {
        throw new Error(`Version is broken for ${specifier}`);
  }


  return {
    name,
    versionReq: version,
    subPath,
  };
}

// This is for finding the path does have extension, if not currently
// It resolved with ".js", Idk we need to look for other sources also like ".ts", ".jsx" here...
export function isEntry(path: string): boolean {
  const ext = path.at(path.length - 3) === "." ||
    path.at(path.length - 4) === ".";
  return !ext;
}
