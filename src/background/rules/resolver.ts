/**
 * Resolves the active location profile for a tab/domain context and converts
 * it into the compact runtime snapshot consumed by injected code.
 */

import type {
  DomainFencingRequest,
  ProfileSnapshotOptions,
  SnapshotBuildOptions,
  RuleSnapshotOptions,
  ToRuntimeSnapshotOptions,
} from "@/background/rules/resolver-options";
import {
  detectLanguagePolicy,
  serializeAcceptLanguage,
} from "@/shared/accept-language";
import {
  createBrowserFingerprint,
  type BrowserFingerprintSource,
  detectBrowserFamily,
} from "@/shared/browser-fingerprint";
import { BUILD_BROWSER_TARGET } from "@/shared/build-flags";
import {
  deriveFenceBaseKey,
  deriveFencedSeedKey,
  getSiteKey,
  type FingerprintFencing,
} from "@/shared/domain-fencing";
import {
  buildSimpleFpExtras,
  resolveGeoSurface,
  createNoiseSeed,
  resolveRuleToggles,
  resolveSwBlocking,
  resolveSharedWorkerMode,
  resolveTimeLocaleSurface,
  canSpoofDeviceMemory,
} from "@/shared/fingerprint-spoofing";
import {
  normalizeHardwareArch,
  normalizePlatformKey,
  type HardwareArch,
  type HardwarePlatformKey,
} from "@/shared/hardware-profiles";
import { getRuntimeLocale } from "@/shared/locale-catalog";
import {
  matchTrustedSite,
  resolveRuleSources,
  type ResolvedRuleSources,
} from "@/shared/rule-resolution";
import { normalizeRuleSeedKey, readRuleSeedKey } from "@/shared/rule-seed";
import { hasRuntimePayload } from "@/shared/runtime-snapshot";
import { getTimeZoneOffsetMinutes } from "@/shared/time-zone-offset";
import type {
  BrowserFingerprint,
  ContainerAssignment,
  DomainRule,
  GlobalFallbackRule,
  SharedSpoofingConfig,
  SurfaceOverrides,
  Location,
  RuntimeSnapshot,
} from "@/shared/types";

export type ActiveIdentity =
  | {
      kind: "rule";
      pattern: string;
      ruleSeedKey: string;
      rule: DomainRule;
    }
  | {
      kind: "container";
      cookieStoreId: string;
      ruleSeedKey: string;
      assignment: ContainerAssignment;
    };

const toActiveIdentity = (
  resolvedSources: ResolvedRuleSources,
): ActiveIdentity | null => {
  if (resolvedSources.activeRule) {
    const ruleSeedKey = readRuleSeedKey(resolvedSources.activeRule.ruleSeedKey);
    if (!ruleSeedKey) {
      return null;
    }

    return {
      kind: "rule",
      pattern: resolvedSources.activeRule.pattern,
      ruleSeedKey,
      rule: resolvedSources.activeRule,
    };
  }

  if (!resolvedSources.usableContainer) {
    return null;
  }

  const ruleSeedKey = readRuleSeedKey(resolvedSources.usableContainer.ruleSeedKey);
  if (!ruleSeedKey) {
    return null;
  }

  return {
    kind: "container",
    cookieStoreId: resolvedSources.usableContainer.cookieStoreId,
    ruleSeedKey,
    assignment: resolvedSources.usableContainer,
  };
};

const getNavigatorLanguages = ():
  (Navigator & { languages?: readonly string[] }) | undefined =>
  typeof navigator === "undefined"
    ? undefined
    : (navigator as Navigator & { languages?: readonly string[] });

const getNativeLanguages = (
  navigatorLanguageSource: ReturnType<typeof getNavigatorLanguages>,
): string[] => {
  if (navigatorLanguageSource?.languages?.length) {
    return [...navigatorLanguageSource.languages];
  }

  if (navigatorLanguageSource?.language) {
    return [navigatorLanguageSource.language];
  }

  return ["en-US"];
};

type NavigatorWithClientHints = Navigator & {
  deviceMemory?: number;
  userAgentData?: {
    brands?: readonly { brand: string; version: string }[];
    fullVersionList?: readonly { brand: string; version: string }[];
    mobile?: boolean;
    platform?: string;
  };
};

