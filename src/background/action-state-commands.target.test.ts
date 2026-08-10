import { afterEach, describe, expect, it, vi } from "vitest";

import { createActionHandlers } from "@/background/action-state-commands";

type ActionStateCommandDeps = Parameters<typeof createActionHandlers>[0];

const createDeps = (): ActionStateCommandDeps => ({
  actionIconPaths: {
    neutral: {},
    unsupported: {},
    active: {},
    "attention-1": {},
    "attention-2": {},
    attention: {},
    off: {},
  },
  findDisplayedRule: vi.fn(() => null),
  getCachedState: vi.fn(async () => null as never),
  getExactHostname: (url) => new URL(url).hostname,
  getDateBadgeSetting: vi.fn(() => false),
  getBadgeCountSetting: vi.fn(() => false),
  getSurfaceAccess: vi.fn(() => ({})),
  getSurfaceErrors: vi.fn(() => ({})),
  getRealmEvidence: vi.fn(() => ({})),
  isSupportedWebUrl: (url): url is string =>
    typeof url === "string" &&
    (url.startsWith("http://") || url.startsWith("https://")),
  logExtensionEvent: vi.fn() as ActionStateCommandDeps["logExtensionEvent"],
  resolveFallbackId: vi.fn(() => null),
  toExtensionIconPaths: (paths) => paths,
});

describe("createActionHandlers", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("cancels a pending badge refresh for a removed tab", async () => {
    vi.useFakeTimers();
    const deps = createDeps();
    const handlers = createActionHandlers(deps);

    handlers.scheduleBadgeRefresh(7);
    handlers.clearBadgeRefreshTimer(7);
    await vi.runAllTimersAsync();

    expect(deps.getBadgeCountSetting).not.toHaveBeenCalled();
  });

  it("coalesces duplicate badge refresh requests", async () => {
    vi.useFakeTimers();
    const deps = createDeps();
    const handlers = createActionHandlers(deps);

    handlers.scheduleBadgeRefresh(7);
    handlers.scheduleBadgeRefresh(7);
    await vi.runAllTimersAsync();

    expect(deps.getBadgeCountSetting).toHaveBeenCalledTimes(1);
  });
});
