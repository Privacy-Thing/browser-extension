import type { PopupCommandDeps } from "./popup-command-types";

import { BUILD_BROWSER_TARGET } from "@/shared/build-flags";
import type { FxPermissionResponse } from "@/shared/types";

export const createAccessHandlers = (deps: PopupCommandDeps) => {
  const requestUserScriptsAccess = async (
    tabId?: number,
  ): Promise<FxPermissionResponse> => {
    if (BUILD_BROWSER_TARGET !== "firefox") {
      return {
        ok: false,
        error: "Firefox-only permission.",
      };
    }

    const granted = await deps.grantUserScripts();
    if (!granted) {
      return {
        ok: true,
        granted: false,
      };
    }

    await deps.ensureStorageMigration();
    await deps.refreshCachedConfig();
    await deps.syncPreloadedState();
    await deps.refreshFxInjectionMode();

    if (typeof tabId === "number") {
      await chrome.tabs.reload(tabId).catch(() => undefined);
    }

    return {
      ok: true,
      granted: true,
    };
  };

  return {
    requestUserScriptsAccess,
  };
};
