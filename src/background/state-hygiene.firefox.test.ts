import { afterEach, describe, expect, it, vi } from "vitest";

import { cleanupHostnamesState } from "@/background/state-hygiene";

type BrowsingDataRemoveArgs = [
  chrome.browsingData.RemovalOptions & Record<string, unknown>,
  chrome.browsingData.DataTypeSet,
];

type CookieRecord = chrome.cookies.Cookie;

type ChromeMocks = {
  browsingDataRemove: ReturnType<typeof vi.fn>;
  cookiesGetAll: ReturnType<typeof vi.fn>;
  cookiesRemove: ReturnType<typeof vi.fn>;
  tabsQuery: ReturnType<typeof vi.fn>;
  executeScript: ReturnType<typeof vi.fn>;
};

const installChromeMocks = (
  overrides: {
    cookies?: CookieRecord[];
    tabs?: Array<chrome.tabs.Tab & { cookieStoreId?: string }>;
  } = {},
): ChromeMocks => {
  const browsingDataRemove = vi.fn().mockResolvedValue(undefined);
  const cookiesGetAll = vi.fn().mockResolvedValue(overrides.cookies ?? []);
  const cookiesRemove = vi.fn().mockResolvedValue(undefined);
  const tabsQuery = vi.fn().mockResolvedValue(overrides.tabs ?? []);
  const executeScript = vi.fn().mockResolvedValue(undefined);

  vi.stubGlobal("chrome", {
    browsingData: { remove: browsingDataRemove },
    cookies: { getAll: cookiesGetAll, remove: cookiesRemove },
    tabs: { query: tabsQuery },
    scripting: { executeScript },
  });

  return { browsingDataRemove, cookiesGetAll, cookiesRemove, tabsQuery, executeScript };
};

const makeCookie = (overrides: Partial<CookieRecord> = {}): CookieRecord =>
  ({
    domain: "example.com",
    name: "session",
    path: "/",
    secure: true,
    storeId: "firefox-default",
    value: "x",
    hostOnly: false,
    httpOnly: false,
    sameSite: "no_restriction",
    session: false,
    ...overrides,
  }) as CookieRecord;

describe("cleanupHostnamesState (firefox target)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("uses hostnames filter (not origins) and includes serviceWorkers when no cookieStoreId", async () => {
    const mocks = installChromeMocks();

    await cleanupHostnamesState(["Shop.Example.COM", "other.test"]);

    const [filter, typeSet] = mocks.browsingDataRemove.mock
      .calls[0] as BrowsingDataRemoveArgs;
    expect(filter).toEqual({ hostnames: ["shop.example.com", "other.test"] });
    expect(filter).not.toHaveProperty("origins");
    expect(typeSet).toMatchObject({
      cookies: true,
      indexedDB: true,
      localStorage: true,
      serviceWorkers: true,
    });
  });

  it("scopes browsingData filter by cookieStoreId and drops serviceWorkers (container-incompatible)", async () => {
    const mocks = installChromeMocks();

    await cleanupHostnamesState(["shop.example.com"], {
      cookieStoreId: "firefox-container-1",
    });

    const [filter, typeSet] = mocks.browsingDataRemove.mock
      .calls[0] as BrowsingDataRemoveArgs;
    expect(filter).toEqual({
      hostnames: ["shop.example.com"],
      cookieStoreId: "firefox-container-1",
    });
    expect(typeSet).toMatchObject({
      cookies: true,
      indexedDB: true,
      localStorage: true,
    });
    expect(typeSet).not.toHaveProperty("serviceWorkers");
  });

  it("still runs per-host cookie cleanup with storeId scoping on firefox", async () => {
    const mocks = installChromeMocks({
      cookies: [
        makeCookie({
          domain: "shop.example.com",
          name: "scoped",
          storeId: "firefox-container-1",
          secure: true,
          path: "/",
        }),
      ],
    });

    await cleanupHostnamesState(["shop.example.com"], {
      cookieStoreId: "firefox-container-1",
    });

    expect(mocks.cookiesGetAll).toHaveBeenCalledWith({
      domain: "shop.example.com",
      storeId: "firefox-container-1",
    });
    expect(mocks.cookiesRemove).toHaveBeenCalledWith({
      url: "https://shop.example.com/",
      name: "scoped",
      storeId: "firefox-container-1",
    });
  });
});
