import { describe, expect, it, vi } from "vitest";

import {
  registerLifecycle,
  type LifecycleDeps,
} from "@/background/lifecycle-listeners";

const createDeps = (): LifecycleDeps => ({
  ensureStorageMigration: vi.fn(async () => undefined),
  enableSessionStorage: vi.fn(async () => undefined),
  syncDynamicHeaderRules: vi.fn(async () => undefined),
  getActiveTabContexts: vi.fn(() => []),
  applyPrivacyDefaults: vi.fn(async () => undefined),
  refreshCachedConfig: vi.fn(async () => undefined),
  syncPreloadedState: vi.fn(async () => undefined),
  provisionContainers: vi.fn(async () => false),
  reconcileContainers: vi.fn(async () => undefined),
  refreshActionState: vi.fn(async () => undefined),
  refreshFxInjectionMode: vi.fn(async () => undefined),
  syncSidebarMenus: vi.fn(async () => undefined),
  registerSidebarHandler: vi.fn(),
  logInstalled: vi.fn(),
  getOnboardingCompleted: vi.fn(async () => true),
  openOnboardingPage: vi.fn(),
  syncSignificantUpdates: vi.fn(async () => undefined),
});

describe("background lifecycle notification synchronization", () => {
  it("includes current catalog entries only for extension updates", async () => {
    let onInstalled:
      ((details: chrome.runtime.InstalledDetails) => Promise<void>) | undefined;
    let onStartup: (() => Promise<void>) | undefined;
    vi.stubGlobal("chrome", {
      runtime: {
        getManifest: () => ({ version: "0.10.0" }),
        onInstalled: {
          addListener: vi.fn((listener) => {
            onInstalled = listener;
          }),
        },
        onStartup: {
          addListener: vi.fn((listener) => {
            onStartup = listener;
          }),
        },
      },
      permissions: {
        onAdded: { addListener: vi.fn() },
        onRemoved: { addListener: vi.fn() },
      },
    });
    const deps = createDeps();
    registerLifecycle(deps);

    await onInstalled?.({ reason: "install" });
    expect(deps.syncSignificantUpdates).toHaveBeenLastCalledWith("0.10.0", false);

    await onInstalled?.({ reason: "update", previousVersion: "0.9.0" });
    expect(deps.syncSignificantUpdates).toHaveBeenLastCalledWith("0.10.0", true);

    await onStartup?.();
    expect(deps.syncSignificantUpdates).toHaveBeenLastCalledWith("0.10.0", false);
  });
});
