import type {
  LoadedLocations,
  PopupCommandDeps,
  PopupTab,
} from "./popup-command-types";

import { isNoticeUnread } from "@/shared/popup-notification-state";
import type { GetPopupStateResponse, PopupEffectiveSummary } from "@/shared/types";

export const defaultPopupCurrentRule = {
  pattern: null,
  locationId: null,
  enabled: null,
  type: null,
  canToggle: false,
  canEdit: false,
  isExplicit: false,
  blockServiceWorkerRegistration: false,
  regionalPresetEnabled: true,
  relaxCspForWorkers: false,
} as const;

export const getPatternMode = (pattern: string): "exact" | "suffix" =>
  pattern.startsWith("*") ? "suffix" : "exact";

type PopupStateInput = {
  panicMode: boolean;
  profiles: LoadedLocations;
  currentRule: GetPopupStateResponse["state"]["currentRule"];
  currentTab: GetPopupStateResponse["state"]["currentTab"];
  effectiveSummary: PopupEffectiveSummary;
  suggestions?: GetPopupStateResponse["state"]["suggestions"];
  hasSuggestionWarning?: boolean;
  notifications?: GetPopupStateResponse["state"]["notifications"];
};

export const buildPopupState = ({
  panicMode,
  profiles,
  currentRule,
  currentTab,
  effectiveSummary,
  suggestions = [],
  hasSuggestionWarning = false,
  notifications = [],
}: PopupStateInput): GetPopupStateResponse => ({
  ok: true,
  state: {
    panicMode,
    effectiveSummary,
    availableLocations: profiles.map((location) => {
      const languages = location.languages ?? [];
      return {
        id: location.id,
        label: location.label,
        language: location.language ?? languages[0] ?? "",
        languages: [...languages],
      };
    }),
    currentRule,
    currentTab,
    suggestions,
    hasSuggestionWarning,
    notifications,
    hasUnreadNotification: notifications.some(isNoticeUnread),
  },
});

export const resolvePopupHostname = (
  explicitHostname: string | undefined,
  activeTab: PopupTab | undefined,
  isSupportedWebUrl: PopupCommandDeps["isSupportedWebUrl"],
  getExactHostname: PopupCommandDeps["getExactHostname"],
): string | null => {
  const normalizedHostname = explicitHostname?.trim();
  if (normalizedHostname) {
    return normalizedHostname;
  }

  return isSupportedWebUrl(activeTab?.url) ? getExactHostname(activeTab.url) : null;
};
