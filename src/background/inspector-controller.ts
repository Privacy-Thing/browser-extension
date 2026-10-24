import type { PauseSeedDeps } from "@/background/host-pause-seed";
import { createInspectorHandlers } from "@/background/inspector-commands";
import { applyInspectorLive, probeInspectorLive } from "@/background/inspector-live";
import type { ResolutionDecision } from "@/background/prepared-runtime-decisions";
import { publishSidebarEvent } from "@/background/sidebar-event-hub";
import {
  initializeInspectors,
  navigateInspector,
  removeInspector,
} from "@/background/storage/inspector-sessions";
import { fireAndForget } from "@/shared/async";
import { BUILD_BROWSER_TARGET } from "@/shared/build-flags";
import { EXTENSION_COMMAND_TYPES } from "@/shared/extension-contract";
import type { EffectiveTabContext } from "@/shared/types";

/** A reload replaces every child document, so only the top document is seeded. */
const seedTopDocument = (
  context: EffectiveTabContext,
  decision: ResolutionDecision,
  deps: PauseSeedDeps,
): Promise<void> =>
  BUILD_BROWSER_TARGET === "chromium"
    ? deps.seedChromiumWindow(context.tabId, 0, decision)
    : deps.injectFxWindowSeed({
        tabId: context.tabId,
        frameId: 0,
        ...(context.cookieStoreId ? { cookieStoreId: context.cookieStoreId } : {}),
      });

export const registerInspector = (
  deps: PauseSeedDeps & {
    resolveRuntimeDecision: (
      hostname: string,
      cookieStoreId?: string,
    ) => Promise<ResolutionDecision>;
    invalidate: (tabId: number) => void;
  },
) => {
  const handlers = createInspectorHandlers({
    resolveRuntimeDecision: deps.resolveRuntimeDecision,
    prepare: (context, decision) => seedTopDocument(context, decision, deps),
    invalidate: deps.invalidate,
    publish: (tabId) =>
      publishSidebarEvent({ type: "doctor-state-invalidated", tabId }),
    applyLive: applyInspectorLive,
    probeLive: probeInspectorLive,
  });
  chrome.tabs.onRemoved.addListener((tabId) => fireAndForget(removeInspector(tabId)));
  // Downloads and 204 responses never commit; the armed document stays in place.
  chrome.webNavigation.onCommitted.addListener((details) => {
    if (details.frameId !== 0) return;
    const hostname = /^https?:/.test(details.url) ? new URL(details.url).hostname : "";
    fireAndForget(navigateInspector(details.tabId, hostname));
  });
  fireAndForget(initializeInspectors());
  return handlers.inspectorCommand;
};

export const isInspectorCommand = (type: string): boolean =>
  type === EXTENSION_COMMAND_TYPES.getXRayInspectorState ||
  type === EXTENSION_COMMAND_TYPES.setXRayInspector ||
  type === EXTENSION_COMMAND_TYPES.clearXRayInspector;
