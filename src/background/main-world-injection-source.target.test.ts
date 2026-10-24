import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  restoreFxHashUrl,
  seedWindowSnapshot,
} from "@/background/main-world-injection";

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

  it("replaces an older seed and keeps only the page-owned name from it", () => {
    const prefix = "\u001f\u001e";
    const decode = (name: string) =>
      JSON.parse(
        atob(name.slice(prefix.length).replace(/-/g, "+").replace(/_/g, "/")),
      ) as Record<string, unknown>;
    const older = { kind: "snapshot", previousName: "page", nextLoad: true };
    vi.stubGlobal("name", `${prefix}${btoa(JSON.stringify(older))}`);
    const snapshot = {
      geo: { latitude: 0, longitude: 0, accuracy: 20, noiseRadius: 50 },
      locale: {
        language: "en",
        languages: ["en"],
        timeZone: "UTC",
        acceptLanguage: "en",
      },
      date: { baseEpochMs: 0, offsetMs: 0, timeZone: "UTC" },
      debugMode: false,
      watchPositionDelay: [60, 500] as [number, number],
    };
    seedWindowSnapshot(snapshot, prefix);
    expect(decode((globalThis as { name?: string }).name ?? "")).toEqual({
      kind: "snapshot",
      previousName: "page",
      snapshot,
    });
    vi.stubGlobal("location", { hostname: "probe.example" });
    seedWindowSnapshot(snapshot, prefix, false, { nextLoad: true });
    expect(decode((globalThis as { name?: string }).name ?? "")).toEqual({
      kind: "snapshot",
      previousName: "page",
      nextLoad: true,
      sourceHostname: "probe.example",
      snapshot,
    });
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
