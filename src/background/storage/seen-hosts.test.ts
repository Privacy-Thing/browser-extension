import { describe, expect, it } from "vitest";

import {
  findIdentityHosts,
  findIdentityOrigins,
  findIdentityHostRecords,
  MAX_SEEN_HOSTS,
  pruneSeenHosts,
  rememberSeenHost,
  SEEN_HOSTS_TTL_MS,
} from "@/background/storage/seen-hosts";
import type { SeenHostRecord } from "@/shared/types";

const recordAt = (
  partial: Omit<SeenHostRecord, "lastSeenAt">,
  isoDate: string,
): SeenHostRecord => ({ ...partial, lastSeenAt: isoDate });

const recentIso = (ageMs = 60_000): string =>
  new Date(Date.now() - ageMs).toISOString();

describe("rememberSeenHost", () => {
  it("overwrites the previous active identity for the same exact origin + cookieStoreId", () => {
    const base = recordAt(
      {
        hostname: "shop.example.com",
        exactOrigin: "https://shop.example.com",
        cookieStoreId: "firefox-container-1",
        identityKind: "rule",
        identityPattern: "*.example.com",
        identitySeedKey: "seed-old",
      },
      "2026-04-01T00:00:00.000Z",
    );

    const result = rememberSeenHost(
      [base],
      {
        hostname: "shop.example.com",
        exactOrigin: "https://shop.example.com",
        cookieStoreId: "firefox-container-1",
        identityKind: "container",
        identityStoreId: "firefox-container-1",
        identitySeedKey: "seed-new",
      },
      new Date("2026-04-10T00:00:00.000Z"),
    );

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      hostname: "shop.example.com",
      cookieStoreId: "firefox-container-1",
      identityKind: "container",
      identityStoreId: "firefox-container-1",
      identitySeedKey: "seed-new",
    });
  });

  it("keeps a separate record when the same hostname is seen in a different cookieStoreId", () => {
    const existing = recordAt(
      {
        hostname: "shop.example.com",
        identityKind: "rule",
        identityPattern: "shop.example.com",
        identitySeedKey: "seed-default",
      },
      "2026-04-01T00:00:00.000Z",
    );

    const result = rememberSeenHost(
      [existing],
      {
        hostname: "shop.example.com",
        cookieStoreId: "firefox-container-1",
        identityKind: "container",
        identityStoreId: "firefox-container-1",
        identitySeedKey: "seed-container",
      },
      new Date("2026-04-02T00:00:00.000Z"),
    );

    expect(result).toHaveLength(2);
  });

  it("keeps separate records for different exact origins on the same hostname", () => {
    const existing = recordAt(
      {
        hostname: "127.0.0.1",
        exactOrigin: "http://127.0.0.1:60722",
        identityKind: "rule",
        identityPattern: "127.0.0.1",
        identitySeedKey: "seed-default",
      },
      "2026-04-01T00:00:00.000Z",
    );

    const result = rememberSeenHost(
      [existing],
      {
        hostname: "127.0.0.1",
        exactOrigin: "http://127.0.0.1:60723",
        identityKind: "rule",
        identityPattern: "127.0.0.1",
        identitySeedKey: "seed-default",
      },
      new Date("2026-04-02T00:00:00.000Z"),
    );

    expect(result).toHaveLength(2);
  });
});

describe("pruneSeenHosts", () => {
  it("drops records beyond the TTL", () => {
    const now = new Date("2026-04-10T00:00:00.000Z").getTime();
    const staleRecord = recordAt(
      {
        hostname: "old.example.com",
        identityKind: "rule",
        identityPattern: "old.example.com",
        identitySeedKey: "abcdef",
      },
      new Date(now - SEEN_HOSTS_TTL_MS - 1).toISOString(),
    );
    const freshRecord = recordAt(
      {
        hostname: "fresh.example.com",
        identityKind: "rule",
        identityPattern: "fresh.example.com",
        identitySeedKey: "fedcba",
      },
      new Date(now - 1000).toISOString(),
    );

    const result = pruneSeenHosts([staleRecord, freshRecord], now);

    expect(result.map((entry) => entry.hostname)).toEqual(["fresh.example.com"]);
  });

  it("enforces the maximum size limit, keeping the most recent records", () => {
    const baseTime = new Date("2026-04-10T00:00:00.000Z").getTime();
    const records: SeenHostRecord[] = [];

    for (let i = 0; i < MAX_SEEN_HOSTS + 25; i += 1) {
      records.push(
        recordAt(
          {
            hostname: `host-${i}.example.com`,
            identityKind: "rule",
            identityPattern: `host-${i}.example.com`,
            identitySeedKey: `seed${i.toString(36).padStart(2, "0").slice(-2)}aa`,
          },
          new Date(baseTime - (records.length - i) * 1000).toISOString(),
        ),
      );
    }

    const pruned = pruneSeenHosts(records, baseTime);
    expect(pruned.length).toBe(MAX_SEEN_HOSTS);
  });
});

