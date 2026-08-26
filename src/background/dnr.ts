import { resetFenceDnrRules } from "@/background/dnr-domain-fencing";
import { buildRequestHeaders } from "@/background/dnr-request-headers";
import {
  resolveProfileSnapshot,
  toRuleRuntimeSnapshot,
} from "@/background/rules/resolver";
import { loadContainerAssignments } from "@/background/storage/container-assignments";
import { loadLocations } from "@/background/storage/locations";
import {
  getFingerprintEnabled,
  getGlobalFallbackRule,
  getPreferences,
  getSharedSpoofing,
} from "@/background/storage/preferences";
import { loadRules } from "@/background/storage/rules";
import { loadTrustedSites } from "@/background/storage/trusted-sites";
import { recordSurfaceEvidence } from "@/background/surface-evidence-tracker";
import {
  type BrowserFingerprintSource,
  readFingerprintSource,
} from "@/shared/browser-fingerprint";
import { BUILD_BROWSER_TARGET } from "@/shared/build-flags";
import {
  buildDomainPatternSource,
  getDomainRuleSpecificity,
} from "@/shared/domain-match";
import type {
  DomainRule,
  DynamicHeaderRule,
  EffectiveTabContext,
  GlobalFallbackRule,
  SharedSpoofingConfig,
  ContainerAssignment,
  Location,
  RuntimeSnapshot,
  SharedWorkerHandlingMode,
  TrustedSite,
  XRaySurfaceCategory,
} from "@/shared/types";

/**
 * Inert on this path, and deliberately not the canonical preference default.
 *
 * Header rules only ever read `fingerprint`, `locale` and `timeLocaleEnabled`
 * off the snapshot, so the resolved SharedWorker mode cannot reach an HTTP
 * header. The resolver used to default this argument to `"native"`; pinning the
 * same value here keeps that behaviour byte-for-byte while the argument becomes
 * explicit. Do **not** "fix" this to `DEFAULT_PREFERENCES.sharedWorkerHandlingMode`
 * (`"strict"`) — that is a real behaviour change and belongs in its own review.
 */
const HEADER_WORKER_MODE: SharedWorkerHandlingMode = "native";

const TAB_RULE_ID_BASE = 1_000_000;
const DOMAIN_RULE_ID_BASE = 2_000_000;
const CSP_RULE_ID_BASE = 3_000_000;
const TRUSTED_RULE_ID_BASE = 4_000_000;
const GLOBAL_FALLBACK_RULE_ID = 2_900_000;
const MODIFY_HEADERS = "modifyHeaders" as chrome.declarativeNetRequest.RuleActionType;
const ALLOW = "allow" as chrome.declarativeNetRequest.RuleActionType;
const REMOVE_HEADER = "remove" as chrome.declarativeNetRequest.HeaderOperation;
const RESOURCE_TYPES = [
  "main_frame",
  "sub_frame",
  "xmlhttprequest",
  "script",
  "image",
  "font",
  "stylesheet",
  "media",
  "websocket",
  "ping",
  ...(BUILD_BROWSER_TARGET === "firefox" ? ["beacon"] : []),
] as chrome.declarativeNetRequest.ResourceType[];
const CSP_RESOURCE_TYPES = [
  "main_frame",
  "sub_frame",
] as chrome.declarativeNetRequest.ResourceType[];
const toTabRuleId = (tabId: number): number => TAB_RULE_ID_BASE + tabId;
const RULE_PRIORITY_BASE = 100;
const MAX_HOST_PATTERN_LENGTH = 253;
const RULE_WILDCARD_RANGE = MAX_HOST_PATTERN_LENGTH + 1;
const RULE_SUBDOMAIN_SCALE = RULE_WILDCARD_RANGE;
const DOMAIN_RULE_EXACT_SCALE = RULE_WILDCARD_RANGE * 2;
const RULE_EXACT_SCALE = RULE_WILDCARD_RANGE * 4;
const MAX_DOMAIN_RULE_PRIORITY =
  RULE_PRIORITY_BASE +
  MAX_HOST_PATTERN_LENGTH * RULE_EXACT_SCALE +
  DOMAIN_RULE_EXACT_SCALE +
  RULE_SUBDOMAIN_SCALE +
  MAX_HOST_PATTERN_LENGTH;
