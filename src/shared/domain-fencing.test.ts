import { describe, expect, it } from "vitest";

import {
  applyFencedNoiseSeeds,
  applySnapshotFencing,
  deriveFenceBaseKey,
  deriveFencedSeedKey,
  getSiteKey,
} from "@/shared/domain-fencing";
import { createNoiseSeed, deriveSurfaceNoiseSeed } from "@/shared/fingerprint-seeds";
import type { BrowserFingerprint, RuntimeSnapshot } from "@/shared/types";

describe("getSiteKey", () => {
  it("returns the registrable domain for plain TLDs", () => {
    expect(getSiteKey("example.com")).toBe("example.com");
    expect(getSiteKey("www.example.com")).toBe("example.com");
    expect(getSiteKey("a.b.c.example.org")).toBe("example.org");
  });

  it("keeps one extra label for known multi-label suffixes", () => {
    expect(getSiteKey("www.example.co.uk")).toBe("example.co.uk");
    expect(getSiteKey("shop.example.com.au")).toBe("example.com.au");
    expect(getSiteKey("deep.sub.example.co.jp")).toBe("example.co.jp");
  });

  it("treats hosting-platform tenants as distinct sites", () => {
    expect(getSiteKey("alice.github.io")).toBe("alice.github.io");
    expect(getSiteKey("assets.alice.github.io")).toBe("alice.github.io");
    expect(getSiteKey("bob.netlify.app")).toBe("bob.netlify.app");
  });

  it("returns IP literals and single-label hosts unchanged", () => {
    expect(getSiteKey("127.0.0.1")).toBe("127.0.0.1");
    expect(getSiteKey("[::1]")).toBe("[::1]");
    expect(getSiteKey("localhost")).toBe("localhost");
    expect(getSiteKey("")).toBe("");
  });

  it("normalizes case and trailing dots", () => {
    expect(getSiteKey("WWW.Example.COM.")).toBe("example.com");
  });
});

describe("fence key derivation", () => {
  it("is deterministic and never exposes the rule seed", () => {
    const fenceBaseKey = deriveFenceBaseKey("abc123");
    expect(fenceBaseKey).toBe(deriveFenceBaseKey("abc123"));
    expect(fenceBaseKey).not.toContain("abc123");
    expect(deriveFenceBaseKey("abc124")).not.toBe(fenceBaseKey);
  });

  it("derives a valid 6-char base36 seed key per site", () => {
    const fenceBaseKey = deriveFenceBaseKey("abc123");
    const first = deriveFencedSeedKey(fenceBaseKey, "example.com");
    const second = deriveFencedSeedKey(fenceBaseKey, "example.org");
    expect(first).toMatch(/^[a-z0-9]{6}$/);
    expect(second).toMatch(/^[a-z0-9]{6}$/);
    expect(first).not.toBe(second);
    expect(deriveFencedSeedKey(fenceBaseKey, "example.com")).toBe(first);
  });
});

describe("applyFencedNoiseSeeds", () => {
  const markedFingerprint = (): BrowserFingerprint => ({
    canvasNoiseSeed: 111,
    audioNoiseSeed: 222,
    webGL: { suppressDebugInfo: true, readPixelsNoiseSeed: 333 },
    screen: { width: 1920, height: 1080 },
    hardwareConcurrency: 8,
    fencing: { key: deriveFenceBaseKey("abc123") },
  });

  it("returns the fingerprint unchanged without a marker", () => {
    const fingerprint: BrowserFingerprint = { canvasNoiseSeed: 111 };
    expect(applyFencedNoiseSeeds(fingerprint, "example.com")).toBe(fingerprint);
  });

  it("recomputes noise seeds per site and strips the marker", () => {
    const first = applyFencedNoiseSeeds(markedFingerprint(), "example.com");
    const second = applyFencedNoiseSeeds(markedFingerprint(), "example.org");

    expect(first.fencing).toBeUndefined();
    expect(first.canvasNoiseSeed).not.toBe(111);
    expect(first.audioNoiseSeed).not.toBe(222);
    expect(first.webGL?.readPixelsNoiseSeed).not.toBe(333);
    expect(first.canvasNoiseSeed).not.toBe(second.canvasNoiseSeed);
    expect(first.audioNoiseSeed).not.toBe(second.audioNoiseSeed);
    expect(first.webGL?.readPixelsNoiseSeed).not.toBe(
      second.webGL?.readPixelsNoiseSeed,
    );
    // Catalog-driven fields are left at carried values.
    expect(first.screen).toEqual({ width: 1920, height: 1080 });
    expect(first.hardwareConcurrency).toBe(8);
  });

  it("matches the background rebuild derivation exactly", () => {
    const fenceBaseKey = deriveFenceBaseKey("abc123");
    const fencedSeedKey = deriveFencedSeedKey(fenceBaseKey, "example.com");
    const baseSeed = createNoiseSeed({ ruleSeedKey: fencedSeedKey });

    const applied = applyFencedNoiseSeeds(markedFingerprint(), "example.com");
    expect(applied.canvasNoiseSeed).toBe(deriveSurfaceNoiseSeed(baseSeed, "canvas"));
    expect(applied.audioNoiseSeed).toBe(deriveSurfaceNoiseSeed(baseSeed, "audio"));
    expect(applied.webGL?.readPixelsNoiseSeed).toBe(
      deriveSurfaceNoiseSeed(baseSeed, "webgl"),
    );
  });
});

describe("applySnapshotFencing", () => {
  const baseSnapshot = (fingerprint?: BrowserFingerprint): RuntimeSnapshot => ({
    geo: { latitude: 0, longitude: 0, accuracy: 0, noiseRadius: 50 },
    locale: {
      language: "en-US",
      languages: ["en-US"],
      timeZone: "UTC",
      acceptLanguage: "en-US",
    },
    date: { baseEpochMs: 0, offsetMs: 0, timeZone: "UTC" },
    debugMode: false,
    watchPositionDelay: [60, 500],
    ...(fingerprint ? { fingerprint } : {}),
  });

  it("is a no-op for unmarked snapshots", () => {
    const unmarked = baseSnapshot({ canvasNoiseSeed: 1 });
    expect(applySnapshotFencing(unmarked, "sub.example.com")).toBe(unmarked);
    const bare = baseSnapshot();
    expect(applySnapshotFencing(bare, "sub.example.com")).toBe(bare);
  });

  it("fences by registrable domain, not full hostname", () => {
    const marked = (): RuntimeSnapshot =>
      baseSnapshot({
        canvasNoiseSeed: 1,
        fencing: { key: deriveFenceBaseKey("abc123") },
      });

    const apex = applySnapshotFencing(marked(), "example.com");
    const sub = applySnapshotFencing(marked(), "deep.sub.example.com");
    expect(apex.fingerprint?.canvasNoiseSeed).toBe(sub.fingerprint?.canvasNoiseSeed);
    expect(apex.fingerprint?.fencing).toBeUndefined();
  });
});
