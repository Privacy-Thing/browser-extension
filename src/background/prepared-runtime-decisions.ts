import {
  buildFirefoxShimState,
  type FirefoxWindowSeedEntry,
  type FirefoxWindowSeedState,
} from "@privacy-brand/refract-browser/common/firefox-shim-state";

import {
  fenceDecisionSnapshot,
  fencesPreparedIdentity,
  toFencingRequest,
  type FencedIdentity,
} from "@/background/prepared-runtime-fencing";
import {
  matchTrustedSite,
  toRuleRuntimeSnapshot,
  toRuntimeSnapshot,
} from "@/background/rules/resolver";
import type {
  DomainFencingRequest,
  SnapshotBuildOptions,
} from "@/background/rules/resolver-options";
import type { BrowserFingerprintSource } from "@/shared/browser-fingerprint";
import type { FeatureFlags } from "@/shared/feature-flags";
import { resolveRuleSources } from "@/shared/rule-resolution";
import { normalizeRuleSeedKey } from "@/shared/rule-seed";
import { hasRuntimePayload } from "@/shared/runtime-snapshot";
import { getTimeZoneOffsetMinutes } from "@/shared/time-zone-offset";
import type {
  ContainerAssignment,
  ControlState,
  DomainRule,
  GlobalFallbackRule,
  Location,
  RuntimeSnapshot,
  SharedWorkerHandlingMode,
  SharedSpoofingConfig,
  TrustedSite,
} from "@/shared/types";

export type ResolutionDecision = {
  snapshot: RuntimeSnapshot | null;
  trustedSiteMatched: boolean;
  /** True when fallback/container identity is fenced for this hostname. */
  fencesIdentity?: boolean;
};

export type PreparedRuntimeInputs = {
  rules: readonly DomainRule[];
  trustedSites: readonly TrustedSite[];
  locations: readonly Location[];
  controlState: ControlState;
  debugMode: boolean;
  watchPositionDelay: [number, number];
  fingerprintEnabled: boolean;
  featureFlags: FeatureFlags;
  sharedWorkerHandlingMode: SharedWorkerHandlingMode;
  sharedSpoofing: SharedSpoofingConfig | undefined;
  browserFingerprintSource: BrowserFingerprintSource | undefined;
  globalFallbackRule: GlobalFallbackRule | undefined;
  containerAssignments: readonly ContainerAssignment[];
};

export type PreloadedDecisionEntry = {
  pattern: string;
  blockServiceWorkerRegistration: boolean;
  snapshot: RuntimeSnapshot;
};

export type PreparedRuntimeDecisions = {
  resolveDecision: (hostname: string, cookieStoreId?: string) => ResolutionDecision;
  getPreloadedEntries: () => PreloadedDecisionEntry[];
  getNativeRulePatterns: () => string[];
  getFxWindowSeed: (cookieStoreId?: string) => FirefoxWindowSeedState | null;
};

type PreparedRuleEntry = {
  pattern: string;
  ownSnapshot: RuntimeSnapshot | null;
  fallbackSnapshot: RuntimeSnapshot | null;
  containerSnapshots: Map<string, RuntimeSnapshot | null>;
};

type PreparedContainerEntry = {
  cookieStoreId: string;
  snapshot: RuntimeSnapshot | null;
};

const createLogEventName = (): string =>
  // eslint-disable-next-line sonarjs/pseudo-random
  `_${Math.random().toString(36).slice(2, 10)}`;

const normalizeFallback = (
  globalFallbackRule: GlobalFallbackRule | undefined,
): GlobalFallbackRule | undefined =>
  globalFallbackRule
    ? {
        ...globalFallbackRule,
        ruleSeedKey: normalizeRuleSeedKey(globalFallbackRule.ruleSeedKey),
      }
    : undefined;

const resolveFallbackLocation = (
  locationsById: ReadonlyMap<string, Location>,
  globalFallbackRule: GlobalFallbackRule | undefined,
): Location | undefined => {
  if (!globalFallbackRule?.enabled || !globalFallbackRule.locationId) {
    return undefined;
  }

  return locationsById.get(globalFallbackRule.locationId);
};