const TAB_RULE_PRIORITY = MAX_DOMAIN_RULE_PRIORITY + 1;
const TRUSTED_ALLOW_PRIORITY = TAB_RULE_PRIORITY + 1;
const URL_REGEX_PREFIX = "^[a-z][a-z0-9+.-]*://(?:[^/?#]*@)?";
const HEADER_URL_RE_PREFIX = "^(?:https?|wss?)://(?:[^/?#]*@)?";
const URL_REGEX_SUFFIX = "(?::\\d+)?(?:[/?#]|$)";
const ANY_HEADER_HOST_RE = "[^/?#:@]+";
const CLIENT_HINTS_HEADERS = [
  "Sec-CH-UA",
  "Sec-CH-UA-Platform",
  "Sec-CH-UA-Mobile",
  "Sec-CH-UA-Full-Version-List",
] as const;
const SURFACE_BY_HEADER: Record<string, XRaySurfaceCategory> = {
  "Accept-Language": "timeLocale",
  "User-Agent": "navigator",
  ...Object.fromEntries(
    CLIENT_HINTS_HEADERS.map((header) => [header, "clientHints" as const]),
  ),
};

const resolveHeaderSurfaces = (
  requestHeaders: DynamicHeaderRule["action"]["requestHeaders"] | undefined,
): XRaySurfaceCategory[] => {
  const surfaces = new Set<XRaySurfaceCategory>();
  for (const entry of requestHeaders ?? []) {
    const surface = SURFACE_BY_HEADER[entry.header];
    if (surface) {
      surfaces.add(surface);
    }
  }
  return [...surfaces];
};

const isHeaderRuleInstalled = (
  expected: DynamicHeaderRule["action"]["requestHeaders"] | undefined,
  installed: DynamicHeaderRule["action"]["requestHeaders"] | undefined,
): boolean =>
  (expected ?? []).every((expectedHeader) =>
    (installed ?? []).some(
      (installedHeader) =>
        installedHeader.header === expectedHeader.header &&
        installedHeader.operation === expectedHeader.operation &&
        installedHeader.value === expectedHeader.value,
    ),
  );

const patternToHostRe = (pattern: string): string | null => {
  const trimmed = pattern.trim().toLowerCase();

  if (trimmed === "*" || trimmed === "" || trimmed.length > MAX_HOST_PATTERN_LENGTH) {
    return null;
  }

  return buildDomainPatternSource(trimmed, {
    wildcardFragment: "[^/?#:@]*",
    labelFragment: "[^/?#:.@]+",
  });
};

const buildUrlRegexFilter = (
  hostRegexFragment: string,
  urlRegexPrefix = URL_REGEX_PREFIX,
): string => `${urlRegexPrefix}${hostRegexFragment}${URL_REGEX_SUFFIX}`;

const resolveFallbackProfile = (
  profiles: readonly Location[],
  rule: DomainRule,
  globalFallbackRule: GlobalFallbackRule | undefined,
): Location | undefined => {
  const resolvedLocationId =
    rule.locationId ||
    (globalFallbackRule?.enabled ? globalFallbackRule.locationId : undefined);

  return resolvedLocationId
    ? profiles.find((candidate) => candidate.id === resolvedLocationId)
    : undefined;
};

const buildDomainFallbackRule = (
  index: number,
  rule: DomainRule,
  requestHeaders: DynamicHeaderRule["action"]["requestHeaders"],
  regexFilter: string,
): DynamicHeaderRule => ({
  id: DOMAIN_RULE_ID_BASE + index,
  priority: getDomainRulePriority(rule.pattern),
  action: {
    type: MODIFY_HEADERS,
    requestHeaders,
  },
  condition: {
    regexFilter,
    resourceTypes: RESOURCE_TYPES,
  },
});

const buildDomainBypassRule = (
  index: number,
  rule: DomainRule,
  regexFilter: string,
): DynamicHeaderRule => ({
  id: DOMAIN_RULE_ID_BASE + index,
  priority: getDomainRulePriority(rule.pattern),
  action: {
    type: ALLOW,
  },
  condition: {
    regexFilter,
    resourceTypes: RESOURCE_TYPES,
  },
});

