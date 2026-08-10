import { buildEffectiveSummary } from "@/background/popup-effective-summary";
import { DEFAULT_CONTAINER_ICON } from "@/shared/firefox-containers";
import { isPopupPolicyNoticeKind } from "@/shared/popup-notification-kinds";
import { isNoticeUnread } from "@/shared/popup-notification-state";
import { getReleaseNotice } from "@/shared/release-notification";
import type {
  ContainerPresentation,
  PopupEffectiveSource,
  PopupNotification,
  PopupSiteSuggestion,
  PopupState,
  RuntimeSnapshot,
} from "@/shared/types";
import type { PopupPresentationKind } from "@/ui/popup/popup-view-model";

/* eslint-disable sonarjs/cognitive-complexity, sonarjs/no-nested-conditional -- exhaustive Storybook scenario fixtures intentionally keep the variant matrix explicit */

export type PopupStoryContext =
  | "baseline"
  | "global-protections-off"
  | "runtime-degraded"
  | "worker-runtime-warning"
  | "service-worker-block"
  | "shared-worker-strict"
  | "worker-csp-relaxed"
  | "all-policy-risks"
  | "notifications"
  | "notifications-acknowledged"
  | "notifications-mixed"
  | "notifications-resolved"
  | "extension-notification"
  | "firefox-first-inline";

const NOW = "2026-07-13T12:00:00.000Z";
const STORY_NOTIFICATION_ID = "notification-center-intro";
const storyNotification = getReleaseNotice(STORY_NOTIFICATION_ID);

if (!storyNotification) {
  throw new Error(`Missing Storybook extension notification: ${STORY_NOTIFICATION_ID}`);
}

const workContainer: ContainerPresentation = {
  cookieStoreId: "firefox-container-1",
  name: "Work",
  icon: DEFAULT_CONTAINER_ICON,
  iconUrl: "/icons/briefcase.svg",
  color: "orange",
  colorCode: "#f59e0b",
};

const baseSnapshot: RuntimeSnapshot = {
  geo: {
    latitude: 52.2297,
    longitude: 21.0122,
    accuracy: 12,
    noiseRadius: 120,
  },
  locale: {
    language: "pl-PL",
    languages: ["pl-PL", "pl"],
    timeZone: "Europe/Warsaw",
    acceptLanguage: "pl-PL,pl;q=0.9",
  },
  date: {
    baseEpochMs: 0,
    offsetMs: 0,
    timeZone: "Europe/Warsaw",
  },
  debugMode: false,
  watchPositionDelay: [100, 200],
  geolocationEnabled: true,
  timeLocaleEnabled: true,
  fingerprint: {},
  sharedWorkerHandlingMode: "spoof",
  blockServiceWorkerRegistration: false,
};

const createWorkerSuggestion = (): PopupSiteSuggestion => ({
  kind: "worker-csp-relaxation",
  status: "pending",
  rediscovered: false,
  detectionCount: 2,
  lastDetectedAt: NOW,
});

const createNotification = (
  kind: PopupNotification["kind"],
  scope: PopupNotification["scope"],
): PopupNotification => ({
  id: kind === "significant-update" ? storyNotification.id : `${scope}:${kind}`,
  kind,
  scope,
  dedupeKey:
    kind === "significant-update"
      ? `extension:update:${storyNotification.id}`
      : `${scope}:${kind}`,
  severity: kind === "significant-update" ? "info" : "needs-action",
  ...(scope === "site" ? { hostname: "browserleaks.com" } : {}),
  ...(kind === "significant-update"
    ? {
        channel: storyNotification.channel,
        introducedInVersion: storyNotification.introducedInVersion,
      }
    : {}),
  createdAt: NOW,
  lastDetectedAt: NOW,
  generation: 1,
  readAt: null,
  resolvedAt: null,
  autoPresentedAt: null,
  pulseShownAt: null,
  ...(kind === "significant-update"
    ? storyNotification.actionUrl
      ? { actionTarget: storyNotification.actionUrl }
      : {}
    : { actionTarget: "notification-list" }),
});

