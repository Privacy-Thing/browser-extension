import {
  buildFirefoxShimState,
  parseFirefoxHashSeed,
} from "@privacy-brand/refract-browser/common/firefox-shim-state";

import { syncDynamicHeaderRules } from "@/background/dnr";
import { createFxRewriteHandlers } from "@/background/firefox-shared-worker-rewrite";
import {
  restoreFxHashUrl,
  seedFxEarlyState,
  seedWindowSnapshot,
  setMainWorldSnapshot,
} from "@/background/main-world-injection";
import { bindSnapshotCache } from "@/background/pause-aware-cache";
import { persistPreloadSafe } from "@/background/preload-persist";
import type {
  PreparedRuntimeDecisions,
  ResolutionDecision,
} from "@/background/prepared-runtime-decisions";
import { buildResolverLogEntry } from "@/background/resolver-log";
import {
  matchTrustedSite,
  resolveActiveIdentity,
  resolveProfileSnapshot,
} from "@/background/rules/resolver";
import { createSnapshotHandler } from "@/background/runtime-snapshot-handler";
import type {
  CachedSettingsState,
  createRuntimeState,
} from "@/background/runtime-state";
import {
  getHostPause,
  initializeHostPauses,
} from "@/background/storage/host-protection-pauses";
import {
  loadSeenHosts,
  rememberSeenHost,
  saveSeenHosts,
} from "@/background/storage/seen-hosts";
import { clearSurfaceAccess } from "@/background/surface-access-tracker";
import { fireAndForget } from "@/shared/async";
import { readFingerprintSource } from "@/shared/browser-fingerprint";
import { BUILD_BROWSER_TARGET } from "@/shared/build-flags";
import {
  applyHostOverride,
  type HostProtectionPause,
} from "@/shared/host-protection-pause";
import type { GlobalFallbackRule } from "@/shared/types";
import { applyWorkerException } from "@/shared/worker-policy-exceptions";

type RuntimeState = ReturnType<typeof createRuntimeState<PreparedRuntimeDecisions>>;
type LoadedLocations = CachedSettingsState["profiles"];
type ActiveIdentity = NonNullable<ReturnType<typeof resolveActiveIdentity>>;
type TrackedIdentity = ActiveIdentity | { kind: "fallback"; ruleSeedKey: string };

type ResolutionControllerDeps = {
  runtimeState: RuntimeState;
  getCachedState: () => Promise<CachedSettingsState>;
  syncPreloadedState: () => Promise<void>;
  ensureStorageMigration: () => Promise<void>;
  resolveFallbackId: (
    profiles: LoadedLocations,
    fallbackRule: GlobalFallbackRule | undefined,
  ) => string | null;
  logResolverEvent: (
    enabled: boolean,
    event: string,
    input: {
      hostname: string;
      tabId?: number;
      details: Record<string, unknown>;
    },
  ) => void;
  clearBadgeRefreshTimer: (tabId: number) => void;
};

const MAIN_WORLD = "MAIN" satisfies `${chrome.scripting.ExecutionWorld}`;
const WINDOW_SEED_PREFIX = "\u001f\u001e";

const resolveTrackedIdentity = (
  activeIdentity: ActiveIdentity | null,
  profiles: LoadedLocations,
  fallbackRule: GlobalFallbackRule | undefined,
  allowFallback: boolean,
): TrackedIdentity | null => {
  if (activeIdentity) return activeIdentity;
  if (!allowFallback || !fallbackRule?.enabled || !fallbackRule.locationId) {
    return null;
  }
  return profiles.some((profile) => profile.id === fallbackRule.locationId)
    ? { kind: "fallback", ruleSeedKey: fallbackRule.ruleSeedKey }
    : null;
};

const rememberIdentityHost = async (
  hostname: string,
  cookieStoreId: string | undefined,
  identity: TrackedIdentity,
  exactOrigin?: string,
): Promise<void> => {
  const shared = {
    hostname,
    ...(exactOrigin ? { exactOrigin } : {}),
    ...(cookieStoreId ? { cookieStoreId } : {}),
    identitySeedKey: identity.ruleSeedKey,
  };
  let identityRecord: Parameters<typeof rememberSeenHost>[1];
  if (identity.kind === "rule") {
    identityRecord = {
      ...shared,
      identityKind: "rule",
      identityPattern: identity.pattern,
    };
  } else if (identity.kind === "container") {
    identityRecord = {
      ...shared,
      identityKind: "container",
      identityStoreId: identity.cookieStoreId,
    };
  } else {
    identityRecord = { ...shared, identityKind: "fallback" };
  }
  await saveSeenHosts(rememberSeenHost(await loadSeenHosts(), identityRecord));
};

