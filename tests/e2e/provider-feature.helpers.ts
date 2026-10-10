import type { BrowserContext, Page, Worker } from "@playwright/test";

import { EXAMPLE_LOCATIONS } from "../../src/background/storage/locations";
import {
  CONTROL_D_COMMANDS,
  CONTROL_D_PROVIDER_ID,
} from "../../src/experimental/control-d/contracts";
import type { ControlDConfig } from "../../src/experimental/control-d/contracts";
import {
  RECOGNITION_STORE_KEY,
  type RecognitionState,
} from "../../src/experimental/control-d/recognition-setup";
import { isControlDResourceCode } from "../../src/experimental/control-d/resource-names";
import { CONTROL_D_STORE_KEYS } from "../../src/experimental/control-d/storage";
import { EXTENSION_STORAGE_KEYS } from "../../src/shared/extension-contract";
import type { ProviderFeature } from "../../src/shared/provider-feature";
import type { ExportedSettings } from "../../src/shared/types";

import {
  exportSettings,
  getPopupState,
  getProbeHostUrl,
  importSettings,
  openPopupWithDefaults,
  openSettingsTab,
  readSettings,
} from "./extension-test.helpers";
import { expect } from "./fixtures";

const [CONTROL_D_CONFIG_KEY, LEGACY_API_KEY] = CONTROL_D_STORE_KEYS;
/** Persistent catalogue adapter. Not part of the settings export. */
const FEATURE_CATALOGUE_KEY = "pt.experimental.control-d.v2.feature-catalogue";
/**
 * Fake credential. It is written only as the legacy storage value that
 * `loadControlDApiKey` migrates into the private store, then removed.
 */
const FIXTURE_API_KEY = "e2e-control-d-fixture";
const LOOKUP_CODE = "ABCDE-FGHJK";
const RESOLVER_ID = "e2eresolver";
const VIDEO_FEATURE_ID = "svc-video";
const SOCIAL_FEATURE_ID = "svc-social";
const RECOGNITION_TIMEOUT_MS = 15_000;

if (!isControlDResourceCode(LOOKUP_CODE)) {
  throw new Error("Fixture lookup code is not a Control D resource code.");
}

export const VIDEO_HOST = "video.example.com";
export const CLIPS_HOST = "clips.example.com";
export const MEDIA_HOST = "media.example.com";
export const LOOPBACK_HOST = "127.0.0.1";
export const LOCAL_HOST = "localhost";
export const VIDEO_FEATURE = VIDEO_FEATURE_ID;
export const SOCIAL_FEATURE = SOCIAL_FEATURE_ID;
export const WARSAW_LOCATION_ID = "spf-warsaw";
export const PARIS_LOCATION_ID = "spf-paris";

export type SourceRule = {
  pattern: string;
  locationId: string;
  enabled: boolean;
  ruleSeedKey: string;
  authKey: string;
};

export const VIDEO_SOURCE: SourceRule = {
  pattern: VIDEO_HOST,
  locationId: WARSAW_LOCATION_ID,
  enabled: true,
  ruleSeedKey: "abc123",
  authKey: "abcd1234",
};

const videoFeature: ProviderFeature = {
  providerId: CONTROL_D_PROVIDER_ID,
  featureId: VIDEO_FEATURE_ID,
  type: "service",
  name: "Video relay",
};

const socialFeature: ProviderFeature = {
  providerId: CONTROL_D_PROVIDER_ID,
  featureId: SOCIAL_FEATURE_ID,
  type: "service",
  name: "Social relay",
};

const connectedConfig = {
  version: 2,
  enabled: true,
  connected: true,
  autoSyncEnabled: false,
  status: "ready",
  resourceIdentity: { code: LOOKUP_CODE },
  profileId: "e2e-profile",
  endpointId: "e2e-endpoint",
  resolverDoh: `https://dns.controld.com/${RESOLVER_ID}`,
  dnsVerification: {
    endpointId: "e2e-endpoint",
    verifiedAt: "2026-10-09T10:00:00.000Z",
  },
  managedFolders: {},
  managedServices: {},
  locationMappings: {
    "spf-warsaw": {
      locationId: "spf-warsaw",
      proxyPk: "WAW",
      status: "exact",
      confirmed: true,
    },
    "spf-paris": {
      locationId: "spf-paris",
      proxyPk: "PAR",
      status: "exact",
      confirmed: true,
    },
  },
  lastSyncedHash: null,
  lastAttemptAt: null,
  lastSuccessAt: null,
  lastError: null,
} satisfies ControlDConfig;

