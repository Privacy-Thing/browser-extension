import { buildFirefoxShimState } from "@privacy-brand/refract-browser/common/firefox-shim-state";
import { getWindowSeedPrefix } from "@privacy-brand/refract-browser/common/runtime-config";

import { seedFxWindowState } from "@/background/main-world-injection";
import type { ResolutionDecision } from "@/background/prepared-runtime-decisions";
import { BUILD_BROWSER_TARGET } from "@/shared/build-flags";
import type { EffectiveTabContext } from "@/shared/types";

export type PauseSeedDeps = {
  seedChromiumWindow: (
    tabId: number,
    frameId: number,
    decision: ResolutionDecision,
  ) => Promise<void>;
  injectFxWindowSeed: (input: {
    tabId: number;
    frameId: number;
    cookieStoreId?: string;
  }) => Promise<void>;
};

export const seedPauseFrames = async (
  context: EffectiveTabContext,
  decision: ResolutionDecision,
  deps: PauseSeedDeps,
): Promise<void> => {
  const frames = await chrome.webNavigation
    .getAllFrames({ tabId: context.tabId })
    .catch(() => null);
  const frameIds = [...new Set([0, ...(frames ?? []).map((frame) => frame.frameId)])];
  // Existing child documents persist window.name while the tab unloads too.
  // Seed every frame with its top-document decision before triggering reload.
  if (BUILD_BROWSER_TARGET === "chromium") {
    await Promise.all(
      frameIds.map((frameId) =>
        deps.seedChromiumWindow(context.tabId, frameId, decision),
      ),
    );
    return;
  }
  await deps.injectFxWindowSeed({
    tabId: context.tabId,
    frameId: 0,
    ...(context.cookieStoreId ? { cookieStoreId: context.cookieStoreId } : {}),
  });
  const childIds = frameIds.filter((frameId) => frameId !== 0);
  if (childIds.length === 0) return;
  const state = {
    ...buildFirefoxShimState(decision.snapshot),
    ...(decision.hostPause ? { hostPause: decision.hostPause } : {}),
  };
  await chrome.scripting
    .executeScript({
      target: { tabId: context.tabId, frameIds: childIds },
      world: "MAIN",
      func: seedFxWindowState,
      args: [
        { entries: [{ pattern: "*", state }], containerState: state },
        getWindowSeedPrefix(),
        __PT_SHIM_GUARD_KEY__,
      ],
    })
    .catch(() => undefined);
};