describe("findIdentityHosts", () => {
  const records: SeenHostRecord[] = [
    recordAt(
      {
        hostname: "a.example.com",
        exactOrigin: "https://a.example.com",
        identityKind: "rule",
        identityPattern: "*.example.com",
        identitySeedKey: "seed01",
      },
      recentIso(60_000),
    ),
    recordAt(
      {
        hostname: "b.example.com",
        exactOrigin: "https://b.example.com",
        identityKind: "rule",
        identityPattern: "*.example.com",
        identitySeedKey: "seed01",
      },
      recentIso(50_000),
    ),
    recordAt(
      {
        hostname: "shop.example.com",
        exactOrigin: "https://shop.example.com",
        identityKind: "rule",
        identityPattern: "shop.example.com",
        identitySeedKey: "seed02",
      },
      recentIso(40_000),
    ),
    recordAt(
      {
        hostname: "x.example.com",
        exactOrigin: "moz-extension://not-web",
        cookieStoreId: "firefox-container-1",
        identityKind: "container",
        identityStoreId: "firefox-container-1",
        identitySeedKey: "cseed1",
      },
      recentIso(30_000),
    ),
    recordAt(
      {
        hostname: "unmatched-a.example.com",
        exactOrigin: "https://unmatched-a.example.com",
        identityKind: "fallback",
        identitySeedKey: "fseed1",
      },
      recentIso(20_000),
    ),
    recordAt(
      {
        hostname: "unmatched-b.example.com",
        exactOrigin: "https://unmatched-b.example.com",
        identityKind: "fallback",
        identitySeedKey: "fseed1",
      },
      recentIso(10_000),
    ),
  ];

  it("returns wildcard hosts sharing the same pattern and seed", () => {
    const hosts = findIdentityHosts(records, {
      kind: "rule",
      pattern: "*.example.com",
      ruleSeedKey: "seed01",
    });

    expect(new Set(hosts)).toEqual(new Set(["a.example.com", "b.example.com"]));
  });

  it("excludes hosts routed by a more specific rule with a different pattern/seed", () => {
    const hosts = findIdentityHosts(records, {
      kind: "rule",
      pattern: "*.example.com",
      ruleSeedKey: "seed01",
    });

    expect(hosts).not.toContain("shop.example.com");
  });

  it("returns container-scoped hosts matching cookieStoreId and seed", () => {
    const hosts = findIdentityHosts(records, {
      kind: "container",
      cookieStoreId: "firefox-container-1",
      ruleSeedKey: "cseed1",
    });

    expect(hosts).toEqual(["x.example.com"]);
  });

  it("returns exact origins for matching rule identities", () => {
    const origins = findIdentityOrigins(records, {
      kind: "rule",
      pattern: "*.example.com",
      ruleSeedKey: "seed01",
    });

    expect(new Set(origins)).toEqual(
      new Set(["https://a.example.com", "https://b.example.com"]),
    );
  });

  it("returns fallback hosts sharing the same fallback seed", () => {
    const hosts = findIdentityHosts(records, {
      kind: "fallback",
      ruleSeedKey: "fseed1",
    });

    expect(new Set(hosts)).toEqual(
      new Set(["unmatched-a.example.com", "unmatched-b.example.com"]),
    );
  });

  it("returns exact origins for matching fallback identities", () => {
    const origins = findIdentityOrigins(records, {
      kind: "fallback",
      ruleSeedKey: "fseed1",
    });

    expect(new Set(origins)).toEqual(
      new Set(["https://unmatched-a.example.com", "https://unmatched-b.example.com"]),
    );
  });

  it("returns structured records for matching identities without cookie payloads", () => {
    const matches = findIdentityHostRecords(records, {
      kind: "rule",
      pattern: "*.example.com",
      ruleSeedKey: "seed01",
    });

    expect(matches).toHaveLength(2);
    expect(matches[0]).toMatchObject({
      hostname: expect.any(String),
      exactOrigin: expect.any(String),
      identityKind: "rule",
      identityPattern: "*.example.com",
    });
    expect(matches[0]).not.toHaveProperty("cookieName");
    expect(matches[0]).not.toHaveProperty("cookieValue");
  });
});