/**
 * Persisted form `saveRecognitionState` writes and `loadRecognitionState` reads.
 * Automatic recognition queries only when this lookup is ready.
 */
const readyRecognition = {
  version: 2 as const,
  phase: "ready",
  code: LOOKUP_CODE,
  profileId: "e2e-lookup-profile",
  endpointId: "e2e-lookup-endpoint",
  resolverDoh: RESOLVER_ID,
  servicePks: [VIDEO_FEATURE_ID, SOCIAL_FEATURE_ID],
  verifiedAt: Date.now(),
  expectedFingerprint: "e2e-ready",
  freshFingerprint: "e2e-ready",
  lastError: null,
} satisfies RecognitionState & { version: 2 };

const optionsUrl = (extensionId: string): string =>
  `chrome-extension://${extensionId}/src/ui/options/index.html`;

export type ControlDQueryRecord = {
  origin: string;
  pathname: string;
  name: string | null;
};

type FetchPermit = {
  pathname: string;
  hosts: readonly string[];
  serviceId: string;
  credential: string;
};

const isControlDHost = (hostname: string): boolean =>
  hostname === "api.controld.com" || hostname === "dns.controld.com";

/**
 * Replaces service-worker fetch for the Control D origins. Every other URL keeps
 * the original fetch. An unexpected Control D request is recorded, then rejected,
 * so a live account is never contacted. A context route aborts anything that
 * escapes the patched worker.
 */
export const installControlledFetch = async (
  context: BrowserContext,
  hosts: readonly string[],
): Promise<{ worker: Worker; escapes: string[] }> => {
  const escapes: string[] = [];
  await context.route(/^https:\/\/(?:[a-z0-9-]+\.)?controld\.com\//, async (route) => {
    escapes.push(route.request().url());
    await route.abort("blockedbyclient");
  });
  const worker =
    context.serviceWorkers()[0] ?? (await context.waitForEvent("serviceworker"));
  const permit: FetchPermit = {
    pathname: `/${RESOLVER_ID}`,
    hosts,
    serviceId: VIDEO_FEATURE_ID,
    credential: FIXTURE_API_KEY,
  };
  await worker.evaluate((allowed) => {
    const host = globalThis as {
      __ptControlDQueryLog?: ControlDQueryRecord[];
      __ptControlDFetchInstalled?: boolean;
    };
    if (host.__ptControlDFetchInstalled) return;
    const original = globalThis.fetch.bind(globalThis);
    const queries: ControlDQueryRecord[] = [];
    host.__ptControlDQueryLog = queries;
    host.__ptControlDFetchInstalled = true;
    const headerValue = (
      headers: HeadersInit | undefined,
      name: string,
    ): string | null => {
      if (!headers) return null;
      if (headers instanceof Headers) return headers.get(name);
      if (Array.isArray(headers)) {
        const found = headers.find(([key]) => key.toLowerCase() === name.toLowerCase());
        return found?.[1] ?? null;
      }
      const key = Object.keys(headers).find(
        (item) => item.toLowerCase() === name.toLowerCase(),
      );
      return key ? (headers[key] ?? null) : null;
    };
    globalThis.fetch = async (input, init) => {
      const raw =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url;
      let parsed: URL;
      try {
        parsed = new URL(raw);
      } catch {
        return original(input, init);
      }
      if (
        parsed.hostname !== "api.controld.com" &&
        parsed.hostname !== "dns.controld.com"
      ) {
        return original(input, init);
      }
      const record = {
        origin: parsed.origin,
        pathname: parsed.pathname,
        name: parsed.searchParams.get("name"),
      };
      queries.push(record);
      const allowedQuery =
        parsed.hostname === "dns.controld.com" &&
        parsed.pathname === allowed.pathname &&
        record.name !== null &&
        allowed.hosts.includes(record.name) &&
        parsed.searchParams.get("type") === "A" &&
        parsed.searchParams.get("controld") === "1" &&
        parsed.searchParams.get("no_log") === "1" &&
        headerValue(init?.headers, "authorization") === `Bearer ${allowed.credential}`;
      if (!allowedQuery) {
        throw new Error(
          `Unexpected Control D request ${record.origin}${record.pathname}`,
        );
      }
      return new Response(
        JSON.stringify({
          Status: 0,
          controld: {
            verdict: { verdictSource: "svc", verdictMatch: allowed.serviceId },
          },
        }),
        { status: 200, headers: { "content-type": "application/dns+json" } },
      );
    };
  }, permit);
  return { worker, escapes };
};