const getClientHintsNavigator = (): NavigatorWithClientHints | undefined =>
  typeof navigator === "undefined"
    ? undefined
    : (navigator as NavigatorWithClientHints);

const resolveNativeFingerprint = (
  browserFingerprintSource: BrowserFingerprintSource | undefined,
  navigatorWithClientHints: NavigatorWithClientHints | undefined,
): BrowserFingerprintSource | undefined => {
  if (browserFingerprintSource) {
    return browserFingerprintSource;
  }

  if (!navigatorWithClientHints) {
    return undefined;
  }

  return {
    userAgent: navigatorWithClientHints.userAgent,
    platform: navigatorWithClientHints.platform,
    vendor: navigatorWithClientHints.vendor,
    hardwareConcurrency: navigatorWithClientHints.hardwareConcurrency,
    ...(typeof navigatorWithClientHints.deviceMemory === "number"
      ? { deviceMemory: navigatorWithClientHints.deviceMemory }
      : {}),
    ...(navigatorWithClientHints.userAgentData
      ? { userAgentData: navigatorWithClientHints.userAgentData }
      : {}),
  };
};

const resolveRuntimeLocale = (
  profile: Location | null | undefined,
  nativeLanguage: string,
  nativeLanguages: readonly string[],
) =>
  profile
    ? getRuntimeLocale(profile)
    : {
        language: nativeLanguage,
        languages: nativeLanguages,
        formattingLanguage: nativeLanguage,
        formattingLanguages: nativeLanguages,
      };

type FingerprintExtOptions = {
  browserFamily: ReturnType<typeof detectBrowserFamily>;
  fingerprintEnabled: boolean;
  fingerprint: BrowserFingerprint | undefined;
  fingerprintSeedKey: string | null | undefined;
  hostArch: HardwareArch;
  hostPlatformKey: HardwarePlatformKey | undefined;
  nativeDeviceMemory: number | undefined;
  ruleOverrides: SurfaceOverrides | undefined;
  sharedSpoofing: SharedSpoofingConfig | undefined;
};

const extendFingerprint = ({
  browserFamily,
  fingerprintEnabled,
  fingerprint,
  fingerprintSeedKey,
  hostArch,
  hostPlatformKey,
  nativeDeviceMemory,
  ruleOverrides,
  sharedSpoofing,
}: FingerprintExtOptions): BrowserFingerprint | undefined => {
  if (!fingerprintEnabled || !fingerprintSeedKey) {
    return fingerprint;
  }

  const noiseSeed = createNoiseSeed({
    ruleSeedKey: fingerprintSeedKey,
  });
  const spoofingToggles = resolveRuleToggles(sharedSpoofing, ruleOverrides);
  const extras = buildSimpleFpExtras({
    baseSeed: noiseSeed,
    browserFamily,
    supportsDeviceMemory:
      typeof nativeDeviceMemory === "number" && canSpoofDeviceMemory(browserFamily),
    ...(hostPlatformKey ? { hostPlatformKey } : {}),
    hostArch,
  });
  const extendedFingerprint: BrowserFingerprint = {
    ...(fingerprint ?? {}),
    ...extras,
    spoofingToggles,
  };

  if (
    !extendedFingerprint.clientHints ||
    typeof extendedFingerprint.deviceMemory !== "number"
  ) {
    return extendedFingerprint;
  }

  return {
    ...extendedFingerprint,
    clientHints: {
      ...extendedFingerprint.clientHints,
      deviceMemory: extendedFingerprint.deviceMemory,
    },
  };
};

/**
 * Converts a saved location profile into the synchronous runtime payload used
 * by page-world patches and worker bootstraps.
 */
/**
 * Reads everything the snapshot needs about the *host* browser, before any
 * spoofing is applied. Split out of {@link toRuntimeSnapshot} to keep that
 * function inside its length budget; it holds no resolution logic.
 */
