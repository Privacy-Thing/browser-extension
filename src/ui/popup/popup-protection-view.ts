import type {
  PopupProtectionStatus,
  ProtectionSummaryView,
} from "./popup-view-model-types";

import type { PopupState } from "@/shared/types";
import { t } from "@/ui/i18n";

const getProtectionSourceLabel = (
  source: PopupState["effectiveSummary"]["resolutionContext"]["source"],
): string => {
  switch (source) {
    case "site-rule":
      return t.popup.protectionSourceSiteRule;
    case "container":
      return t.popup.protectionSourceContainer;
    case "default-rule":
      return t.popup.protectionSourceDefaultRule;
    case "trusted-site":
      return t.popup.protectionSourceTrustedSite;
    case "none":
      return t.popup.protectionSourceNone;
  }
};

const getSurfaceLabel = (
  key: PopupState["effectiveSummary"]["surfaceSummary"]["surfaces"][number]["key"],
): string =>
  ({
    geolocation: t.popup.surfaceGeolocation,
    timeLocale: t.popup.surfaceTimeLocale,
    navigator: t.popup.surfaceNavigator,
    screen: t.popup.surfaceScreen,
    clientHints: t.popup.surfaceClientHints,
    battery: t.popup.surfaceBattery,
    canvas: t.popup.surfaceCanvas,
    webGL: t.popup.surfaceWebGL,
    audio: t.popup.surfaceAudio,
    webRTC: t.popup.surfaceWebRTC,
    worker: t.popup.surfaceWorker,
    serviceWorker: t.popup.surfaceServiceWorker,
    sharedWorker: t.popup.surfaceSharedWorker,
  })[key];

const getProtectionStatus = ({
  attentionCount,
  degradedCount,
  unrecoverableCount,
  unknownCount,
  state,
}: {
  attentionCount: number;
  degradedCount: number;
  unrecoverableCount: number;
  unknownCount: number;
  state: PopupState["effectiveSummary"]["resolutionContext"]["state"];
}): PopupProtectionStatus => {
  if (
    state === "panic" ||
    state === "trusted" ||
    state === "unsupported" ||
    state === "disabled" ||
    state === "unconfigured"
  ) {
    return "off";
  }
  if (unrecoverableCount > 0) return "unrecoverable";
  if (degradedCount > 0) return "degraded";
  if (attentionCount > 0) return "needs-attention";
  if (unknownCount > 0) return "unknown";
  return state === "active" || state === "protections" ? "protected" : "off";
};

const STATUS_LABELS: Record<PopupProtectionStatus, () => string> = {
  off: () => t.popup.protectionOff,
  unrecoverable: () => t.popup.protectionStateUnrecoverable,
  degraded: () => t.popup.protectionStateDegraded,
  "needs-attention": () => t.popup.protectionNeedsAttention,
  unknown: () => t.popup.protectionUnknown,
  protected: () => t.popup.protectionProtected,
};

const getProtectionException = (
  summary: PopupState["effectiveSummary"]["surfaceSummary"],
): string | undefined => {
  if (summary.highestPriorityAttention || summary.highestPriorityContext) {
    return t.popup.protectionPageMayNotWork;
  }
  const exception = summary.highestPriorityException;
  return exception
    ? t.popup.protectionException(getSurfaceLabel(exception.key))
    : undefined;
};

const getProtectionSummaryView = (
  popupState: PopupState | null,
): ProtectionSummaryView => {
  if (!popupState) {
    return {
      protectionTitle: t.popup.loading,
      protectionSource: "",
      protectionStatus: "off",
      protectionCounts: "",
      protectedSurfaceCount: 0,
      hasProtectionDetails: false,
    };
  }

  const { resolutionContext, surfaceSummary } = popupState.effectiveSummary;
  const protectionStatus = getProtectionStatus({
    attentionCount: surfaceSummary.highestPriorityAttention ? 1 : 0,
    degradedCount: surfaceSummary.counts.degraded,
    unrecoverableCount: surfaceSummary.counts.unrecoverable,
    unknownCount: surfaceSummary.counts.unknown,
    state: resolutionContext.state,
  });
  const protectionException = getProtectionException(surfaceSummary);
  return {
    protectionTitle: STATUS_LABELS[protectionStatus](),
    protectionStatus,
    protectedSurfaceCount:
      surfaceSummary.counts.protected +
      surfaceSummary.counts["browser-enforced"] +
      surfaceSummary.counts.repaired,
    protectionSource: getProtectionSourceLabel(resolutionContext.source),
    ...((resolutionContext.source === "site-rule" ||
      resolutionContext.source === "trusted-site") &&
    resolutionContext.pattern
      ? { protectionSourcePattern: resolutionContext.pattern }
      : {}),
    protectionCounts: t.popup.protectionCounts(surfaceSummary.counts),
    ...(protectionException ? { protectionException } : {}),
    hasProtectionDetails: surfaceSummary.complete,
  };
};

export const hasGlobalProtectionsOff = (popupState: PopupState | null): boolean =>
  Boolean(
    popupState &&
    !popupState.panicMode &&
    popupState.currentTab.supported &&
    popupState.effectiveSummary.resolutionContext.state === "disabled" &&
    popupState.currentRule.enabled !== false,
  );

export const getProtectionSummary = (
  popupState: PopupState | null,
  globalProtectionsOff: boolean,
): ProtectionSummaryView => {
  const summary = getProtectionSummaryView(popupState);
  if (!globalProtectionsOff) return summary;
  return {
    protectionTitle: t.popup.protectionDisabled,
    protectionSource: t.popup.protectionSourceGlobalSetting,
    protectionStatus: summary.protectionStatus,
    protectionCounts: summary.protectionCounts,
    protectedSurfaceCount: summary.protectedSurfaceCount,
    hasProtectionDetails: summary.hasProtectionDetails,
  };
};
