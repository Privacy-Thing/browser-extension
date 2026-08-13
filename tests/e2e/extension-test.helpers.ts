// Shared E2E helpers consumed by both the core (runtime/state) and product
// (options/popup) Playwright lanes. Changes here therefore trigger both
// needs_e2e_core and needs_e2e_product in .github/workflows/ci.yml.
import type { BrowserContext, Frame, Page } from "@playwright/test";

import { EXAMPLE_LOCATIONS } from "../../src/background/storage/locations";
import { EXTENSION_COMMAND_TYPES } from "../../src/shared/extension-contract";
import type {
  DomainRule,
  ExportedSettings,
  GetSettingsResponse,
  Location,
  TrustedSite,
} from "../../src/shared/types";

import { expect } from "./fixtures";
export {
  expectToast,
  readToastProgress,
  waitForToastProgressDrop,
} from "./toast.helpers";

// Shared helpers for the split Chromium smoke suites.
export const openSettingsTab = async (
  page: Page,
  tab: "profiles" | "rules" | "advanced" | "about",
): Promise<void> => {
  await page.locator(`[data-tab="${tab}"]`).click();
  await expect(page.locator(`[data-panel="${tab}"]`)).toBeVisible();
};

export const getProbeHostUrl = (serverUrl: string): string =>
  new URL("/__test/host", serverUrl).toString();

/** Read the persisted extension settings through the background command contract. */
export const readSettings = async (
  page: Page | Frame,
): Promise<GetSettingsResponse> => {
  const response = await page.evaluate(async (commandType) => {
    return (await chrome.runtime.sendMessage({
      type: commandType,
    })) as GetSettingsResponse | { ok?: false; error?: string };
  }, EXTENSION_COMMAND_TYPES.getSettings);

  if (!response?.ok) {
    throw new Error(response?.error ?? "Loading current settings failed.");
  }

  return response;
};

export const readFallbackSeedKey = async (
  page: Page | Frame,
): Promise<string | null> => {
  const settings = await readSettings(page);
  return settings.globalFallbackRule?.ruleSeedKey ?? null;
};

export const readRuleSeedKey = async (
  page: Page | Frame,
  pattern: string,
): Promise<string | null> =>
  readSettings(page).then(
    (response) =>
      response.rules?.find((rule) => rule.pattern === pattern)?.ruleSeedKey ?? null,
  );

export const NAVIGATION_RACE_PATTERN =
  /interrupted|ERR_ABORTED|Execution context was destroyed|frame was detached|Target (page|frame)?.*closed/i;

export type HostState = {
  cookie: string;
  localStorage: string | null;
  sessionStorage: string | null;
};

export const reloadAfterCleanup = async (
  page: Page,
  url: string,
): Promise<HostState> => {
  try {
    await page.goto(url, { waitUntil: "load" });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    // The extension reloads the active tab after a rule mutation (e.g. new
    // identity / cleanup), which can interrupt our goto to the SAME url.
    // The probe below synchronizes with the replacement document.
    if (!NAVIGATION_RACE_PATTERN.test(message)) throw error;
  }

  let hostState: HostState | null = null;
  await expect
    .poll(
      async () => {
        try {
          hostState = await page.evaluate(() => {
            const collectHostState = (
              globalThis as typeof globalThis & {
                collectHostState?: () => HostState;
              }
            ).collectHostState;
            return typeof collectHostState === "function" ? collectHostState() : null;
          });
          return hostState !== null;
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : String(error);
          if (NAVIGATION_RACE_PATTERN.test(message)) {
            return false;
          }
          throw error;
        }
      },
      { message: "Expected the host-state probe to be ready after cleanup." },
    )
    .toBe(true);

  if (hostState === null) {
    throw new Error("Host-state probe completed without a state snapshot.");
  }
  return hostState;
};

export const waitForPersistedLocation = async (
  page: Page | Frame,
  locationId: string,
  predicate: (location: Location) => boolean,
  description = `Location ${locationId} did not persist in time.`,
): Promise<void> => {
  await expect
    .poll(
      async () => {
        const settings = await readSettings(page);
        const location = settings.locations.find((entry) => entry.id === locationId);
        return location ? predicate(location) : false;
      },
      {
        timeout: 15_000,
        message: description,
      },
    )
    .toBe(true);
};

