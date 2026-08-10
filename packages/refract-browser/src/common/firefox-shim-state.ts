/** Firefox early-state transport, seed selection, and replay handoff. */

import {
  isFxRecord,
  normalizeFxState,
  type FirefoxMainHandoff,
  type FirefoxShimState,
} from "./firefox-shim-model";
import {
  buildHashTransport,
  clearStaticPayload,
  dispatchEphemeral,
  parseEphemeralTransport,
  parseHashTransport,
  readDomHandoff,
  removeDomHandoff,
  takeStaticPayload,
  writeDomHandoff,
} from "./snapshot-transports";

import {
  compileDomainPattern,
  compareRuleSpecificity,
  getDomainRuleSpecificity,
  type DomainRuleSpecificity,
} from "@/shared/domain-match";

export * from "./firefox-shim-model";

export const getFxStateEvent = (): string => __PT_FX_STATE_CHANGE_EVENT__;
export const getFxHandoffReadyEvent = (): string => __PT_FX_HANDOFF_READY_EVENT__;
export const getFxStaticCandidatesKey = (): string => __PT_FX_STATIC_CANDIDATES_KEY__;

export type FirefoxWindowSeedEntry = {
  pattern: string;
  state: FirefoxShimState;
};

export type FirefoxWindowSeedState = {
  entries: FirefoxWindowSeedEntry[];
  containerState: FirefoxShimState | null;
  containerEntries?: FirefoxWindowSeedEntry[] | undefined;
  nativeRulePatterns?: string[];
  trustedPatterns?: string[];
};

export type FxStaticStateCandidate = {
  buildKey: string;
  pattern: string;
  specificity: DomainRuleSpecificity;
  state: FirefoxShimState;
};

export type FirefoxHashSeedPayload = {
  originalHash: string;
  state: FirefoxShimState;
};

export const getFirefoxHashSeedPrefix = (): string =>
  `#${__PT_FIREFOX_STATE_PORT_ID__}=`;
const getFxBootstrapKey = (): string => __PT_SHIM_GUARD_KEY__;

const normalizeOriginalHash = (value: string): string =>
  value === "" || value.startsWith("#") ? value : `#${value}`;

export const injectFxEphemeralState = (
  documentRef: Document,
  state: FirefoxShimState,
): void => {
  writeDomHandoff(documentRef, state, __PT_FIREFOX_STATE_PORT_ID__);
};

export const dispatchFxStateEvent = (state: FirefoxShimState): void => {
  dispatchEphemeral(document, __PT_FX_STATE_CHANGE_EVENT__, state);
};

export const publishFxMainHandoff = (
  documentRef: Document,
  state: FirefoxShimState,
): void => {
  const handoff: FirefoxMainHandoff = {
    protocol: 1,
    revision: state.bootstrap.revision,
    state,
  };
  writeDomHandoff(documentRef, handoff, __PT_FX_HANDOFF_ATTR__);
  documentRef.dispatchEvent(new Event(__PT_FX_HANDOFF_READY_EVENT__));
};

const normalizeFxSeedEntries = (
  value: unknown[],
  { legacyRevision = 0 }: { legacyRevision?: number } = {},
): FirefoxWindowSeedEntry[] | null => {
  const entries: FirefoxWindowSeedEntry[] = [];
  for (const entry of value) {
    if (!isFxRecord(entry) || typeof entry.pattern !== "string") return null;
    const state = normalizeFxState(entry.state, { legacyRevision });
    if (!state) return null;
    entries.push({ pattern: entry.pattern, state });
  }
  return entries;
};