const buildFallbackHeaderRule = (
  requestHeaders: DynamicHeaderRule["action"]["requestHeaders"],
): DynamicHeaderRule => ({
  id: GLOBAL_FALLBACK_RULE_ID,
  priority: 1,
  action: {
    type: MODIFY_HEADERS,
    requestHeaders,
  },
  condition: {
    regexFilter: buildUrlRegexFilter(ANY_HEADER_HOST_RE, HEADER_URL_RE_PREFIX),
    resourceTypes: RESOURCE_TYPES,
  },
});

const hasRequestHeaders = (
  requestHeaders: DynamicHeaderRule["action"]["requestHeaders"],
): requestHeaders is NonNullable<DynamicHeaderRule["action"]["requestHeaders"]> =>
  Array.isArray(requestHeaders) && requestHeaders.length > 0;

const buildSavedFallbackRule = ({
  index,
  rule,
  profiles,
  fingerprintEnabled,
  sharedSpoofing,
  browserFingerprintSource,
  globalFallbackRule,
}: {
  index: number;
  rule: DomainRule;
  profiles: readonly Location[];
  fingerprintEnabled: boolean;
  sharedSpoofing: SharedSpoofingConfig | undefined;
  browserFingerprintSource?: BrowserFingerprintSource | undefined;
  globalFallbackRule: GlobalFallbackRule | undefined;
}): DynamicHeaderRule | null => {
  const hostRegexFragment = patternToHostRe(rule.pattern);
  const regexFilter = hostRegexFragment ? buildUrlRegexFilter(hostRegexFragment) : null;
  if (!regexFilter) {
    return null;
  }

  const profile = resolveFallbackProfile(profiles, rule, globalFallbackRule);
  if (!profile) {
    return null;
  }

  const snapshot = toRuleRuntimeSnapshot({
    browserFingerprintSource,
    fingerprintEnabled,
    debugMode: false,
    profile,
    rule,
    sharedSpoofing,
    sharedWorkerHandlingMode: HEADER_WORKER_MODE,
    watchPositionDelay: [60, 500],
  });
  const requestHeaders = buildRequestHeaders(snapshot);
  if (!hasRequestHeaders(requestHeaders)) {
    // A saved domain rule still wins over the Default Rule when every
    // network-visible surface is Native. Without an explicit allow rule the
    // lower-priority global fallback would keep mutating this host's headers.
    return buildDomainBypassRule(index, rule, regexFilter);
  }

  return buildDomainFallbackRule(index, rule, requestHeaders, regexFilter);
};

const buildGlobalFallbackRule = ({
  profiles,
  fingerprintEnabled,
  sharedSpoofing,
  browserFingerprintSource,
  globalFallbackRule,
}: {
  profiles: readonly Location[];
  fingerprintEnabled: boolean;
  sharedSpoofing: SharedSpoofingConfig | undefined;
  browserFingerprintSource?: BrowserFingerprintSource | undefined;
  globalFallbackRule: GlobalFallbackRule | undefined;
}): DynamicHeaderRule | null => {
  if (!globalFallbackRule?.enabled || !globalFallbackRule.locationId) {
    return null;
  }

  const profile = profiles.find(
    (candidate) => candidate.id === globalFallbackRule.locationId,
  );
  if (!profile) {
    return null;
  }

  const snapshot = toRuleRuntimeSnapshot({
    browserFingerprintSource,
    fingerprintEnabled,
    debugMode: false,
    profile,
    rule: globalFallbackRule,
    sharedSpoofing,
    sharedWorkerHandlingMode: HEADER_WORKER_MODE,
    watchPositionDelay: [60, 500],
  });
  const requestHeaders = buildRequestHeaders(snapshot);
  return hasRequestHeaders(requestHeaders)
    ? buildFallbackHeaderRule(requestHeaders)
    : null;
};

/**
 * Converts a saved hostname pattern into a DNR `regexFilter` that preserves
 * the extension's matching semantics instead of collapsing exact and suffix
 * rules into the broader `requestDomains` behavior.
 *
 * Returns `null` when the pattern is too broad (bare `*`) or empty.
 */
export const patternToRegexFilter = (pattern: string): string | null => {
  const hostPattern = patternToHostRe(pattern);

  if (!hostPattern) {
    return null;
  }

  return buildUrlRegexFilter(hostPattern);
};