type PersistSettingsPayload = {
  themeMode?: "light" | "dark" | "system";
  debugMode?: boolean;
  watchPositionDelay?: [number, number];
  osmConsent?: "unknown" | "granted" | "denied";
  browserFingerprintSpoofingEnabled?: boolean;
  sharedWorkerCompatibilityMode?: boolean;
  sharedSpoofing?: {
    canvas?: boolean;
    webGL?: boolean;
    audio?: boolean;
    screen?: boolean;
    webRTC?: boolean;
  };
  highContrastMode?: boolean;
  highContrastExplicit?: boolean;
  reduceMotion?: boolean;
  onboardingCompleted?: boolean;
  globalFallbackRule?: {
    enabled: boolean;
    locationId?: string;
    ruleSeedKey?: string;
    fingerprintSurfaceOverrides?: {
      canvas?: boolean;
      webGL?: boolean;
      audio?: boolean;
      navigator?: boolean;
      screen?: boolean;
      clientHints?: boolean;
      webRTC?: boolean;
    };
  };
  trustedSites?: TrustedSite[];
  featureFlags?: {
    temporalApi?: boolean;
  };
};

type PersistLocModelPayload = {
  locations: unknown[];
  rules: unknown[];
  containerAssignments?: unknown[];
};

const readPersistedLocState = async (
  page: Page | Frame,
): Promise<{
  locations: Location[];
  rules: unknown[];
  containerAssignments: unknown[];
}> => {
  const response = await readSettings(page);

  return {
    locations: response.locations,
    rules: response.rules,
    containerAssignments: response.containerAssignments ?? [],
  };
};

export const saveSimpleSettings = async (
  page: Page | Frame,
  payload: PersistSettingsPayload,
): Promise<void> => {
  const response = (await page.evaluate(
    async ({ commandType, message }) => {
      return chrome.runtime.sendMessage({
        type: commandType,
        ...message,
      });
    },
    {
      commandType: EXTENSION_COMMAND_TYPES.saveSimpleSettings,
      message: payload,
    },
  )) as { ok?: boolean; error?: string };

  if (!response?.ok) {
    throw new Error(response?.error ?? "Saving simple settings failed.");
  }
};

export const saveLocationModel = async (
  page: Page | Frame,
  payload: PersistLocModelPayload,
): Promise<void> => {
  // The save-location-model command persists the full model, so preserve omitted
  // subtrees unless the caller explicitly wants to replace them.
  const persistedState =
    payload.containerAssignments === undefined
      ? await readPersistedLocState(page)
      : null;
  const normalizedPayload = {
    ...payload,
    containerAssignments:
      payload.containerAssignments ?? persistedState?.containerAssignments ?? [],
  };
  const response = (await page.evaluate(
    async ({ commandType, message }) => {
      return chrome.runtime.sendMessage({
        type: commandType,
        ...message,
      });
    },
    {
      commandType: EXTENSION_COMMAND_TYPES.saveLocationModel,
      message: normalizedPayload,
    },
  )) as { ok?: boolean; error?: string };

  if (!response?.ok) {
    throw new Error(response?.error ?? "Saving location model failed.");
  }
};

export const expectAnchorInViewport = async (
  page: Page,
  anchorId: string,
): Promise<void> => {
  await expect(page.locator(`[data-anchor-id="${anchorId}"]`)).toBeVisible();
  await expect
    .poll(async () =>
      page.locator(`[data-anchor-id="${anchorId}"]`).evaluate((node) => {
        const rect = node.getBoundingClientRect();
        return rect.top >= 0 && rect.top < window.innerHeight;
      }),
    )
    .toBe(true);
};

export const escapeForRegex = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const getFieldContainer = (page: Page, label: string) =>
  page
    .locator("#profile-dialog")
    .locator("label:visible")
    .filter({ hasText: new RegExp(`^${escapeForRegex(label)}$`) })
    .first()
    .locator("..")
    .locator("..");

