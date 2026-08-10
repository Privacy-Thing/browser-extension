/**
 * Reads the preseeded runtime snapshot cache stored in `chrome.storage.session`
 * so content bootstrap can avoid a background round-trip on hot navigations.
 */

import { matchRule } from "@/shared/domain-match";
import { STORAGE_PRELOADED_STATE } from "@/shared/extension-contract";
import { isRuntimeSnapshot } from "@/shared/runtime-snapshot";
import type { DomainRule, RuntimeSnapshot, TrustedSite } from "@/shared/types";

/** Session-storage key used for per-pattern preloaded runtime snapshots. */
export const PRELOAD_STATE_KEY = STORAGE_PRELOADED_STATE;

/** One precomputed snapshot entry associated with a single domain pattern. */
export type PreloadedRuntimeEntry = {
  pattern: string;
  blockServiceWorkerRegistration: boolean;
  snapshot: RuntimeSnapshot;
};

/** Serializable snapshot cache hydrated by the background worker. */
export type PreloadedRuntimeState = {
  entries: PreloadedRuntimeEntry[];
  nativeRulePatterns?: string[];
  trustedSites?: TrustedSite[];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isPreloadedRuntimeState = (value: unknown): value is PreloadedRuntimeState => {
  if (!isRecord(value)) {
    return false;
  }

  return (
    Array.isArray(value.entries) &&
    value.entries.every(
      (entry) =>
        isRecord(entry) &&
        typeof entry.pattern === "string" &&
        typeof entry.blockServiceWorkerRegistration === "boolean" &&
        isRuntimeSnapshot(entry.snapshot),
    ) &&
    (value.nativeRulePatterns === undefined ||
      (Array.isArray(value.nativeRulePatterns) &&
        value.nativeRulePatterns.every((pattern) => typeof pattern === "string")))
  );
};

/**
 * Resolves a hostname against the preloaded cache and returns the matching
 * runtime snapshot without contacting the background worker.
 */
export const resolvePreloadedSnapshot = (
  hostname: string,
  state: PreloadedRuntimeState | null,
): RuntimeSnapshot | null => {
  if (!state) {
    return null;
  }

  if (
    state.trustedSites &&
    matchRule(hostname, undefined, state.trustedSites as DomainRule[])
  ) {
    return null;
  }

  const nativeRulePatterns = state.nativeRulePatterns ?? [];
  const rule = matchRule(hostname, undefined, [
    ...state.entries.map((entry) => ({
      pattern: entry.pattern,
      enabled: true,
    })),
    ...nativeRulePatterns.map((pattern) => ({
      pattern,
      enabled: true,
    })),
  ] satisfies DomainRule[]);
  if (!rule) {
    return null;
  }

  if (nativeRulePatterns.includes(rule.pattern)) {
    return null;
  }

  const entry = state.entries.find((candidate) => candidate.pattern === rule.pattern);
  if (!entry) {
    return null;
  }

  const snapshot = {
    ...entry.snapshot,
    blockServiceWorkerRegistration: entry.blockServiceWorkerRegistration,
  };

  return isRuntimeSnapshot(snapshot) ? snapshot : null;
};

/**
 * Reads and validates the session-backed preload cache prepared by the
 * background worker.
 */
export const readPreloadedState = async (): Promise<PreloadedRuntimeState | null> => {
  if (typeof chrome === "undefined" || !chrome.storage?.session) {
    return null;
  }

  try {
    const result = await chrome.storage.session.get(PRELOAD_STATE_KEY);
    const state = result[PRELOAD_STATE_KEY];
    return isPreloadedRuntimeState(state) ? state : null;
  } catch {
    return null;
  }
};