export const buildTrustedBypassRules = (
  trustedSites: readonly TrustedSite[],
): DynamicHeaderRule[] =>
  trustedSites.flatMap((site, index) => {
    if (site.enabled === false) {
      return [];
    }

    const regexFilter = patternToRegexFilter(site.pattern);
    if (!regexFilter) {
      return [];
    }

    return [
      {
        id: TRUSTED_RULE_ID_BASE + index,
        priority: TRUSTED_ALLOW_PRIORITY,
        action: {
          type: ALLOW,
        },
        condition: {
          regexFilter,
          resourceTypes: RESOURCE_TYPES,
        },
      },
    ];
  });

const getDomainRulePriority = (pattern: string): number => {
  const specificity = getDomainRuleSpecificity(pattern);
  const boundedWildcardCount = Math.min(
    specificity.wildcardCount,
    MAX_HOST_PATTERN_LENGTH,
  );
  const wildcardBonus = MAX_HOST_PATTERN_LENGTH - boundedWildcardCount;

  const priority =
    RULE_PRIORITY_BASE +
    specificity.nonWildcardLength * RULE_EXACT_SCALE +
    specificity.exactMatchBonus * DOMAIN_RULE_EXACT_SCALE +
    specificity.subdomainOnlyBonus * RULE_SUBDOMAIN_SCALE +
    wildcardBonus;

  return Math.min(priority, TAB_RULE_PRIORITY - 1);
};

/**
 * Builds per-tab DNR header rules from the same runtime snapshot used by page
 * injection, keeping network Client Hints aligned with JS-visible values.
 */
export type HeaderRuleInput = {
  contexts: readonly EffectiveTabContext[];
  profiles: Awaited<ReturnType<typeof loadLocations>>;
  rules: Awaited<ReturnType<typeof loadRules>>;
  fingerprintEnabled: boolean;
  /**
   * Domain fencing flag: fences the per-tab header rules for fallback and
   * container identities so `Sec-CH-UA-Full-Version-List` matches the fenced
   * JS-visible values. The tab-independent global fallback rule keeps the
   * spoofed *base* version list — the documented residual window for requests
   * outside any tab rule (e.g. service-worker-initiated fetches).
   */
  domainFencingEnabled?: boolean;
  sharedSpoofing?: SharedSpoofingConfig;
  browserFingerprintSource?: BrowserFingerprintSource;
  globalFallbackRule?: GlobalFallbackRule;
  trustedSites?: Awaited<ReturnType<typeof loadTrustedSites>>;
  containerAssignments?: readonly ContainerAssignment[];
};

export const buildHeaderRules = ({
  contexts,
  profiles,
  rules,
  fingerprintEnabled,
  domainFencingEnabled,
  sharedSpoofing,
  browserFingerprintSource,
  globalFallbackRule,
  trustedSites = [],
  containerAssignments = [],
}: HeaderRuleInput): DynamicHeaderRule[] => {
  const nextRules: DynamicHeaderRule[] = [];

  for (const context of contexts) {
    if (!context.hostname) {
      continue;
    }

    const snapshot = resolveProfileSnapshot({
      browserFingerprintSource,
      fingerprintEnabled,
      containerAssignments,
      cookieStoreId: context.cookieStoreId,
      debugMode: false,
      domainFencingEnabled,
      globalFallbackRule,
      hostname: context.hostname,
      profiles,
      rules,
      sharedSpoofing,
      sharedWorkerHandlingMode: HEADER_WORKER_MODE,
      trustedSites,
      watchPositionDelay: [60, 500],
    });

    if (!snapshot) {
      continue;
    }
    const requestHeaders = buildRequestHeaders(snapshot);
    if (!hasRequestHeaders(requestHeaders)) {
      continue;
    }

    nextRules.push({
      id: toTabRuleId(context.tabId),
      priority: TAB_RULE_PRIORITY,
      action: {
        type: MODIFY_HEADERS,
        requestHeaders,
      },
      condition: {
        tabIds: [context.tabId],
        requestDomains: [context.hostname],
        resourceTypes: RESOURCE_TYPES,
      },
    });
  }

  return nextRules;
};