export const normalizeFxWindowSeed = (
  value: unknown,
  { legacyRevision = 0 }: { legacyRevision?: number } = {},
): FirefoxWindowSeedState | null => {
  if (!isFxRecord(value) || !Array.isArray(value.entries)) return null;
  const entries = normalizeFxSeedEntries(value.entries, { legacyRevision });
  if (!entries) return null;
  const containerState =
    value.containerState === null
      ? null
      : normalizeFxState(value.containerState, { legacyRevision });
  if (value.containerState !== null && containerState === null) return null;
  const containerEntries = Array.isArray(value.containerEntries)
    ? normalizeFxSeedEntries(value.containerEntries, { legacyRevision })
    : null;
  if (Array.isArray(value.containerEntries) && !containerEntries) return null;
  const trustedPatterns = Array.isArray(value.trustedPatterns)
    ? value.trustedPatterns.filter(
        (pattern): pattern is string => typeof pattern === "string",
      )
    : [];
  const nativeRulePatterns = Array.isArray(value.nativeRulePatterns)
    ? value.nativeRulePatterns.filter(
        (pattern): pattern is string => typeof pattern === "string",
      )
    : [];
  return {
    entries,
    containerState,
    ...(containerEntries ? { containerEntries } : {}),
    ...(nativeRulePatterns.length > 0 ? { nativeRulePatterns } : {}),
    ...(trustedPatterns.length > 0 ? { trustedPatterns } : {}),
  };
};

export const isFirefoxWindowSeedState = (
  value: unknown,
): value is FirefoxWindowSeedState => normalizeFxWindowSeed(value) !== null;

type SeedCandidate = {
  pattern: string;
  state: FirefoxShimState | null;
};

const isMoreSpecific = (
  candidate: DomainRuleSpecificity,
  currentBest: DomainRuleSpecificity,
): boolean => compareRuleSpecificity(candidate, currentBest) > 0;

const resolveFxSeedCandidate = (
  hostname: string,
  entries: readonly SeedCandidate[],
): SeedCandidate | null => {
  let matchedEntry: SeedCandidate | null = null;
  let matchedSpecificity: DomainRuleSpecificity | null = null;
  for (const entry of entries) {
    if (!compileDomainPattern(entry.pattern).test(hostname)) continue;
    const specificity = getDomainRuleSpecificity(entry.pattern);
    if (!matchedSpecificity || isMoreSpecific(specificity, matchedSpecificity)) {
      matchedEntry = entry;
      matchedSpecificity = specificity;
    }
  }
  return matchedEntry;
};

export const resolveFxSeedForHost = (
  hostname: string,
  seedState: FirefoxWindowSeedState,
): FirefoxShimState | null => {
  if (
    (seedState.trustedPatterns ?? []).some((pattern) =>
      compileDomainPattern(pattern).test(hostname),
    )
  ) {
    return null;
  }
  const matched = resolveFxSeedCandidate(hostname, [
    ...(seedState.containerEntries ?? []),
    ...seedState.entries,
    ...(seedState.nativeRulePatterns ?? []).map((pattern) => ({
      pattern,
      state: null,
    })),
  ]);
  return matched ? matched.state : seedState.containerState;
};

const isFxStaticCandidate = (
  value: unknown,
  { legacyRevision = 0 }: { legacyRevision?: number } = {},
): value is FxStaticStateCandidate => {
  if (!isFxRecord(value) || !isFxRecord(value.specificity)) return false;
  const state = normalizeFxState(value.state, { legacyRevision });
  if (!state) return false;
  const specificity = value.specificity;
  return (
    value.buildKey === getFxBootstrapKey() &&
    typeof value.pattern === "string" &&
    typeof specificity.nonWildcardLength === "number" &&
    (specificity.exactMatchBonus === 0 || specificity.exactMatchBonus === 1) &&
    (specificity.subdomainOnlyBonus === 0 || specificity.subdomainOnlyBonus === 1) &&
    typeof specificity.wildcardCount === "number"
  );
};

const normalizeFxCandidates = (
  value: unknown,
  { legacyRevision = 0 }: { legacyRevision?: number } = {},
): FxStaticStateCandidate[] => {
  if (!Array.isArray(value)) return [];
  const candidates: FxStaticStateCandidate[] = [];
  for (const candidate of value) {
    if (!isFxStaticCandidate(candidate, { legacyRevision })) continue;
    candidates.push({
      buildKey: candidate.buildKey,
      pattern: candidate.pattern,
      specificity: candidate.specificity,
      state: candidate.state,
    });
  }
  return candidates;
};

