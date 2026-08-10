import { describe, expect, it, vi } from "vitest";

import {
  removeCleanupContexts,
  shouldReloadCleanupTab,
  type CleanupCommandHelperDeps,
} from "@/background/cleanup-command-helpers";

const createDeps = (
  contexts: CleanupCommandHelperDeps["getActiveTabContexts"] extends () => infer T
    ? T
    : never,
): CleanupCommandHelperDeps => ({
  getActiveTabContexts: () => contexts,
  isSupportedWebUrl: (url): url is string =>
    typeof url === "string" &&
    (url.startsWith("http://") || url.startsWith("https://")),
  removeActiveTabContext: vi.fn(),
  resolveTrackedIdentity: vi.fn(() => null),
});

describe("cleanup command helpers", () => {
  it("removes only matching runtime contexts from the requested container", () => {
    const deps = createDeps([
      {
        tabId: 1,
        hostname: "example.com",
        cookieStoreId: "firefox-container-1",
      },
      {
        tabId: 2,
        hostname: "example.com",
        cookieStoreId: "firefox-container-2",
      },
      {
        tabId: 3,
        hostname: "other.test",
        cookieStoreId: "firefox-container-1",
      },
    ]);

    expect(removeCleanupContexts(deps, ["example.com"], "firefox-container-1")).toEqual(
      [1],
    );
    expect(deps.removeActiveTabContext).toHaveBeenCalledWith(1);
    expect(deps.removeActiveTabContext).toHaveBeenCalledTimes(1);
  });

  it("adds an open cleanup page when it is not already among affected tabs", () => {
    const deps = createDeps([]);

    expect(
      shouldReloadCleanupTab(deps, {
        cleanupHostnames: ["example.com"],
        cookieStoreId: undefined,
        existingTabIds: [],
        pageUrl: "https://example.com/account",
        tab: { id: 7 } as chrome.tabs.Tab,
      }),
    ).toBe(7);
  });
});
