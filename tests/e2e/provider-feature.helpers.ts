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
import type {
  ProviderFeature,
  ProviderFeatureMatch,
} from "../../src/shared/provider-feature";
import type { ExportedSettings } from "../../src/shared/types";

import {
  exportSettings,
  getPopupState,
  getProbeHostUrl,
  importSettings,
  openPopupWithDefaults,
  openSettingsTab,
  saveLocationModel,
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

if (!isControlDResourceCode(LOOKUP_CODE)) {
  throw new Error("Fixture lookup code is not a Control D resource code.");
}

export const VIDEO_HOST = "video.example.com";
export const LOOPBACK_HOST = "127.0.0.1";

export type SourceRule = {
  pattern: string;
  locationId: string;
  enabled: boolean;
  ruleSeedKey: string;
  authKey: string;
};

export const VIDEO_SOURCE: SourceRule = {
  pattern: VIDEO_HOST,
  locationId: "spf-warsaw",
  enabled: true,
  ruleSeedKey: "abc123",
  authKey: "abcd1234",
};

export const LOOPBACK_SOURCE: SourceRule = {
  pattern: LOOPBACK_HOST,
  locationId: "spf-warsaw",
  enabled: true,
  ruleSeedKey: "loop01",
  authKey: "loop1234",
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
  },
  lastSyncedHash: null,
  lastAttemptAt: null,
  lastSuccessAt: null,
  lastError: null,
} satisfies ControlDConfig;

/**
 * Persisted form `saveRecognitionState` writes and `loadRecognitionState` reads.
 * `recognizeDomain` queries only when this lookup is ready. Preview/apply is not
 * used here because it would call Control D.
 */
const readyRecognition = {
  version: 1 as const,
  phase: "ready",
  code: LOOKUP_CODE,
  profileId: "e2e-lookup-profile",
  endpointId: "e2e-lookup-endpoint",
  resolverDoh: RESOLVER_ID,
  servicePks: [VIDEO_FEATURE_ID, SOCIAL_FEATURE_ID],
  expectedFingerprint: "e2e-ready",
  freshFingerprint: "e2e-ready",
  lastError: null,
} satisfies RecognitionState & { version: 1 };

const suggestionFor = (hostname: string): ProviderFeatureMatch => ({
  hostname,
  providerId: CONTROL_D_PROVIDER_ID,
  featureId: VIDEO_FEATURE_ID,
  matchSource: "domain-test",
  status: "matched",
  checkedAt: new Date().toISOString(),
});

const optionsUrl = (extensionId: string): string =>
  `chrome-extension://${extensionId}/src/ui/options/index.html`;

export type ControlDQueryRecord = {
  origin: string;
  pathname: string;
  name: string | null;
};

type FetchPermit = {
  pathname: string;
  name: string;
  serviceId: string;
} | null;

/**
 * Replaces service-worker fetch for the two Control D origins. Every other URL
 * keeps the original fetch. An unexpected Control D request is recorded, then
 * rejected, so a live account is never contacted.
 */
export const installControlledFetch = async (
  context: BrowserContext,
  queryHost: string | null,
): Promise<Worker> => {
  const worker =
    context.serviceWorkers()[0] ?? (await context.waitForEvent("serviceworker"));
  const permit: FetchPermit = queryHost
    ? {
        pathname: `/${RESOLVER_ID}`,
        name: queryHost,
        serviceId: VIDEO_FEATURE_ID,
      }
    : null;
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
        allowed !== null &&
        parsed.hostname === "dns.controld.com" &&
        parsed.pathname === allowed.pathname &&
        record.name === allowed.name &&
        parsed.searchParams.get("type") === "A" &&
        parsed.searchParams.get("controld") === "1";
      if (!allowedQuery) {
        throw new Error(
          `Unexpected Control D request ${record.origin}${record.pathname}`,
        );
      }
      return new Response(
        JSON.stringify({
          Status: 0,
          controld: {
            verdict: { verdictSource: "svc", verdictMatch: allowed?.serviceId },
          },
        }),
        { status: 200, headers: { "content-type": "application/dns+json" } },
      );
    };
  }, permit);
  return worker;
};