const ensureProfileSectionOpen = async (
  page: Page,
  label: "Primary locale" | "Preferred languages" | "Time zone",
): Promise<void> => {
  const sectionTitle =
    label === "Preferred languages" ||
    label === "Primary locale" ||
    label === "Time zone"
      ? "Time & language"
      : null;

  if (!sectionTitle) {
    return;
  }

  const sectionTrigger = page
    .locator("#profile-dialog")
    .locator(`button[data-form-section-title="${sectionTitle}"]`);

  if ((await sectionTrigger.count()) === 0) {
    return;
  }

  await sectionTrigger.scrollIntoViewIfNeeded();
  if ((await sectionTrigger.getAttribute("aria-expanded")) !== "true") {
    await sectionTrigger.click();
  }
};

export const selectProfileOption = async (
  page: Page,
  label: "Primary locale" | "Time zone",
  value: string,
  optionLabel = value,
): Promise<void> => {
  await ensureProfileSectionOpen(page, label);
  const container = getFieldContainer(page, label);
  const combobox = container.getByRole("combobox").first();
  await combobox.click();

  const input = page.getByPlaceholder(label, { exact: true });
  await expect(input).toBeVisible();
  await input.fill(value);

  const option = page.getByRole("option", { name: optionLabel, exact: true });
  await expect(option).toBeVisible();
  await expect(option).toHaveAttribute("aria-selected", "true");
  await input.press("Enter");
  await expect(input).toBeHidden();
  await expect(combobox).toContainText(optionLabel, { timeout: 10_000 });
};

export const selectPopupOption = async (
  page: Page,
  triggerSelector: string,
  optionLabel: string,
): Promise<void> => {
  const trigger = page.locator(triggerSelector);
  await trigger.click();
  const option = page.getByRole("option", { name: optionLabel, exact: true });
  await expect(option).toBeVisible();
  await option.click();
  await expect(trigger).toContainText(optionLabel);
};

export const replaceProfileLanguages = async (
  page: Page,
  values: string[],
): Promise<void> => {
  await ensureProfileSectionOpen(page, "Preferred languages");
  const container = getFieldContainer(page, "Preferred languages");
  const input = container.locator('input[type="text"]');
  await input.click();
  await page.keyboard.press(`${process.platform === "darwin" ? "Meta" : "Control"}+A`);
  await page.keyboard.press("Backspace");
  for (const value of values) {
    await input.fill(value);
    await input.press("Enter");
  }
};

type NativeNavigatorIdentity = {
  userAgent: string;
  appVersion: string;
  platform: string;
  vendor: string;
  vendorSub: string | null;
  productSub: string | null;
  userAgentData: {
    platform: string;
    mobile: boolean;
    brands: Array<{
      brand: string;
      version: string;
    }>;
  } | null;
};

export const readNavigatorIdentity = async (
  page: Page | Frame,
): Promise<NativeNavigatorIdentity> =>
  page.evaluate(() => ({
    userAgent: navigator.userAgent,
    appVersion: navigator.appVersion,
    platform: navigator.platform,
    vendor: navigator.vendor,
    vendorSub: "vendorSub" in navigator ? navigator.vendorSub : null,
    productSub: "productSub" in navigator ? navigator.productSub : null,
    userAgentData: navigator.userAgentData
      ? {
          platform: navigator.userAgentData.platform,
          mobile: navigator.userAgentData.mobile,
          brands: navigator.userAgentData.brands,
        }
      : null,
  }));

