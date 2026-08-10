import type { FirefoxWindowSeedState } from "@privacy-brand/refract-browser/common/firefox-shim-state";

export type WindowSeedTrigger =
  | "on-before-navigate"
  | "on-before-request"
  | "on-committed-about-blank"
  | "popup-rule-mutation";

type SeedDiagnosticTab = {
  url?: string;
  pendingUrl?: string;
  status?: string;
  discarded?: boolean;
  cookieStoreId?: string;
};

type SeedLogBase = {
  frameId: number;
  cookieStoreId: string | undefined;
  trigger: WindowSeedTrigger;
};

type SeedSuccessLog = SeedLogBase & {
  outcome: "success";
  seedState: FirefoxWindowSeedState;
};

type SeedMissingStateLog = SeedLogBase & {
  outcome: "missing-seed-state";
};

type SeedExecutionFailureLog = SeedLogBase & {
  outcome: "execute-script-failed";
  error: unknown;
  tab?: SeedDiagnosticTab;
};

type HashTransportLog = SeedLogBase & {
  outcome: "hash-transport-preferred";
  hostname: string;
};

type AboutBlankSeedLog = SeedLogBase & {
  outcome: "about-blank-seed-unavailable";
};

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export const buildWindowSeedLog = (
  entry:
    | SeedSuccessLog
    | SeedMissingStateLog
    | SeedExecutionFailureLog
    | HashTransportLog
    | AboutBlankSeedLog,
): Record<string, unknown> => {
  const baseDetails: Record<string, unknown> = {
    success: entry.outcome === "success",
    frameId: entry.frameId,
    cookieStoreId: entry.cookieStoreId ?? null,
    trigger: entry.trigger,
  };

  if (entry.outcome === "success") {
    return {
      ...baseDetails,
      entryCount: entry.seedState.entries.length,
      hasContainerState: entry.seedState.containerState !== null,
    };
  }

  if (entry.outcome === "missing-seed-state") {
    return {
      ...baseDetails,
      reason: "missing-seed-state",
    };
  }

  if (entry.outcome === "hash-transport-preferred") {
    return {
      ...baseDetails,
      reason: "hash-transport-preferred",
      hostname: entry.hostname,
    };
  }

  if (entry.outcome === "about-blank-seed-unavailable") {
    return {
      ...baseDetails,
      reason: "about-blank-seed-unavailable",
    };
  }

  return {
    ...baseDetails,
    reason: "execute-script-failed",
    error: getErrorMessage(entry.error),
    ...(entry.error instanceof Error ? { errorName: entry.error.name } : {}),
    ...(entry.tab?.url ? { tabUrl: entry.tab.url } : {}),
    ...(entry.tab?.pendingUrl ? { pendingUrl: entry.tab.pendingUrl } : {}),
    ...(entry.tab?.status ? { tabStatus: entry.tab.status } : {}),
    ...(typeof entry.tab?.discarded === "boolean"
      ? { tabDiscarded: entry.tab.discarded }
      : {}),
    ...(entry.tab?.cookieStoreId ? { tabCookieStoreId: entry.tab.cookieStoreId } : {}),
  };
};