const resolveFxCandidates = (
  hostname: string,
  candidates: readonly FxStaticStateCandidate[],
): FirefoxShimState | null => {
  let matchedCandidate: FxStaticStateCandidate | null = null;
  for (const candidate of candidates) {
    if (!compileDomainPattern(candidate.pattern).test(hostname)) continue;
    if (
      !matchedCandidate ||
      isMoreSpecific(candidate.specificity, matchedCandidate.specificity)
    ) {
      matchedCandidate = candidate;
    }
  }
  return matchedCandidate?.state ?? null;
};

export const takeFxStaticState = (
  globalRef: typeof globalThis,
  hostname: string,
  { legacyRevision = 0 }: { legacyRevision?: number } = {},
): FirefoxShimState | null => {
  const raw = takeStaticPayload(globalRef, __PT_FX_STATIC_CANDIDATES_KEY__);
  return resolveFxCandidates(hostname, normalizeFxCandidates(raw, { legacyRevision }));
};

export const clearFirefoxStaticState = (globalRef: typeof globalThis): void => {
  clearStaticPayload(globalRef, __PT_FX_STATIC_CANDIDATES_KEY__);
};

export const parseFirefoxHashSeed = (hash: string): FirefoxHashSeedPayload | null => {
  const raw = parseHashTransport(hash, getFirefoxHashSeedPrefix());
  if (!raw) return null;
  const parsed = raw as {
    buildKey?: unknown;
    originalHash?: unknown;
    state?: unknown;
  };
  if (
    parsed.buildKey !== getFxBootstrapKey() ||
    typeof parsed.originalHash !== "string" ||
    (parsed.originalHash !== "" && !parsed.originalHash.startsWith("#"))
  ) {
    return null;
  }
  const state = normalizeFxState(parsed.state);
  return state ? { originalHash: parsed.originalHash, state } : null;
};

export const buildFirefoxHashSeed = (
  state: FirefoxShimState,
  originalHash = "",
): string =>
  buildHashTransport(
    {
      buildKey: getFxBootstrapKey(),
      originalHash: normalizeOriginalHash(originalHash),
      state,
    },
    getFirefoxHashSeedPrefix(),
  );

export const buildFxSeededUrl = (url: string, state: FirefoxShimState): string => {
  const parsedUrl = new URL(url);
  const existingSeed = parseFirefoxHashSeed(parsedUrl.hash);
  parsedUrl.hash = buildFirefoxHashSeed(
    state,
    existingSeed?.originalHash ??
      (parsedUrl.hash.startsWith(getFirefoxHashSeedPrefix()) ? "" : parsedUrl.hash),
  );
  return parsedUrl.toString();
};

export const takeFxEphemeralState = (
  documentRef: Document,
): FirefoxShimState | null => {
  const raw = readDomHandoff(documentRef, __PT_FIREFOX_STATE_PORT_ID__);
  if (raw === null) return null;
  const normalized = normalizeFxState(raw);
  if (!normalized) return null;
  removeDomHandoff(documentRef, __PT_FIREFOX_STATE_PORT_ID__);
  return normalized;
};

export const parseFxStateEvent = (event: Event): FirefoxShimState | null => {
  const raw = parseEphemeralTransport(event);
  return raw !== null ? normalizeFxState(raw) : null;
};

export const takeFxMainHandoff = (documentRef: Document): FirefoxMainHandoff | null => {
  const raw = readDomHandoff(documentRef, __PT_FX_HANDOFF_ATTR__);
  removeDomHandoff(documentRef, __PT_FX_HANDOFF_ATTR__);
  if (!isFxRecord(raw) || raw.protocol !== 1 || typeof raw.revision !== "number") {
    return null;
  }
  const state = normalizeFxState(raw.state);
  if (!state || state.bootstrap.revision !== raw.revision) return null;
  return { protocol: 1, revision: raw.revision, state };
};