export const readControlDQueries = async (
  worker: Worker,
): Promise<ControlDQueryRecord[]> =>
  worker.evaluate(() => {
    const host = globalThis as { __ptControlDQueryLog?: ControlDQueryRecord[] };
    return host.__ptControlDQueryLog ?? [];
  });

export const expectedDomainQuery = (hostname: string): ControlDQueryRecord => ({
  origin: "https://dns.controld.com",
  pathname: `/${RESOLVER_ID}`,
  name: hostname,
});

const seedProviderStorage = async (page: Page): Promise<void> => {
  const entries: Record<string, unknown> = {
    [CONTROL_D_CONFIG_KEY]: connectedConfig,
    [LEGACY_API_KEY]: FIXTURE_API_KEY,
    [FEATURE_CATALOGUE_KEY]: {
      features: [videoFeature, socialFeature],
      checkedAt: Date.now(),
    },
    [RECOGNITION_STORE_KEY]: readyRecognition,
  };
  const migrated = await page.evaluate(
    async (payload: {
      entries: Record<string, unknown>;
      getState: string;
      apiKey: string;
    }) => {
      await chrome.storage.local.set(payload.entries);
      const response = (await chrome.runtime.sendMessage({
        type: payload.getState,
      })) as {
        ok?: boolean;
        state?: { hasApiKey?: boolean; autoSyncEnabled?: boolean };
      };
      const stored = await chrome.storage.local.get(payload.apiKey);
      return {
        ok: response.ok === true,
        hasApiKey: response.state?.hasApiKey === true,
        autoSyncEnabled: response.state?.autoSyncEnabled === true,
        legacyPresent: stored[payload.apiKey] !== undefined,
      };
    },
    {
      entries,
      getState: CONTROL_D_COMMANDS.getState,
      apiKey: LEGACY_API_KEY,
    },
  );
  expect(migrated).toEqual({
    ok: true,
    hasApiKey: true,
    autoSyncEnabled: false,
    legacyPresent: false,
  });
};

export const prepareProviderPage = async (
  context: BrowserContext,
  extensionId: string,
  options: {
    rules?: readonly SourceRule[];
    hosts: readonly string[];
  },
): Promise<{
  page: Page;
  worker: Worker;
  escapes: string[];
  pageRequests: string[];
}> => {
  const { worker, escapes } = await installControlledFetch(context, options.hosts);
  const page = await context.newPage();
  const pageRequests: string[] = [];
  page.on("request", (request) => {
    if (isControlDHost(new URL(request.url()).hostname))
      pageRequests.push(request.url());
  });
  await page.goto(optionsUrl(extensionId));
  await seedProviderStorage(page);
  await importSettings(page, {
    version: 3,
    exportedAt: "2026-10-09T10:00:00.000Z",
    locations: EXAMPLE_LOCATIONS,
    rules: [...(options.rules ?? [])],
    onboardingCompleted: true,
  });
  const seeded = await exportSettings<ExportedSettings>(page);
  expect(seeded.rules.map((rule) => rule.pattern)).toEqual(
    (options.rules ?? []).map((rule) => rule.pattern),
  );
  expect(await readControlDQueries(worker)).toEqual([]);
  expect(pageRequests).toEqual([]);
  return { page, worker, escapes, pageRequests };
};

export const openRulesPage = async (page: Page, extensionId: string): Promise<void> => {
  await page.goto(optionsUrl(extensionId));
  await openSettingsTab(page, "rules");
};

export const openNewRuleDialog = async (
  page: Page,
  extensionId: string,
): Promise<void> => {
  await openRulesPage(page, extensionId);
  await page.locator("#open-rule-dialog").click();
  await expect(page.locator("#rule-dialog")).toBeVisible();
  await expect(page.locator("#rule-dialog-title")).toHaveAttribute("data-mode", "add");
  await expect(page.locator("[data-provider-feature-host-field]")).toHaveCount(0);
};