// `blockServiceWorkerRegistration` is resolved inside `toRuntimeSnapshot` from
// the shared global default + per-rule/container surface override, so the
// snapshot already carries the correct value here.
const materializeSnapshot = (snapshot: RuntimeSnapshot): RuntimeSnapshot | null =>
  hasRuntimePayload(snapshot) ? snapshot : null;

const finalizeNavSnapshot = (
  snapshot: RuntimeSnapshot | null,
): RuntimeSnapshot | null => {
  if (!snapshot) {
    return null;
  }

  const baseEpochMs = Date.now();
  const timeZone = snapshot.date.timeZone;
  const offsetMs =
    (new Date(baseEpochMs).getTimezoneOffset() -
      getTimeZoneOffsetMinutes(timeZone, baseEpochMs)) *
    60_000;

  return {
    ...snapshot,
    date: {
      ...snapshot.date,
      baseEpochMs,
      offsetMs,
    },
    logEventName: createLogEventName(),
  };
};

/**
 * Narrows the prepared inputs to exactly what the snapshot builders consume.
 *
 * Mapped field by field rather than spread: `PreparedRuntimeInputs` also carries
 * routing data (rules, locations, control state), and this fast path has to
 * mirror the baseline resolver exactly — a parity test asserts it. An explicit
 * mapping turns any future drift into a compile error instead of a silent one.
 */
const toSnapshotBuildOptions = (
  inputs: PreparedRuntimeInputs,
): SnapshotBuildOptions => ({
  browserFingerprintSource: inputs.browserFingerprintSource,
  fingerprintEnabled: inputs.fingerprintEnabled,
  temporalApiEnabled: inputs.featureFlags.temporalApi,
  debugMode: inputs.debugMode,
  sharedSpoofing: inputs.sharedSpoofing,
  sharedWorkerHandlingMode: inputs.sharedWorkerHandlingMode,
  watchPositionDelay: inputs.watchPositionDelay,
});

const buildRuleSnapshot = (
  rule: DomainRule | GlobalFallbackRule,
  location: Location | undefined,
  inputs: PreparedRuntimeInputs,
  domainFencing?: DomainFencingRequest,
): RuntimeSnapshot | null =>
  materializeSnapshot(
    toRuleRuntimeSnapshot({
      ...toSnapshotBuildOptions(inputs),
      profile: location,
      rule,
      domainFencing,
    }),
  );

const buildContainerSnapshot = (
  assignment: ContainerAssignment,
  location: Location | undefined,
  inputs: PreparedRuntimeInputs,
  domainFencing?: DomainFencingRequest,
): RuntimeSnapshot | null =>
  materializeSnapshot(
    toRuntimeSnapshot({
      ...toSnapshotBuildOptions(inputs),
      authKey: assignment.authKey,
      profile: location,
      ruleOverrides: assignment.fingerprintSurfaceOverrides,
      ruleSeedKey: assignment.ruleSeedKey,
      domainFencing,
    }),
  );

// Domain rules are explicit per-domain configuration: their identity stays
// static, so rule entries never receive a fencing request.
const buildPreparedRuleEntries = (
  inputs: PreparedRuntimeInputs,
  locationsById: ReadonlyMap<string, Location>,
  fallbackLocation: Location | undefined,
): PreparedRuleEntry[] =>
  inputs.rules
    .filter((rule) => rule.enabled)
    .filter((rule) => !matchTrustedSite(rule.pattern, inputs.trustedSites))
    .map((rule) => {
      const ownLocation = rule.locationId
        ? locationsById.get(rule.locationId)
        : undefined;
      const ownSnapshot = buildRuleSnapshot(rule, ownLocation, inputs);
      const fallbackSnapshot =
        !rule.locationId && fallbackLocation
          ? buildRuleSnapshot(rule, fallbackLocation, inputs)
          : null;
      const containerSnapshots = new Map<string, RuntimeSnapshot | null>();

      if (!rule.locationId) {
        for (const assignment of inputs.containerAssignments) {
          if (assignment.enabled === false || !assignment.locationId) {
            continue;
          }

          containerSnapshots.set(
            assignment.cookieStoreId,
            buildRuleSnapshot(rule, locationsById.get(assignment.locationId), inputs),
          );
        }
      }

      return {
        pattern: rule.pattern,
        ownSnapshot,
        fallbackSnapshot,
        containerSnapshots,
      };
    });