export const readSnapshot = async (
  page: Page | Frame,
): Promise<{
  language: string;
  languages: string[];
  timeZone: string;
  platform: string;
  vendor: string;
  vendorSub: string | null;
  productSub: string | null;
  webdriver: boolean;
  userAgent: string;
  appVersion: string;
  languageGetterSource: string | null;
  webdriverGetterSource: string | null;
  webdriverPrototypeAccessThrows: boolean;
  webdriverCallThrows: boolean;
  userAgentGetterSource: string | null;
  functionToStringHasPrototype: boolean;
  functionToStringNewThrows: boolean;
  permissions: {
    geolocation: string;
    geolocationTag: string;
    geolocationPrototypeName: string | null;
  };
  userAgentData: {
    platform: string;
    mobile: boolean;
    brands: Array<{
      brand: string;
      version: string;
    }>;
    highEntropyValues: {
      architecture: string;
      bitness: string;
      wow64: boolean;
      formFactors: string[];
      platformVersion: string;
      uaFullVersion: string;
      fullVersionList: Array<{
        brand: string;
        version: string;
      }>;
    };
  } | null;
  intl: {
    dateTimeResolvedOptions: {
      locale: string;
      timeZone: string;
    };
    numberResolvedOptions: {
      locale: string;
    };
    pluralRulesResolvedOptions: {
      locale: string;
      pluralCategories: string[];
    };
    formattedNumber: string;
    formattedNumberParts: Array<{
      type: string;
      value: string;
    }>;
    formattedMonthParts: Array<{
      type: string;
      value: string;
    }>;
    pluralCategory: string;
  };
  geo?: {
    latitude: number;
    longitude: number;
  };
  geoError?: string;
  error?: string;
  installMarkerPresent: boolean;
  earlyInstallMarkerPresent: boolean;
  iframeNavigatorMarkerPresent: boolean;
  runtimePresent: boolean;
}> => {
  await expect(page.locator("#snapshot")).not.toHaveText("pending");
  const snapshot = JSON.parse(
    (await page.locator("#snapshot").textContent()) ?? "{}",
  ) as {
    language: string;
    languages: string[];
    timeZone: string;
    platform: string;
    vendor: string;
    vendorSub: string | null;
    productSub: string | null;
    webdriver: boolean;
    userAgent: string;
    appVersion: string;
    languageGetterSource: string | null;
    webdriverGetterSource: string | null;
    userAgentGetterSource: string | null;
    permissions: {
      geolocation: string;
      geolocationTag: string;
      geolocationPrototypeName: string | null;
    };
    userAgentData: {
      platform: string;
      mobile: boolean;
      brands: Array<{
        brand: string;
        version: string;
      }>;
      highEntropyValues: {
        architecture: string;
        bitness: string;
        wow64: boolean;
        formFactors: string[];
        platformVersion: string;
        uaFullVersion: string;
        fullVersionList: Array<{
          brand: string;
          version: string;
        }>;
      };
    } | null;
    intl: {
      dateTimeResolvedOptions: {
        locale: string;
        timeZone: string;
      };
      numberResolvedOptions: {
        locale: string;
      };
      pluralRulesResolvedOptions: {
        locale: string;
        pluralCategories: string[];
      };
      formattedNumber: string;
      formattedNumberParts: Array<{
        type: string;
        value: string;
      }>;
      formattedMonthParts: Array<{
        type: string;
        value: string;
      }>;
      pluralCategory: string;
    };
    geo?: {
      latitude: number;
      longitude: number;
    };
    geoError?: string;
    error?: string;
    installMarkerPresent: boolean;
    earlyInstallMarkerPresent: boolean;
    iframeNavigatorMarkerPresent: boolean;
    runtimePresent: boolean;
    functionToStringHasPrototype: boolean;
    functionToStringNewThrows: boolean;
    webdriverPrototypeAccessThrows: boolean;
    webdriverCallThrows: boolean;
  };

  if (snapshot.error) {
    throw new Error(`Snapshot probe failed: ${snapshot.error}`);
  }

  return snapshot;
};

export const readWatchSnapshot = async (
  page: Page | Frame,
): Promise<{
  updates: Array<{
    latitude: number;
    longitude: number;
  }>;
}> => {
  await expect(page.locator("#watch-snapshot")).not.toHaveText("pending");
  return JSON.parse((await page.locator("#watch-snapshot").textContent()) ?? "{}") as {
    updates: Array<{
      latitude: number;
      longitude: number;
    }>;
  };
};

