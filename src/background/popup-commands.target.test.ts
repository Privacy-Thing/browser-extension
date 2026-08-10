import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PopupCommandDeps } from "@/background/popup-command-types";
import { createPopupHandlers } from "@/background/popup-commands";
import type {
  ContainerPresentation,
  GlobalFallbackRule,
  PopupNotification,
  RuntimeSnapshot,
  ToggleRuleResponse,
  TrustedSite,
} from "@/shared/types";

const baseContainer: ContainerPresentation = {
  cookieStoreId: "firefox-container-1",
  name: "Work",
  icon: "briefcase",
  iconUrl: "/icons/briefcase.svg",
  color: "orange",
  colorCode: "#f59e0b",
};

type MockLocation = { id: string; label: string };
type MockRule = {
  pattern: string;
  locationId?: string;
  enabled?: boolean;
  ruleSeedKey?: string;
  blockServiceWorkerRegistration?: boolean;
  relaxCspForWorkers?: boolean;
  fingerprintSurfaceOverrides?: {
    serviceWorker?: boolean;
    sharedWorker?: "native" | "spoof" | "strict";
  };
};
type MockContainerAssignment = {
  cookieStoreId: string;
  locationId?: string;
  enabled?: boolean;
};

const {
  getFingerprintEnabled,
  getSharedSpoofing,
  getWorkerMode,
  loadLocations,
  loadRules,
  loadControlState,
  getDebugMode,
  saveGlobalFallbackRule,
  saveRules,
  loadContainerAssignments,
  saveContainerAssignments,
  loadSiteSuggestions,
  loadTrustedSites,
  selectPopupSuggestions,
  getGlobalFallbackRule,
  getContainer,
  syncDynamicHeaderRules,
  cleanupHostnameState,
  loadPopupNotifications,
  selectPopupNotifications,
  syncSiteNotices,
} = vi.hoisted(() => ({
  getFingerprintEnabled: vi.fn<() => Promise<boolean>>(),
  getSharedSpoofing: vi.fn<() => Promise<undefined>>(),
  getWorkerMode: vi.fn<() => Promise<"strict">>(),
  loadLocations: vi.fn<() => Promise<MockLocation[]>>(),
  loadRules: vi.fn<() => Promise<MockRule[]>>(),
  loadControlState: vi.fn<() => Promise<{ panicMode: boolean }>>(),
  getDebugMode: vi.fn<() => Promise<boolean>>(),
  saveGlobalFallbackRule: vi.fn<(rule: GlobalFallbackRule) => Promise<void>>(),
  saveRules: vi.fn<(rules: MockRule[]) => Promise<void>>(),
  loadContainerAssignments: vi.fn<() => Promise<MockContainerAssignment[]>>(),
  saveContainerAssignments:
    vi.fn<(assignments: MockContainerAssignment[]) => Promise<void>>(),
  loadSiteSuggestions: vi.fn<() => Promise<unknown[]>>(),
  loadTrustedSites: vi.fn<() => Promise<TrustedSite[]>>(),
  selectPopupSuggestions: vi.fn(),
  getGlobalFallbackRule: vi.fn<() => Promise<GlobalFallbackRule | undefined>>(),
  getContainer: vi.fn<() => Promise<ContainerPresentation | null>>(),
  syncDynamicHeaderRules: vi.fn<() => Promise<void>>(),
  cleanupHostnameState: vi.fn<() => Promise<void>>(),
  loadPopupNotifications: vi.fn<() => Promise<PopupNotification[]>>(async () => []),
  selectPopupNotifications: vi.fn<
    (
      notifications: readonly PopupNotification[],
      hostname: string | null,
      cookieStoreId?: string,
    ) => PopupNotification[]
  >(() => []),
  syncSiteNotices: vi.fn<() => Promise<PopupNotification[]>>(async () => []),
}));

vi.mock("@/background/storage/popup-notifications", () => ({
  loadPopupNotifications,
  selectPopupNotifications,
  syncSiteNotices,
}));

vi.mock("@/background/dnr", () => ({
  syncDynamicHeaderRules,
}));

vi.mock("@/background/state-hygiene", () => ({
  cleanupHostnameState,
  getRegistrableHostname: (hostname: string) => hostname,
}));

