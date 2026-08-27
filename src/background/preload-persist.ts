import type { PreparedRuntimeDecisions } from "@/background/prepared-runtime-decisions";
import { PRELOAD_STATE_KEY } from "@/content/preloaded-runtime";
import type { TrustedSite } from "@/shared/types";

type PreloadPersistSource = {
  getPreparedDecisions: () => PreparedRuntimeDecisions | null;
  getLastKnownTrustedSites: () => TrustedSite[] | null;
};

/**
 * Writes the current prepared catalog to session storage without rebuilding
 * decisions. Host-bound `*<siteKey>` rows already in the fence cache survive;
 * a full `createPreparedDecisions` rebuild would wipe them.
 */
export const writePreparedPreloadState = async (
  prepared: PreparedRuntimeDecisions,
  trustedSites: readonly TrustedSite[],
): Promise<void> => {
  await chrome.storage.session.set({
    [PRELOAD_STATE_KEY]: {
      entries: prepared.getPreloadedEntries(),
      nativeRulePatterns: prepared.getNativeRulePatterns(),
      trustedSites,
    },
  });
};

export const persistPreparedPreloadState = async (
  source: PreloadPersistSource,
): Promise<void> => {
  const prepared = source.getPreparedDecisions();
  if (!prepared) {
    return;
  }
  await writePreparedPreloadState(prepared, source.getLastKnownTrustedSites() ?? []);
};

export const persistPreparedPreloadStateSafely = async (
  source: PreloadPersistSource,
): Promise<void> => {
  try {
    await persistPreparedPreloadState(source);
  } catch (error) {
    console.warn("Failed to persist fenced preload state.", error);
  }
};
