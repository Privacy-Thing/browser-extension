import { fireAndForget } from "@/shared/async";
import { BUILD_BROWSER_TARGET } from "@/shared/build-flags";
import {
  onContainerCreated,
  onContainerRemoved,
} from "@/targets/firefox/containers-api";

export type LifecycleDeps = {
  ensureStorageMigration: () => Promise<void>;
  enableSessionStorage: () => Promise<void>;
  syncDynamicHeaderRules: (
    contexts: Array<{ tabId: number; hostname: string; cookieStoreId?: string }>,
  ) => Promise<void>;
  getActiveTabContexts: () => Array<{
    tabId: number;
    hostname: string;
    cookieStoreId?: string;
  }>;
  applyPrivacyDefaults: () => Promise<void>;
  refreshCachedConfig: () => Promise<void>;
  syncPreloadedState: () => Promise<void>;
  provisionContainers: () => Promise<boolean>;
  reconcileContainers: () => Promise<void>;
  refreshActionState: (tabId?: number) => Promise<void>;
  refreshFxInjectionMode: () => Promise<void>;
  syncSidebarMenus: () => Promise<void>;
  registerSidebarHandler: () => void;
  logInstalled: () => void;
  getOnboardingCompleted: () => Promise<boolean>;
  openOnboardingPage: () => void;
  syncSignificantUpdates: (version: string, includeCurrent: boolean) => Promise<void>;
};

export const registerLifecycle = (deps: LifecycleDeps): void => {
  deps.registerSidebarHandler();

  chrome.runtime.onInstalled.addListener(async (details) => {
    await deps.ensureStorageMigration();
    await deps.enableSessionStorage();
    await deps.provisionContainers();
    await deps.syncDynamicHeaderRules([]);
    await deps.applyPrivacyDefaults();
    await deps.refreshCachedConfig();
    await deps.syncPreloadedState();
    await deps.syncSignificantUpdates(
      chrome.runtime.getManifest().version,
      details.reason === "update",
    );
    await deps.refreshActionState();
    await deps.refreshFxInjectionMode();
    await deps.syncSidebarMenus();
    deps.logInstalled();

    if (details.reason === "install" && !(await deps.getOnboardingCompleted())) {
      deps.openOnboardingPage();
    }
  });

  chrome.runtime.onStartup.addListener(async () => {
    await deps.ensureStorageMigration();
    await deps.enableSessionStorage();
    await deps.provisionContainers();
    await deps.syncDynamicHeaderRules(deps.getActiveTabContexts());
    await deps.applyPrivacyDefaults();
    await deps.refreshCachedConfig();
    await deps.syncPreloadedState();
    await deps.syncSignificantUpdates(chrome.runtime.getManifest().version, false);
    await deps.refreshActionState();
    await deps.refreshFxInjectionMode();
    await deps.syncSidebarMenus();
  });

  chrome.permissions.onAdded?.addListener((permissions) => {
    if (
      BUILD_BROWSER_TARGET !== "firefox" ||
      !permissions.permissions?.includes("userScripts")
    ) {
      return;
    }

    fireAndForget(
      (async () => {
        await deps.ensureStorageMigration();
        await deps.refreshCachedConfig();
        await deps.syncPreloadedState();
        await deps.refreshFxInjectionMode();
      })(),
    );
  });

  chrome.permissions.onRemoved?.addListener((permissions) => {
    if (
      BUILD_BROWSER_TARGET !== "firefox" ||
      !permissions.permissions?.includes("userScripts")
    ) {
      return;
    }

    fireAndForget(deps.refreshFxInjectionMode());
  });

  // Containers created/removed outside the Privacy Thing panel (directly in Firefox or
  // by other extensions) must still gain/lose their own spoofing identity.
  if (BUILD_BROWSER_TARGET === "firefox") {
    const reconcile = (): void => {
      fireAndForget(deps.reconcileContainers());
    };
    onContainerCreated(reconcile);
    onContainerRemoved(reconcile);
  }
};