export const readWorkerSnapshot = async (
  page: Page | Frame,
): Promise<{
  error?: string;
  language: string;
  languages: string[];
  locale: string;
  timeZone: string;
  temporal: {
    defaultTimeZone: string;
    explicitTimeZone: string;
    timeZoneIdSource: string;
  } | null;
  hardwareConcurrency: number;
  userAgent: string;
  appVersion: string;
  platform: string;
  vendor: string;
  userAgentData: {
    platform: string;
    mobile: boolean;
    brands: Array<{
      brand: string;
      version: string;
    }>;
  } | null;
  clientHints: {
    brands: Array<{
      brand: string;
      version: string;
    }>;
    mobile: boolean;
    platform: string;
    highEntropyValues: Record<string, unknown>;
    error?: string;
  } | null;
  webGL: {
    debugExtensionAvailable: boolean;
    renderer: string | null;
    vendor: string | null;
    supportedExtensions: string[] | null;
    readPixelsHash: number;
    readPixelsSample: number[];
    error?: string;
  } | null;
  formattedMonthParts: Array<{
    type: string;
    value: string;
  }>;
}> => {
  await expect(page.locator("#worker-snapshot")).not.toHaveText("pending");
  const snapshot = JSON.parse(
    (await page.locator("#worker-snapshot").textContent()) ?? "{}",
  ) as {
    error?: string;
    language: string;
    languages: string[];
    locale: string;
    timeZone: string;
    temporal: {
      defaultTimeZone: string;
      explicitTimeZone: string;
      timeZoneIdSource: string;
    } | null;
    hardwareConcurrency: number;
    userAgent: string;
    appVersion: string;
    platform: string;
    vendor: string;
    userAgentData: {
      platform: string;
      mobile: boolean;
      brands: Array<{
        brand: string;
        version: string;
      }>;
    } | null;
    clientHints: {
      brands: Array<{
        brand: string;
        version: string;
      }>;
      mobile: boolean;
      platform: string;
      highEntropyValues: Record<string, unknown>;
      error?: string;
    } | null;
    webGL: {
      debugExtensionAvailable: boolean;
      renderer: string | null;
      vendor: string | null;
      supportedExtensions: string[] | null;
      readPixelsHash: number;
      readPixelsSample: number[];
      error?: string;
    } | null;
    formattedMonthParts: Array<{
      type: string;
      value: string;
    }>;
  };

  if (snapshot.error) {
    throw new Error(`Worker snapshot probe failed: ${snapshot.error}`);
  }

  return snapshot;
};

export const readSharedWorkerSnapshot = async (
  page: Page | Frame,
): Promise<{
  error?: string;
  unsupported?: boolean;
  language: string;
  languages: string[];
  locale: string;
  timeZone: string;
  hardwareConcurrency: number;
  userAgent: string;
  appVersion: string;
  platform: string;
  vendor: string;
  formattedMonthParts: Array<{
    type: string;
    value: string;
  }>;
}> => {
  await expect(page.locator("#shared-worker-snapshot")).not.toHaveText("pending");
  const snapshot = JSON.parse(
    (await page.locator("#shared-worker-snapshot").textContent()) ?? "{}",
  ) as {
    error?: string;
    unsupported?: boolean;
    language: string;
    languages: string[];
    locale: string;
    timeZone: string;
    hardwareConcurrency: number;
    userAgent: string;
    appVersion: string;
    platform: string;
    vendor: string;
    formattedMonthParts: Array<{
      type: string;
      value: string;
    }>;
  };

  if (snapshot.unsupported) {
    throw new Error("SharedWorker is unsupported in this browser context");
  }

  if (snapshot.error) {
    throw new Error(`Shared worker snapshot probe failed: ${snapshot.error}`);
  }

  return snapshot;
};

export const readHostState = async (page: Page | Frame): Promise<HostState> => {
  await expect(page.locator("#host-state")).not.toHaveText("pending");
  return JSON.parse(
    (await page.locator("#host-state").textContent()) ?? "{}",
  ) as HostState;
};