vi.mock("@/background/storage/container-assignments", () => ({
  loadContainerAssignments,
  saveContainerAssignments,
}));

vi.mock("@/background/storage/control-state", () => ({
  loadControlState,
}));

vi.mock("@/background/storage/locations", () => ({
  loadLocations,
}));

vi.mock("@/background/storage/preferences", () => ({
  getFingerprintEnabled,
  getDebugMode,
  getGlobalFallbackRule,
  getSharedSpoofing,
  getWorkerMode,
  saveGlobalFallbackRule,
}));

vi.mock("@/background/storage/rules", () => ({
  loadRules,
  saveRules,
}));

vi.mock("@/background/storage/site-suggestions", () => ({
  loadSiteSuggestions,
  selectPopupSuggestions,
  updateSuggestionStatus: vi.fn(),
}));

vi.mock("@/background/storage/trusted-sites", () => ({
  loadTrustedSites,
}));

vi.mock("@/shared/build-flags", () => ({
  BUILD_BROWSER_TARGET: "chromium",
}));

vi.mock("@/shared/rule-seed", () => ({
  createRuleSeedKey: () => "seed",
  withRuleSeedKey: <T>(value: T) => value,
}));

vi.mock("@/shared/container-service", () => ({
  getContainer,
}));

describe("createPopupHandlers", () => {
  const activeTab = {
    id: 7,
    url: "https://google.com/",
    cookieStoreId: "firefox-container-1",
  } as chrome.tabs.Tab & { cookieStoreId: string };

  let locationsState: MockLocation[];
  let rulesState: MockRule[];
  let containerState: MockContainerAssignment[];
  let globalFallbackRuleState: GlobalFallbackRule | undefined;
  let fingerprintState: boolean;
  let trustedSitesState: TrustedSite[];

  beforeEach(() => {
    activeTab.url = "https://google.com/";
    locationsState = [{ id: "warsaw", label: "Warsaw" }];
    rulesState = [];
    containerState = [
      {
        cookieStoreId: "firefox-container-1",
        locationId: "warsaw",
        enabled: false,
      },
    ];
    globalFallbackRuleState = undefined;
    fingerprintState = false;
    trustedSitesState = [];

    vi.stubGlobal("chrome", {
      tabs: {
        reload: vi.fn(async () => undefined),
      },
      scripting: {
        executeScript: vi.fn(async () => undefined),
      },
    });

    loadLocations.mockImplementation(async () => locationsState);
    loadRules.mockImplementation(async () => rulesState);
    loadControlState.mockResolvedValue({ panicMode: false });
    getFingerprintEnabled.mockImplementation(async () => fingerprintState);
    getSharedSpoofing.mockResolvedValue(undefined);
    getWorkerMode.mockResolvedValue("strict");
    getDebugMode.mockResolvedValue(false);
    loadContainerAssignments.mockImplementation(async () => containerState);
    saveContainerAssignments.mockImplementation(async (assignments) => {
      containerState = assignments;
    });
    saveGlobalFallbackRule.mockImplementation(async (rule) => {
      globalFallbackRuleState = rule;
    });
    saveRules.mockImplementation(async (rules) => {
      rulesState = rules;
    });
    loadSiteSuggestions.mockResolvedValue([]);
    loadPopupNotifications.mockResolvedValue([]);
    loadTrustedSites.mockImplementation(async () => trustedSitesState);
    selectPopupSuggestions.mockReturnValue({ items: [], hasWarning: false });
    selectPopupNotifications.mockReturnValue([]);
    syncSiteNotices.mockResolvedValue([]);
    getGlobalFallbackRule.mockImplementation(async () => globalFallbackRuleState);
    getContainer.mockResolvedValue(baseContainer);
    syncDynamicHeaderRules.mockResolvedValue();
    cleanupHostnameState.mockResolvedValue();
  });

  const createHandlers = (overrides: Partial<PopupCommandDeps> = {}) =>
    createPopupHandlers({
      ensureStorageMigration: async () => undefined,
      getPopupTabById: async () => activeTab,
      isSupportedWebUrl: (url: string | undefined): url is string =>
        typeof url === "string" && url.startsWith("http"),
      getExactHostname: (url: string) => new URL(url).hostname,
      getSurfaceAccess: () => ({}),
      getSurfaceErrors: () => ({}),
      getRealmEvidence: () => ({}),
      getSurfaceCounts: () => ({}),
      getSurfaceMethodCounts: () => ({}),
      resolveFallbackId: (profiles, globalFallbackRule) => {
        if (!globalFallbackRule?.enabled || !globalFallbackRule.locationId) {
          return null;
        }

        return profiles.some((profile) => profile.id === globalFallbackRule.locationId)
          ? globalFallbackRule.locationId
          : null;
      },
      canRequestUserScripts: () => false,
      hasUserScriptsPermission: async () => false,
      setLastKnownProfiles: () => undefined,
      setLastKnownRules: () => undefined,
      setLastKnownControlState: () => undefined,
      setLastKnownDebugMode: () => undefined,
      setKnownContainers: () => undefined,
      setKnownFallback: () => undefined,
      getLastKnownDebugMode: () => false,
      refreshActionState: async () => undefined,
      grantUserScripts: async () => false,
      refreshCachedConfig: async () => undefined,
      syncPreloadedState: async () => undefined,
      refreshFxInjectionMode: async () => undefined,
      removeHostnameContexts: () => undefined,
      getActiveTabContexts: () => [],
      resolveCachedSnapshot: async () => null,
      updateSnapshotCache: () => undefined,
      injectFxWindowSeed: async () => undefined,
      seedWindowSnapshot: () => undefined,
      mainWorld: "MAIN",
      runtimeWindowSeedPrefix: "gw",
      logExtensionEvent: () => undefined,
      ...overrides,
    });

  const expectToggleSuccess = (
    response: ToggleRuleResponse,
  ): Extract<ToggleRuleResponse, { ok: true }> => {
    expect(response.ok).toBe(true);
    if (!response.ok) {
      throw new Error(response.error);
    }

    return response;
  };

  it("keeps disabled container assignments toggleable in popup state", async () => {
    const handlers = createHandlers();

    const response = await handlers.getPopupState(activeTab.id);

    expect(response.ok).toBe(true);
    expect(response.state.currentRule.enabled).toBe(false);
    expect(response.state.currentRule.canToggle).toBe(true);
    expect(response.state.currentRule.canEdit).toBe(true);
    expect(response.state.currentTab.locationLabel).toBe("Warsaw");
    expect(response.state.currentTab.locationId).toBe("warsaw");
    expect(response.state.currentTab.winningSource).toBe("none");
  });

  it("presents every surface as native while global protections are off", async () => {
    containerState = [];
    rulesState = [
      {
        pattern: "google.com",
        locationId: "warsaw",
        enabled: true,
      },
    ];

    const response = await createHandlers().getPopupState(activeTab.id);

    expect(response.ok).toBe(true);
    expect(response.state.currentRule.enabled).toBe(true);
    expect(response.state.effectiveSummary.resolutionContext.state).toBe("disabled");
    expect(response.state.effectiveSummary.surfaceSummary.counts.pending).toBe(0);
    expect(
      response.state.effectiveSummary.surfaceSummary.counts["native-by-policy"],
    ).toBe(13);
    expect(
      response.state.effectiveSummary.surfaceSummary.groups.every(
        (group) => group.state === "native-by-policy",
      ),
    ).toBe(true);
  });

  it("keeps extension notifications available on unsupported pages", async () => {
    const extensionNotification: PopupNotification = {
      id: "release-note",
      kind: "significant-update",
      scope: "extension",
      dedupeKey: "extension:update:release-note",
      severity: "info",
      channel: "release",
      introducedInVersion: "0.9.0",
      createdAt: "2026-07-20T12:00:00.000Z",
      lastDetectedAt: "2026-07-20T12:00:00.000Z",
      generation: 1,
      readAt: null,
      resolvedAt: null,
      autoPresentedAt: null,
      pulseShownAt: null,
    };
    activeTab.url = "chrome://extensions";
    loadPopupNotifications.mockResolvedValue([extensionNotification]);
    selectPopupNotifications.mockImplementation((notifications, hostname) =>
      notifications.filter(
        (notification) =>
          notification.scope === "extension" || notification.hostname === hostname,
      ),
    );

    const response = await createHandlers().getPopupState(activeTab.id);

    expect(response.state.currentTab.supported).toBe(false);
    expect(response.state.notifications).toEqual([extensionNotification]);
    expect(response.state.hasUnreadNotification).toBe(true);
  });

  it("synchronizes compatibility policies only after the page uses worker APIs", async () => {
    fingerprintState = true;
    containerState = [
      {
        cookieStoreId: "firefox-container-1",
        locationId: "warsaw",
        enabled: true,
      },
    ];
    const snapshot: RuntimeSnapshot = {
      geo: { latitude: 52.23, longitude: 21.01, accuracy: 10, noiseRadius: 100 },
      locale: {
        language: "pl-PL",
        languages: ["pl-PL", "pl"],
        timeZone: "Europe/Warsaw",
        acceptLanguage: "pl-PL,pl;q=0.9",
      },
      date: { baseEpochMs: 0, offsetMs: 0, timeZone: "Europe/Warsaw" },
      debugMode: false,
      watchPositionDelay: [100, 200],
      geolocationEnabled: true,
      timeLocaleEnabled: true,
      fingerprint: {},
      sharedWorkerHandlingMode: "strict",
      blockServiceWorkerRegistration: true,
    };
    const handlers = createHandlers({
      getSurfaceAccess: () => ({ serviceWorker: true, sharedWorker: true }),
      resolveCachedSnapshot: async () => snapshot,
    });

    await handlers.getPopupState(activeTab.id);

    expect(syncSiteNotices).toHaveBeenCalledWith({
      hostname: "google.com",
      cookieStoreId: "firefox-container-1",
      applicableKinds: ["service-worker-block", "shared-worker-strict"],
      activeKinds: ["service-worker-block", "shared-worker-strict"],
    });
  });

  it("keeps an acknowledged active policy in the effective attention summary", async () => {
    fingerprintState = true;
    containerState = [
      {
        cookieStoreId: "firefox-container-1",
        locationId: "warsaw",
        enabled: true,
      },
    ];
    const acknowledged: PopupNotification = {
      id: "site:firefox-container-1:google.com:service-worker-block",
      kind: "service-worker-block",
      scope: "site",
      dedupeKey: "site:firefox-container-1:google.com:service-worker-block",
      severity: "needs-action",
      hostname: "google.com",
      cookieStoreId: "firefox-container-1",
      createdAt: "2026-07-14T10:00:00.000Z",
      lastDetectedAt: "2026-07-14T10:00:00.000Z",
      generation: 1,
      readAt: "2026-07-14T10:01:00.000Z",
      resolvedAt: null,
      autoPresentedAt: null,
      pulseShownAt: null,
      actionTarget: "policy:service-worker-block",
    };
    syncSiteNotices.mockResolvedValue([acknowledged]);
    selectPopupNotifications.mockReturnValue([acknowledged]);
    const handlers = createHandlers({
      getSurfaceAccess: () => ({ serviceWorker: true }),
      resolveCachedSnapshot: async () => ({
        geo: { latitude: 52.23, longitude: 21.01, accuracy: 10, noiseRadius: 100 },
        locale: {
          language: "pl-PL",
          languages: ["pl-PL", "pl"],
          timeZone: "Europe/Warsaw",
          acceptLanguage: "pl-PL,pl;q=0.9",
        },
        date: { baseEpochMs: 0, offsetMs: 0, timeZone: "Europe/Warsaw" },
        debugMode: false,
        watchPositionDelay: [100, 200],
        geolocationEnabled: true,
        timeLocaleEnabled: true,
        fingerprint: {},
        sharedWorkerHandlingMode: "spoof",
        blockServiceWorkerRegistration: true,
      }),
    });

    const response = await handlers.getPopupState(activeTab.id);

    expect(response.state.hasUnreadNotification).toBe(false);
    expect(response.state.effectiveSummary.surfaceSummary.attentionCount).toBe(1);
    expect(
      response.state.effectiveSummary.surfaceSummary.highestPriorityAttention,
    ).toMatchObject({ kind: "service-worker-block" });
  });

  it("does not warn a page that never uses Service Workers or Shared Workers", async () => {
    fingerprintState = true;
    containerState = [
      {
        cookieStoreId: "firefox-container-1",
        locationId: "warsaw",
        enabled: true,
      },
    ];
    const snapshot: RuntimeSnapshot = {
      geo: { latitude: 52.23, longitude: 21.01, accuracy: 10, noiseRadius: 100 },
      locale: {
        language: "pl-PL",
        languages: ["pl-PL", "pl"],
        timeZone: "Europe/Warsaw",
        acceptLanguage: "pl-PL,pl;q=0.9",
      },
      date: { baseEpochMs: 0, offsetMs: 0, timeZone: "Europe/Warsaw" },
      debugMode: false,
      watchPositionDelay: [100, 200],
      geolocationEnabled: true,
      timeLocaleEnabled: true,
      fingerprint: {},
      sharedWorkerHandlingMode: "strict",
      blockServiceWorkerRegistration: true,
    };
    const handlers = createHandlers({
      getSurfaceAccess: () => ({}),
      resolveCachedSnapshot: async () => snapshot,
    });

    const response = await handlers.getPopupState(activeTab.id);

    expect(response.state.effectiveSummary.surfaceSummary.attentionCount).toBe(0);
    expect(syncSiteNotices).toHaveBeenCalledWith({
      hostname: "google.com",
      cookieStoreId: "firefox-container-1",
      applicableKinds: ["service-worker-block", "shared-worker-strict"],
      activeKinds: [],
    });
  });

  it("does not request Firefox first-inline permission for a Trusted Site", async () => {
    trustedSitesState = [{ pattern: "google.com", enabled: true }];
    const handlers = createHandlers({
      canRequestUserScripts: () => true,
      hasUserScriptsPermission: async () => false,
    });

    const response = await handlers.getPopupState(activeTab.id);

    expect(response.state.currentTab.winningSource).toBe("trusted-site");
    expect(response.state.currentTab.firefoxFirstInlinePermissionRequired).toBe(false);
  });

  it("can re-enable a disabled container assignment from the popup", async () => {
    const handlers = createHandlers();

    const response = expectToggleSuccess(
      await handlers.toggleCurrentRule(true, activeTab.id),
    );

    expect(containerState[0]?.enabled).toBe(true);
    expect(response.state.currentRule.enabled).toBe(true);
    expect(response.state.currentRule.canToggle).toBe(true);
    expect(response.state.currentTab.locationLabel).toBe("Warsaw");
    expect(response.state.currentTab.winningSource).toBe("container");
  });

  it("keeps the default rule as the active popup source when a container assignment is disabled", async () => {
    locationsState = [
      { id: "warsaw", label: "Warsaw" },
      { id: "paris", label: "Paris" },
    ];
    containerState = [
      {
        cookieStoreId: "firefox-container-1",
        locationId: "warsaw",
        enabled: false,
      },
    ];
    globalFallbackRuleState = {
      enabled: true,
      locationId: "paris",
      ruleSeedKey: "fallback-seed",
    };

    const handlers = createHandlers();

    const response = await handlers.getPopupState(activeTab.id);

    expect(response.ok).toBe(true);
    expect(response.state.currentRule.enabled).toBe(true);
    expect(response.state.currentRule.locationId).toBe("paris");
    expect(response.state.currentRule.canToggle).toBe(true);
    expect(response.state.currentTab.winningSource).toBe("fallback");
    expect(response.state.currentTab.locationLabel).toBe("Paris");
    expect(response.state.currentTab.locationId).toBe("paris");
  });

  it("disables fallback toggling for an unconfigured default rule shown inside a container", async () => {
    containerState = [];
    globalFallbackRuleState = {
      enabled: true,
      ruleSeedKey: "fallback-seed",
    };

    const handlers = createHandlers();
    const response = await handlers.getPopupState(activeTab.id);

    expect(response.ok).toBe(true);
    expect(response.state.currentRule.enabled).toBe(true);
    expect(response.state.currentRule.locationId).toBeNull();
    expect(response.state.currentRule.canToggle).toBe(false);
    expect(response.state.currentTab.winningSource).toBe("none");
    expect(response.state.currentTab.fallbackState).toBe("unconfigured");
    expect(response.state.effectiveSummary.resolutionContext.source).toBe(
      "default-rule",
    );
  });

  it("disables fallback toggling for preview-only default rule protections shown inside a container", async () => {
    containerState = [];
    globalFallbackRuleState = {
      enabled: true,
      ruleSeedKey: "fallback-seed",
      fingerprintSurfaceOverrides: {
        timeLocale: false,
      },
    };

    const handlers = createHandlers();
    const response = await handlers.getPopupState(activeTab.id);

    expect(response.ok).toBe(true);
    expect(response.state.currentRule.enabled).toBe(true);
    expect(response.state.currentRule.locationId).toBeNull();
    expect(response.state.currentRule.canToggle).toBe(false);
    expect(response.state.currentTab.winningSource).toBe("none");
    expect(response.state.currentTab.fallbackState).toBe("protections");
  });

  it("treats fingerprint-only default-rule runtime as an active fallback source", async () => {
    containerState = [];
    globalFallbackRuleState = {
      enabled: true,
      ruleSeedKey: "fallback-seed",
    };
    fingerprintState = true;
    getContainer.mockResolvedValue(null);

    const handlers = createHandlers();
    const response = await handlers.getPopupState(activeTab.id);

    expect(response.ok).toBe(true);
    expect(response.state.currentRule.enabled).toBe(true);
    expect(response.state.currentRule.locationId).toBeNull();
    expect(response.state.currentRule.canToggle).toBe(true);
    expect(response.state.currentTab.winningSource).toBe("fallback");
    expect(response.state.currentTab.fallbackState).toBe("protections");
  });

  it("accepts a fallback worker-CSP suggestion by creating an inheriting exact rule", async () => {
    locationsState = [
      { id: "warsaw", label: "Warsaw" },
      { id: "paris", label: "Paris" },
    ];
    containerState = [];
    globalFallbackRuleState = {
      enabled: true,
      locationId: "paris",
      ruleSeedKey: "fallback-seed",
    };

    const handlers = createHandlers();
    const response = await handlers.applyPopupSuggestion(
      "worker-csp-relaxation",
      activeTab.id,
    );

    expect(response.ok).toBe(true);
    if (!response.ok) {
      throw new Error(response.error);
    }

    expect(rulesState[0]).toEqual({
      pattern: "google.com",
      enabled: true,
      relaxCspForWorkers: true,
    });
    expect(rulesState[0]?.locationId).toBeUndefined();
    expect(response.state.currentRule.pattern).toBe("google.com");
    expect(response.state.currentRule.locationId).toBeNull();
    expect(response.state.currentRule.relaxCspForWorkers).toBe(true);
    expect(response.state.currentTab.winningSource).toBe("rule");
    expect(response.state.currentTab.locationLabel).toBe("Paris");
    expect(response.state.currentTab.locationId).toBe("paris");
  });

  it("creates an exact SharedWorker spoof fallback without relaxing CSP", async () => {
    activeTab.url = "https://shop.google.com/";
    containerState = [];
    rulesState = [
      {
        pattern: "*.google.com",
        locationId: "warsaw",
        enabled: true,
      },
    ];

    const response = await createHandlers().applyPopupSuggestion(
      "shared-worker-injection-relaxation",
      activeTab.id,
      undefined,
      "spoof",
    );

    expect(response.ok).toBe(true);
    expect(rulesState).toEqual([
      {
        pattern: "shop.google.com",
        locationId: "warsaw",
        enabled: true,
        fingerprintSurfaceOverrides: { sharedWorker: "spoof" },
      },
      {
        pattern: "*.google.com",
        locationId: "warsaw",
        enabled: true,
      },
    ]);
  });

  it("allows Service Workers by updating the active exact domain rule", async () => {
    containerState = [];
    rulesState = [
      {
        pattern: "google.com",
        locationId: "warsaw",
        enabled: true,
        ruleSeedKey: "site-seed",
        fingerprintSurfaceOverrides: {
          serviceWorker: true,
          sharedWorker: "strict",
        },
      },
    ];

    const response = await createHandlers().applyPopupPolicyAction(
      "service-worker-block",
      activeTab.id,
    );

    expect(response.ok).toBe(true);
    expect(rulesState).toEqual([
      {
        pattern: "google.com",
        locationId: "warsaw",
        enabled: true,
        ruleSeedKey: "site-seed",
        fingerprintSurfaceOverrides: {
          serviceWorker: false,
          sharedWorker: "strict",
        },
      },
    ]);
  });

  it("creates a site-only SharedWorker override instead of changing global settings", async () => {
    activeTab.url = "https://shop.google.com/";
    containerState = [];
    rulesState = [
      {
        pattern: "*.google.com",
        locationId: "warsaw",
        enabled: true,
        fingerprintSurfaceOverrides: { sharedWorker: "strict" },
      },
    ];

    const response = await createHandlers().applyPopupPolicyAction(
      "shared-worker-strict",
      activeTab.id,
      undefined,
      "spoof",
    );

    expect(response.ok).toBe(true);
    expect(rulesState[0]).toEqual({
      pattern: "shop.google.com",
      locationId: "warsaw",
      enabled: true,
      fingerprintSurfaceOverrides: { sharedWorker: "spoof" },
    });
    expect(rulesState[1]?.pattern).toBe("*.google.com");
  });

  it("does not leak a disabled container location into a fallback suggestion-created rule", async () => {
    locationsState = [
      { id: "warsaw", label: "Warsaw" },
      { id: "paris", label: "Paris" },
    ];
    containerState = [
      {
        cookieStoreId: "firefox-container-1",
        locationId: "warsaw",
        enabled: false,
      },
    ];
    globalFallbackRuleState = {
      enabled: true,
      locationId: "paris",
      ruleSeedKey: "fallback-seed",
    };

    const handlers = createHandlers();
    const response = await handlers.applyPopupSuggestion(
      "worker-csp-relaxation",
      activeTab.id,
    );

    expect(response.ok).toBe(true);
    if (!response.ok) {
      throw new Error(response.error);
    }

    expect(rulesState[0]?.locationId).toBeUndefined();
    expect(response.state.currentRule.pattern).toBe("google.com");
    expect(response.state.currentTab.locationLabel).toBe("Paris");
    expect(response.state.currentTab.locationId).toBe("paris");
  });

  it("does not clear site state when applying a CSP-relaxation suggestion", async () => {
    locationsState = [
      { id: "warsaw", label: "Warsaw" },
      { id: "paris", label: "Paris" },
    ];
    containerState = [];
    globalFallbackRuleState = {
      enabled: true,
      locationId: "paris",
      ruleSeedKey: "fallback-seed",
    };

    const handlers = createHandlers();
    const response = await handlers.applyPopupSuggestion(
      "worker-csp-relaxation",
      activeTab.id,
    );

    expect(response.ok).toBe(true);
    expect(cleanupHostnameState).not.toHaveBeenCalled();
  });

  it("does not clear site state when only CSP/SW flags change on a rule", async () => {
    rulesState = [
      {
        pattern: "google.com",
        locationId: "warsaw",
        enabled: true,
        blockServiceWorkerRegistration: false,
        relaxCspForWorkers: false,
      },
    ];

    const handlers = createHandlers();
    const response = await handlers.updateCurrentRule({
      locationId: "warsaw",
      patternMode: "exact",
      replaceExisting: false,
      blockServiceWorkers: true,
      relaxCspForWorkers: true,
      ...(activeTab.id !== undefined ? { tabId: activeTab.id } : {}),
    });

    expect(response.ok).toBe(true);
    expect(cleanupHostnameState).not.toHaveBeenCalled();
    expect(rulesState[0]).toMatchObject({
      pattern: "google.com",
      locationId: "warsaw",
      enabled: true,
      relaxCspForWorkers: true,
      fingerprintSurfaceOverrides: { serviceWorker: true },
    });
  });

  it("persists a popup Dedicated and Shared Worker mode override", async () => {
    rulesState = [
      {
        pattern: "google.com",
        locationId: "warsaw",
        enabled: true,
      },
    ];

    const response = await createHandlers().updateCurrentRule({
      locationId: "warsaw",
      patternMode: "exact",
      replaceExisting: false,
      blockServiceWorkers: false,
      relaxCspForWorkers: false,
      ...(activeTab.id !== undefined ? { tabId: activeTab.id } : {}),
      workerHandlingOverride: "strict",
    });

    expect(response.ok).toBe(true);
    if (!response.ok) {
      throw new Error(response.error);
    }
    expect(rulesState[0]?.fingerprintSurfaceOverrides).toEqual({
      sharedWorker: "strict",
    });
    expect(response.state.currentRule.workerHandlingOverride).toBe("strict");
  });

  it("creates an inheriting exact rule without requiring a saved location", async () => {
    locationsState = [{ id: "paris", label: "Paris" }];
    globalFallbackRuleState = {
      enabled: true,
      locationId: "paris",
      ruleSeedKey: "fallback-seed",
    };

    const handlers = createHandlers();
    const response = await handlers.updateCurrentRule({
      locationId: undefined,
      patternMode: "exact",
      replaceExisting: false,
      blockServiceWorkers: false,
      relaxCspForWorkers: false,
      ...(activeTab.id !== undefined ? { tabId: activeTab.id } : {}),
    });

    expect(response.ok).toBe(true);
    expect(rulesState[0]).toMatchObject({
      pattern: "google.com",
      enabled: true,
    });
    expect(rulesState[0]).not.toHaveProperty("locationId");
  });

  it("keeps a wildcard rule when adding a separate exact override", async () => {
    rulesState = [
      {
        pattern: "*.com",
        locationId: "warsaw",
        enabled: true,
        ruleSeedKey: "wildcard-seed",
      },
    ];

    const handlers = createHandlers();
    const response = await handlers.updateCurrentRule({
      locationId: "warsaw",
      patternMode: "exact",
      replaceExisting: false,
      blockServiceWorkers: false,
      relaxCspForWorkers: false,
      ...(activeTab.id !== undefined ? { tabId: activeTab.id } : {}),
      createExactOverride: true,
    });

    expect(response.ok).toBe(true);
    expect(rulesState.map((rule) => rule.pattern)).toEqual(["google.com", "*.com"]);
    expect(rulesState[0]?.ruleSeedKey).not.toBe("wildcard-seed");
  });

  it("toggles the default rule off inside a container without mutating the disabled container assignment", async () => {
    locationsState = [
      { id: "warsaw", label: "Warsaw" },
      { id: "paris", label: "Paris" },
    ];
    containerState = [
      {
        cookieStoreId: "firefox-container-1",
        locationId: "warsaw",
        enabled: false,
      },
    ];
    globalFallbackRuleState = {
      enabled: true,
      locationId: "paris",
      ruleSeedKey: "fallback-seed",
    };

    const handlers = createHandlers();

    const response = expectToggleSuccess(
      await handlers.toggleCurrentRule(false, activeTab.id),
    );

    expect(globalFallbackRuleState?.enabled).toBe(false);
    expect(containerState[0]?.enabled).toBe(false);
    expect(response.state.currentRule.enabled).toBe(false);
    expect(response.state.currentRule.locationId).toBe("warsaw");
    expect(response.state.currentRule.canToggle).toBe(true);
    expect(response.state.currentTab.winningSource).toBe("none");
    expect(response.state.currentTab.locationLabel).toBe("Warsaw");
    expect(response.state.currentTab.locationId).toBe("warsaw");
  });

  it("ignores a closed-tab reload while finalizing a popup fallback mutation", async () => {
    locationsState = [
      { id: "warsaw", label: "Warsaw" },
      { id: "paris", label: "Paris" },
    ];
    containerState = [];
    globalFallbackRuleState = {
      enabled: true,
      locationId: "paris",
      ruleSeedKey: "fallback-seed",
    };

    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.stubGlobal("chrome", {
      tabs: {
        reload: vi.fn(async () => {
          throw new Error("No tab with id: 7");
        }),
      },
      scripting: {
        executeScript: vi.fn(async () => undefined),
      },
    });

    const handlers = createHandlers();
    const response = expectToggleSuccess(
      await handlers.toggleCurrentRule(false, activeTab.id),
    );

    await Promise.resolve();
    await Promise.resolve();

    expect(response.state.currentRule.enabled).toBe(false);
    expect(globalFallbackRuleState?.enabled).toBe(false);
    expect(consoleError).not.toHaveBeenCalled();
  });
});