export const openSavedRuleEditor = async (
  page: Page,
  extensionId: string,
  pattern: string,
): Promise<void> => {
  await openRulesPage(page, extensionId);
  await page.getByRole("button", { name: `Edit rule ${pattern}`, exact: true }).click();
  await expect(page.locator("#rule-dialog")).toBeVisible();
  await expect(page.locator("#rule-dialog-title")).toHaveAttribute("data-mode", "edit");
  await expect(page.locator("#dialog-rule-pattern")).toHaveValue(pattern);
  await expect(page.locator("[data-provider-feature-host-field]")).toHaveCount(0);
};

export const fillRulePattern = async (page: Page, pattern: string): Promise<void> => {
  await page.locator("#dialog-rule-pattern").fill(pattern);
};

export const selectRuleProfile = async (
  page: Page,
  label: string,
  locationId: string,
): Promise<void> => {
  await page.locator("#dialog-rule-profile").click();
  await page.getByRole("option", { name: label, exact: true }).click();
  await expect(page.locator("#dialog-rule-profile")).toHaveAttribute(
    "data-selected-value",
    locationId,
  );
};

export const saveRuleDialog = async (page: Page): Promise<void> => {
  await page.locator("#save-rule-dialog").click();
  await expect(page.locator("#rule-dialog")).toHaveCount(0);
};

export const cancelRuleDialog = async (page: Page): Promise<void> => {
  await page.locator("#close-rule-dialog").click();
  await expect(page.locator("#rule-dialog")).toHaveCount(0);
};

const REMOVED_ACTIONS = ["recognize", "confirm", "dismiss", "confirm-choice"] as const;

export const expectFeatureSlot = async (
  page: Page,
  state: {
    state: string;
    variant: "default" | "compact";
  },
): Promise<void> => {
  const slot = page.locator("[data-provider-feature]");
  await expect(slot).toHaveAttribute("data-provider-feature-state", state.state, {
    timeout: RECOGNITION_TIMEOUT_MS,
  });
  await expect(slot).toHaveAttribute("data-provider-feature-variant", state.variant);
  await expect(slot).toHaveAttribute(
    "data-provider-feature-provider",
    CONTROL_D_PROVIDER_ID,
  );
  await expect(page.locator("[data-provider-feature-host-field]")).toHaveCount(0);
  await expect(page.locator("[data-provider-feature-error]")).toHaveCount(0);
  for (const action of REMOVED_ACTIONS) {
    await expect(
      page.locator(`[data-provider-feature-action="${action}"]`),
    ).toHaveCount(0);
  }
};

export const clickFeatureAction = async (page: Page, action: string): Promise<void> => {
  await page.locator(`[data-provider-feature-action="${action}"]`).click();
};

export type StagedDecision = {
  providerId: string;
  featureId: string | null;
  joinExisting?: boolean;
};

export const expectFeatureDecision = async (
  page: Page,
  decision: StagedDecision,
): Promise<void> => {
  const input = page.locator('input[name="featureDecision"]');
  await expect(input).toHaveCount(1);
  expect(JSON.parse(await input.inputValue())).toEqual(decision);
};

export const expectNoFeatureDecision = async (page: Page): Promise<void> => {
  await expect(page.locator('input[name="featureDecision"]')).toHaveCount(0);
};

export const chooseCatalogueFeature = async (
  page: Page,
  featureId: string,
): Promise<void> => {
  await clickFeatureAction(page, "open");
  const change = page.locator('[data-provider-feature-action="change"]');
  const chooser = page.locator("[data-provider-feature-chooser]");
  await expect(change.or(chooser)).toBeVisible();
  if (await change.isVisible()) await change.click();
  await expect(chooser).toBeVisible();
  await chooser.locator('[role="combobox"]').click();
  await page.locator(`[data-combobox-option-value="${featureId}"]`).click();
};

