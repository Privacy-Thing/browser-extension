import { fireAndForget } from "@/shared/async";
import { EXTENSION_STORAGE_KEYS } from "@/shared/extension-contract";
import type { PluginConfigurationScope, PluginHooks } from "@/shared/plugin-hooks";

const storageKeys: Record<PluginConfigurationScope, string> = {
  rules: EXTENSION_STORAGE_KEYS.rules,
  locations: EXTENSION_STORAGE_KEYS.locations,
  featureBindings: EXTENSION_STORAGE_KEYS.providerFeatures,
  preferences: EXTENSION_STORAGE_KEYS.preferences,
  containers: EXTENSION_STORAGE_KEYS.containerAssignments,
  trustedSites: EXTENSION_STORAGE_KEYS.trustedSites,
};

export const createPluginHooks = (): PluginHooks => ({
  onConfigurationChanged: (scopes, listener) => {
    const subscribed = [...new Set(scopes)];
    let active = true;
    const onChanged = (
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string,
    ): void => {
      if (!active || areaName !== "local") return;
      const changed = subscribed.filter((scope) => {
        const change = changes[storageKeys[scope]];
        return (
          change && JSON.stringify(change.oldValue) !== JSON.stringify(change.newValue)
        );
      });
      if (changed.length === 0) return;
      // Isolate synchronous and asynchronous plugin failures from PT event delivery.
      fireAndForget(
        Promise.resolve().then(() => {
          if (active) return listener(changed);
        }),
      );
    };
    chrome.storage.onChanged.addListener(onChanged);
    return () => {
      if (!active) return;
      active = false;
      chrome.storage.onChanged.removeListener(onChanged);
    };
  },
});
