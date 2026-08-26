import { serializeHintBrands } from "@/shared/browser-fingerprint";
import { BUILD_BROWSER_TARGET } from "@/shared/build-flags";
import { getSiteKey } from "@/shared/domain-fencing";
import type { DynamicHeaderRule, RuntimeSnapshot } from "@/shared/types";

/**
 * Session DNR rules that override `Sec-CH-UA-Full-Version-List` for one
 * registrable domain. They sit above the global fallback rule (priority 1)
 * and below saved domain rules / per-tab rules, so an explicit site rule
 * still wins.
 *
 * Residual window: the first request on a domain whose Client Hints opt-in
 * is already cached can leave before this session rule is installed.
 */
export const FENCE_DNR_ID_BASE = 5_000_000;
export const FENCE_DNR_LRU = 100;
export const FENCE_DNR_PRIORITY = 2;

const MODIFY_HEADERS = "modifyHeaders" as chrome.declarativeNetRequest.RuleActionType;
const SET_HEADER = "set" as chrome.declarativeNetRequest.HeaderOperation;
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
] as chrome.declarativeNetRequest.ResourceType[];

type FenceDnrSlot = {
  siteKey: string;
  headerValue: string;
  ruleId: number;
};

const lruOrder: string[] = [];
const slots = new Map<string, FenceDnrSlot>();
let nextSlot = 0;
let syncInFlight: Promise<void> = Promise.resolve();

export const resetFenceDnrRules = (): void => {
  lruOrder.length = 0;
  slots.clear();
  nextSlot = 0;
};

export const versionListHeader = (snapshot: RuntimeSnapshot): string | null => {
  if (snapshot.fingerprint?.spoofingToggles?.clientHints === false) {
    return null;
  }
  return (
    serializeHintBrands(snapshot.fingerprint?.clientHints?.fullVersionList) || null
  );
};

export const buildFenceDnrRule = (
  ruleId: number,
  siteKey: string,
  headerValue: string,
): DynamicHeaderRule => ({
  id: ruleId,
  priority: FENCE_DNR_PRIORITY,
  action: {
    type: MODIFY_HEADERS,
    requestHeaders: [
      {
        header: "Sec-CH-UA-Full-Version-List",
        operation: SET_HEADER,
        value: headerValue,
      },
    ],
  },
  condition: {
    requestDomains: [siteKey],
    resourceTypes: RESOURCE_TYPES,
  },
});

const touchLru = (siteKey: string): void => {
  const index = lruOrder.indexOf(siteKey);
  if (index >= 0) {
    lruOrder.splice(index, 1);
  }
  lruOrder.push(siteKey);
};

const allocateRuleId = (): { ruleId: number; removeRuleIds: number[] } => {
  if (lruOrder.length < FENCE_DNR_LRU) {
    const ruleId = FENCE_DNR_ID_BASE + nextSlot;
    nextSlot += 1;
    return { ruleId, removeRuleIds: [] };
  }

  const evictKey = lruOrder.shift();
  const evicted = evictKey ? slots.get(evictKey) : undefined;
  if (evictKey) {
    slots.delete(evictKey);
  }
  if (evicted) {
    return { ruleId: evicted.ruleId, removeRuleIds: [evicted.ruleId] };
  }
  const ruleId = FENCE_DNR_ID_BASE + nextSlot;
  nextSlot += 1;
  return { ruleId, removeRuleIds: [] };
};

/**
 * Installs or refreshes the per-site `Sec-CH-UA-Full-Version-List` session
 * rule for a fenced fallback/container identity. No-op on Firefox, when the
 * identity is an explicit domain rule, or when the snapshot has no version list.
 */
export const syncFenceDnrRule = (
  hostname: string,
  snapshot: RuntimeSnapshot | null,
  fencesIdentity: boolean,
): Promise<void> => {
  if (BUILD_BROWSER_TARGET !== "chromium" || !fencesIdentity || !snapshot) {
    return Promise.resolve();
  }

  const headerValue = versionListHeader(snapshot);
  const siteKey = getSiteKey(hostname);
  if (!headerValue || siteKey === "") {
    return Promise.resolve();
  }

  syncInFlight = syncInFlight
    .catch(() => undefined)
    .then(async () => {
      const existing = slots.get(siteKey);
      if (existing) {
        touchLru(siteKey);
        if (existing.headerValue === headerValue) {
          return;
        }
        existing.headerValue = headerValue;
        await chrome.declarativeNetRequest.updateSessionRules({
          removeRuleIds: [existing.ruleId],
          addRules: [buildFenceDnrRule(existing.ruleId, siteKey, headerValue)],
        });
        return;
      }

      const { ruleId, removeRuleIds } = allocateRuleId();
      slots.set(siteKey, { siteKey, headerValue, ruleId });
      lruOrder.push(siteKey);
      await chrome.declarativeNetRequest.updateSessionRules({
        removeRuleIds,
        addRules: [buildFenceDnrRule(ruleId, siteKey, headerValue)],
      });
    });
  return syncInFlight;
};