export const readProviderGuard = async (
  page: Page,
): Promise<{
  autoSyncEnabled: boolean;
  lastSyncedHash: string | null;
  managedServiceCount: number;
}> =>
  page.evaluate(async (key: string) => {
    const stored: Record<string, unknown> = await chrome.storage.local.get(key);
    const value = stored[key];
    if (!value || typeof value !== "object") {
      throw new Error("Control D config is missing.");
    }
    const config = value as {
      autoSyncEnabled?: unknown;
      lastSyncedHash?: unknown;
      managedServices?: unknown;
    };
    const managed = config.managedServices;
    let lastSyncedHash: string | null = null;
    if (typeof config.lastSyncedHash === "string")
      lastSyncedHash = config.lastSyncedHash;
    return {
      autoSyncEnabled: config.autoSyncEnabled === true,
      lastSyncedHash,
      managedServiceCount:
        managed && typeof managed === "object" ? Object.keys(managed).length : 0,
    };
  }, CONTROL_D_CONFIG_KEY);

export const expectProviderQuiet = async (
  page: Page,
  worker: Worker,
  hosts: readonly string[],
  escapes: readonly string[],
  pageRequests: readonly string[],
): Promise<void> => {
  expect(await readProviderGuard(page)).toEqual({
    autoSyncEnabled: false,
    lastSyncedHash: null,
    managedServiceCount: 0,
  });
  expect(await readControlDQueries(worker)).toEqual(hosts.map(expectedDomainQuery));
  expect(escapes).toEqual([]);
  expect(pageRequests).toEqual([]);
};

export const expectExportSealed = (exported: ExportedSettings): void => {
  const serialized = JSON.stringify(exported);
  expect(serialized).not.toContain(FIXTURE_API_KEY);
  expect(serialized).not.toContain("pt.experimental.control-d");
  expect(serialized).not.toContain(RESOLVER_ID);
  expect(serialized).not.toContain(LOOKUP_CODE);
};

export type SavedIdentity = {
  pattern: string;
  authKey: string;
  ruleSeedKey: string;
  enabled: boolean;
  locationId: string | undefined;
};

export const savedIdentity = (
  exported: ExportedSettings,
  pattern: string,
): SavedIdentity => {
  const rule = exported.rules.find((item) => item.pattern === pattern);
  if (!rule?.authKey || !rule.ruleSeedKey) {
    throw new Error(`Missing identity for ${pattern}.`);
  }
  return {
    pattern,
    authKey: rule.authKey,
    ruleSeedKey: rule.ruleSeedKey,
    enabled: rule.enabled,
    locationId: rule.locationId,
  };
};

export const expectSavedRule = (
  exported: ExportedSettings,
  identity: SavedIdentity,
): void => {
  expect(exported.rules).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        pattern: identity.pattern,
        authKey: identity.authKey,
        ruleSeedKey: identity.ruleSeedKey,
        enabled: identity.enabled,
        ...(identity.locationId ? { locationId: identity.locationId } : {}),
      }),
    ]),
  );
};

export const readDismissedHosts = async (page: Page): Promise<string[]> =>
  page.evaluate(async (key: string) => {
    const stored: Record<string, unknown> = await chrome.storage.local.get(key);
    const value = stored[key];
    if (!value || typeof value !== "object") return [];
    const dismissed = (value as { dismissedMatches?: unknown }).dismissedMatches;
    if (!Array.isArray(dismissed)) return [];
    return dismissed.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const hostname = (item as { hostname?: unknown }).hostname;
      return typeof hostname === "string" ? [hostname] : [];
    });
  }, EXTENSION_STORAGE_KEYS.providerFeatureMatches);

export const expectPageHasNoProvider = async (page: Page): Promise<void> => {
  const evidence = await page.evaluate(
    (needles: readonly string[]) => {
      const html = document.documentElement.innerHTML.toLowerCase();
      const resources = performance
        .getEntriesByType("resource")
        .map((entry) => entry.name);
      return {
        html: needles.filter((needle) => html.includes(needle)),
        resources: resources.filter((url) => {
          const value = url.toLowerCase();
          return value.includes("controld") || value.includes("provider-feature");
        }),
      };
    },
    ["controld", "pt.provider-feature", "pt.experimental.control-d", FIXTURE_API_KEY],
  );
  expect(evidence).toEqual({ html: [], resources: [] });
};