const resolveNativeEnvironment = (
  browserFingerprintSource: BrowserFingerprintSource | undefined,
) => {
  const nativeLanguages = getNativeLanguages(getNavigatorLanguages());
  const nativeFingerprint = resolveNativeFingerprint(
    browserFingerprintSource,
    getClientHintsNavigator(),
  );

  return {
    acceptLanguagePolicy: detectLanguagePolicy(nativeFingerprint),
    browserFamily: detectBrowserFamily(nativeFingerprint?.userAgent),
    nativeFingerprint,
    nativeLanguage: nativeLanguages[0] ?? "en-US",
    nativeLanguages,
    nativeTimeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
  };
};

type FencingPlan = {
  /** Seed used for noise / hardware / version derivation. */
  seedKey: string | null;
  /** Marker for realm-side finalization on shared or Firefox channels. */
  marker: FingerprintFencing | undefined;
};

/**
 * Resolves how domain fencing applies to this snapshot build.
 *
 * - No request or no usable identity seed → base seed, no marker.
 * - Hostname known on Chromium → derive the fenced seed here; every Chromium
 *   delivery channel is background-resolved per hostname, so the snapshot can
 *   carry fully fenced values (noise, hardware selection, version rotation).
 * - Otherwise (multi-domain template, or any Firefox build) → keep the base
 *   seed and attach a marker; the consuming realm finalizes noise seeds via
 *   `applyFencedNoiseSeeds`. Firefox stays marker-based even with a hostname
 *   because its static/userScripts and `window.name` catalog channels can only
 *   fence in-realm — background parity would otherwise diverge from them.
 *
 * `authKey` is never involved (invariant #4): fencing derives only from the
 * rotatable `ruleSeedKey`.
 */
const resolveFencingPlan = (
  domainFencing: DomainFencingRequest | undefined,
  baseSeedKey: string | null,
): FencingPlan => {
  if (!domainFencing || !baseSeedKey) {
    return { seedKey: baseSeedKey, marker: undefined };
  }

  const fenceBaseKey = deriveFenceBaseKey(baseSeedKey);
  if (domainFencing.hostname !== undefined && BUILD_BROWSER_TARGET === "chromium") {
    return {
      seedKey: deriveFencedSeedKey(fenceBaseKey, getSiteKey(domainFencing.hostname)),
      marker: undefined,
    };
  }

  return { seedKey: baseSeedKey, marker: { key: fenceBaseKey } };
};

type SurfaceGateOptions = Pick<
  ToRuntimeSnapshotOptions,
  | "fingerprintEnabled"
  | "profile"
  | "ruleOverrides"
  | "sharedSpoofing"
  | "sharedWorkerHandlingMode"
>;

const resolveSurfaceGates = ({
  fingerprintEnabled,
  profile,
  ruleOverrides,
  sharedSpoofing,
  sharedWorkerHandlingMode,
}: SurfaceGateOptions) => {
  // Preserve individual settings for a later re-enable while the global
  // protection switch gates every page-visible surface.
  if (!fingerprintEnabled) {
    return {
      blockServiceWorkers: false,
      geoEnabled: false,
      workerMode: "native" as const,
      timeLocaleEnabled: false,
    };
  }

  return {
    blockServiceWorkers: resolveSwBlocking(sharedSpoofing, ruleOverrides),
    geoEnabled: profile ? resolveGeoSurface(sharedSpoofing, ruleOverrides) : false,
    workerMode: resolveSharedWorkerMode(
      sharedSpoofing,
      ruleOverrides,
      sharedWorkerHandlingMode,
    ),
    timeLocaleEnabled: profile
      ? resolveTimeLocaleSurface(sharedSpoofing, ruleOverrides)
      : false,
  };
};

