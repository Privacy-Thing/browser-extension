import { describe, expect, it } from "vitest";

import {
  FX_LOCAL_MODULES,
  FIREFOX_EARLY_MODULES,
  FIREFOX_MAIN_MODULES,
  FX_SNAPSHOT_SEMANTICS,
} from "./module-ownership";

describe("Firefox runtime module ownership", () => {
  it("keeps early and main ownership disjoint", () => {
    const mainModules = new Set<string>(FIREFOX_MAIN_MODULES);
    expect(FIREFOX_EARLY_MODULES.filter((name) => mainModules.has(name))).toEqual([]);
  });

  it("defines snapshot semantics for every owned or bundle-local module", () => {
    const expected = new Set<string>([
      ...FIREFOX_EARLY_MODULES,
      ...FIREFOX_MAIN_MODULES,
      ...FX_LOCAL_MODULES,
    ]);
    expect(new Set(Object.keys(FX_SNAPSHOT_SEMANTICS))).toEqual(expected);
  });
});