const createBetaNotification = (): PopupNotification => ({
  ...createNotification("significant-update", "extension"),
  id: "storybook-beta-update",
  dedupeKey: "extension:update:storybook-beta-update",
  channel: "beta",
  introducedInVersion: "0.2026.720.1530",
});

type VariantFields = {
  currentRule: Partial<PopupState["currentRule"]>;
  currentTab: Partial<PopupState["currentTab"]>;
  source: PopupEffectiveSource;
  enabled: boolean | null;
  runtimeExpected: boolean;
};

const createVariant = (fields: Partial<VariantFields> = {}): VariantFields => ({
  currentRule: {},
  currentTab: {},
  source: "none",
  enabled: null,
  runtimeExpected: false,
  ...fields,
});

const getRuleVariant = (active: boolean): VariantFields =>
  createVariant({
    source: "site-rule",
    enabled: active,
    runtimeExpected: active,
    currentRule: {
      pattern: "browserleaks.com",
      locationId: "warsaw",
      enabled: active,
      type: "exact",
      canToggle: true,
      canEdit: true,
      isExplicit: true,
    },
    currentTab: {
      winningSource: active ? "rule" : "none",
      hasMatch: true,
      hasExactRule: true,
      matchedRulePattern: "browserleaks.com",
      displayedRulePattern: "browserleaks.com",
      locationProfileActive: active,
      locationId: "warsaw",
      locationLabel: "Warsaw",
    },
  });

const getConfiguredContainer = (
  active: boolean,
  protectionsOnly = false,
): VariantFields =>
  createVariant({
    ...(active ? { source: "container" as const, enabled: true } : {}),
    runtimeExpected: active,
    currentRule: { enabled: active, canToggle: true, canEdit: true },
    currentTab: {
      activeContainer: workContainer,
      containerAssignmentConfigured: true,
      winningSource: active ? "container" : "none",
      ...(active ? { hasMatch: true } : {}),
      locationProfileActive: !protectionsOnly,
      locationId: protectionsOnly ? null : "warsaw",
      locationLabel: protectionsOnly ? null : "Warsaw",
    },
  });

const getFallbackState = (
  kind: Exclude<PopupPresentationKind, "loading">,
): "active" | "protections" | "unconfigured" | "disabled" => {
  if (kind === "container-unconfigured") return "disabled";
  if (kind.endsWith("-protections")) return "protections";
  if (kind.endsWith("-unconfigured")) return "unconfigured";
  if (kind.endsWith("-active") || kind === "container-unconfigured-default") {
    return "active";
  }
  return "disabled";
};

const getFallbackVariant = (
  kind: Exclude<PopupPresentationKind, "loading">,
  container: boolean,
): VariantFields => {
  const fallbackState = getFallbackState(kind);
  const enabled = fallbackState !== "disabled";
  return createVariant({
    source: enabled ? "default-rule" : "none",
    enabled: enabled ? true : null,
    runtimeExpected: fallbackState === "active" || fallbackState === "protections",
    currentRule: container ? {} : { enabled, canToggle: true, canEdit: true },
    currentTab: {
      ...(container
        ? { activeContainer: workContainer, containerAssignmentConfigured: false }
        : {}),
      winningSource: enabled ? "fallback" : "none",
      fallbackState,
      hasMatch: enabled,
      locationProfileActive: fallbackState === "active",
      locationId: fallbackState === "active" ? "warsaw" : null,
      locationLabel: fallbackState === "active" ? "Warsaw" : null,
    },
  });
};

