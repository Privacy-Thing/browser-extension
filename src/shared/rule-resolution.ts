import { findRuleMatches } from "@/shared/domain-match";
import type {
  ContainerAssignment,
  DomainRule,
  GlobalFallbackRule,
  TrustedSite,
} from "@/shared/types";

export type ResolvedRuleSources = {
  trustedSite: TrustedSite | null;
  matchingTrustedSite: TrustedSite | null;
  activeRule: DomainRule | null;
  displayedRule: DomainRule | null;
  matchedContainer: ContainerAssignment | null;
  activeContainer: ContainerAssignment | null;
  usableContainer: ContainerAssignment | null;
  runtimeFallbackRule: GlobalFallbackRule | null;
  previewFallbackRule: GlobalFallbackRule | null;
  inheritedLocationId: string | null;
  effectiveLocationId: string | null;
  winningSource: "rule" | "container" | "fallback" | "trusted-site" | "none";
};

export type TrustedSiteMatchSet = {
  enabledSite: TrustedSite | null;
  matchingSite: TrustedSite | null;
};

type ResolveRuleSourcesParams = {
  hostname: string;
  cookieStoreId?: string | undefined;
  rules: readonly DomainRule[];
  containerAssignments?: readonly ContainerAssignment[] | undefined;
  globalFallbackRule?: GlobalFallbackRule | undefined;
  trustedSites?: readonly TrustedSite[] | undefined;
};

const resolveMatchedContainer = (
  cookieStoreId: string | undefined,
  containerAssignments: readonly ContainerAssignment[],
): ContainerAssignment | null => {
  if (!cookieStoreId) {
    return null;
  }

  return (
    containerAssignments.find((entry) => entry.cookieStoreId === cookieStoreId) ?? null
  );
};

const resolveWinningSource = (
  trustedSite: TrustedSite | null,
  activeRule: DomainRule | null,
  usableContainer: ContainerAssignment | null,
  runtimeFallbackRule: GlobalFallbackRule | null,
): ResolvedRuleSources["winningSource"] => {
  if (trustedSite) {
    return "trusted-site";
  }

  if (activeRule) {
    return "rule";
  }

  if (usableContainer) {
    return "container";
  }

  return runtimeFallbackRule ? "fallback" : "none";
};

const hasFallbackPreview = (
  globalFallbackRule: GlobalFallbackRule | undefined,
): globalFallbackRule is GlobalFallbackRule =>
  Boolean(
    globalFallbackRule &&
    globalFallbackRule.enabled !== false &&
    (Boolean(globalFallbackRule.locationId) ||
      globalFallbackRule.fingerprintSurfaceOverrides?.geolocation === false ||
      Object.values(globalFallbackRule.fingerprintSurfaceOverrides ?? {}).some(
        (value) => value !== undefined,
      )),
  );

export const findTrustedSiteMatches = (
  hostname: string,
  trustedSites: readonly TrustedSite[] = [],
): TrustedSiteMatchSet => {
  const normalizedHostname = hostname.trim().toLowerCase();
  const matches = findRuleMatches(
    normalizedHostname,
    trustedSites.map((site, index) => ({
      pattern: site.pattern,
      locationId: String(index),
      enabled: site.enabled,
    })),
  );
  const resolveSite = (locationId: string | undefined): TrustedSite | null => {
    const matchedSiteIndex = Number(locationId);
    return Number.isInteger(matchedSiteIndex)
      ? (trustedSites[matchedSiteIndex] ?? null)
      : null;
  };

  return {
    enabledSite: resolveSite(matches.enabledRule?.locationId),
    matchingSite: resolveSite(matches.matchingRule?.locationId),
  };
};

export const matchTrustedSite = (
  hostname: string,
  trustedSites: readonly TrustedSite[] = [],
): TrustedSite | undefined =>
  findTrustedSiteMatches(hostname, trustedSites).enabledSite ?? undefined;

export const resolveRuleSources = ({
  hostname,
  cookieStoreId,
  rules,
  containerAssignments = [],
  globalFallbackRule,
  trustedSites = [],
}: ResolveRuleSourcesParams): ResolvedRuleSources => {
  const normalizedHostname = hostname.trim().toLowerCase();
  const trustedSiteMatches = findTrustedSiteMatches(normalizedHostname, trustedSites);
  const trustedSite = trustedSiteMatches.enabledSite;
  const ruleMatches = findRuleMatches(normalizedHostname, rules);
  const activeRule = ruleMatches.enabledRule ?? null;
  const displayedRule = ruleMatches.matchingRule ?? null;
  const matchedContainer = resolveMatchedContainer(cookieStoreId, containerAssignments);
  const activeContainer = matchedContainer?.enabled !== false ? matchedContainer : null;
  const usableContainer = activeContainer?.locationId ? activeContainer : null;
  const runtimeFallbackRule =
    globalFallbackRule?.enabled !== false && globalFallbackRule?.locationId
      ? globalFallbackRule
      : null;
  const previewFallbackRule = hasFallbackPreview(globalFallbackRule)
    ? globalFallbackRule
    : null;
  const fallbackLocationId =
    usableContainer?.locationId ?? runtimeFallbackRule?.locationId ?? null;
  const inheritedLocationId =
    activeRule && !activeRule.locationId ? fallbackLocationId : null;
  const effectiveLocationId = activeRule
    ? activeRule.locationId || inheritedLocationId
    : fallbackLocationId;
  const winningSource = resolveWinningSource(
    trustedSite,
    activeRule,
    usableContainer,
    runtimeFallbackRule,
  );

  return {
    trustedSite,
    matchingTrustedSite: trustedSiteMatches.matchingSite,
    activeRule,
    displayedRule,
    matchedContainer,
    activeContainer,
    usableContainer,
    runtimeFallbackRule,
    previewFallbackRule,
    inheritedLocationId,
    effectiveLocationId,
    winningSource,
  };
};
