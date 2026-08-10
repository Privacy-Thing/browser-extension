import {
  recordSiteNotice,
  resolvePopupNotification,
} from "@/background/storage/popup-notifications";
import { EXTENSION_STORAGE_KEYS } from "@/shared/extension-contract";
import type {
  PopupSiteSuggestion,
  SiteSuggestionKind,
  SiteSuggestionStatus,
} from "@/shared/types";

export const SUGGESTIONS_STORAGE_KEY = EXTENSION_STORAGE_KEYS.siteSuggestions;

type StoredSiteSuggestion = {
  kind: SiteSuggestionKind;
  status: SiteSuggestionStatus;
  detectionCount: number;
  lastDetectedAt: string;
  dismissedAt?: string | null;
  acceptedAt?: string | null;
};

export type SiteSuggestionMap = Record<string, StoredSiteSuggestion[]>;

const getSuggestionScopeKey = (hostname: string, cookieStoreId?: string): string =>
  `${cookieStoreId ?? "default"}::${hostname}`;

const normalizeScopeKey = (key: string): string =>
  key.includes("::") ? key : getSuggestionScopeKey(key);

const normalizeSuggestion = (
  suggestion: Partial<StoredSiteSuggestion> & Pick<StoredSiteSuggestion, "kind">,
): StoredSiteSuggestion => ({
  kind: suggestion.kind,
  status: suggestion.status ?? "pending",
  detectionCount:
    typeof suggestion.detectionCount === "number" && suggestion.detectionCount > 0
      ? suggestion.detectionCount
      : 1,
  lastDetectedAt:
    typeof suggestion.lastDetectedAt === "string" &&
    suggestion.lastDetectedAt.length > 0
      ? suggestion.lastDetectedAt
      : new Date(0).toISOString(),
  dismissedAt:
    typeof suggestion.dismissedAt === "string" ? suggestion.dismissedAt : null,
  acceptedAt: typeof suggestion.acceptedAt === "string" ? suggestion.acceptedAt : null,
});

export const loadSiteSuggestions = async (): Promise<SiteSuggestionMap> => {
  const stored = await chrome.storage.local.get(SUGGESTIONS_STORAGE_KEY);
  const raw = stored[SUGGESTIONS_STORAGE_KEY];
  if (!raw || typeof raw !== "object") {
    return {};
  }

  return Object.fromEntries(
    Object.entries(raw as Record<string, unknown>)
      .filter(([, suggestions]) => Array.isArray(suggestions))
      .map(([scopeKey, suggestions]) => [
        normalizeScopeKey(scopeKey),
        (
          suggestions as Array<
            Partial<StoredSiteSuggestion> & Pick<StoredSiteSuggestion, "kind">
          >
        ).map(normalizeSuggestion),
      ]),
  );
};

export const saveSiteSuggestions = async (
  suggestions: SiteSuggestionMap,
): Promise<void> => {
  await chrome.storage.local.set({
    [SUGGESTIONS_STORAGE_KEY]: suggestions,
  });
};

export const recordSuggestion = async (
  hostname: string,
  kind: SiteSuggestionKind,
  cookieStoreId?: string,
): Promise<SiteSuggestionMap> => {
  const nextState = await loadSiteSuggestions();
  const now = new Date().toISOString();
  const scopeKey = getSuggestionScopeKey(hostname, cookieStoreId);
  const currentSuggestions = nextState[scopeKey] ?? [];
  const current = currentSuggestions.find((entry) => entry.kind === kind);

  const nextSuggestion: StoredSiteSuggestion = current
    ? {
        ...current,
        status: current.status === "accepted" ? "pending" : current.status,
        detectionCount: current.detectionCount + 1,
        lastDetectedAt: now,
        acceptedAt: current.status === "accepted" ? null : (current.acceptedAt ?? null),
      }
    : {
        kind,
        status: "pending",
        detectionCount: 1,
        lastDetectedAt: now,
        dismissedAt: null,
        acceptedAt: null,
      };

  nextState[scopeKey] = [
    ...currentSuggestions.filter((entry) => entry.kind !== kind),
    nextSuggestion,
  ];
  await saveSiteSuggestions(nextState);
  await recordSiteNotice({
    hostname,
    ...(cookieStoreId ? { cookieStoreId } : {}),
    kind,
    generation: nextSuggestion.detectionCount,
    detectedAt: nextSuggestion.lastDetectedAt,
  });
  return nextState;
};

export const updateSuggestionStatus = async (
  hostname: string,
  kind: SiteSuggestionKind,
  status: Extract<SiteSuggestionStatus, "dismissed" | "accepted">,
  cookieStoreId?: string,
): Promise<SiteSuggestionMap> => {
  const nextState = await loadSiteSuggestions();
  const scopeKey = getSuggestionScopeKey(hostname, cookieStoreId);
  const currentSuggestions = nextState[scopeKey] ?? [];
  const current = currentSuggestions.find((entry) => entry.kind === kind);

  if (!current) {
    return nextState;
  }

  const now = new Date().toISOString();
  nextState[scopeKey] = currentSuggestions.map((entry) =>
    entry.kind === kind
      ? {
          ...entry,
          status,
          dismissedAt: status === "dismissed" ? now : null,
          acceptedAt: status === "accepted" ? now : null,
        }
      : entry,
  );
  await saveSiteSuggestions(nextState);
  await resolvePopupNotification(
    `site:${cookieStoreId ?? "default"}:${hostname}:${kind}`,
  );
  return nextState;
};

export const clearSiteSuggestions = async (): Promise<void> => {
  await saveSiteSuggestions({});
};

export const selectPopupSuggestions = (
  suggestions: SiteSuggestionMap,
  hostname: string | null,
  cookieStoreId?: string,
): { items: PopupSiteSuggestion[]; hasWarning: boolean } => {
  if (!hostname) {
    return {
      items: [],
      hasWarning: false,
    };
  }

  const items = (suggestions[getSuggestionScopeKey(hostname, cookieStoreId)] ?? [])
    .filter(
      (
        entry,
      ): entry is StoredSiteSuggestion & {
        status: Exclude<SiteSuggestionStatus, "accepted">;
      } => entry.status !== "accepted",
    )
    .map((entry) => ({
      kind: entry.kind,
      status: entry.status,
      rediscovered:
        entry.status === "dismissed" &&
        (entry.detectionCount > 1 ||
          (typeof entry.dismissedAt === "string" &&
            entry.lastDetectedAt >= entry.dismissedAt)),
      detectionCount: entry.detectionCount,
      lastDetectedAt: entry.lastDetectedAt,
    }));

  return {
    items,
    hasWarning: items.some(
      (entry) => entry.status === "dismissed" && entry.rediscovered,
    ),
  };
};
