import { describe, expect, it } from "vitest";

import {
  countChromeVersions,
  pickChromeBuild,
  pickChromeFrames,
} from "./chrome-version-catalog";
import {
  chromeVersionCatalog,
  type ChromeVersionsByMajor,
} from "./chrome-versions.generated";

// The generated catalog is a rolling window: each metadata refresh adds new majors and
// drops old ones, and platforms can differ. Derive the major from the catalog instead of
// hard-coding it: the newest major with at least two builds on every platform.
const KNOWN_MAJOR = (() => {
  const platforms: readonly ChromeVersionsByMajor[] =
    Object.values(chromeVersionCatalog);
  const majors = Object.keys(chromeVersionCatalog.windows)
    .map(Number)
    .filter((major) =>
      platforms.every((byMajor) => (byMajor[String(major)]?.length ?? 0) >= 2),
    );
  const newest = Math.max(...majors);
  if (!Number.isFinite(newest)) {
    throw new Error("Chrome version catalog has no major shared by all platforms");
  }
  return newest;
})();

// Deterministic: same inputs always yield the same result
describe("pickChromeBuild", () => {
  it("returns a result for a known major version with Windows platform (Client Hints format)", () => {
    const result = pickChromeBuild(KNOWN_MAJOR, "Windows", 0);
    expect(result).not.toBeUndefined();
    expect(result?.build).toBeGreaterThanOrEqual(0);
    expect(result?.patch).toBeGreaterThanOrEqual(0);
  });

  it("returns a result for macOS Client Hints platform string", () => {
    const result = pickChromeBuild(KNOWN_MAJOR, "macOS", 0);
    expect(result).not.toBeUndefined();
  });

  it("returns a result for Linux Client Hints platform string", () => {
    const result = pickChromeBuild(KNOWN_MAJOR, "Linux", 0);
    expect(result).not.toBeUndefined();
  });

  it("normalizes navigator.platform Win32 to windows", () => {
    const fromCH = pickChromeBuild(KNOWN_MAJOR, "Windows", 0);
    const fromNav = pickChromeBuild(KNOWN_MAJOR, "Win32", 0);
    expect(fromNav).toEqual(fromCH);
  });

  it("normalizes navigator.platform Win64 to windows", () => {
    const fromCH = pickChromeBuild(KNOWN_MAJOR, "Windows", 0);
    const fromNav = pickChromeBuild(KNOWN_MAJOR, "Win64", 0);
    expect(fromNav).toEqual(fromCH);
  });

  it("normalizes navigator.platform MacIntel to mac", () => {
    const fromCH = pickChromeBuild(KNOWN_MAJOR, "macOS", 0);
    const fromNav = pickChromeBuild(KNOWN_MAJOR, "MacIntel", 0);
    expect(fromNav).toEqual(fromCH);
  });

  it("normalizes navigator.platform Linux x86_64 to linux", () => {
    const fromCH = pickChromeBuild(KNOWN_MAJOR, "Linux", 0);
    const fromNav = pickChromeBuild(KNOWN_MAJOR, "Linux x86_64", 0);
    expect(fromNav).toEqual(fromCH);
  });

  it("returns undefined for unknown platform", () => {
    expect(pickChromeBuild(KNOWN_MAJOR, "FreeBSD", 0)).toBeUndefined();
  });

  it("returns undefined when platform is undefined", () => {
    expect(pickChromeBuild(KNOWN_MAJOR, undefined, 0)).toBeUndefined();
  });

  it("returns undefined for a major version not in the catalog", () => {
    expect(pickChromeBuild(1, "Windows", 0)).toBeUndefined();
  });

  it("is deterministic: same inputs always produce the same output", () => {
    const a = pickChromeBuild(KNOWN_MAJOR, "Windows", 12345);
    const b = pickChromeBuild(KNOWN_MAJOR, "Windows", 12345);
    expect(a).toEqual(b);
  });

  it("different hash values may select different catalog entries", () => {
    const a = pickChromeBuild(KNOWN_MAJOR, "Windows", 0);
    const b = pickChromeBuild(KNOWN_MAJOR, "Windows", 1);
    // They might be equal if catalog has only one entry, but for 500 canary releases
    // of the same major they will differ most of the time.
    expect(a).toBeDefined();
    expect(b).toBeDefined();
  });

  it("never returns the excluded native build/patch", () => {
    // Exhaust all possible hash values modulo catalog size to confirm the excluded
    // entry never leaks through regardless of which slot the hash lands on.
    const allVersions = pickChromeFrames(KNOWN_MAJOR, "Windows");
    expect(allVersions.length).toBeGreaterThan(1);

    for (let hash = 0; hash < allVersions.length * 2; hash++) {
      const baseline = pickChromeBuild(KNOWN_MAJOR, "Windows", hash);
      if (!baseline) continue;
      const result = pickChromeBuild(KNOWN_MAJOR, "Windows", hash, baseline);
      // result must differ from the excluded version (or be undefined if catalog shrinks to 0)
      if (result) {
        expect(result).not.toEqual(baseline);
      }
    }
  });
});

describe("pickChromeFrames", () => {
  it("returns a non-empty array for a known major version", () => {
    const result = pickChromeFrames(KNOWN_MAJOR, "Windows");
    expect(result.length).toBeGreaterThan(0);
  });

  it("each entry has numeric build and patch strings", () => {
    const result = pickChromeFrames(KNOWN_MAJOR, "Windows");
    for (const entry of result) {
      expect(/^\d+$/.test(entry.build)).toBe(true);
      expect(/^\d+$/.test(entry.patch)).toBe(true);
    }
  });

  it("returns empty array for unknown platform", () => {
    expect(pickChromeFrames(KNOWN_MAJOR, "FreeBSD")).toHaveLength(0);
  });

  it("returns empty array when platform is undefined", () => {
    expect(pickChromeFrames(KNOWN_MAJOR, undefined)).toHaveLength(0);
  });

  it("returns empty array for unknown major version", () => {
    expect(pickChromeFrames(1, "Windows")).toHaveLength(0);
  });

  it("normalizes macOS Client Hints platform", () => {
    const fromCH = pickChromeFrames(KNOWN_MAJOR, "macOS");
    const fromNav = pickChromeFrames(KNOWN_MAJOR, "MacIntel");
    expect(fromCH).toEqual(fromNav);
  });
});

describe("countChromeVersions", () => {
  it("matches the animation catalog size for a major version and platform", () => {
    expect(countChromeVersions(KNOWN_MAJOR, "Windows")).toBe(
      pickChromeFrames(KNOWN_MAJOR, "Windows").length,
    );
  });
});