export const expectHostUnprotected = async (
  context: BrowserContext,
  extensionId: string,
  page: Page,
  hostname: string,
): Promise<void> => {
  const popup = await openPopupWithDefaults(context, extensionId, page);
  const state = await getPopupState<{
    currentRule: { pattern: string | null };
    currentTab: { hostname: string | null };
  }>(popup);
  expect(state.currentTab.hostname).toBe(hostname);
  expect(state.currentRule.pattern).toBeNull();
  await expect(popup.locator("#current-rule")).toHaveAttribute(
    "data-presentation",
    "fallback-inactive",
  );
  await expect(popup.locator("[data-provider-decorators]")).toHaveCount(0);
  await popup.close();
};

export const openProbe = async (
  context: BrowserContext,
  serverUrl: string,
): Promise<Page> => {
  const page = await context.newPage();
  await page.goto(getProbeHostUrl(serverUrl), { waitUntil: "domcontentloaded" });
  return page;
};

const extensionWorker = (
  context: BrowserContext,
  extensionId: string,
): Worker | undefined =>
  context.serviceWorkers().find((worker) => worker.url().includes(extensionId));

type WorkerVersion = {
  versionId: string;
  scriptURL: string;
  runningStatus: string;
};

/**
 * Stops the MV3 worker. `chrome.runtime.reload()` unloads an unpacked extension.
 * The options page owns the CDP session because the browser session has no
 * ServiceWorker domain.
 */
const stopExtensionWorker = async (
  context: BrowserContext,
  extensionId: string,
  page: Page,
): Promise<void> => {
  const client = await context.newCDPSession(page);
  const versions: WorkerVersion[] = [];
  const scopes = new Set<string>();
  const recordVersions = (payload: { versions: WorkerVersion[] }) => {
    versions.push(...payload.versions);
  };
  const recordScopes = (payload: { registrations: { scopeURL: string }[] }) => {
    for (const registration of payload.registrations) {
      if (registration.scopeURL.includes(extensionId))
        scopes.add(registration.scopeURL);
    }
  };
  client.on("ServiceWorker.workerVersionUpdated", recordVersions);
  client.on("ServiceWorker.workerRegistrationUpdated", recordScopes);
  try {
    await client.send("ServiceWorker.enable");
    const running = versions.filter(
      (version) =>
        version.scriptURL.includes(extensionId) && version.runningStatus !== "stopped",
    );
    const stopped = new Set<string>();
    for (const version of running) {
      if (stopped.has(version.versionId)) continue;
      stopped.add(version.versionId);
      await client.send("ServiceWorker.stopWorker", { versionId: version.versionId });
    }
    if (stopped.size === 0) await client.send("ServiceWorker.stopAllWorkers");
    const scope = [...scopes][0] ?? `chrome-extension://${extensionId}/`;
    await client.send("ServiceWorker.startWorker", { scopeURL: scope });
  } finally {
    client.off("ServiceWorker.workerVersionUpdated", recordVersions);
    client.off("ServiceWorker.workerRegistrationUpdated", recordScopes);
    await client.detach();
  }
};

export const restartExtensionWorker = async (
  context: BrowserContext,
  extensionId: string,
): Promise<Page> => {
  const current = extensionWorker(context, extensionId);
  if (!current) throw new Error("Extension service worker is not running.");
  await current.evaluate(() => {
    (globalThis as { __ptWorkerEpoch?: number }).__ptWorkerEpoch = 1;
  });
  const open = context
    .pages()
    .find((candidate) => candidate.url().startsWith(optionsUrl(extensionId)));
  const stoppedFrom = open ?? (await context.newPage());
  if (!open) await stoppedFrom.goto(optionsUrl(extensionId));
  await stopExtensionWorker(context, extensionId, stoppedFrom);
  const page = await context.newPage();
  await page.goto(optionsUrl(extensionId));
  await readSettings(page);
  const restarted = extensionWorker(context, extensionId);
  if (restarted && restarted !== current) return page;
  try {
    const epoch = await current.evaluate(
      () => (globalThis as { __ptWorkerEpoch?: number }).__ptWorkerEpoch ?? 0,
    );
    if (epoch !== 0) throw new Error("Extension service worker did not restart.");
  } catch (error) {
    if (
      !(error instanceof Error) ||
      !error.message.includes("Execution context was destroyed")
    ) {
      throw error;
    }
  }
  return page;
};

export const videoDecision = (
  featureId: string | null,
  joinExisting?: boolean,
): StagedDecision => ({
  providerId: CONTROL_D_PROVIDER_ID,
  featureId,
  ...(joinExisting ? { joinExisting: true } : {}),
});
