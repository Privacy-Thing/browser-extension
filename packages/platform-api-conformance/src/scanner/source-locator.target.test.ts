import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, it, expect, beforeAll, afterAll } from "vitest";

import { SourceLocator, extractSurface } from "./source-locator.js";

/**
 * Creates a temporary directory tree with synthetic injection files
 * that mirror real patterns from `src/injection/`.
 */

const TEST_ROOT = join(tmpdir(), `source-locator-test-${Date.now()}`);
const INJECTION_DIR = join(TEST_ROOT, "src", "injection");

const FILES: Record<string, string> = {
  "main/locale-patch.ts": [
    `import { defineGetter } from "../utils.js";`,
    ``,
    `export function patchLocale(target: any) {`,
    `  defineGetter(target, "language", () => "en-GB");`,
    `  defineGetter(target, "languages", () => ["en-GB"]);`,
    `}`,
  ].join("\n"),

  "main/date-intl-patch.ts": [
    `Object.defineProperties(NativeDate.prototype, {`,
    `    getTimezoneOffset: {`,
    `      configurable: true,`,
    `      value: function getTimezoneOffset() { return -60; }`,
    `    },`,
    `    toString: {`,
    `      configurable: true,`,
    `      value: function toString() { return "fake"; }`,
    `    },`,
    `});`,
  ].join("\n"),

  "main/index.ts": [
    `defineGetter(Navigator.prototype, "userAgent", () => "spoofed");`,
    `defineGetter(Navigator.prototype, "platform", () => "Win32");`,
    `Object.defineProperty(queryTarget, "query", {`,
    `  configurable: true,`,
    `  value: function query() {}`,
    `});`,
    `Object.defineProperties(eventTarget, {`,
    `    name: {`,
    `      configurable: true,`,
    `      get: () => "geolocation"`,
    `    },`,
    `    state: {`,
    `      configurable: true,`,
    `      get: () => "granted"`,
    `    },`,
    `});`,
  ].join("\n"),

  "main/client-hints-patch.ts": [
    `const target = Object.getPrototypeOf(userAgentData);`,
    `defineGetter(target, "brands", () => []);`,
    `defineGetter(target, "mobile", () => false);`,
    `Object.defineProperty(target, "toJSON", {`,
    `  configurable: true,`,
    `  value: function toJSON() { return {}; }`,
    `});`,
    `Object.defineProperty(target, "getHighEntropyValues", {`,
    `  configurable: true,`,
    `  value: async function getHighEntropyValues() {}`,
    `});`,
  ].join("\n"),

  "firefox/geo-shim.ts": [
    `const descriptors: PropertyDescriptorMap = {`,
    `  getCurrentPosition: {`,
    `    configurable: true,`,
    `    value: () => {}`,
    `  },`,
    `  watchPosition: {`,
    `    configurable: true,`,
    `    value: () => 1`,
    `  },`,
    `  clearWatch: {`,
    `    configurable: true,`,
    `    value: () => {}`,
    `  },`,
    `};`,
    `Object.defineProperty(Navigator.prototype, "language", {`,
    `  get: () => "en-GB"`,
    `});`,
    `defineNativeGetter(MediaDevices.prototype, property, getter);`,
    `class SpoofedDate extends NativeDate {}`,
    `globalThis.Date = SpoofedDate;`,
    `privateDefineProperty(globalThis, "SharedWorker", { value: function SharedWorker() {} });`,
  ].join("\n"),

  // Test files should be excluded
  "main/locale-patch.target.test.ts": [
    `defineGetter(FakeNavigator.prototype, "language", () => "test");`,
  ].join("\n"),
};

beforeAll(() => {
  for (const [relPath, content] of Object.entries(FILES)) {
    const fullPath = join(INJECTION_DIR, relPath);
    mkdirSync(join(fullPath, ".."), { recursive: true });
    writeFileSync(fullPath, content, "utf-8");
  }
});

afterAll(() => {
  rmSync(TEST_ROOT, { recursive: true, force: true });
});