export const toRuntimeSnapshot = ({
  authKey,
  browserFingerprintSource,
  domainFencing,
  fingerprintEnabled,
  debugMode,
  profile,
  ruleOverrides,
  ruleSeedKey,
  sharedSpoofing,
  sharedWorkerHandlingMode,
  temporalApiEnabled,
  watchPositionDelay,
}: ToRuntimeSnapshotOptions): RuntimeSnapshot => {
  const baseEpochMs = Date.now();
  const {
    acceptLanguagePolicy,
    browserFamily,
    nativeFingerprint,
    nativeLanguage,
    nativeLanguages,
    nativeTimeZone,
  } = resolveNativeEnvironment(browserFingerprintSource);
  const fencingPlan = resolveFencingPlan(domainFencing, readRuleSeedKey(ruleSeedKey));
  const fingerprintSeedKey = fencingPlan.seedKey;
  const fingerprint = createBrowserFingerprint(
    {
      userAgent: nativeFingerprint?.userAgent,
      platform: nativeFingerprint?.platform,
      vendor: nativeFingerprint?.vendor,
      hardwareConcurrency: nativeFingerprint?.hardwareConcurrency,
      deviceMemory: canSpoofDeviceMemory(browserFamily)
        ? nativeFingerprint?.deviceMemory
        : undefined,
      userAgentData: nativeFingerprint?.userAgentData,
    },
    fingerprintEnabled,
    {
      rotateChromiumVersion: sharedSpoofing?.clientHintsVersionRotation !== false,
      ...(fingerprintSeedKey ? { versionSeedKey: fingerprintSeedKey } : {}),
    },
  );

  const runtimeLocale = resolveRuntimeLocale(profile, nativeLanguage, nativeLanguages);
  const effectiveTimeZone = profile?.timeZone ?? nativeTimeZone;
  const acceptLanguage = serializeAcceptLanguage(
    runtimeLocale.languages,
    acceptLanguagePolicy,
  );
  const { blockServiceWorkers, geoEnabled, workerMode, timeLocaleEnabled } =
    resolveSurfaceGates({
      fingerprintEnabled,
      profile,
      ruleOverrides,
      sharedSpoofing,
      sharedWorkerHandlingMode,
    });
  const hostPlatformKey = normalizePlatformKey(
    nativeFingerprint?.userAgentData?.platform ?? nativeFingerprint?.platform,
  );
  const hostArch = normalizeHardwareArch(nativeFingerprint?.architecture);
  const extendedFingerprint = extendFingerprint({
    browserFamily,
    fingerprintEnabled,
    fingerprint,
    fingerprintSeedKey,
    hostArch,
    hostPlatformKey,
    nativeDeviceMemory: nativeFingerprint?.deviceMemory,
    ruleOverrides,
    sharedSpoofing,
  });
  const fencedFingerprint =
    extendedFingerprint && fencingPlan.marker
      ? { ...extendedFingerprint, fencing: fencingPlan.marker }
      : extendedFingerprint;

  return {
    debugMode,
    watchPositionDelay,
    sharedWorkerHandlingMode: workerMode,
    ...(workerMode === "native" ? {} : { sharedWorkerCompatibilityMode: false }),
    ...(geoEnabled ? {} : { geolocationEnabled: false }),
    ...(timeLocaleEnabled ? {} : { timeLocaleEnabled: false }),
    ...(timeLocaleEnabled && temporalApiEnabled ? { temporalApiEnabled: true } : {}),
    ...(blockServiceWorkers ? { blockServiceWorkerRegistration: true } : {}),
    geo: {
      latitude: profile?.latitude ?? 0,
      longitude: profile?.longitude ?? 0,
      accuracy: profile?.accuracy ?? 0,
      noiseRadius: profile?.noiseRadius ?? 50,
    },
    locale: {
      language: runtimeLocale.language,
      languages: runtimeLocale.languages,
      timeZone: effectiveTimeZone,
      acceptLanguage,
      formattingLanguage: runtimeLocale.formattingLanguage ?? runtimeLocale.language,
      formattingLanguages: runtimeLocale.formattingLanguages ?? runtimeLocale.languages,
    },
    date: {
      baseEpochMs,
      offsetMs:
        (new Date(baseEpochMs).getTimezoneOffset() -
          getTimeZoneOffsetMinutes(effectiveTimeZone, baseEpochMs)) *
        60_000,
      timeZone: effectiveTimeZone,
    },
    ...(fencedFingerprint ? { fingerprint: fencedFingerprint } : {}),
    ...(authKey ? { authKey } : {}),
  };
};