const getActiveLocationId = (
  identity: ReturnType<typeof resolveActiveIdentity>,
): string | null => {
  if (identity?.kind === "rule") return identity.rule.locationId ?? null;
  if (identity?.kind === "container") {
    return identity.assignment.locationId ?? null;
  }
  return null;
};

const isGeolocationEnabled = (
  state: CachedSettingsState,
  identity: ReturnType<typeof resolveActiveIdentity>,
  decision: ResolutionDecision,
): boolean => {
  if (identity?.kind === "rule") {
    return identity.rule.fingerprintSurfaceOverrides?.geolocation !== false;
  }
  if (identity?.kind === "container") {
    return identity.assignment.fingerprintSurfaceOverrides?.geolocation !== false;
  }
  if (decision.snapshot) return decision.snapshot.geolocationEnabled !== false;
  return state.globalFallbackRule?.fingerprintSurfaceOverrides?.geolocation !== false;
};

const buildFallbackDecision = async (
  state: CachedSettingsState,
  hostname: string,
  cookieStoreId: string | undefined,
): Promise<ResolutionDecision> => {
  const snapshot = resolveProfileSnapshot({
    browserFingerprintSource: await readFingerprintSource(),
    fingerprintEnabled: state.browserFingerprintSpoofingEnabled,
    temporalApiEnabled: state.featureFlags.temporalApi,
    containerAssignments: state.containerAssignments,
    cookieStoreId,
    debugMode: state.debugMode,
    domainFencingEnabled: state.featureFlags.domainFencing,
    globalFallbackRule: state.globalFallbackRule,
    hostname,
    profiles: state.profiles,
    rules: state.rules,
    sharedSpoofing: state.sharedSpoofing,
    sharedWorkerHandlingMode: state.sharedWorkerHandlingMode,
    trustedSites: state.trustedSites,
    watchPositionDelay: state.watchPositionDelay,
  });
  if (snapshot) {
    // Randomized per activation to keep the logging bridge difficult to probe.
    // eslint-disable-next-line sonarjs/pseudo-random
    snapshot.logEventName = `_${Math.random().toString(36).slice(2, 10)}`;
  }
  const activeIdentity = resolveActiveIdentity(
    hostname,
    cookieStoreId,
    state.rules,
    state.containerAssignments,
  );
  return {
    snapshot: applyWorkerException(snapshot, hostname, state.workerPolicyExceptions),
    trustedSiteMatched: Boolean(matchTrustedSite(hostname, state.trustedSites)),
    fencesIdentity: Boolean(
      snapshot && state.featureFlags.domainFencing && activeIdentity?.kind !== "rule",
    ),
  };
};

const logResolution = (
  deps: ResolutionControllerDeps,
  state: CachedSettingsState,
  input: {
    hostname: string;
    cookieStoreId?: string;
    exactOrigin?: string;
    activeIdentity: ReturnType<typeof resolveActiveIdentity>;
    decision: ResolutionDecision;
  },
): void => {
  const trustedSite = matchTrustedSite(input.hostname, state.trustedSites);
  const fallbackId = deps.resolveFallbackId(state.profiles, state.globalFallbackRule);
  const activeLocationId = getActiveLocationId(input.activeIdentity);
  const entry = buildResolverLogEntry({
    cookieStoreId: input.cookieStoreId,
    exactOrigin: input.exactOrigin,
    matchedTrustedSitePattern: trustedSite?.pattern ?? null,
    matchedPattern:
      input.activeIdentity?.kind === "rule"
        ? input.activeIdentity.pattern
        : (trustedSite?.pattern ?? null),
    activeIdentityKind: input.activeIdentity?.kind ?? null,
    activeLocationId,
    fallbackLocationId: fallbackId,
    fallbackConfigured: Boolean(state.globalFallbackRule?.enabled),
    activeProfileExists: activeLocationId
      ? state.profiles.some((profile) => profile.id === activeLocationId)
      : false,
    fallbackProfileExists: fallbackId
      ? state.profiles.some((profile) => profile.id === fallbackId)
      : false,
    geolocationEnabled: isGeolocationEnabled(
      state,
      input.activeIdentity,
      input.decision,
    ),
    blockServiceWorkerRegistration:
      input.decision.snapshot?.blockServiceWorkerRegistration ?? false,
    resolved: input.decision.snapshot !== null,
  });
  deps.logResolverEvent(state.debugMode, entry.event, {
    hostname: input.hostname,
    details: entry.details,
  });
};