describe("extractSurface", () => {
  it("should extract surface from prototype-based API paths", () => {
    expect(extractSurface("Date.prototype.getTime")).toBe("Date");
    expect(extractSurface("Navigator.prototype.language")).toBe("Navigator");
    expect(extractSurface("Geolocation.prototype.watchPosition")).toBe("Geolocation");
  });

  it("should handle Intl.* surfaces", () => {
    expect(extractSurface("Intl.DateTimeFormat.prototype.format")).toBe(
      "Intl.DateTimeFormat",
    );
    expect(extractSurface("Intl.NumberFormat.prototype.format")).toBe(
      "Intl.NumberFormat",
    );
  });

  it("should extract surface from static property paths", () => {
    expect(extractSurface("Date.now")).toBe("Date");
  });

  it("should return undefined for bare surface names", () => {
    expect(extractSurface("Date")).toBeUndefined();
  });
});

describe("SourceLocator", () => {
  it("should find defineGetter calls with quoted property names", () => {
    const locator = new SourceLocator();
    locator.buildIndex(INJECTION_DIR, TEST_ROOT);

    const locations = locator.locate("Navigator.prototype.language");
    const files = locations.map((l) => l.file);

    // geo-shim.ts uses Navigator.prototype directly (surface = "Navigator"),
    // locale-patch.ts uses a variable `target` (surface = undefined).
    // Surface-matched result from geo-shim.ts takes priority.
    expect(files).toContain("src/injection/firefox/geo-shim.ts");
  });

  it("should find defineProperty calls with quoted property names", () => {
    const locator = new SourceLocator();
    locator.buildIndex(INJECTION_DIR, TEST_ROOT);

    const locations = locator.locate("Permissions.prototype.query");
    expect(locations).toHaveLength(1);
    expect(locations[0]!.file).toBe("src/injection/main/index.ts");
    expect(locations[0]!.line).toBe(3);
  });

  it("should find property keys inside Object.defineProperties blocks", () => {
    const locator = new SourceLocator();
    locator.buildIndex(INJECTION_DIR, TEST_ROOT);

    const locations = locator.locate("Date.prototype.getTimezoneOffset");
    expect(locations.some((l) => l.file.includes("date-intl-patch.ts"))).toBe(true);

    const toStringLocs = locator.locate("Date.prototype.toString");
    expect(toStringLocs.some((l) => l.file.includes("date-intl-patch.ts"))).toBe(true);
  });

  it("should find property keys inside PropertyDescriptorMap declarations", () => {
    const locator = new SourceLocator();
    locator.buildIndex(INJECTION_DIR, TEST_ROOT);

    const locations = locator.locate("Geolocation.prototype.getCurrentPosition");
    expect(locations.some((l) => l.file.includes("geo-shim.ts"))).toBe(true);

    const watchLocs = locator.locate("Geolocation.prototype.watchPosition");
    expect(watchLocs.some((l) => l.file.includes("geo-shim.ts"))).toBe(true);
  });

  it("should not match descriptor attribute keywords (value, get, set, etc.)", () => {
    const locator = new SourceLocator();
    locator.buildIndex(INJECTION_DIR, TEST_ROOT);

    const locations = locator.locate("Something.prototype.configurable");
    expect(locations).toHaveLength(0);

    const valueLocs = locator.locate("Something.prototype.value");
    expect(valueLocs).toHaveLength(0);
  });

  it("should exclude test files (.test.ts)", () => {
    const locator = new SourceLocator();
    locator.buildIndex(INJECTION_DIR, TEST_ROOT);

    const locations = locator.locate("Navigator.prototype.language");
    const testFiles = locations.filter((l) => l.file.includes(".test.ts"));
    expect(testFiles).toHaveLength(0);
  });

  it("should discover surfaces from define* helpers with dynamic property names", () => {
    const locator = new SourceLocator();
    locator.buildIndex(INJECTION_DIR, TEST_ROOT);

    expect(locator.getDiscoveredSurfaces().has("MediaDevices")).toBe(true);
  });

  it("should return empty array for unknown properties", () => {
    const locator = new SourceLocator();
    locator.buildIndex(INJECTION_DIR, TEST_ROOT);

    expect(locator.locate("Unknown.prototype.noSuchProperty")).toHaveLength(0);
  });

  it("should format locations as file:line pairs", () => {
    const locator = new SourceLocator();
    locator.buildIndex(INJECTION_DIR, TEST_ROOT);

    const formatted = locator.formatLocations("Navigator.prototype.userAgent");
    expect(formatted).toBeDefined();
    expect(formatted).toContain("src/injection/main/index.ts:");
  });

  it("should return undefined from formatLocations when nothing matches", () => {
    const locator = new SourceLocator();
    locator.buildIndex(INJECTION_DIR, TEST_ROOT);

    expect(locator.formatLocations("Foo.bar.nope")).toBeUndefined();
  });

  it("should deduplicate identical file:line pairs in formatLocations", () => {
    const locator = new SourceLocator();
    locator.buildIndex(INJECTION_DIR, TEST_ROOT);

    const formatted = locator.formatLocations("Navigator.prototype.language");
    expect(formatted).toBeDefined();

    const parts = formatted!.split(", ");
    const unique = new Set(parts);
    expect(parts.length).toBe(unique.size);
  });

  // ---- Surface-aware filtering ----

  it("should filter out wrong-surface matches (toJSON false positive)", () => {
    const locator = new SourceLocator();
    locator.buildIndex(INJECTION_DIR, TEST_ROOT);

    // Date.prototype.toJSON: the only "toJSON" definition is in
    // client-hints-patch.ts targeting NavigatorUAData — should NOT be returned.
    // Instead, should fall back to Date surface entry points.
    const locations = locator.locate("Date.prototype.toJSON");
    const files = locations.map((l) => l.file);

    // Must NOT contain client-hints-patch.ts
    expect(files.every((f) => !f.includes("client-hints-patch"))).toBe(true);

    // Should fall back to Date surface entry point (from date-intl-patch.ts
    // defineProperties block or geo-shim.ts class/globalThis)
    expect(locations.length).toBeGreaterThan(0);
  });

  it("should return correct surface match for NavigatorUAData.prototype.toJSON", () => {
    const locator = new SourceLocator();
    locator.buildIndex(INJECTION_DIR, TEST_ROOT);

    // NavigatorUAData surface: toJSON is defined with variable target in
    // client-hints-patch.ts. Since it uses a variable, surface = undefined.
    // No "NavigatorUAData" surface matches exist, but no entry points either,
    // so the unknown-surface match from client-hints-patch.ts is the last resort.
    const locations = locator.locate("NavigatorUAData.prototype.toJSON");
    expect(locations.length).toBeGreaterThanOrEqual(1);
    expect(locations.some((l) => l.file.includes("client-hints-patch.ts"))).toBe(true);
  });

  it("should prefer surface-matched results over unknown-surface results", () => {
    const locator = new SourceLocator();
    locator.buildIndex(INJECTION_DIR, TEST_ROOT);

    // Navigator.prototype.userAgent: defined in index.ts with
    // Navigator.prototype as target → surface = "Navigator"
    const locations = locator.locate("Navigator.prototype.userAgent");
    expect(locations).toHaveLength(1);
    expect(locations[0]!.file).toContain("index.ts");
    expect(locations[0]!.surface).toBe("Navigator");
  });

  it("should fall back to surface entry points when no property match", () => {
    const locator = new SourceLocator();
    locator.buildIndex(INJECTION_DIR, TEST_ROOT);

    // Date.prototype.valueOf: not explicitly defined in any test fixture,
    // but Date has entry points (defineProperties, class extends, globalThis)
    const locations = locator.locate("Date.prototype.valueOf");
    expect(locations.length).toBeGreaterThan(0);

    // Should point to Date surface entry points
    const files = locations.map((l) => l.file);
    expect(
      files.some((f) => f.includes("date-intl-patch.ts") || f.includes("geo-shim.ts")),
    ).toBe(true);
  });

  it("should detect surface entry points from class extends and globalThis", () => {
    const locator = new SourceLocator();
    locator.buildIndex(INJECTION_DIR, TEST_ROOT);

    // geo-shim.ts has: class SpoofedDate extends NativeDate {}
    //                   globalThis.Date = SpoofedDate;
    // Both should register as Date surface entry points.
    // Use a Date property with no direct match to trigger entry point fallback.
    const locations = locator.locate("Date.prototype.someUnpatchedMethod");
    const files = locations.map((l) => l.file);
    expect(files.some((f) => f.includes("geo-shim.ts"))).toBe(true);
  });

  it("should aggregate locations across files when surface matches exist", () => {
    const locator = new SourceLocator();
    locator.buildIndex(INJECTION_DIR, TEST_ROOT);

    // "platform" is defined via defineGetter(Navigator.prototype, "platform", ...)
    // in index.ts → surface = "Navigator"
    const locations = locator.locate("Navigator.prototype.platform");
    expect(locations.some((l) => l.file.includes("index.ts"))).toBe(true);
    expect(locations.every((l) => l.surface === "Navigator")).toBe(true);
  });
});
