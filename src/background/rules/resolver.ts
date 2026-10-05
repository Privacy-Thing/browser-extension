/** Resolve rule/container identity and site partition exclusively in the background. */
import {
  deriveFenceBaseKey,
  deriveFencedSeedKey,
  getSiteKey,
} from "@/background/domain-fencing";
import type {
  DomainFencingRequest,
  ProfileSnapshotOptions,
  SnapshotBuildOptions,
  RuleSnapshotOptions,
  ToRuntimeSnapshotOptions,
} from "@/background/rules/resolver-options";
import {
  matchTrustedSite,
  resolveRuleSources,
  type ResolvedRuleSources,
} from "@/shared/rule-resolution";
import { normalizeRuleSeedKey, readRuleSeedKey } from "@/shared/rule-seed";
import { hasRuntimePayload } from "@/shared/runtime-snapshot";
import { buildRuntimeSnapshot } from "@/shared/runtime-snapshot-builder";
import type {
  ContainerAssignment,
  DomainRule,
  GlobalFallbackRule,
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

/**
 * Resolves the fingerprint seed for this snapshot build.
 *
 * - No request, no usable identity seed, or no site key (shared `*` templates,
 *   empty/`about:blank` hosts) → unfenced base seed. The page still gets a
 *   generated fingerprint instead of native device values.
 * - Hostname known → derive the fenced seed here on every target (noise,
 *   hardware selection, version rotation). No page-visible marker.
 *
 * `authKey` is never involved (invariant #4): fencing derives only from the
 * rotatable `ruleSeedKey`.
 */
const resolveFencingSeedKey = (
  domainFencing: DomainFencingRequest | undefined,
  baseSeedKey: string | null,
): string | null => {
  if (!domainFencing || !baseSeedKey) {
    return baseSeedKey;
  }

  const siteKey = domainFencing.hostname ? getSiteKey(domainFencing.hostname) : "";
  if (!siteKey) {
    return baseSeedKey;
  }

  return deriveFencedSeedKey(deriveFenceBaseKey(baseSeedKey), siteKey);
};

export const toRuntimeSnapshot = ({
  domainFencing,
  ruleSeedKey,
  ...options
}: ToRuntimeSnapshotOptions): RuntimeSnapshot =>
  buildRuntimeSnapshot({
    ...options,
    ruleSeedKey:
      resolveFencingSeedKey(domainFencing, readRuleSeedKey(ruleSeedKey)) ?? undefined,
  });

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