export const toRuleRuntimeSnapshot = ({
  profile,
  rule,
  ...buildOptions
}: RuleSnapshotOptions): RuntimeSnapshot =>
  toRuntimeSnapshot({
    ...buildOptions,
    authKey: rule?.authKey,
    profile,
    ruleOverrides: rule?.fingerprintSurfaceOverrides,
    ruleSeedKey: rule?.ruleSeedKey,
  });

export const resolveActiveIdentity = (
  hostname: string,
  cookieStoreId: string | undefined,
  rules: readonly DomainRule[],
  containerAssignments: readonly ContainerAssignment[] = [],
): ActiveIdentity | null =>
  toActiveIdentity(
    resolveRuleSources({
      hostname,
      cookieStoreId,
      rules,
      containerAssignments,
    }),
  );

/**
 * Normalizes the fallback rule's seed for matching while *preserving* its
 * authKey verbatim.
 *
 * ⚠️ Resolution must NEVER mint an authKey (do not call `withAuthKey` /
 * `withFallbackSeed` here). The authKey is a once-per-rule nonce
 * created and persisted at the storage boundary; minting per resolve would hand
 * different keys to the runtime and the XRay on repeated/parallel resolves and
 * silently break the keyed surface-usage channel. A rule that arrives without an
 * authKey yields no keyed channel — never a per-call random one.
 *
 * @see createAuthKey (in `@/shared/rule-seed`) for the full authKey contract.
 */
const normalizeFallback = (
  globalFallbackRule: GlobalFallbackRule | undefined,
): GlobalFallbackRule | undefined =>
  globalFallbackRule
    ? {
        ...globalFallbackRule,
        ruleSeedKey: normalizeRuleSeedKey(globalFallbackRule.ruleSeedKey),
      }
    : undefined;

type SnapshotBuildParams = SnapshotBuildOptions & {
  profiles: readonly Location[];
  domainFencing: DomainFencingRequest | undefined;
};

/**
 * Builds the snapshot when no trusted site and no domain rule / usable container
 * won, i.e. the Default Rule path.
 *
 * An enabled container assignment without its own preset still inherits the
 * Default Rule's enabled state and location, but keeps its OWN fingerprint
 * identity (ruleSeedKey/authKey/overrides). Otherwise every such container would
 * collapse onto the Default Rule's shared seed and present an identical
 * fingerprint — defeating container isolation. The identity is read verbatim
 * here; it is never minted during resolution (invariant #15).
 */
const resolveFallbackSnapshot = (
  resolvedSources: ResolvedRuleSources,
  normalizedFallback: GlobalFallbackRule | undefined,
  params: SnapshotBuildParams,
): RuntimeSnapshot | null => {
  const { profiles, domainFencing, ...buildOptions } = params;
  const { fingerprintEnabled } = buildOptions;
  const fingerprintFallback =
    normalizedFallback && normalizedFallback.enabled !== false && fingerprintEnabled
      ? normalizedFallback
      : null;
  const fallbackRule = resolvedSources.runtimeFallbackRule ?? fingerprintFallback;
  if (!fallbackRule) {
    return null;
  }

  const identityContainer = resolvedSources.activeContainer;
  if (identityContainer && readRuleSeedKey(identityContainer.ruleSeedKey)) {
    const containerLocationId = identityContainer.locationId ?? fallbackRule.locationId;
    const containerLocation = containerLocationId
      ? profiles.find((candidate) => candidate.id === containerLocationId)
      : undefined;
    const containerSnapshot = toRuntimeSnapshot({
      ...buildOptions,
      authKey: identityContainer.authKey,
      profile: containerLocation,
      ruleOverrides: identityContainer.fingerprintSurfaceOverrides,
      ruleSeedKey: identityContainer.ruleSeedKey,
      domainFencing,
    });
    return hasRuntimePayload(containerSnapshot) ? containerSnapshot : null;
  }

  const fallbackLocation = fallbackRule.locationId
    ? profiles.find((candidate) => candidate.id === fallbackRule.locationId)
    : undefined;
  const snapshot = toRuleRuntimeSnapshot({
    ...buildOptions,
    profile: fallbackLocation,
    rule: fallbackRule,
    domainFencing,
  });
  return hasRuntimePayload(snapshot) ? snapshot : null;
};