const buildContainerEntries = (
  inputs: PreparedRuntimeInputs,
  locationsById: ReadonlyMap<string, Location>,
  fallbackLocation: Location | undefined,
): PreparedContainerEntry[] => {
  // An enabled container without its own preset still inherits the Default
  // Rule's enabled state and location, but keeps its OWN fingerprint identity.
  // Mirror `resolveProfileSnapshot`'s fallback branch so the hot-path cache and
  // on-demand resolution agree.
  const fallbackActive = Boolean(
    inputs.globalFallbackRule?.enabled &&
    (fallbackLocation || inputs.fingerprintEnabled),
  );

  return inputs.containerAssignments.map((assignment) => {
    if (assignment.enabled === false) {
      return { cookieStoreId: assignment.cookieStoreId, snapshot: null };
    }

    if (assignment.locationId) {
      return {
        cookieStoreId: assignment.cookieStoreId,
        snapshot: buildContainerSnapshot(
          assignment,
          locationsById.get(assignment.locationId),
          inputs,
          toFencingRequest(inputs),
        ),
      };
    }

    return {
      cookieStoreId: assignment.cookieStoreId,
      snapshot: fallbackActive
        ? buildContainerSnapshot(
            assignment,
            fallbackLocation,
            inputs,
            toFencingRequest(inputs),
          )
        : null,
    };
  });
};

const getRuleSnapshotTemplate = (
  entry: PreparedRuleEntry,
  cookieStoreId: string | undefined,
  usableContainer: ContainerAssignment | null,
): RuntimeSnapshot | null => {
  if (usableContainer?.cookieStoreId && !entry.ownSnapshot) {
    return (
      entry.containerSnapshots.get(usableContainer.cookieStoreId) ??
      entry.fallbackSnapshot ??
      entry.ownSnapshot
    );
  }

  if (usableContainer?.cookieStoreId && entry.containerSnapshots.size > 0) {
    return (
      entry.containerSnapshots.get(usableContainer.cookieStoreId) ??
      entry.fallbackSnapshot ??
      entry.ownSnapshot
    );
  }

  if (cookieStoreId && entry.containerSnapshots.has(cookieStoreId)) {
    return (
      entry.containerSnapshots.get(cookieStoreId) ??
      entry.fallbackSnapshot ??
      entry.ownSnapshot
    );
  }

  return entry.fallbackSnapshot ?? entry.ownSnapshot;
};

const toPreloadedEntry = (entry: PreparedRuleEntry): PreloadedDecisionEntry | null => {
  const snapshot = finalizeNavSnapshot(entry.fallbackSnapshot ?? entry.ownSnapshot);
  if (!snapshot) {
    return null;
  }

  return {
    pattern: entry.pattern,
    blockServiceWorkerRegistration: snapshot.blockServiceWorkerRegistration ?? false,
    snapshot,
  };
};

type PreparedDecisionState = {
  inputs: PreparedRuntimeInputs;
  ruleEntries: PreparedRuleEntry[];
  ruleEntriesByPattern: ReadonlyMap<string, PreparedRuleEntry>;
  entriesByCookieStore: ReadonlyMap<string, PreparedContainerEntry>;
  fallbackSnapshot: RuntimeSnapshot | null;
  locationsById: ReadonlyMap<string, Location>;
  fallbackLocation: Location | undefined;
  fencedSnapshotCache: Map<string, RuntimeSnapshot | null>;
};

const rebuildFencedSnapshot = (
  state: PreparedDecisionState,
  identity: FencedIdentity,
  hostname: string,
): RuntimeSnapshot | null => {
  const domainFencing = { hostname };
  if (identity.kind === "fallback") {
    return state.inputs.globalFallbackRule
      ? buildRuleSnapshot(
          state.inputs.globalFallbackRule,
          state.fallbackLocation,
          state.inputs,
          domainFencing,
        )
      : null;
  }
  return buildContainerSnapshot(
    identity.assignment,
    identity.assignment.locationId
      ? state.locationsById.get(identity.assignment.locationId)
      : state.fallbackLocation,
    state.inputs,
    domainFencing,
  );
};

