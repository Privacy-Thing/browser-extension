import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  loadTrustedSites,
  setTrustedSiteEnabled,
  upsertTrustedSite,
} from "@/background/storage/trusted-sites";

const storage = new Map<string, unknown>();

describe("trusted site storage mutations", () => {
  beforeEach(() => {
    storage.clear();
    vi.stubGlobal("chrome", {
      storage: {
        local: {
          get: vi.fn(async (key: string) => ({ [key]: storage.get(key) })),
          set: vi.fn(async (values: Record<string, unknown>) => {
            for (const [key, value] of Object.entries(values)) storage.set(key, value);
          }),
        },
      },
    });
  });

  it("serializes concurrent upserts so neither hostname is lost", async () => {
    await Promise.all([
      upsertTrustedSite("FIRST.EXAMPLE"),
      upsertTrustedSite("second.example"),
    ]);

    expect(await loadTrustedSites()).toEqual([
      { pattern: "first.example", enabled: true },
      { pattern: "second.example", enabled: true },
    ]);
  });

  it("updates an existing matched pattern without creating a duplicate", async () => {
    await upsertTrustedSite("*.example.com");
    await setTrustedSiteEnabled("*.EXAMPLE.COM", false);

    expect(await loadTrustedSites()).toEqual([
      { pattern: "*.example.com", enabled: false },
    ]);
  });
});
