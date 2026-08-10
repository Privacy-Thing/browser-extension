import type { CachedSettings, MutableCachedSettings } from "@/background/runtime-state";
import type { EffectiveTabContext } from "@/shared/types";

export type SettingsCommandDeps = {
  ensureStorageMigration: () => Promise<void>;
  syncPreloadedState: () => Promise<void>;
  resyncActiveHeaderRules: () => Promise<void>;
  refreshFxInjectionMode: () => Promise<void>;
  getCachedValues: () => CachedSettings;
  setCachedValues: (values: MutableCachedSettings) => void;
  getActiveTabContexts: () => readonly EffectiveTabContext[];
  reloadTabs: (tabIds: readonly number[]) => Promise<void>;
};
