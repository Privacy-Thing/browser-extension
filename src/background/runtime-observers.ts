import { sameRuleShape } from "@/background/config-watch";
import { LOCATIONS_STORAGE_KEY } from "@/background/storage/locations";
import { RULES_STORAGE_KEY } from "@/background/storage/rules";
import { fireAndForget } from "@/shared/async";
import type { DomainRule } from "@/shared/types";

export type RuntimeObserverDeps = {
  removeTabSnapshots: (tabId: number) => void;
  removeTabContext: (tabId: number) => Promise<void>;
  refreshActionState: (tabId?: number) => Promise<void>;
  isSupportedWebUrl: (url: string | undefined) => url is string;
  handleConfigMutation: () => Promise<void>;
  setLastKnownRules: (rules: DomainRule[]) => void;
};

export const registerRuntimeObservers = (deps: RuntimeObserverDeps): void => {
  chrome.tabs.onRemoved.addListener((tabId) => {
    deps.removeTabSnapshots(tabId);
    fireAndForget(deps.removeTabContext(tabId));
  });

  chrome.tabs.onActivated.addListener((details) => {
    fireAndForget(deps.refreshActionState(details.tabId));
  });

  chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.url || changeInfo.status === "complete") {
      fireAndForget(deps.refreshActionState(tabId));
    }
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local") {
      return;
    }

    if (RULES_STORAGE_KEY in changes) {
      const ruleChange = changes[RULES_STORAGE_KEY];
      const previousRules = Array.isArray(ruleChange?.oldValue)
        ? (ruleChange.oldValue as DomainRule[])
        : [];
      const nextRules = Array.isArray(ruleChange?.newValue)
        ? (ruleChange.newValue as DomainRule[])
        : [];

      if (
        !(LOCATIONS_STORAGE_KEY in changes) &&
        sameRuleShape(previousRules, nextRules)
      ) {
        deps.setLastKnownRules(nextRules);
        return;
      }
    }

    if (!(LOCATIONS_STORAGE_KEY in changes) && !(RULES_STORAGE_KEY in changes)) {
      return;
    }

    fireAndForget(deps.handleConfigMutation());
  });
};
