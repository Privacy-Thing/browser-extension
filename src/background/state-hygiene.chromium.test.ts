import { afterEach, describe, expect, it, vi } from "vitest";

import { cleanupHostnamesState } from "@/background/state-hygiene";

type BrowsingDataRemoveArgs = [
  chrome.browsingData.RemovalOptions & Record<string, unknown>,
  chrome.browsingData.DataTypeSet,
];

const installChromeMocks = () => {
  const browsingDataRemove = vi.fn().mockResolvedValue(undefined);
  const cookiesGetAll = vi.fn().mockResolvedValue([]);
  const cookiesRemove = vi.fn().mockResolvedValue(undefined);
  const tabsQuery = vi.fn().mockResolvedValue([]);
  const executeScript = vi.fn().mockResolvedValue(undefined);

  vi.stubGlobal("chrome", {
    browsingData: { remove: browsingDataRemove },
    cookies: { getAll: cookiesGetAll, remove: cookiesRemove },
    tabs: { query: tabsQuery },
    scripting: { executeScript },
  });

  return { browsingDataRemove };
};

describe("cleanupHostnamesState (chromium target, origins filter shape)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("uses origins filter with https+http variants and full cleanup type set", async () => {
    const mocks = installChromeMocks();

    await cleanupHostnamesState(["Shop.Example.COM", "shop.example.com", "other.test"]);

    const [filter, typeSet] = mocks.browsingDataRemove.mock
      .calls[0] as BrowsingDataRemoveArgs;
    expect(filter).toEqual({
      origins: [
        "https://shop.example.com",
        "http://shop.example.com",
        "https://other.test",
        "http://other.test",
      ],
    });
    expect(typeSet).toMatchObject({
      cacheStorage: true,
      cookies: true,
      indexedDB: true,
      localStorage: true,
      serviceWorkers: true,
    });
  });

  it("includes exact origins when cleanup runs on a ported web origin", async () => {
    const mocks = installChromeMocks();

    await cleanupHostnamesState(["127.0.0.1"], {
      exactOrigins: ["http://127.0.0.1:60722/path", "http://127.0.0.1:60722"],
    });

    const [filter] = mocks.browsingDataRemove.mock.calls[0] as BrowsingDataRemoveArgs;
    expect(filter).toEqual({
      origins: ["https://127.0.0.1", "http://127.0.0.1", "http://127.0.0.1:60722"],
    });
  });
});