export const readFingerprintSnapshot = async (
  page: Page | Frame,
): Promise<{
  screen: {
    width: number;
    height: number;
    availWidth: number;
    availHeight: number;
    colorDepth: number;
    pixelDepth: number;
    devicePixelRatio: number;
  };
  navigator: {
    hardwareConcurrency: number;
    deviceMemory: number | null;
    platform: string;
    userAgent: string;
    vendor: string;
    appVersion: string;
  };
  canvas: {
    toDataURL: string;
    imageDataHash: number;
    imageDataSample: number[];
    error?: string;
  } | null;
  webGL: {
    debugExtensionAvailable: boolean;
    renderer: string | null;
    vendor: string | null;
    supportedExtensions: string[] | null;
    readPixelsHash: number;
    readPixelsSample: number[];
    error?: string;
  } | null;
  audio: {
    sampleRate: number;
    channelDataSample: number[];
    channelDataLength: number;
    error?: string;
  } | null;
  webRTC: {
    iceTransportPolicy: string;
    sdpOffer?: string | null;
    sdpError?: string;
    error?: string;
  } | null;
  clientHints: {
    brands: Array<{ brand: string; version: string }>;
    mobile: boolean;
    platform: string;
    highEntropyValues: Record<string, unknown>;
    error?: string;
  } | null;
  error?: string;
}> => {
  await expect(page.locator("#fingerprint-snapshot")).not.toHaveText("pending");
  const snapshot = JSON.parse(
    (await page.locator("#fingerprint-snapshot").textContent()) ?? "{}",
  ) as {
    screen: {
      width: number;
      height: number;
      availWidth: number;
      availHeight: number;
      colorDepth: number;
      pixelDepth: number;
      devicePixelRatio: number;
    };
    navigator: {
      hardwareConcurrency: number;
      deviceMemory: number | null;
      platform: string;
      userAgent: string;
      vendor: string;
      appVersion: string;
    };
    canvas: {
      toDataURL: string;
      imageDataHash: number;
      imageDataSample: number[];
      error?: string;
    } | null;
    webGL: {
      debugExtensionAvailable: boolean;
      renderer: string | null;
      vendor: string | null;
      supportedExtensions: string[] | null;
      readPixelsHash: number;
      readPixelsSample: number[];
      error?: string;
    } | null;
    audio: {
      sampleRate: number;
      channelDataSample: number[];
      channelDataLength: number;
      error?: string;
    } | null;
    webRTC: {
      iceTransportPolicy: string;
      sdpOffer?: string | null;
      sdpError?: string;
      error?: string;
    } | null;
    clientHints: {
      brands: Array<{ brand: string; version: string }>;
      mobile: boolean;
      platform: string;
      highEntropyValues: Record<string, unknown>;
      error?: string;
    } | null;
    error?: string;
  };

  if (snapshot.error) {
    throw new Error(`Fingerprint snapshot probe failed: ${snapshot.error}`);
  }

  return snapshot;
};

export const readEarlySnapshot = async (
  page: Page | Frame,
): Promise<{
  language: string;
  userAgent: string;
  timeZone: string;
  temporalTimeZone: string | null;
  webdriver: boolean;
  permission: string;
}> => {
  await expect(page.locator("#early-snapshot")).not.toHaveText("pending");
  return JSON.parse((await page.locator("#early-snapshot").textContent()) ?? "{}") as {
    language: string;
    userAgent: string;
    timeZone: string;
    temporalTimeZone: string | null;
    webdriver: boolean;
    permission: string;
  };
};

export const readEarlyGeoSnapshot = async (
  page: Page | Frame,
): Promise<{
  permission: string;
  firstPosition: {
    latitude: number;
    longitude: number;
  } | null;
  watchUpdates: Array<{
    latitude: number;
    longitude: number;
  }>;
  error: string | null;
}> => {
  await expect(page.locator("#early-geo")).not.toHaveText("pending");
  await expect
    .poll(
      async () => {
        const value = JSON.parse(
          (await page.locator("#early-geo").textContent()) ?? "{}",
        ) as {
          permission?: string;
          firstPosition?: unknown;
          watchUpdates?: unknown;
        };
        const watchUpdates = Array.isArray(value.watchUpdates)
          ? value.watchUpdates
          : [];

        return (
          value.permission !== "pending" &&
          value.firstPosition !== null &&
          watchUpdates.length >= 1
        );
      },
      {
        timeout: 10_000,
      },
    )
    .toBe(true);

  return JSON.parse((await page.locator("#early-geo").textContent()) ?? "{}") as {
    permission: string;
    firstPosition: {
      latitude: number;
      longitude: number;
    } | null;
    watchUpdates: Array<{
      latitude: number;
      longitude: number;
    }>;
    error: string | null;
  };
};