/**
 * Resolves the effective spoofing snapshot for a tab context.
 *
 * Privacy Thing has one runtime decision hierarchy, but it does not store all
 * sources as one homogeneous rule type. Instead, the resolver combines several
 * entities that match on different keys and have slightly different semantics:
 * trusted-site bypasses, domain rules, Firefox container assignments, and the
 * global fallback rule.
 *
 * Resolution order:
 *
 * | Source | Match key | Wins when | Fallback / next step |
 * | --- | --- | --- | --- |
 * | Trusted Site | `hostname` pattern | A trusted-site pattern matches first. Privacy Thing must stay fully disabled. | Stop and return `null`. |
 * | Domain Rule | `hostname` pattern | No trusted site matched and the most specific enabled domain rule matches. | If the winning rule has no `locationId`, inherit location from the active container assignment first, then from the global fallback rule. |
 * | Container Assignment | `cookieStoreId` | No trusted site matched and no domain rule won for the tab. | Use the container assignment when it is enabled and has a `locationId`. An enabled container *without* a `locationId` still inherits the Default Rule's enabled state and location, but keeps its OWN fingerprint identity (`ruleSeedKey`/`authKey`/overrides) so containers stay mutually distinct instead of collapsing onto the Default Rule's shared seed. |
 * | Default Rule | global singleton | No trusted site, no winning domain rule, and no enabled container assignment kept its own identity. | Use the global fallback when enabled. A saved location drives geo/time-locale spoofing; without one, the same rule can still own fingerprint-only runtime. |
 * | None | — | Nothing above produced an applicable source. | Return `null`. |
 *
 * Important nuance: the hierarchy above is unified at runtime, but storage is
 * intentionally split. `TrustedSite`, `DomainRule`, `ContainerAssignment`, and
 * `GlobalFallbackRule` are separate types because they match on different
 * identifiers and do not expose exactly the same behavior surface.
 *
 * `resolveActiveIdentity()` handles only the domain-rule vs container branch.
 * Trusted-site bypass and global-fallback resolution stay in this entry point
 * so the full precedence order remains explicit in one place.
 */
export const resolveProfileSnapshot = ({
  containerAssignments,
  cookieStoreId,
  domainFencingEnabled,
  globalFallbackRule,
  hostname,
  profiles,
  rules,
  trustedSites,
  ...buildOptions
}: ProfileSnapshotOptions): RuntimeSnapshot | null => {
  // Fencing applies only to fallback/container identities; domain rules are
  // explicit per-domain configuration and keep their static identity.
  const domainFencing = domainFencingEnabled ? { hostname } : undefined;
  const normalizedFallback = normalizeFallback(globalFallbackRule);
  const resolvedSources = resolveRuleSources({
    hostname,
    cookieStoreId,
    rules,
    containerAssignments,
    globalFallbackRule: normalizedFallback,
    trustedSites,
  });

  if (resolvedSources.trustedSite) {
    return null;
  }

  const activeIdentity = toActiveIdentity(resolvedSources);
  if (!activeIdentity) {
    return resolveFallbackSnapshot(resolvedSources, normalizedFallback, {
      ...buildOptions,
      profiles,
      domainFencing,
    });
  }

  const location = resolvedSources.effectiveLocationId
    ? profiles.find((candidate) => candidate.id === resolvedSources.effectiveLocationId)
    : undefined;

  const snapshot =
    activeIdentity.kind === "rule"
      ? toRuleRuntimeSnapshot({
          ...buildOptions,
          profile: location,
          rule: activeIdentity.rule,
        })
      : toRuntimeSnapshot({
          ...buildOptions,
          authKey: activeIdentity.assignment.authKey,
          profile: location,
          ruleOverrides: activeIdentity.assignment.fingerprintSurfaceOverrides,
          ruleSeedKey: activeIdentity.ruleSeedKey,
          domainFencing,
        });

  // `blockServiceWorkerRegistration` is resolved inside `toRuntimeSnapshot`
  // from the shared global default + per-rule/container surface override.

  return hasRuntimePayload(snapshot) ? snapshot : null;
};

export { matchTrustedSite };
