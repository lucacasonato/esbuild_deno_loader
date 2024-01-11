import { expect } from "https://deno.land/std@0.211.0/expect/mod.ts";
import { parseNpmSpecifier } from "./new.ts";

Deno.test("parseNpmSpecifier", () => {
  expect(() => parseNpmSpecifier("")).toThrow();
  expect(parseNpmSpecifier("npm:foo@1.2.3")).toEqual({
    name: "foo",
    version: "1.2.3",
  });
  expect(parseNpmSpecifier("npm:@bar/foo@1.2.3")).toEqual({
    scope: "@bar",
    name: "foo",
    version: "1.2.3",
  });
  expect(parseNpmSpecifier("npm:@bar/foo@1.2.3")).toEqual({
    scope: "@bar",
    name: "foo",
    version: "1.2.3",
  });

  expect(parseNpmSpecifier("npm:foo@1.2.3/bar/baz.ts")).toEqual({
    name: "foo",
    version: "1.2.3",
    entry: "bar/baz.ts",
  });
  expect(parseNpmSpecifier("npm:@bar/foo@1.2.3/bar/baz.ts")).toEqual({
    scope: "@bar",
    name: "foo",
    version: "1.2.3",
    entry: "bar/baz.ts",
  });
});