export const assignDomainProfile = async (
  context: BrowserContext,
  extensionId: string,
  serverUrl: string,
  profileLabel: string,
): Promise<void> => {
  const page = await context.newPage();
  await page.goto(getProbeHostUrl(serverUrl));

  const popupPage = await openPopupWithDefaults(context, extensionId, page);
  const currentProfile = popupPage.locator("#current-profile");
  const currentRule = popupPage.locator("#current-rule");

  if ((await currentProfile.count()) > 0) {
    const currentProfileText = (await currentProfile.textContent())?.trim();
    const presentation = await currentRule.getAttribute("data-presentation");
    if (
      currentProfileText?.includes(profileLabel) &&
      presentation?.startsWith("rule-")
    ) {
      await popupPage.close();
      await page.close();
      return;
    }
  }

  await expect(
    popupPage.locator("#open-rule-settings, #open-domain-rule-settings").first(),
  ).toBeEnabled({
    timeout: 10_000,
  });
  const domainRuleButton = popupPage.locator("#open-domain-rule-settings");
  if ((await domainRuleButton.count()) > 0) {
    await domainRuleButton.click();
  } else {
    await popupPage.locator("#open-rule-settings").click();
  }
  await selectPopupOption(popupPage, "#current-profile-select", profileLabel);
  const navPromise = page
    .waitForNavigation({ waitUntil: "domcontentloaded" })
    .catch(() => {});
  await popupPage
    .locator("#apply-current-profile")
    .evaluate((node) => (node as HTMLElement).click());
  await navPromise;
  await expect(popupPage.locator("#current-profile")).toContainText(profileLabel);
  await expect(popupPage.locator("#current-rule")).toHaveAttribute(
    "data-presentation",
    /^rule-/,
  );

  await popupPage.close();
  await page.close();
};

export const assignCurrentPageProfile = async (
  context: BrowserContext,
  extensionId: string,
  profileLabel: string,
  targetPage?: Page,
): Promise<void> => {
  const popupPage = await openPopupWithDefaults(context, extensionId, targetPage);
  const currentProfile = popupPage.locator("#current-profile");
  const currentRule = popupPage.locator("#current-rule");

  if ((await currentProfile.count()) > 0) {
    const currentProfileText = (await currentProfile.textContent())?.trim();
    const presentation = await currentRule.getAttribute("data-presentation");
    if (
      currentProfileText?.includes(profileLabel) &&
      presentation?.startsWith("rule-")
    ) {
      if (targetPage) {
        await targetPage.reload({ waitUntil: "domcontentloaded" });
      }
      await popupPage.close();
      return;
    }
  }

  await expect(
    popupPage.locator("#open-rule-settings, #open-domain-rule-settings").first(),
  ).toBeEnabled({
    timeout: 10_000,
  });
  const domainRuleButton = popupPage.locator("#open-domain-rule-settings");
  if ((await domainRuleButton.count()) > 0) {
    await domainRuleButton.click();
  } else {
    await popupPage.locator("#open-rule-settings").click();
  }
  await selectPopupOption(popupPage, "#current-profile-select", profileLabel);

  if (targetPage) {
    const navPromise = targetPage
      .waitForNavigation({ waitUntil: "domcontentloaded" })
      .catch(() => {});
    await popupPage
      .locator("#apply-current-profile")
      .evaluate((node) => (node as HTMLElement).click());
    await navPromise;
  } else {
    await popupPage.locator("#apply-current-profile").click();
  }

  await expect(popupPage.locator("#current-profile")).toContainText(profileLabel);
  await expect(popupPage.locator("#current-rule")).toHaveAttribute(
    "data-presentation",
    /^rule-/,
  );
  await popupPage.close();
};

const bringActivePageToFront = async (
  context: BrowserContext,
  popupPage: Page,
  activePage?: Page,
): Promise<void> => {
  if (activePage) {
    await activePage.bringToFront();
    return;
  }

  const activePages = context.pages().filter((page) => page !== popupPage);
  await activePages.at(-1)?.bringToFront();
};

const waitForPopupReady = async (popupPage: Page): Promise<void> => {
  await expect(popupPage.locator("#toggle-current-rule")).toBeVisible();
  await expect(popupPage.locator("#current-rule")).toHaveAttribute(
    "data-presentation",
    /.+/,
    { timeout: 10_000 },
  );
};

export const openPopupPage = async (
  context: BrowserContext,
  extensionId: string,
  activePage?: Page,
): Promise<Page> => {
  const popupUrl = new URL(`chrome-extension://${extensionId}/src/ui/popup/index.html`);
  const popupPage = await context.newPage();
  await popupPage.goto(popupUrl.toString());
  if (activePage) {
    const targetTabId = await popupPage.evaluate(async (targetUrl) => {
      const tabs = await chrome.tabs.query({});
      return tabs
        .filter((tab) => tab.url === targetUrl && typeof tab.id === "number")
        .sort((left, right) => (right.lastAccessed ?? 0) - (left.lastAccessed ?? 0))[0]
        ?.id;
    }, activePage.url());
    if (targetTabId !== undefined) {
      popupUrl.searchParams.set("tabId", String(targetTabId));
      await popupPage.goto(popupUrl.toString());
    }
  }
  await bringActivePageToFront(context, popupPage, activePage);
  await waitForPopupReady(popupPage);
  return popupPage;
};