const createRuntimeResolver =
  (deps: ResolutionControllerDeps) =>
  async (
    hostname: string,
    cookieStoreId?: string,
    exactOrigin?: string,
    options: { trackSeenHost?: boolean; respectHostPause?: boolean } = {},
  ): Promise<ResolutionDecision> => {
    await initializeHostPauses();
    const state = await deps.getCachedState();
    if (state.controlState.panicMode) {
      deps.logResolverEvent(state.debugMode, "resolver.snapshot-skipped", {
        hostname,
        details: {
          reason: "panic-mode",
          cookieStoreId: cookieStoreId ?? null,
          exactOrigin: exactOrigin ?? null,
        },
      });
      return { snapshot: null, trustedSiteMatched: false };
    }
    const hostPause =
      options.respectHostPause === false ? undefined : getHostPause(hostname);
    if (
      hostPause &&
      !hostPause.workerTest &&
      !matchTrustedSite(hostname, state.trustedSites)
    ) {
      return { snapshot: null, trustedSiteMatched: false, hostPause };
    }
    const activeIdentity = resolveActiveIdentity(
      hostname,
      cookieStoreId,
      state.rules,
      state.containerAssignments,
    );
    if (!deps.runtimeState.getPreparedDecisions()) {
      await deps.syncPreloadedState();
    }
    const decision =
      deps.runtimeState
        .getPreparedDecisions()
        ?.resolveDecision(hostname, cookieStoreId, false) ??
      (await buildFallbackDecision(state, hostname, cookieStoreId));
    logResolution(deps, state, {
      hostname,
      ...(cookieStoreId ? { cookieStoreId } : {}),
      ...(exactOrigin ? { exactOrigin } : {}),
      activeIdentity,
      decision,
    });
    const trackedIdentity = resolveTrackedIdentity(
      activeIdentity,
      state.profiles,
      state.globalFallbackRule,
      decision.snapshot !== null,
    );
    if (trackedIdentity && options.trackSeenHost !== false) {
      fireAndForget(
        rememberIdentityHost(
          hostname,
          cookieStoreId,
          trackedIdentity,
          exactOrigin,
        ).catch((error) => {
          console.warn("Failed to remember active identity host.", error);
        }),
      );
    }
    if (decision.fencesIdentity && decision.snapshot) {
      await persistPreloadSafe(deps.runtimeState);
    }
    const latestPause =
      options.respectHostPause === false ? undefined : getHostPause(hostname);
    return latestPause && !decision.trustedSiteMatched
      ? {
          ...decision,
          snapshot: applyHostOverride(decision.snapshot, latestPause),
          hostPause: latestPause,
        }
      : decision;
  };

