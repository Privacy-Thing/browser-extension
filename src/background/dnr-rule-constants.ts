import { BUILD_BROWSER_TARGET } from "@/shared/build-flags";
import type { DynamicHeaderRule, XRaySurfaceCategory } from "@/shared/types";

export const TAB_RULE_ID_BASE = 1_000_000;
export const DOMAIN_RULE_ID_BASE = 2_000_000;
export const CSP_RULE_ID_BASE = 3_000_000;
export const TRUSTED_RULE_ID_BASE = 4_000_000;
export const GLOBAL_FALLBACK_RULE_ID = 2_900_000;
export const MODIFY_HEADERS =
  "modifyHeaders" as chrome.declarativeNetRequest.RuleActionType;
export const ALLOW = "allow" as chrome.declarativeNetRequest.RuleActionType;
export const REMOVE_HEADER = "remove" as chrome.declarativeNetRequest.HeaderOperation;
export const RESOURCE_TYPES = [
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
export const CSP_RESOURCE_TYPES = [
  "main_frame",
  "sub_frame",
] as chrome.declarativeNetRequest.ResourceType[];
export const toTabRuleId = (tabId: number): number => TAB_RULE_ID_BASE + tabId;
export const buildTabHeaderCondition = (
  tabId: number,
): DynamicHeaderRule["condition"] => ({
  tabIds: [tabId],
  resourceTypes: RESOURCE_TYPES,
});
export const RULE_PRIORITY_BASE = 100;
export const MAX_HOST_PATTERN_LENGTH = 253;
export const RULE_WILDCARD_RANGE = MAX_HOST_PATTERN_LENGTH + 1;
export const RULE_SUBDOMAIN_SCALE = RULE_WILDCARD_RANGE;
export const DOMAIN_RULE_EXACT_SCALE = RULE_WILDCARD_RANGE * 2;
export const RULE_EXACT_SCALE = RULE_WILDCARD_RANGE * 4;
export const MAX_DOMAIN_RULE_PRIORITY =
  RULE_PRIORITY_BASE +
  MAX_HOST_PATTERN_LENGTH * RULE_EXACT_SCALE +
  DOMAIN_RULE_EXACT_SCALE +
  RULE_SUBDOMAIN_SCALE +
  MAX_HOST_PATTERN_LENGTH;
// Domain fallback < trusted-site allow < tab-wide modifyHeaders. Chrome only
// applies modifyHeaders when its priority is strictly above a matching allow,
// so tab rules must outrank Trusted Site bypasses or iframe hosts on the
// allowlist would keep the real Accept-Language / Client Hints.
export const TRUSTED_ALLOW_PRIORITY = MAX_DOMAIN_RULE_PRIORITY + 1;
export const TAB_RULE_PRIORITY = TRUSTED_ALLOW_PRIORITY + 1;
export const URL_REGEX_PREFIX = "^[a-z][a-z0-9+.-]*://(?:[^/?#]*@)?";
export const HEADER_URL_RE_PREFIX = "^(?:https?|wss?)://(?:[^/?#]*@)?";
export const URL_REGEX_SUFFIX = "(?::\\d+)?(?:[/?#]|$)";
export const ANY_HEADER_HOST_RE = "[^/?#:@]+";
export const CLIENT_HINTS_HEADERS = [
  "Sec-CH-UA",
  "Sec-CH-UA-Platform",
  "Sec-CH-UA-Mobile",
  "Sec-CH-UA-Full-Version-List",
] as const;
export const SURFACE_BY_HEADER: Record<string, XRaySurfaceCategory> = {
  "Accept-Language": "timeLocale",
  "User-Agent": "navigator",
  ...Object.fromEntries(
    CLIENT_HINTS_HEADERS.map((header) => [header, "clientHints" as const]),
  ),
};