export const readControlDQueries = async (
  worker: Worker,
): Promise<ControlDQueryRecord[]> =>
  worker.evaluate(() => {
    const host = globalThis as { __ptControlDQueryLog?: ControlDQueryRecord[] };
    return host.__ptControlDQueryLog ?? [];
  });

const seedProviderStorage = async (
  page: Page,
  options: { suggestionHost: string | null; recognition: boolean },
): Promise<void> => {
  const entries: Record<string, unknown> = {
    [CONTROL_D_CONFIG_KEY]: connectedConfig,
    [LEGACY_API_KEY]: FIXTURE_API_KEY,
    [FEATURE_CATALOGUE_KEY]: {
      features: [videoFeature, socialFeature],
      checkedAt: Date.now(),
    },
  };
  if (options.suggestionHost) {
    entries[EXTENSION_STORAGE_KEYS.providerFeatureMatches] = {
      featureMatches: [suggestionFor(options.suggestionHost)],
      dismissedMatches: [],
    };
  }
  if (options.recognition) entries[RECOGNITION_STORE_KEY] = readyRecognition;
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
    rule: SourceRule;
    suggestion?: boolean;
    recognition?: boolean;
    queryHost?: string | null;
  },
): Promise<{ page: Page; worker: Worker }> => {
  const worker = await installControlledFetch(context, options.queryHost ?? null);
  const page = await context.newPage();
  await page.goto(optionsUrl(extensionId));
  // Config is quiet before the rule write, so the automatic sync scheduled by
  // that write cannot reach Control D.
  await seedProviderStorage(page, {
    suggestionHost: options.suggestion ? options.rule.pattern : null,
    recognition: options.recognition === true,
  });
  await importSettings(page, {
    version: 3,
    exportedAt: "2026-10-09T10:00:00.000Z",
    locations: EXAMPLE_LOCATIONS,
    rules: [options.rule],
    onboardingCompleted: true,
  });
  const seeded = await exportSettings<ExportedSettings>(page);
  expect(seeded.rules).toEqual([
    expect.objectContaining({
      pattern: options.rule.pattern,
      authKey: options.rule.authKey,
      ruleSeedKey: options.rule.ruleSeedKey,
      enabled: true,
      locationId: options.rule.locationId,
    }),
  ]);
  expect(await readControlDQueries(worker)).toEqual([]);
  return { page, worker };
};

export const expectedDomainQuery = (hostname: string): ControlDQueryRecord => ({
  origin: "https://dns.controld.com",
  pathname: `/${RESOLVER_ID}`,
  name: hostname,
});

export const openPopupRuleEditor = async (
  context: BrowserContext,
  extensionId: string,
  probe: Page,
): Promise<Page> => {
  const popup = await openPopupWithDefaults(context, extensionId, probe);
  await expect(popup.locator("#current-rule")).toHaveAttribute(
    "data-presentation",
    "rule-active",
  );
  await expect(popup.locator("#open-rule-settings")).toHaveAttribute(
    "data-action-intent",
    "open-rule-options",
  );
  await popup.locator("#open-rule-settings").click();
  await expect(popup.locator("[data-provider-feature-host-field]")).toHaveCount(0);
  return popup;
};

export const openSavedRuleEditor = async (
  page: Page,
  extensionId: string,
  pattern: string,
): Promise<void> => {
  await page.goto(optionsUrl(extensionId));
  await openSettingsTab(page, "rules");
  await page.getByRole("button", { name: `Edit rule ${pattern}`, exact: true }).click();
  await expect(page.locator("#rule-dialog")).toBeVisible();
  await expect(page.locator("#rule-dialog-title")).toHaveAttribute("data-mode", "edit");
  await expect(page.locator("#dialog-rule-pattern")).toHaveValue(pattern);
  await expect(page.locator("[data-provider-feature-host-field]")).toHaveCount(0);
};

