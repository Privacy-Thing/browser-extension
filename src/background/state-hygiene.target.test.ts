import { afterEach, describe, expect, it, vi } from "vitest";

import {
  cleanupDomainState,
  cleanupHostnameState,
  cleanupHostnamesState,
  getRegistrableHostname,
  shouldCleanupExactHosts,
  shouldCleanupTabForHosts,
} from "@/background/state-hygiene";

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
    storeId: "0",
    value: "x",
    hostOnly: false,
    httpOnly: false,
    sameSite: "no_restriction",
    session: false,
    ...overrides,
  }) as CookieRecord;

describe("getRegistrableHostname", () => {
  it("normalizes plain hostnames", () => {
    expect(getRegistrableHostname("Example.COM")).toBe("example.com");
  });

  it("extracts hostname from full URLs", () => {
    expect(getRegistrableHostname("https://sub.example.com/path?q=1")).toBe(
      "sub.example.com",
    );
  });
});

describe("shouldCleanupExactHosts", () => {
  it("matches tabs whose hostname is in the cleanup list", () => {
    expect(
      shouldCleanupExactHosts(["shop.example.com"], "https://shop.example.com/path"),
    ).toBe(true);
  });

  it("does not match subdomains that are not explicitly listed", () => {
    expect(
      shouldCleanupTabForHosts(["example.com"], "https://shop.example.com/path"),
    ).toBe(false);
  });

  it("ignores unrelated or invalid tab urls", () => {
    expect(shouldCleanupTabForHosts(["example.com"], "https://other.test/path")).toBe(
      false,
    );
    expect(shouldCleanupTabForHosts(["example.com"], "chrome://extensions")).toBe(
      false,
    );
  });
});

describe("shouldCleanupTabForHosts (backwards-compat wrapper)", () => {
  it("retains exact-host matching semantics", () => {
    expect(
      shouldCleanupTabForHosts(["shop.example.com"], "https://shop.example.com/path"),
    ).toBe(true);
    expect(
      shouldCleanupTabForHosts(["example.com"], "https://shop.example.com/path"),
    ).toBe(false);
  });
});

describe("cleanupHostnamesState (chromium target)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("returns an empty list and makes no calls when hostnames is empty", async () => {
    const mocks = installChromeMocks();

    await expect(cleanupHostnamesState([])).resolves.toEqual([]);
    expect(mocks.browsingDataRemove).not.toHaveBeenCalled();
    expect(mocks.cookiesGetAll).not.toHaveBeenCalled();
    expect(mocks.tabsQuery).not.toHaveBeenCalled();
  });

  it("deduplicates and normalizes hostnames (target-agnostic return value)", async () => {
    installChromeMocks();

    const result = await cleanupHostnamesState([
      "Shop.Example.COM",
      "shop.example.com",
      "other.test",
    ]);

    expect(result).toEqual([
      "https://shop.example.com",
      "http://shop.example.com",
      "https://other.test",
      "http://other.test",
    ]);
  });

  it("removes cookies for each hostname including secure/insecure + leading-dot domains", async () => {
    const mocks = installChromeMocks({
      cookies: [
        makeCookie({
          domain: ".shop.example.com",
          name: "session",
          secure: true,
          path: "/",
        }),
        makeCookie({
          domain: "shop.example.com",
          name: "pref",
          secure: false,
          path: "",
        }),
      ],
    });

    await cleanupHostnamesState(["shop.example.com"]);

    expect(mocks.cookiesGetAll).toHaveBeenCalledWith({ domain: "shop.example.com" });
    expect(mocks.cookiesRemove).toHaveBeenCalledWith({
      url: "https://shop.example.com/",
      name: "session",
      storeId: "0",
    });
    expect(mocks.cookiesRemove).toHaveBeenCalledWith({
      url: "http://shop.example.com/",
      name: "pref",
      storeId: "0",
    });
  });

  it("runs page-registration cleanup only in tabs whose hostname is explicitly listed", async () => {
    const mocks = installChromeMocks({
      tabs: [
        { id: 1, url: "https://shop.example.com/" } as chrome.tabs.Tab,
        { id: 2, url: "https://unrelated.test/" } as chrome.tabs.Tab,
        { id: 3, url: "https://sub.shop.example.com/" } as chrome.tabs.Tab,
      ],
    });

    await cleanupHostnamesState(["shop.example.com"]);

    const scriptedTabIds = mocks.executeScript.mock.calls.map(
      ([args]) => (args as { target: { tabId: number } }).target.tabId,
    );
    expect(scriptedTabIds).toEqual([1]);
  });

  it("scopes cookies + tab cleanup by cookieStoreId when passed", async () => {
    const matchingCookie = makeCookie({
      domain: "shop.example.com",
      name: "scoped",
      storeId: "firefox-container-1",
      secure: true,
      path: "/",
    });
    const mocks = installChromeMocks({
      cookies: [matchingCookie],
      tabs: [
        {
          id: 1,
          url: "https://shop.example.com/",
          cookieStoreId: "firefox-container-1",
        } as chrome.tabs.Tab & { cookieStoreId?: string },
        {
          id: 2,
          url: "https://shop.example.com/",
          cookieStoreId: "firefox-container-2",
        } as chrome.tabs.Tab & { cookieStoreId?: string },
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

    const scriptedTabIds = mocks.executeScript.mock.calls.map(
      ([args]) => (args as { target: { tabId: number } }).target.tabId,
    );
    expect(scriptedTabIds).toEqual([1]);
  });
});

describe("cleanupHostnameState", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("delegates to cleanupHostnamesState with a single-host list", async () => {
    const mocks = installChromeMocks();

    const result = await cleanupHostnameState("shop.example.com");

    expect(result).toEqual(["https://shop.example.com", "http://shop.example.com"]);
    expect(mocks.browsingDataRemove).toHaveBeenCalledTimes(1);
  });
});

describe("cleanupDomainState (backwards-compat wrapper)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("keeps delegating to exact-host cleanup", async () => {
    installChromeMocks();

    await expect(cleanupDomainState("shop.example.com")).resolves.toEqual([
      "https://shop.example.com",
      "http://shop.example.com",
    ]);
  });
});