const finalizeFencedDecision = (
  state: PreparedDecisionState,
  template: RuntimeSnapshot | null,
  hostname: string,
  identity: FencedIdentity,
): RuntimeSnapshot | null =>
  fenceDecisionSnapshot({
    template,
    hostname,
    identity,
    domainFencingEnabled: state.inputs.featureFlags.domainFencing,
    cache: state.fencedSnapshotCache,
    rebuild: (nextIdentity, nextHostname) =>
      rebuildFencedSnapshot(state, nextIdentity, nextHostname),
  });

const resolvePreparedDecision = (
  state: PreparedDecisionState,
  hostname: string,
  cookieStoreId?: string,
): ResolutionDecision => {
  const { inputs, ruleEntriesByPattern, entriesByCookieStore, fallbackSnapshot } =
    state;
  if (inputs.controlState.panicMode) {
    return { snapshot: null, trustedSiteMatched: false };
  }
  const resolvedSources = resolveRuleSources({
    hostname,
    cookieStoreId,
    rules: inputs.rules,
    containerAssignments: inputs.containerAssignments,
    globalFallbackRule: inputs.globalFallbackRule,
    trustedSites: inputs.trustedSites,
  });
  if (resolvedSources.trustedSite) {
    return { snapshot: null, trustedSiteMatched: true };
  }
  if (resolvedSources.activeRule) {
    const entry = ruleEntriesByPattern.get(resolvedSources.activeRule.pattern);
    return {
      snapshot: finalizeNavSnapshot(
        entry
          ? getRuleSnapshotTemplate(
              entry,
              cookieStoreId,
              resolvedSources.usableContainer,
            )
          : null,
      ),
      trustedSiteMatched: false,
    };
  }
  if (resolvedSources.usableContainer) {
    return {
      snapshot: finalizeNavSnapshot(
        finalizeFencedDecision(
          state,
          entriesByCookieStore.get(resolvedSources.usableContainer.cookieStoreId)
            ?.snapshot ?? null,
          hostname,
          { kind: "container", assignment: resolvedSources.usableContainer },
        ),
      ),
      trustedSiteMatched: false,
      fencesIdentity: fencesPreparedIdentity(inputs, "container"),
    };
  }
  const activeContainerSnapshot = resolvedSources.activeContainer
    ? entriesByCookieStore.get(resolvedSources.activeContainer.cookieStoreId)?.snapshot
    : null;
  const fencedSnapshot =
    activeContainerSnapshot && resolvedSources.activeContainer
      ? finalizeFencedDecision(state, activeContainerSnapshot, hostname, {
          kind: "container",
          assignment: resolvedSources.activeContainer,
        })
      : finalizeFencedDecision(state, fallbackSnapshot, hostname, {
          kind: "fallback",
        });
  return {
    snapshot: finalizeNavSnapshot(fencedSnapshot),
    trustedSiteMatched: false,
    fencesIdentity: fencesPreparedIdentity(
      inputs,
      activeContainerSnapshot && resolvedSources.activeContainer
        ? "container"
        : "fallback",
    ),
  };
};

const getPreparedEntries = (state: PreparedDecisionState): PreloadedDecisionEntry[] => {
  if (state.inputs.controlState.panicMode) return [];
  const entries = state.ruleEntries
    .map(toPreloadedEntry)
    .filter((entry): entry is PreloadedDecisionEntry => entry !== null);
  if (state.fallbackSnapshot) {
    const finalizedFallback =
      finalizeNavSnapshot(state.fallbackSnapshot) ?? state.fallbackSnapshot;
    entries.push({
      pattern: "*",
      blockServiceWorkerRegistration:
        finalizedFallback.blockServiceWorkerRegistration ?? false,
      snapshot: finalizedFallback,
    });
  }
  return entries;
};

