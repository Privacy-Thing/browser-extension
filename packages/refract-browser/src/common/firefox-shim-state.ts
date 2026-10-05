/** Firefox early-state transport, seed selection, and replay handoff. */

import { privateDateNow } from "@privacy-brand/refract-core/runtime/primordials";

import {
  buildNativeFxState,
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
import {
  isHostPauseActive,
  parseHostPauses,
  type HostProtectionPause,
} from "@/shared/host-protection-pause";
import {
  applyWorkerException,
  applyWorkerPolicy,
  type WorkerPolicyExceptions,
} from "@/shared/worker-policy-exceptions";

export * from "./firefox-shim-model";

export const getFxStateEvent = (): string => __PT_FX_STATE_CHANGE_EVENT__;
export const getFxHandoffReadyEvent = (): string => __PT_FX_HANDOFF_READY_EVENT__;
export const getFxStaticCandidatesKey = (): string => __PT_FX_STATIC_CANDIDATES_KEY__;

export type FirefoxWindowSeedEntry = {
  pattern: string;
  state: FirefoxShimState;
};

export type FirefoxWindowSeedState = {
  workers?: WorkerPolicyExceptions;
  hostPauses?: HostProtectionPause[];
  entries: FirefoxWindowSeedEntry[];
  containerState: FirefoxShimState | null;
  containerEntries?: FirefoxWindowSeedEntry[] | undefined;
  nativeRulePatterns?: string[];
  trustedPatterns?: string[];
};

export type FxStaticStateCandidate = {
  workers?: WorkerPolicyExceptions;
  hostPauses?: HostProtectionPause[];
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
const FX_BOOTSTRAP_KEY: string = __PT_SHIM_GUARD_KEY__;

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

type ResolvedStaticCandidate = Omit<FxStaticStateCandidate, "buildKey">;

const isSpecificityBonus = (value: unknown): value is 0 | 1 =>
  value === 0 || value === 1;

const parseStringList = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];

const resolvePausedFxState = (
  hostname: string | null,
  pauses: readonly HostProtectionPause[],
  baseline: FirefoxShimState | null,
): FirefoxShimState | null | undefined => {
  const pause = pauses.find(
    (pause) =>
      (hostname === null || pause.hostname === hostname) &&
      isHostPauseActive(pause, privateDateNow()),
  );
  if (!pause) return undefined;
  if (hostname === null) return null;
  const policy =
    pause.workerTest === "service-worker"
      ? { serviceWorker: false as const }
      : { sharedWorker: "native" as const };
  const state = pause.workerTest
    ? applyWorkerPolicy(baseline, policy)
    : buildNativeFxState();
  return state ? { ...state, hostPause: pause } : null;
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
  // Background validates persisted keys. This writable transport does not
  // authenticate state; applyWorkerPolicy accepts only exact policy values.
  const hostPauses = parseHostPauses(value.hostPauses);
  const trustedPatterns = parseStringList(value.trustedPatterns);
  const nativeRulePatterns = parseStringList(value.nativeRulePatterns);
  return {
    entries,
    ...(isFxRecord(value.workers)
      ? {
          workers: value.workers as WorkerPolicyExceptions,
        }
      : {}),
    ...(hostPauses.length > 0 ? { hostPauses } : {}),
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
  specificity?: DomainRuleSpecificity;
  pattern: string;
  state: FirefoxShimState | null;
};

const resolveFxSeedCandidate = (
  hostname: string,
  entries: readonly SeedCandidate[],
): SeedCandidate | null => {
  let matchedEntry: SeedCandidate | null = null;
  let matchedSpecificity: DomainRuleSpecificity | null = null;
  for (const entry of entries) {
    if (!compileDomainPattern(entry.pattern).test(hostname)) continue;
    const specificity = entry.specificity ?? getDomainRuleSpecificity(entry.pattern);
    if (
      !matchedSpecificity ||
      compareRuleSpecificity(specificity, matchedSpecificity) > 0
    ) {
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
  const baseline = applyWorkerException(
    matched ? matched.state : seedState.containerState,
    hostname,
    seedState.workers,
  );
  const paused = resolvePausedFxState(hostname, seedState.hostPauses ?? [], baseline);
  return paused === undefined ? baseline : paused;
};

const normalizeFxCandidates = (value: unknown): ResolvedStaticCandidate[] => {
  if (!Array.isArray(value)) return [];
  const candidates: ResolvedStaticCandidate[] = [];
  for (const candidate of value) {
    if (!isFxRecord(candidate) || !isFxRecord(candidate.specificity)) continue;
    const specificity = candidate.specificity;
    if (
      candidate.buildKey !== FX_BOOTSTRAP_KEY ||
      typeof candidate.pattern !== "string" ||
      typeof specificity.nonWildcardLength !== "number" ||
      !isSpecificityBonus(specificity.exactMatchBonus) ||
      !isSpecificityBonus(specificity.subdomainOnlyBonus) ||
      typeof specificity.wildcardCount !== "number"
    )
      continue;
    // This pass validates shape; the serialized state is retained verbatim.
    if (!normalizeFxState(candidate.state)) continue;
    candidates.push(candidate as FxStaticStateCandidate);
  }
  return candidates;
};

export const takeFxStaticState = (
  globalRef: typeof globalThis,
  hostname: string,
  {
    topHostname = hostname,
  }: { legacyRevision?: number; topHostname?: string | null } = {},
): FirefoxShimState | null => {
  const raw = takeStaticPayload(globalRef, __PT_FX_STATIC_CANDIDATES_KEY__);
  const candidates = normalizeFxCandidates(raw);
  const pauses = parseHostPauses(candidates[0]?.hostPauses);
  // Unknown top hosts keep the protected baseline until tab-aware convergence.
  // Native worker exceptions require a known top host; temporary pauses still defer.
  // Every candidate in this registration batch carries the same global policies.
  const exceptions = candidates[0]?.workers;
  const baseline = applyWorkerException(
    resolveFxSeedCandidate(hostname, candidates)?.state ?? null,
    topHostname ?? hostname,
    topHostname === null ? undefined : exceptions,
  );
  const paused = resolvePausedFxState(topHostname, pauses, baseline);
  return paused === undefined ? baseline : paused;
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
    parsed.buildKey !== FX_BOOTSTRAP_KEY ||
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
      buildKey: FX_BOOTSTRAP_KEY,
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
  const normalized = normalizeFxState(raw);
  if (!normalized) return null;
  removeDomHandoff(documentRef, __PT_FIREFOX_STATE_PORT_ID__);
  return normalized;
};

export const parseFxStateEvent = (event: Event): FirefoxShimState | null => {
  return normalizeFxState(parseEphemeralTransport(event));
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

/** Returns null for an inaccessible cross-origin ancestor. */
export const readTopHostname = (): string | null => {
  try {
    return window.top?.location.hostname ?? window.location.hostname;
  } catch {
    return null;
  }
};
