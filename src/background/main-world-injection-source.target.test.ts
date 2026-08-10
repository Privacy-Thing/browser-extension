import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import { restoreFxHashUrl } from "@/background/main-world-injection";

describe("MAIN-world injection source", () => {
  const source = readFileSync(
    resolve(process.cwd(), "src/background/main-world-injection.ts"),
    "utf8",
  );

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("selects only the marked runtime config element", () => {
    expect(source).toContain('script[type="application/json"][data-${markerAttr}]');
    expect(source).not.toContain("querySelectorAll");
  });

  it("has no runtime imports", () => {
    expect(source).not.toMatch(/^import (?!type )/m);
  });

  it("restores the Firefox hash without module-scope closures", () => {
    const location = {
      pathname: "/page",
      search: "?view=details",
      hash: "#bootstrap-seed",
    };
    const replaceState = vi.fn((_state: unknown, _title: string, url: string) => {
      location.hash = url.slice(url.indexOf("#"));
    });
    const guardSymbol = Symbol.for("test-guard");

    vi.stubGlobal("location", location);
    vi.stubGlobal("history", {
      state: null,
      replaceState,
    });
    Object.defineProperty(globalThis, guardSymbol, {
      configurable: true,
      value: true,
    });

    const serializedRestore = new Function(
      `return (${restoreFxHashUrl.toString()});`,
    )() as typeof restoreFxHashUrl;

    try {
      expect(() => serializedRestore("#original", "test-guard")).not.toThrow();
      expect(replaceState).toHaveBeenCalledWith(
        null,
        "",
        "/page?view=details#original",
      );
      expect(location.hash).toBe("#original");
    } finally {
      Reflect.deleteProperty(globalThis, guardSymbol);
    }
  });
});
