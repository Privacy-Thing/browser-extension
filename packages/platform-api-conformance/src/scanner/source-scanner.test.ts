import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { BRAND_FILE_STEM } from "@privacy-brand/tooling-shared/brand";
import { afterEach, describe, expect, it } from "vitest";

import { SourceScanner } from "./source-scanner.js";

const tempDirs: string[] = [];

const createFixtureDir = (): string => {
  const dir = mkdtempSync(join(tmpdir(), `${BRAND_FILE_STEM}-source-scanner-`));
  tempDirs.push(dir);
  return dir;
};

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

describe("SourceScanner.scan", () => {
  it("counts unique indexed patch sites instead of wrapper call volume", () => {
    const fixtureDir = createFixtureDir();
    mkdirSync(join(fixtureDir, "main"), { recursive: true });

    writeFileSync(
      join(fixtureDir, "main", "patch.ts"),
      `
        Object.defineProperty(Date.prototype, "toString", {
          configurable: true,
          value: maskAsNative(function toString() {}, createNativeSource("toString"), 0),
        });

        Object.defineProperties(Navigator.prototype, {
          language: {
            get: defineGetter("language", () => "en-GB"),
          },
          languages: {
            get: defineGetter("languages", () => ["en-GB", "en"]),
          },
        });
      `,
    );

    const stats = SourceScanner.scan(fixtureDir);

    expect(stats.indexedPropertyCount).toBe(3);
    expect(stats.totalEstimated).toBe(3);
  });

  it("collapses duplicated injection-path copies of the same public API property", () => {
    const fixtureDir = createFixtureDir();
    mkdirSync(join(fixtureDir, "main"), { recursive: true });
    mkdirSync(join(fixtureDir, "worker"), { recursive: true });

    const duplicatePatch = `
      Object.defineProperty(Date.prototype, "getTimezoneOffset", {
        configurable: true,
        value: maskAsNative(function getTimezoneOffset() {}, createNativeSource("getTimezoneOffset"), 0),
      });
    `;

    writeFileSync(join(fixtureDir, "main", "patch.ts"), duplicatePatch);
    writeFileSync(join(fixtureDir, "worker", "patch.ts"), duplicatePatch);

    const stats = SourceScanner.scan(fixtureDir);

    expect(stats.indexedPropertyCount).toBe(1);
    expect(stats.totalEstimated).toBe(1);
  });
});