export const buildSnapshotHeaderRule = (
  context: EffectiveTabContext,
  snapshot: RuntimeSnapshot | null,
): DynamicHeaderRule | null => {
  if (!snapshot || !context.hostname) {
    return null;
  }

  const requestHeaders = buildRequestHeaders(snapshot);
  if (!hasRequestHeaders(requestHeaders)) {
    return null;
  }

  return {
    id: toTabRuleId(context.tabId),
    priority: TAB_RULE_PRIORITY,
    action: {
      type: MODIFY_HEADERS,
      requestHeaders,
    },
    condition: {
      tabIds: [context.tabId],
      requestDomains: [context.hostname],
      resourceTypes: RESOURCE_TYPES,
    },
  };
};

export const syncContextHeaderRule = (
  context: EffectiveTabContext,
  snapshot: RuntimeSnapshot | null,
): Promise<void> => {
  syncHeaderRulesInFlight = syncHeaderRulesInFlight
    .catch(() => undefined)
    .then(async () => {
      const rule = buildSnapshotHeaderRule(context, snapshot);

      await chrome.declarativeNetRequest.updateSessionRules({
        removeRuleIds: [toTabRuleId(context.tabId)],
        ...(rule ? { addRules: [rule] } : {}),
      });

      if (!rule) {
        return;
      }

      // Confirm the browser actually applied the expected header rule instead
      // of assuming success from an unrejected promise — a session rule-count
      // limit or a higher-priority conflicting rule can silently drop or
      // shadow it, leaving the network-visible headers inconsistent with the
      // spoofed JavaScript surfaces (#111). Reported against the `dnr` realm so
      // the worst-of fold degrades the hybrid surface without pretending the
      // (separately-confirmed) JavaScript layer also failed.
      try {
        const activeRules = await chrome.declarativeNetRequest.getSessionRules();
        const installedRule = activeRules.find(
          (activeRule) => activeRule.id === rule.id,
        );
        const matches = isHeaderRuleInstalled(
          rule.action.requestHeaders,
          installedRule?.action.requestHeaders,
        );
        const headerSurfaces = resolveHeaderSurfaces(rule.action.requestHeaders);
        const observedAt = Date.now();
        for (const category of headerSurfaces) {
          // Emit on both branches (last-write-wins per `dnr` realm) so a rule
          // that later re-applies correctly clears a prior mismatch instead of
          // leaving the surface degraded for the tab's lifetime.
          recordSurfaceEvidence(context.tabId, category, {
            realmId: "dnr",
            integrity: matches ? "intact" : "degraded",
            ...(matches ? {} : { reasonCode: "dnr-header-rule-mismatch" }),
            observedAt,
          });
        }
      } catch {
        // Readback is a best-effort confirmation; it must not fail the sync.
      }
    });
  return syncHeaderRulesInFlight;
};

/**
 * Builds domain-scoped DNR fallback rules that apply **without** `tabIds`.
 *
 * Service-worker-initiated requests often lack a `tabId`, so the per-tab rules
 * from {@link buildHeaderRules} will not match them. These lower-priority
 * domain-scoped rules ensure that `Accept-Language` and Client Hints headers
 * are still set on requests originating from domains covered by active
 * saved rules.
 *
 * Rules are generated one-for-one from the saved rules so exact hosts,
 * suffix hosts, and rule-local fingerprint overrides keep their own semantics.
 * Domain rule priorities track hostname specificity while per-tab rules always
 * keep a higher priority.
 */
export type DomainFallbackRuleInput = {
  profiles: readonly Location[];
  rules: readonly DomainRule[];
  fingerprintEnabled: boolean;
  sharedSpoofing?: SharedSpoofingConfig;
  browserFingerprintSource?: BrowserFingerprintSource;
  globalFallbackRule?: GlobalFallbackRule;
};

export const buildDomainFallbackRules = ({
  profiles,
  rules,
  fingerprintEnabled,
  sharedSpoofing,
  browserFingerprintSource,
  globalFallbackRule,
}: DomainFallbackRuleInput): DynamicHeaderRule[] => {
  const nextRules: DynamicHeaderRule[] = [];

  for (const [index, rule] of rules.entries()) {
    if (!rule.enabled) {
      continue;
    }

    const fallbackRule = buildSavedFallbackRule({
      index,
      rule,
      profiles,
      fingerprintEnabled,
      sharedSpoofing,
      browserFingerprintSource,
      globalFallbackRule,
    });
    if (fallbackRule) {
      nextRules.push(fallbackRule);
    }
  }

  const globalRule = buildGlobalFallbackRule({
    profiles,
    fingerprintEnabled,
    sharedSpoofing,
    browserFingerprintSource,
    globalFallbackRule,
  });
  if (globalRule) {
    nextRules.push(globalRule);
  }

  return nextRules;
};