const getVariantFields = (
  kind: Exclude<PopupPresentationKind, "loading">,
): VariantFields => {
  if (kind === "unsupported") {
    return createVariant({
      currentTab: { supported: false, hostname: null, url: "chrome://extensions" },
    });
  }
  if (kind === "trusted-site") {
    return createVariant({
      source: "trusted-site",
      currentTab: {
        winningSource: "trusted-site",
        hasMatch: true,
        matchedTrustedSitePattern: "browserleaks.com",
        matchedTrustedSiteEnabled: true,
      },
    });
  }
  if (kind === "rule-active" || kind === "rule-inactive") {
    return getRuleVariant(kind === "rule-active");
  }
  if (kind === "container-active" || kind === "container-protections") {
    return getConfiguredContainer(true, kind === "container-protections");
  }
  if (kind === "container-inactive") return getConfiguredContainer(false);
  if (kind.startsWith("container-unconfigured")) {
    return getFallbackVariant(kind, true);
  }
  if (kind.startsWith("fallback-")) return getFallbackVariant(kind, false);
  return createVariant();
};

type StoryRuntime = {
  effectiveSummary: PopupState["effectiveSummary"];
  suggestions: PopupSiteSuggestion[];
  serviceWorkerProtected: boolean;
  relaxCspForWorkers: boolean;
};

const buildStoryRuntime = ({
  kind,
  context,
  variant,
  globalProtectionsOff,
}: {
  kind: Exclude<PopupPresentationKind, "loading">;
  context: PopupStoryContext;
  variant: VariantFields;
  globalProtectionsOff: boolean;
}): StoryRuntime => {
  const activeRuntime = variant.runtimeExpected && !globalProtectionsOff;
  const runtimeDegraded = activeRuntime && context === "runtime-degraded";
  const serviceWorkerBlocked =
    activeRuntime &&
    (context === "service-worker-block" || context === "all-policy-risks");
  const serviceWorkerProtected =
    serviceWorkerBlocked || (activeRuntime && context === "worker-runtime-warning");
  const sharedWorkerStrict =
    activeRuntime &&
    (context === "shared-worker-strict" || context === "all-policy-risks");
  const relaxCspForWorkers =
    activeRuntime &&
    (context === "worker-csp-relaxed" || context === "all-policy-risks");
  const suggestions =
    activeRuntime && context === "worker-runtime-warning"
      ? [createWorkerSuggestion()]
      : [];
  const protectionsOnly =
    kind === "container-protections" ||
    kind === "fallback-protections" ||
    kind === "container-unconfigured-default-protections";
  const snapshot = activeRuntime
    ? {
        ...baseSnapshot,
        geolocationEnabled: !protectionsOnly,
        timeLocaleEnabled: !protectionsOnly,
        blockServiceWorkerRegistration: serviceWorkerProtected,
        sharedWorkerHandlingMode: sharedWorkerStrict
          ? ("strict" as const)
          : ("spoof" as const),
      }
    : null;
  const effectiveSummary = buildEffectiveSummary({
    generation: 1,
    source: variant.source,
    pattern: variant.source === "site-rule" ? "browserleaks.com" : null,
    enabled: globalProtectionsOff ? false : variant.enabled,
    editable: variant.currentRule.canEdit ?? false,
    toggleable: variant.currentRule.canToggle ?? false,
    panicMode: kind === "panic",
    supported: variant.currentTab.supported ?? true,
    snapshot,
    suggestions,
    accessedCategories: {
      ...(serviceWorkerBlocked ? { serviceWorker: true } : {}),
      ...(sharedWorkerStrict ? { sharedWorker: true } : {}),
    },
    failedCategories: runtimeDegraded ? { worker: true } : {},
    runtimeExpected: activeRuntime,
    attentionKinds: [
      ...(serviceWorkerBlocked ? ["service-worker-block" as const] : []),
      ...(sharedWorkerStrict ? ["shared-worker-strict" as const] : []),
      ...suggestions.map((suggestion) => suggestion.kind),
    ],
  });
  return {
    effectiveSummary,
    suggestions,
    serviceWorkerProtected,
    relaxCspForWorkers,
  };
};

