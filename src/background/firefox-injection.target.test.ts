import { afterEach, describe, expect, it, vi } from "vitest";

import { createFxInjection } from "@/background/firefox-injection";
import { BUILD_BROWSER_TARGET } from "@/shared/build-flags";

vi.mock("@/background/firefox-content-scripts", () => ({
  getRegisteredFxScriptIds: () => [],
}));

describe("createFxInjection", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it.runIf(BUILD_BROWSER_TARGET === "firefox")(
    "shares one refresh and permits a later refresh",
    async () => {
      let resolvePermission: ((value: boolean) => void) | undefined;
      const hasUserScriptsPermission = vi.fn(
        () =>
          new Promise<boolean>((resolve) => {
            resolvePermission = resolve;
          }),
      );
      const syncFirefoxUserScripts = vi.fn(async () => undefined);
      vi.stubGlobal("chrome", {
        scripting: {
          getRegisteredContentScripts: vi.fn(async () => []),
          unregisterContentScripts: vi.fn(async () => undefined),
          registerContentScripts: vi.fn(async () => undefined),
        },
      });
      const { refreshFxInjectionMode } = createFxInjection({
        mainWorld: "MAIN",
        hasUserScriptsPermission,
        syncFirefoxUserScripts,
        unregisterUserScripts: vi.fn(async () => undefined),
      });

      const first = refreshFxInjectionMode();
      const second = refreshFxInjectionMode();
      expect(hasUserScriptsPermission).toHaveBeenCalledTimes(1);
      resolvePermission?.(true);
      await Promise.all([first, second]);
      expect(syncFirefoxUserScripts).toHaveBeenCalledTimes(1);

      hasUserScriptsPermission.mockResolvedValueOnce(true);
      await refreshFxInjectionMode();
      expect(hasUserScriptsPermission).toHaveBeenCalledTimes(2);
    },
  );

  it.runIf(BUILD_BROWSER_TARGET === "firefox")(
    "clears a rejected refresh so it can be retried",
    async () => {
      const syncFirefoxUserScripts = vi
        .fn<() => Promise<void>>()
        .mockRejectedValueOnce(new Error("sync failed"))
        .mockResolvedValueOnce(undefined);
      vi.stubGlobal("chrome", {
        scripting: {
          getRegisteredContentScripts: vi.fn(async () => []),
          unregisterContentScripts: vi.fn(async () => undefined),
          registerContentScripts: vi.fn(async () => undefined),
        },
      });
      const { refreshFxInjectionMode } = createFxInjection({
        mainWorld: "MAIN",
        hasUserScriptsPermission: vi.fn(async () => true),
        syncFirefoxUserScripts,
        unregisterUserScripts: vi.fn(async () => undefined),
      });

      await expect(refreshFxInjectionMode()).rejects.toThrow("sync failed");
      await expect(refreshFxInjectionMode()).resolves.toBeUndefined();
      expect(syncFirefoxUserScripts).toHaveBeenCalledTimes(2);
    },
  );
});