export const openPopupWithDefaults = async (
  context: BrowserContext,
  extensionId: string,
  activePage?: Page,
): Promise<Page> => {
  const popupPage = await openPopupPage(context, extensionId, activePage);
  const seeded = await ensurePopupLocsAvailable(popupPage);
  if (seeded) {
    await popupPage.reload();
    await bringActivePageToFront(context, popupPage, activePage);
    await waitForPopupReady(popupPage);
  }
  return popupPage;
};

export const ensurePopupLocsAvailable = async (
  page: Page | Frame,
): Promise<boolean> => {
  const settings = await readSettings(page);

  if (!settings.ok || settings.locations.length > 0) {
    return false;
  }

  await saveLocationModel(page, {
    locations: EXAMPLE_LOCATIONS,
    rules: settings.rules,
    containerAssignments: settings.containerAssignments ?? [],
  });

  return true;
};

/** Export the current settings payload through the background command contract. */
export const exportSettings = async <Settings>(
  page: Page | Frame,
): Promise<Settings> => {
  const response = (await page.evaluate(
    async (commandType) => chrome.runtime.sendMessage({ type: commandType }),
    EXTENSION_COMMAND_TYPES.exportSettings,
  )) as { ok?: boolean; settings?: Settings; error?: string };

  if (!response?.ok || response.settings === undefined) {
    throw new Error(response?.error ?? "Exporting settings failed.");
  }

  return response.settings;
};

/** Read popup control state through the shared command contract. */
export const getPopupState = async <State>(page: Page | Frame): Promise<State> => {
  const response = (await page.evaluate(
    async (commandType) => chrome.runtime.sendMessage({ type: commandType }),
    EXTENSION_COMMAND_TYPES.getPopupState,
  )) as { ok?: boolean; state?: State; error?: string };

  if (!response?.ok || response.state === undefined) {
    throw new Error(response?.error ?? "Loading popup state failed.");
  }

  return response.state;
};

/** Trigger domain cleanup through the shared background command contract. */
export const cleanupDomainState = async (
  page: Page | Frame,
  hostname: string,
): Promise<{ cleanedOrigins?: string[] }> => {
  const response = (await page.evaluate(
    async ({ commandType, cleanupHostname }) =>
      chrome.runtime.sendMessage({
        type: commandType,
        hostname: cleanupHostname,
      }),
    {
      commandType: EXTENSION_COMMAND_TYPES.cleanupDomainState,
      cleanupHostname: hostname,
    },
  )) as { ok?: boolean; cleanedOrigins?: string[]; error?: string };

  if (!response?.ok) {
    throw new Error(response?.error ?? "Cleaning domain state failed.");
  }

  return response;
};

export const expectRuleSheetClosed = async (popupPage: Page): Promise<void> => {
  await expect(popupPage.locator("#current-profile-select")).toBeHidden();
  await expect(popupPage.locator("#close-rule-settings")).toBeHidden();
};

/**
 * Import settings into the extension via background message.
 *
 * The `settings` parameter type is an intentional subset of `ExportedSettings`
 * tailored for E2E tests: it adds test-only fields (`cookieStoreId` on rules
 * for Firefox containers). The background worker still validates every payload
 * at runtime.
 */
type E2EImportedSettings = Omit<ExportedSettings, "rules"> & {
  rules: Array<DomainRule & { cookieStoreId?: string }>;
};

export const importSettings = async (
  page: Page,
  settings: E2EImportedSettings,
): Promise<void> => {
  const imported = await page.evaluate(
    async ({ commandType, payload }) => {
      return (await chrome.runtime.sendMessage({
        type: commandType,
        settings: payload,
      })) as { ok: boolean; error?: string };
    },
    {
      commandType: EXTENSION_COMMAND_TYPES.importSettings,
      payload: settings,
    },
  );

  expect(imported.ok).toBe(true);
};