const buildStoryNotifications = (
  context: PopupStoryContext,
  effectiveSummary: PopupState["effectiveSummary"],
  hasSuggestions: boolean,
): PopupNotification[] => {
  const policyNotifications = effectiveSummary.surfaceSummary.surfaces
    .map((surface) => surface.attention?.notificationKind)
    .filter(isPopupPolicyNoticeKind)
    .map((kind) => createNotification(kind, "site"));
  const notificationContext =
    context === "notifications" ||
    context === "notifications-acknowledged" ||
    context === "notifications-mixed" ||
    context === "notifications-resolved";
  const contextNotifications =
    context === "extension-notification"
      ? [createNotification("significant-update", "extension")]
      : notificationContext
        ? [
            createNotification("worker-csp-relaxation", "site"),
            createNotification("shared-worker-injection-relaxation", "site"),
            createNotification("significant-update", "extension"),
            createBetaNotification(),
          ]
        : hasSuggestions
          ? [createNotification("worker-csp-relaxation", "site")]
          : [];

  return [...policyNotifications, ...contextNotifications].map(
    (notification, index) => {
      const acknowledged =
        context === "notifications-acknowledged" ||
        context === "notifications-resolved" ||
        (context === "notifications-mixed" && index === 0);
      const resolved = context === "notifications-resolved";
      return {
        ...notification,
        readAt: acknowledged ? NOW : null,
        resolvedAt: resolved ? NOW : null,
      };
    },
  );
};

export const createPopupStoryState = (
  kind: PopupPresentationKind,
  context: PopupStoryContext,
): PopupState | null => {
  if (kind === "loading") return null;

  const variant = getVariantFields(kind);
  const globalProtectionsOff = context === "global-protections-off";
  if (globalProtectionsOff && kind === "rule-active") {
    Object.assign(variant.currentRule, {
      pattern: "*.browserleaks.com",
      type: "suffix",
      isExplicit: false,
    });
    Object.assign(variant.currentTab, {
      hasExactRule: false,
      matchedRulePattern: "*.browserleaks.com",
      displayedRulePattern: "*.browserleaks.com",
      matchedTrustedSitePattern: "*.browserleaks.com",
      matchedTrustedSiteEnabled: false,
    });
  }
  const runtime = buildStoryRuntime({
    kind,
    context,
    variant,
    globalProtectionsOff,
  });
  const notifications = buildStoryNotifications(
    context,
    runtime.effectiveSummary,
    runtime.suggestions.length > 0,
  );

  const state: PopupState = {
    panicMode: kind === "panic",
    effectiveSummary: runtime.effectiveSummary,
    availableLocations: [
      { id: "warsaw", label: "Warsaw", language: "pl", languages: ["pl", "en"] },
      {
        id: "new-york",
        label: "New York",
        language: "en-US",
        languages: ["en-US", "en"],
      },
      {
        id: "tokyo",
        label: "Tokyo",
        language: "ja-JP",
        languages: ["ja-JP", "ja", "en"],
      },
    ],
    currentRule: {
      pattern: null,
      enabled: null,
      type: null,
      canToggle: false,
      canEdit: false,
      isExplicit: false,
      blockServiceWorkerRegistration: runtime.serviceWorkerProtected,
      regionalPresetEnabled: true,
      relaxCspForWorkers: runtime.relaxCspForWorkers,
      ...variant.currentRule,
    },
    currentTab: {
      supported: true,
      hostname: "browserleaks.com",
      url: "https://browserleaks.com/javascript",
      locationLabel: null,
      locationId: null,
      locationProfileActive: false,
      fallbackState: "disabled",
      matchedRulePattern: null,
      hasExactRule: false,
      canCleanDomain: true,
      pendingRulePattern: "browserleaks.com",
      hasMatch: false,
      activeContainer: null,
      winningSource: "none",
      firefoxFirstInlinePermissionRequired: context === "firefox-first-inline",
      firefoxFirstInlineEnabled: false,
      ...variant.currentTab,
    },
    suggestions: runtime.suggestions,
    hasSuggestionWarning: runtime.suggestions.length > 0,
    notifications,
    hasUnreadNotification: notifications.some(isNoticeUnread),
  };

  return state;
};