/**
 * Builds domain-scoped DNR rules that remove `Content-Security-Policy` (and
 * `-Report-Only`) response headers for rules with `relaxCspForWorkers` enabled.
 *
 * The runtime wraps page workers in blob URLs to inject spoofing patches. Sites
 * whose CSP does not include `blob:` in `script-src` / `worker-src` block these
 * blob workers.  Removing the CSP header on matching document responses allows
 * the blob bootstrap to execute.
 *
 * Only rules with the explicit opt-in flag are affected — CSP is never removed
 * globally or for domains that do not need it.
 */
export const buildCspRemovalRules = (
  rules: readonly DomainRule[],
): DynamicHeaderRule[] => {
  const nextRules: DynamicHeaderRule[] = [];

  for (const [index, rule] of rules.entries()) {
    if (!rule.enabled || !rule.relaxCspForWorkers) {
      continue;
    }

    const regexFilter = patternToRegexFilter(rule.pattern);
    if (!regexFilter) {
      continue;
    }

    nextRules.push({
      id: CSP_RULE_ID_BASE + index,
      priority: getDomainRulePriority(rule.pattern),
      action: {
        type: MODIFY_HEADERS,
        responseHeaders: [
          { header: "Content-Security-Policy", operation: REMOVE_HEADER },
          { header: "Content-Security-Policy-Report-Only", operation: REMOVE_HEADER },
        ],
      },
      condition: {
        regexFilter,
        resourceTypes: CSP_RESOURCE_TYPES,
      },
    });
  }

  return nextRules;
};

let syncHeaderRulesInFlight: Promise<void> = Promise.resolve();

export const syncDynamicHeaderRules = (
  contexts: readonly EffectiveTabContext[],
): Promise<void> => {
  syncHeaderRulesInFlight = syncHeaderRulesInFlight
    .catch(() => undefined)
    .then(async () => {
      const [
        profiles,
        rules,
        fingerprintEnabled,
        preferences,
        sharedSpoofing,
        browserFingerprintSource,
        globalFallbackRule,
        trustedSites,
        containerAssignments,
      ] = await Promise.all([
        loadLocations(),
        loadRules(),
        getFingerprintEnabled(),
        getPreferences(),
        getSharedSpoofing(),
        readFingerprintSource(),
        getGlobalFallbackRule(),
        loadTrustedSites(),
        loadContainerAssignments(),
      ]);
      const tabRules = buildHeaderRules({
        contexts,
        profiles,
        rules,
        fingerprintEnabled,
        domainFencingEnabled: preferences.featureFlags.domainFencing,
        ...(sharedSpoofing ? { sharedSpoofing } : {}),
        ...(browserFingerprintSource ? { browserFingerprintSource } : {}),
        ...(globalFallbackRule ? { globalFallbackRule } : {}),
        trustedSites,
        containerAssignments,
      });
      const domainRules = buildDomainFallbackRules({
        profiles,
        rules,
        fingerprintEnabled,
        ...(sharedSpoofing ? { sharedSpoofing } : {}),
        ...(browserFingerprintSource ? { browserFingerprintSource } : {}),
        ...(globalFallbackRule ? { globalFallbackRule } : {}),
      });
      const trustedSiteBypassRules = buildTrustedBypassRules(trustedSites);
      const cspRules = buildCspRemovalRules(rules);
      const nextRules = [
        ...tabRules,
        ...domainRules,
        ...trustedSiteBypassRules,
        ...cspRules,
      ];
      const existingRules = await chrome.declarativeNetRequest.getSessionRules();
      const removeRuleIds = existingRules
        .map((rule) => rule.id)
        .filter((id) => id >= TAB_RULE_ID_BASE);
      resetFenceDnrRules();

      await chrome.declarativeNetRequest.updateSessionRules({
        removeRuleIds,
        addRules: nextRules,
      });
    });
  return syncHeaderRulesInFlight;
};
