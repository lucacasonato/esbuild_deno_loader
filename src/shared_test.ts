import {
  type NpmSpecifier,
  parseJsrSpecifier,
  parseNpmSpecifier,
} from "./shared.ts";
import { assertEquals, assertThrows } from "@std/assert";
import type { JsrSpecifier } from "./shared.ts";

interface NpmSpecifierTestCase extends NpmSpecifier {
  specifier: string;
}

const NPM_SPECIFIER_VALID: Array<NpmSpecifierTestCase> = [
  {
    specifier: "npm:package@1.2.3/test",
    name: "package",
    version: "1.2.3",
    path: "/test",
  },
  {
    specifier: "npm:package@1.2.3",
    name: "package",
    version: "1.2.3",
    path: null,
  },
  {
    specifier: "npm:@package/test",
    name: "@package/test",
    version: null,
    path: null,
  },
  {
    specifier: "npm:@package/test@1",
    name: "@package/test",
    version: "1",
    path: null,
  },
  {
    specifier: "npm:@package/test@~1.1/sub_path",
    name: "@package/test",
    version: "~1.1",
    path: "/sub_path",
  },
  {
    specifier: "npm:@package/test/sub_path",
    name: "@package/test",
    version: null,
    path: "/sub_path",
  },
  {
    specifier: "npm:test",
    name: "test",
    version: null,
    path: null,
  },
  {
    specifier: "npm:test@^1.2",
    name: "test",
    version: "^1.2",
    path: null,
  },
  {
    specifier: "npm:test@~1.1/sub_path",
    name: "test",
    version: "~1.1",
    path: "/sub_path",
  },
  {
    specifier: "npm:@package/test/sub_path",
    name: "@package/test",
    version: null,
    path: "/sub_path",
  },
  {
    specifier: "npm:/@package/test/sub_path",
    name: "@package/test",
    version: null,
    path: "/sub_path",
  },
  {
    specifier: "npm:/test",
    name: "test",
    version: null,
    path: null,
  },
  {
    specifier: "npm:/test/",
    name: "test",
    version: null,
    path: "/",
  },
];

Deno.test("parseNpmSpecifier", async (t) => {
  for (const test of NPM_SPECIFIER_VALID) {
    await t.step(test.specifier, () => {
      const parsed = parseNpmSpecifier(new URL(test.specifier));
      assertEquals(parsed, {
        name: test.name,
        version: test.version,
        path: test.path,
      });
    });
  }
});

const NPM_SPECIFIER_INVALID = [
  "npm:@package",
  "npm:/",
  "npm://test",
];
Deno.test("parseNpmSpecifier", async (t) => {
  for (const specifier of NPM_SPECIFIER_INVALID) {
    await t.step(specifier, () => {
      assertThrows(
        () => parseNpmSpecifier(new URL(specifier)),
        Error,
        "Invalid npm specifier",
      );
    });
  }
});

interface JsrSpecifierTestCase extends JsrSpecifier {
  specifier: string;
}

const JSR_SPECIFIER_VALID: Array<JsrSpecifierTestCase> = [
  {
    specifier: "jsr:@package/test",
    name: "@package/test",
    version: null,
    path: null,
  },
  {
    specifier: "jsr:@package/test@1",
    name: "@package/test",
    version: "1",
    path: null,
  },
  {
    specifier: "jsr:@package/test@~1.1/sub_path",
    name: "@package/test",
    version: "~1.1",
    path: "/sub_path",
  },
  {
    specifier: "jsr:@package/test/sub_path",
    name: "@package/test",
    version: null,
    path: "/sub_path",
  },
  {
    specifier: "jsr:/@package/test/sub_path",
    name: "@package/test",
    version: null,
    path: "/sub_path",
  },
];

Deno.test("parseJsrSpecifier", async (t) => {
  for (const test of JSR_SPECIFIER_VALID) {
    await t.step(test.specifier, () => {
      const parsed = parseJsrSpecifier(new URL(test.specifier));
      assertEquals(parsed, {
        name: test.name,
        version: test.version,
        path: test.path,
      });
    });
  }
});

const JSR_SPECIFIER_INVALID = [
  "jsr:@package",
  "jsr:/",
  "jsr://@package/name",
  "jsr:test",
  "jsr:package/name",
];

Deno.test("parseJsrSpecifier", async (t) => {
  for (const specifier of JSR_SPECIFIER_INVALID) {
    await t.step(specifier, () => {
      assertThrows(
        () => parseJsrSpecifier(new URL(specifier)),
        Error,
        "Invalid jsr specifier",
      );
    });
  }
});
