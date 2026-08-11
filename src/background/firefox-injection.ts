import { getRegisteredFxScriptIds } from "@/background/firefox-content-scripts";
import { BUILD_BROWSER_TARGET, FX_RUNTIME_TEST_HOST } from "@/shared/build-flags";
import { FIREFOX_SCRIPT_IDS } from "@/shared/extension-contract";

type FirefoxInjectionModeDeps = {
  mainWorld: `${chrome.scripting.ExecutionWorld}`;
  hasUserScriptsPermission: () => Promise<boolean>;
  syncFirefoxUserScripts: () => Promise<unknown>;
  unregisterUserScripts: () => Promise<unknown>;
};

export const createFxInjection = (deps: FirefoxInjectionModeDeps) => {
  let injectionRefreshPromise: Promise<void> | null = null;

  const registerFxContentScripts = async (
    includeGeoShim: boolean,
    excludeMatches: string[] = [],
  ): Promise<void> => {
    if (BUILD_BROWSER_TARGET !== "firefox") {
      return;
    }

    try {
      const registeredScriptIds = getRegisteredFxScriptIds(
        await chrome.scripting.getRegisteredContentScripts(),
      );
      if (registeredScriptIds.length > 0) {
        await chrome.scripting.unregisterContentScripts({
          ids: registeredScriptIds,
        });
      }
    } catch {
      // May fail if scripts are not registered yet.
    }

    const registrations: chrome.scripting.RegisteredContentScript[] = [];

    if (includeGeoShim) {
      registrations.push({
        id: FIREFOX_SCRIPT_IDS.geoShim,
        matches: ["<all_urls>"],
        ...(excludeMatches.length > 0 ? { excludeMatches } : {}),
        allFrames: true,
        runAt: "document_start",
        js: ["main-world-early.js"],
        world: deps.mainWorld,
      });
    }

    registrations.push({
      id: FIREFOX_SCRIPT_IDS.mainWorld,
      matches: ["<all_urls>"],
      ...(excludeMatches.length > 0 ? { excludeMatches } : {}),
      allFrames: true,
      runAt: "document_start",
      js: ["main-world-runtime.js"],
      world: deps.mainWorld,
    });

    if (FX_RUNTIME_TEST_HOST) {
      registrations.push({
        id: FIREFOX_SCRIPT_IDS.timingSpike,
        matches: [
          `http://${FX_RUNTIME_TEST_HOST}/*`,
          `https://${FX_RUNTIME_TEST_HOST}/*`,
        ],
        allFrames: true,
        matchOriginAsFallback: true,
        runAt: "document_start",
        js: ["timing-spike.js"],
        world: deps.mainWorld,
      });
    }

    if (registrations.length > 0) {
      await chrome.scripting.registerContentScripts(registrations);
    }
  };

  const refreshFxInjectionMode = async (): Promise<void> => {
    if (BUILD_BROWSER_TARGET !== "firefox") {
      return;
    }

    if (injectionRefreshPromise) {
      await injectionRefreshPromise;
      return;
    }

    const refreshPromise = (async () => {
      const useUserScripts = await deps.hasUserScriptsPermission();
      if (useUserScripts) {
        await deps.syncFirefoxUserScripts();
        await registerFxContentScripts(true);
        return;
      }

      await deps.unregisterUserScripts();
      await registerFxContentScripts(true);
    })();

    injectionRefreshPromise = refreshPromise;

    try {
      await refreshPromise;
    } finally {
      injectionRefreshPromise = null;
    }
  };

  return {
    refreshFxInjectionMode,
  };
};
