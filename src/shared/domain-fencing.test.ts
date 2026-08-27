import { describe, expect, it } from "vitest";

import {
  deriveFenceBaseKey,
  deriveFencedSeedKey,
  getSiteKey,
  toFencePattern,
} from "@/shared/domain-fencing";

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
    expect(getSiteKey("docs.example.govt.nz")).toBe("example.govt.nz");
    expect(getSiteKey("mail.example.uk.com")).toBe("example.uk.com");
  });

  it("treats hosting-platform tenants as distinct sites", () => {
    expect(getSiteKey("alice.github.io")).toBe("alice.github.io");
    expect(getSiteKey("assets.alice.github.io")).toBe("alice.github.io");
    expect(getSiteKey("bob.netlify.app")).toBe("bob.netlify.app");
  });

  it("degrades unknown multi-label public suffixes to a coarser site key", () => {
    // Compact ccTLD/private heuristic, not a full PSL. Unlisted 3-label
    // suffixes keep the last two labels; unrelated tenants may share a key.
    expect(getSiteKey("school-a.k12.ca.us")).toBe("ca.us");
    expect(getSiteKey("school-b.k12.ca.us")).toBe("ca.us");
    expect(getSiteKey("alice.s3.amazonaws.com")).toBe("amazonaws.com");
    expect(getSiteKey("bob.s3.amazonaws.com")).toBe("amazonaws.com");
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

  it("builds an apex-and-subdomains catalog pattern from the site key", () => {
    expect(toFencePattern("example.com")).toBe("*example.com");
  });
});
