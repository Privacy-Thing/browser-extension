import { isSupportedWebUrl } from "@/background/background-composition-helpers";
import { syncDynamicHeaderRules } from "@/background/dnr";
import type { EffectiveTabContext } from "@/shared/types";

export const createTabReloader =
  (activeTabContexts: Map<number, EffectiveTabContext>) =>
  async (tabIds: readonly number[]): Promise<void> => {
    const uniqueTabIds = [...new Set(tabIds)];
    let prunedStaleContext = false;

    await Promise.all(
      uniqueTabIds.map(async (tabId) => {
        const tab = await chrome.tabs.get(tabId).catch(() => undefined);
        if (!isSupportedWebUrl(tab?.url)) {
          prunedStaleContext = activeTabContexts.delete(tabId) || prunedStaleContext;
          return;
        }

        await chrome.tabs.reload(tabId).catch(() => undefined);
      }),
    );

    if (prunedStaleContext) {
      await syncDynamicHeaderRules([...activeTabContexts.values()]);
    }
  };

export const enableSessionStorage = async (): Promise<void> => {
  await chrome.storage.session
    .setAccessLevel?.({
      accessLevel: "TRUSTED_AND_UNTRUSTED_CONTEXTS" as chrome.storage.AccessLevel,
    })
    .catch(() => undefined);
};