export type FeatureViewState = {
  view: string;
  variant: "default" | "compact";
  matchSource: string;
  matchStatus: string;
  sync: string;
  rulePattern: string;
};

export const expectFeatureState = async (
  page: Page,
  state: FeatureViewState,
): Promise<void> => {
  const panel = page.locator("[data-provider-feature]");
  await expect(panel).toHaveAttribute("data-provider-feature-view", state.view);
  await expect(panel).toHaveAttribute("data-provider-feature-variant", state.variant);
  await expect(panel).toHaveAttribute("data-provider-feature-busy", "false");
  await expect(panel).toHaveAttribute(
    "data-provider-feature-match-status",
    state.matchStatus,
  );
  await expect(page.locator("[data-provider-feature-match-source]")).toHaveAttribute(
    "data-provider-feature-match-source",
    state.matchSource,
  );
  await expect(page.locator("[data-provider-feature-sync]")).toHaveAttribute(
    "data-provider-feature-sync",
    state.sync,
  );
  await expect(page.locator("[data-provider-feature-rule-pattern]")).toHaveAttribute(
    "data-provider-feature-rule-pattern",
    state.rulePattern,
  );
  await expect(page.locator("[data-provider-feature-error]")).toHaveCount(0);
};

export const clickFeatureAction = async (page: Page, action: string): Promise<void> => {
  await page.locator(`[data-provider-feature-action="${action}"]`).click();
};

export const confirmManualFeature = async (
  page: Page,
  featureId: string,
): Promise<void> => {
  await clickFeatureAction(page, "choose");
  await expect(page.locator("[data-provider-feature]")).toHaveAttribute(
    "data-provider-feature-choosing",
    "true",
  );
  await page.locator('[data-provider-feature-chooser] [role="combobox"]').click();
  await page.locator(`[data-combobox-option-value="${featureId}"]`).click();
  await clickFeatureAction(page, "confirm-choice");
};

export const SOCIAL_FEATURE = SOCIAL_FEATURE_ID;
export const VIDEO_FEATURE = VIDEO_FEATURE_ID;

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

export const expectQuietProvider = async (
  page: Page,
  worker: Worker,
): Promise<void> => {
  expect(await readProviderGuard(page)).toEqual({
    autoSyncEnabled: false,
    lastSyncedHash: null,
    managedServiceCount: 0,
  });
  expect(await readControlDQueries(worker)).toEqual([]);
};

export const expectSourceUnchanged = async (
  page: Page,
  rule: SourceRule,
  binding: { featureId: string; matchSource: string } | null,
): Promise<ExportedSettings> => {
  const exported = await exportSettings<ExportedSettings>(page);
  expect(exported.rules).toEqual([
    expect.objectContaining({
      pattern: rule.pattern,
      authKey: rule.authKey,
      ruleSeedKey: rule.ruleSeedKey,
      enabled: rule.enabled,
      locationId: rule.locationId,
    }),
  ]);
  if (binding === null) {
    expect(exported.featureBindings ?? []).toEqual([]);
  } else {
    expect(exported.featureBindings).toEqual([
      expect.objectContaining({
        rulePattern: rule.pattern,
        providerId: CONTROL_D_PROVIDER_ID,
        featureId: binding.featureId,
        featureType: "service",
        matchSource: binding.matchSource,
      }),
    ]);
  }
  const serialized = JSON.stringify(exported);
  expect(serialized).not.toContain(FIXTURE_API_KEY);
  expect(serialized).not.toContain("pt.experimental.control-d");
  expect(serialized).not.toContain(RESOLVER_ID);
  return exported;
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

export const renameSource = async (
  page: Page,
  exported: ExportedSettings,
  from: string,
  to: string,
): Promise<void> => {
  const rule = exported.rules.find((item) => item.pattern === from);
  if (!rule) throw new Error(`Missing source rule ${from}.`);
  await saveLocationModel(page, {
    locations: exported.locations,
    rules: [{ ...rule, pattern: to }],
  });
};