const getNativePatterns = (state: PreparedDecisionState): string[] =>
  state.inputs.controlState.panicMode
    ? []
    : state.ruleEntries
        .filter((entry) => !(entry.fallbackSnapshot ?? entry.ownSnapshot))
        .map((entry) => entry.pattern);

const getFxSeed = (
  state: PreparedDecisionState,
  cookieStoreId?: string,
): FirefoxWindowSeedState | null => {
  const { inputs, entriesByCookieStore, ruleEntries } = state;
  if (inputs.controlState.panicMode) {
    return {
      entries: [],
      containerState: null,
      containerEntries: [],
      trustedPatterns: [],
    };
  }
  const entries = getPreparedEntries(state).map((entry) => ({
    pattern: entry.pattern,
    state: buildFirefoxShimState(finalizeNavSnapshot(entry.snapshot)),
  }));
  const containerStateTemplate = cookieStoreId
    ? (entriesByCookieStore.get(cookieStoreId)?.snapshot ?? null)
    : null;
  const containerState = containerStateTemplate
    ? buildFirefoxShimState(finalizeNavSnapshot(containerStateTemplate))
    : null;
  const usableContainer = cookieStoreId
    ? (inputs.containerAssignments.find(
        (assignment) =>
          assignment.cookieStoreId === cookieStoreId && assignment.enabled !== false,
      ) ?? null)
    : null;
  const locationlessPatterns = new Set(
    inputs.rules.filter((rule) => !rule.locationId).map((rule) => rule.pattern),
  );
  const containerEntries: FirefoxWindowSeedEntry[] = [];
  if (usableContainer) {
    for (const entry of ruleEntries) {
      if (!locationlessPatterns.has(entry.pattern)) continue;
      const snapshot = getRuleSnapshotTemplate(entry, cookieStoreId, usableContainer);
      containerEntries.push({
        pattern: entry.pattern,
        state: buildFirefoxShimState(finalizeNavSnapshot(snapshot)),
      });
    }
  }
  const nativeRulePatterns = getNativePatterns(state);
  return {
    entries,
    containerState,
    containerEntries,
    ...(nativeRulePatterns.length > 0 ? { nativeRulePatterns } : {}),
    trustedPatterns: inputs.trustedSites.map((site) => site.pattern),
  };
};

export const createPreparedDecisions = (
  rawInputs: PreparedRuntimeInputs,
): PreparedRuntimeDecisions => {
  const globalFallbackRule = normalizeFallback(rawInputs.globalFallbackRule);
  const inputs = {
    ...rawInputs,
    ...(globalFallbackRule
      ? { globalFallbackRule }
      : { globalFallbackRule: undefined }),
  };
  const locationsById = new Map(
    inputs.locations.map((location) => [location.id, location]),
  );
  const fallbackLocation = resolveFallbackLocation(locationsById, globalFallbackRule);
  const ruleEntries = buildPreparedRuleEntries(inputs, locationsById, fallbackLocation);
  const ruleEntriesByPattern = new Map(
    ruleEntries.map((entry) => [entry.pattern, entry]),
  );
  const containerEntries = buildContainerEntries(
    inputs,
    locationsById,
    fallbackLocation,
  );
  const entriesByCookieStore = new Map(
    containerEntries.map((entry) => [entry.cookieStoreId, entry]),
  );
  const fallbackSnapshot =
    globalFallbackRule?.enabled && (fallbackLocation || inputs.fingerprintEnabled)
      ? buildRuleSnapshot(
          globalFallbackRule,
          fallbackLocation,
          inputs,
          toFencingRequest(inputs),
        )
      : null;
  const state: PreparedDecisionState = {
    inputs,
    ruleEntries,
    ruleEntriesByPattern,
    entriesByCookieStore,
    fallbackSnapshot,
    locationsById,
    fallbackLocation,
    fencedSnapshotCache: new Map(),
  };

  return {
    resolveDecision: (hostname, cookieStoreId) =>
      resolvePreparedDecision(state, hostname, cookieStoreId),
    getPreloadedEntries: () => getPreparedEntries(state),
    getNativeRulePatterns: () => getNativePatterns(state),
    getFxWindowSeed: (cookieStoreId) => getFxSeed(state, cookieStoreId),
  };
};
