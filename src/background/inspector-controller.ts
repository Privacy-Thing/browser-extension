import { seedPauseFrames, type PauseSeedDeps } from "@/background/host-pause-seed";
import { createInspectorHandlers } from "@/background/inspector-commands";
import type { ResolutionDecision } from "@/background/prepared-runtime-decisions";
import { publishSidebarEvent } from "@/background/sidebar-event-hub";
import {
  initializeInspectors,
  navigateInspector,
  removeInspector,
} from "@/background/storage/inspector-sessions";
import { fireAndForget } from "@/shared/async";
import { EXTENSION_COMMAND_TYPES } from "@/shared/extension-contract";

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
    prepare: (context, decision) => seedPauseFrames(context, decision, deps),
    invalidate: deps.invalidate,
    publish: (tabId) =>
      publishSidebarEvent({ type: "doctor-state-invalidated", tabId }),
  });
  chrome.tabs.onRemoved.addListener((tabId) => fireAndForget(removeInspector(tabId)));
  chrome.webNavigation.onBeforeNavigate.addListener((details) => {
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