const createInjectionHandlers = () => {
  const injectFrameSnapshot = async (
    tabId: number,
    frameId: number,
    decision: ResolutionDecision,
    documentId?: string,
  ): Promise<void> => {
    if (BUILD_BROWSER_TARGET !== "chromium") return;
    try {
      await chrome.scripting.executeScript({
        target: {
          tabId,
          ...(documentId ? { documentIds: [documentId] } : { frameIds: [frameId] }),
        },
        world: MAIN_WORLD,
        injectImmediately: true,
        func: setMainWorldSnapshot,
        args: [
          {
            snapshot: decision.snapshot,
            readyEvent: __PT_RUNTIME_READY_EVENT_NAME__,
            markerAttr: __PT_RUNTIME_CONFIG_ATTR__,
            payloadAttr: __PT_RUNTIME_PAYLOAD_ATTR__,
            offAttr: __PT_RUNTIME_DISABLED_ATTR__,
            disabled: decision.snapshot === null,
          },
        ],
      } as chrome.scripting.ScriptInjection<
        [Parameters<typeof setMainWorldSnapshot>[0]],
        void
      > & { injectImmediately: boolean });
    } catch {
      // Restricted URLs and frames disappearing during navigation are expected.
    }
  };
  const seedChromiumWindow = async (
    tabId: number,
    frameId: number,
    decision: ResolutionDecision,
  ): Promise<void> => {
    try {
      await chrome.scripting.executeScript({
        target: { tabId, frameIds: [frameId] },
        world: MAIN_WORLD,
        injectImmediately: true,
        func: seedWindowSnapshot,
        args: [
          decision.snapshot,
          WINDOW_SEED_PREFIX,
          decision.snapshot === null,
          ...(decision.hostPause?.expiresAt === null ||
          decision.hostPause?.expiresAt === undefined
            ? []
            : [decision.hostPause.expiresAt]),
        ],
      } as chrome.scripting.ScriptInjection<
        [ReturnType<typeof resolveProfileSnapshot>, string, boolean, number?],
        void
      > & { injectImmediately: boolean });
    } catch {
      // Restricted and disappearing documents cannot be seeded.
    }
  };
  const injectFxEarlyState = async (
    tabId: number,
    frameId: number,
    snapshot: ReturnType<typeof resolveProfileSnapshot>,
    hostPause?: HostProtectionPause,
  ): Promise<void> => {
    if (BUILD_BROWSER_TARGET !== "firefox") return;
    try {
      await chrome.scripting.executeScript({
        target: { tabId, frameIds: [frameId] },
        world: MAIN_WORLD,
        injectImmediately: true,
        func: seedFxEarlyState,
        args: [
          { ...buildFirefoxShimState(snapshot), ...(hostPause ? { hostPause } : {}) },
          __PT_FIREFOX_STATE_PORT_ID__,
        ],
      } as chrome.scripting.ScriptInjection<
        [ReturnType<typeof buildFirefoxShimState>, string],
        void
      > & { injectImmediately: boolean });
    } catch {
      // Restricted and disappearing documents cannot be injected.
    }
  };
  const cleanupFxHashUrl = async (
    tabId: number,
    frameId: number,
    url: string,
  ): Promise<void> => {
    if (BUILD_BROWSER_TARGET !== "firefox" || frameId !== 0) return;
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return;
    }
    const payload = parseFirefoxHashSeed(parsedUrl.hash);
    if (!payload) return;
    try {
      await chrome.scripting.executeScript({
        target: { tabId, frameIds: [frameId] },
        world: MAIN_WORLD,
        injectImmediately: true,
        func: restoreFxHashUrl,
        args: [payload.originalHash, __PT_SHIM_GUARD_KEY__],
      } as chrome.scripting.ScriptInjection<[string, string], void> & {
        injectImmediately: boolean;
      });
    } catch {
      // Restricted and disappearing documents cannot be cleaned up.
    }
  };
  return {
    injectFrameSnapshot,
    seedChromiumWindow,
    injectFxEarlyState,
    cleanupFxHashUrl,
  };
};

export const createRuntimeResolverCtl = (deps: ResolutionControllerDeps) => {
  const resolveRuntimeDecision = createRuntimeResolver(deps);
  const resolveCachedSnapshot = async (
    hostname: string,
    cookieStoreId?: string,
    exactOrigin?: string,
    options?: { trackSeenHost?: boolean; respectHostPause?: boolean },
  ) =>
    (await resolveRuntimeDecision(hostname, cookieStoreId, exactOrigin, options))
      .snapshot;
  const {
    updateSnapshotCache,
    readSnapshotCache,
    readDecisionCache,
    readTopDecision,
    readTopEntry,
  } = bindSnapshotCache(deps.runtimeState.effectiveSnapshotCache);
  const rewriteHandlers = createFxRewriteHandlers({
    getActiveTabContexts: deps.runtimeState.getActiveTabContexts,
    getPreparedDecisions: deps.runtimeState.getPreparedDecisions,
    getRewriteRequestIds: () => deps.runtimeState.rewriteRequestIds,
    getRewriteTracker: () => deps.runtimeState.rewriteTracker,
    readDecisionCache,
  });
  const handleResolveSnapshot = createSnapshotHandler({
    ...deps,
    resolveCachedSnapshot,
    resolveRuntimeDecision,
    readDecisionCache,
    readTopDecision,
    updateSnapshotCache,
  });
  return {
    resolveRuntimeDecision,
    resolveCachedSnapshot,
    updateSnapshotCache,
    resyncActiveHeaderRules: async (): Promise<void> => {
      deps.runtimeState.effectiveSnapshotCache.clear();
      await syncDynamicHeaderRules(deps.runtimeState.getActiveTabContexts());
    },
    readSnapshotCache,
    readDecisionCache,
    readTopDecision,
    readTopEntry,
    ...rewriteHandlers,
    removeTabSnapshots: (tabId: number): void => {
      deps.clearBadgeRefreshTimer(tabId);
      deps.runtimeState.effectiveSnapshotCache.removeTab(tabId);
      clearSurfaceAccess(tabId);
      deps.runtimeState.rewriteTracker.clearTab(tabId);
    },
    ...createInjectionHandlers(),
    handleResolveSnapshot,
  };
};
