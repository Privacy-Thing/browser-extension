import { afterEach, expect, it, vi } from "vitest";

import { seedPauseFrames } from "./host-pause-seed";

import { BUILD_BROWSER_TARGET } from "@/shared/build-flags";

afterEach(() => vi.unstubAllGlobals());
it("replaces old carriers in every frame before reload with the top-document pause", async () => {
  const execute = vi.fn(async () => []);
  vi.stubGlobal("chrome", {
    webNavigation: {
      getAllFrames: vi.fn(async () => [{ frameId: 0 }, { frameId: 4 }, { frameId: 7 }]),
    },
    scripting: { executeScript: execute },
  });
  const seedChromiumWindow = vi.fn(async () => undefined);
  const injectFxWindowSeed = vi.fn(async () => undefined);
  const decision = {
    snapshot: null,
    trustedSiteMatched: false,
    hostPause: { hostname: "h.example", id: "pause", expiresAt: 1000 },
  };
  await seedPauseFrames(
    { tabId: 12, hostname: "h.example", cookieStoreId: "firefox-container-1" },
    decision,
    { seedChromiumWindow, injectFxWindowSeed },
  );
  if (BUILD_BROWSER_TARGET === "chromium") {
    expect(seedChromiumWindow.mock.calls).toEqual([
      [12, 0, decision],
      [12, 4, decision],
      [12, 7, decision],
    ]);
    expect(injectFxWindowSeed).not.toHaveBeenCalled();
  } else {
    expect(injectFxWindowSeed).toHaveBeenCalledWith({
      tabId: 12,
      frameId: 0,
      cookieStoreId: "firefox-container-1",
    });
    expect(execute).toHaveBeenCalledWith(
      expect.objectContaining({
        target: { tabId: 12, frameIds: [4, 7] },
        world: "MAIN",
        args: [
          expect.objectContaining({
            entries: [
              {
                pattern: "*",
                state: expect.objectContaining({
                  hostPause: decision.hostPause,
                  timeLocaleStatus: "absent",
                }),
              },
            ],
          }),
          expect.any(String),
          expect.any(String),
        ],
      }),
    );
  }
});
