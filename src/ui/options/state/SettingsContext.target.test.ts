// @vitest-environment jsdom

import { act, createElement, type FormEvent } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  BETA_BRAND_DISPLAY_NAME,
  STABLE_DISPLAY_NAME,
} from "../../../../scripts/brand-config.mjs";

import { EXTENSION_COMMAND_TYPES } from "@/shared/extension-contract";
import type {
  DomainRule,
  LocationDraftResponse,
  ExtensionCommand,
  GetControlStateResponse,
  GetSettingsResponse,
  SaveLocationResponse,
  SaveSettingsResponse,
} from "@/shared/types";
import { AUTOSAVE_DELAY_MS, LOAD_RETRY_DELAY_MS } from "@/ui/options/constants";
import {
  SettingsProvider,
  resolveReleaseChannel,
  useSettings,
} from "@/ui/options/state/SettingsContext";

const baseControlResponse: GetControlStateResponse = {
  ok: true,
  state: {
    panicMode: false,
  },
};

const baseSettingsResponse: GetSettingsResponse = {
  ok: true,
  locations: [],
  rules: [],
  trustedSites: [],
  themeMode: "system",
  themeAccentPreset: "teal",
  reduceMotion: false,
  debugMode: false,
  watchPositionDelay: [60, 500],
  osmConsent: "unknown",
  browserFingerprintSpoofingEnabled: false,
  sharedWorkerHandlingMode: "native",
  sharedWorkerCompatibilityMode: true,
  sharedSpoofing: undefined,
  globalFallbackRule: undefined,
  containerAssignments: [],
  highContrastMode: false,
  defaultNoiseRadius: 50,
  randomizeGeneratedLocationByDefault: true,
  generatedLocationRandomizationRadiusKm: 10,
  showBadgeQueryCount: true,
  includeDateCallsInBadgeCount: true,
  notice: null,
};

const baseSaveResponse = {
  ok: true,
  themeMode: "system",
  themeAccentPreset: "teal",
  reduceMotion: false,
  debugMode: false,
  watchPositionDelay: [60, 500],
  osmConsent: "unknown",
  browserFingerprintSpoofingEnabled: true,
  sharedWorkerHandlingMode: "native",
  sharedWorkerCompatibilityMode: true,
  sharedSpoofing: undefined,
  globalFallbackRule: undefined,
  trustedSites: [],
  highContrastMode: false,
  defaultNoiseRadius: 50,
  randomizeGeneratedLocationByDefault: true,
  generatedLocationRandomizationRadiusKm: 10,
  showBadgeQueryCount: true,
  includeDateCallsInBadgeCount: true,
} satisfies Extract<SaveSettingsResponse, { ok: true }>;

const createDeferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });

  return { promise, resolve };
};

const flushEffects = async (): Promise<void> => {
  await act(async () => {
    await Promise.resolve();
  });
};

const TestHarness = () => {
  const {
    settingsLoaded,
    browserFingerprintSpoofingEnabled: isFingerprintSpoofingOn,
    themeMode,
    themeAccentPreset,
    profiles,
    rules,
    profileDialogOpened,
    editingProfileIndex,
    ruleDialogOpened,
    ruleDialogMode,
    editingRulePattern,
    fallbackLocationId,
    generatorStep,
    searchCandidates,
    selectedCandidateId,
    shouldRandomize,
    confirmDialogOpen,
    confirmDialogConfig,
    handleAddProfile,
    handlePersistProfile,
    setSearchQuery,
    setShouldRandomize,
    setSelectedCandidateId,
    setPendingDraft,
    runGenerator,
    selectCandidate,
    saveGenerator,
    openRuleDialog,
    closeRuleDialog,
    openFallbackDialog,
    setRules,
    setRulePattern,
    handleRuleSubmit,
    resolveConfirmDialog,
    setThemeAccentPreset,
    setFingerprintSpoofing,
    sharedSpoofing,
    scheduleAutosave,
  } = useSettings();
  const editableRule: DomainRule = {
    pattern: "example.com",
    locationId: "warsaw",
    enabled: false,
  };

  return createElement(
    "div",
    null,
    createElement(
      "div",
      { id: "settings-loaded" },
      settingsLoaded ? "loaded" : "loading",
    ),
    createElement(
      "div",
      { id: "browser-fingerprint-spoofing" },
      isFingerprintSpoofingOn ? "on" : "off",
    ),
    createElement("div", { id: "theme-mode" }, themeMode),
    createElement("div", { id: "theme-accent-preset" }, themeAccentPreset),
    createElement("div", { id: "profiles-count" }, String(profiles.length)),
    createElement("div", { id: "rules-count" }, String(rules.length)),
    createElement(
      "div",
      { id: "shared-spoofing" },
      JSON.stringify(sharedSpoofing ?? null),
    ),
    createElement(
      "div",
      { id: "rule-patterns" },
      rules.map((rule) => rule.pattern).join(","),
    ),
    createElement(
      "div",
      { id: "profile-dialog-opened" },
      profileDialogOpened ? "open" : "closed",
    ),
    createElement(
      "div",
      { id: "editing-profile-index" },
      editingProfileIndex === null ? "" : String(editingProfileIndex),
    ),
    createElement(
      "div",
      { id: "rule-dialog-opened" },
      ruleDialogOpened ? "open" : "closed",
    ),
    createElement("div", { id: "rule-dialog-mode" }, ruleDialogMode),
    createElement("div", { id: "editing-rule-pattern" }, editingRulePattern ?? ""),
    createElement("div", { id: "global-fallback-draft-location" }, fallbackLocationId),
    createElement("div", { id: "profile-generator-step" }, generatorStep),
    createElement(
      "div",
      { id: "profile-search-candidates-count" },
      String(searchCandidates.length),
    ),
    createElement(
      "div",
      { id: "selected-profile-search-candidate" },
      selectedCandidateId,
    ),
    createElement(
      "div",
      { id: "randomize-generated-location" },
      shouldRandomize ? "true" : "false",
    ),
    createElement(
      "div",
      { id: "confirm-dialog-opened" },
      confirmDialogOpen ? "open" : "closed",
    ),
    createElement(
      "div",
      { id: "confirm-dialog-title" },
      confirmDialogConfig?.title ?? "",
    ),
    createElement(
      "div",
      { id: "confirm-dialog-confirm-label" },
      confirmDialogConfig?.confirmLabel ?? "",
    ),
    createElement(
      "div",
      { id: "confirm-dialog-cancel-label" },
      confirmDialogConfig?.cancelLabel ?? "",
    ),
    createElement(
      "button",
      {
        id: "fingerprint-toggle",
        onClick: () => {
          setFingerprintSpoofing(true);
          scheduleAutosave({
            browserFingerprintSpoofingEnabled: true,
          });
        },
      },
      "toggle",
    ),
    createElement(
      "button",
      {
        id: "fingerprint-toggle-off",
        onClick: () => {
          setFingerprintSpoofing(false);
          scheduleAutosave({
            browserFingerprintSpoofingEnabled: false,
          });
        },
      },
      "toggle off",
    ),
    createElement(
      "button",
      {
        id: "theme-accent-blue",
        onClick: () => {
          setThemeAccentPreset("blue");
          scheduleAutosave({
            themeAccentPreset: "blue",
          });
        },
      },
      "theme accent blue",
    ),
    createElement(
      "button",
      {
        id: "add-profile",
        onClick: () => {
          void handleAddProfile();
        },
      },
      "add profile",
    ),
    createElement(
      "button",
      {
        id: "save-new-profile",
        onClick: () => {
          void handlePersistProfile(null, {
            id: "",
            label: "Berlin",
            latitude: 52.52,
            longitude: 13.405,
            accuracy: 25,
            noiseRadius: 50,
            language: "de-DE",
            languages: ["de-DE", "de"],
            timeZone: "Europe/Berlin",
          });
        },
      },
      "save new profile",
    ),
    createElement(
      "button",
      {
        id: "set-generator-query-warsaw",
        onClick: () => {
          setSearchQuery("Warsaw");
        },
      },
      "set generator query",
    ),
    createElement(
      "button",
      {
        id: "disable-generator-randomization",
        onClick: () => {
          setShouldRandomize(false);
        },
      },
      "disable generator randomization",
    ),
    createElement(
      "button",
      {
        id: "run-profile-generator",
        onClick: () => {
          void runGenerator({
            preventDefault: vi.fn(),
          } as unknown as FormEvent<HTMLFormElement>);
        },
      },
      "run generator",
    ),
    createElement(
      "button",
      {
        id: "select-first-search-candidate",
        onClick: () => {
          const firstCandidate = searchCandidates[0];
          if (firstCandidate) {
            setSelectedCandidateId(firstCandidate.id);
          }
        },
      },
      "select first candidate",
    ),
    createElement(
      "button",
      {
        id: "continue-search-candidate",
        onClick: () => {
          void selectCandidate();
        },
      },
      "continue candidate",
    ),
    createElement(
      "button",
      {
        id: "seed-generator-profile",
        onClick: () => {
          setPendingDraft({
            id: "draft-berlin",
            label: "Berlin",
            latitude: 52.52,
            longitude: 13.405,
            accuracy: 25,
            noiseRadius: 50,
            language: "de-DE",
            languages: ["de-DE", "de"],
            timeZone: "Europe/Berlin",
            sourceLabel: "Berlin, Germany",
            languageSelection: {
              options: [],
              selectedValue: "de-DE",
              required: false,
            },
          });
        },
      },
      "seed generator profile",
    ),
    createElement(
      "button",
      {
        id: "save-generator-profile",
        onClick: () => {
          void saveGenerator();
        },
      },
      "save generator profile",
    ),
    createElement(
      "button",
      {
        id: "open-edit-rule",
        onClick: () => {
          openRuleDialog(editableRule);
        },
      },
      "open edit rule",
    ),
    createElement(
      "button",
      {
        id: "open-add-rule",
        onClick: () => {
          openRuleDialog();
        },
      },
      "open add rule",
    ),
    createElement(
      "button",
      {
        id: "close-rule",
        onClick: () => {
          closeRuleDialog();
        },
      },
      "close rule",
    ),
    createElement(
      "button",
      {
        id: "seed-existing-rule",
        onClick: () => {
          setRules([editableRule]);
        },
      },
      "seed existing rule",
    ),
    createElement(
      "button",
      {
        id: "set-duplicate-rule-pattern",
        onClick: () => {
          setRulePattern("example.com");
        },
      },
      "set duplicate rule pattern",
    ),
    createElement(
      "button",
      {
        id: "set-unique-rule-pattern",
        onClick: () => {
          setRulePattern("new.example.com");
        },
      },
      "set unique rule pattern",
    ),
    createElement(
      "button",
      {
        id: "submit-rule",
        onClick: () => {
          void handleRuleSubmit({
            preventDefault() {},
          } as FormEvent<HTMLFormElement>);
        },
      },
      "submit rule",
    ),
    createElement(
      "button",
      {
        id: "confirm-dialog-yes",
        onClick: () => {
          resolveConfirmDialog(true);
        },
      },
      "confirm dialog yes",
    ),
    createElement(
      "button",
      {
        id: "confirm-dialog-no",
        onClick: () => {
          resolveConfirmDialog(false);
        },
      },
      "confirm dialog no",
    ),
    createElement(
      "button",
      {
        id: "open-default-rule",
        onClick: () => {
          openFallbackDialog();
        },
      },
      "open default rule",
    ),
  );
};

describe("resolveReleaseChannel", () => {
  it("detects the local channel from version_name", () => {
    expect(
      resolveReleaseChannel({
        name: STABLE_DISPLAY_NAME,
        version: "0.0.0",
        version_name: "0.2026.330.1845-local",
      } as chrome.runtime.Manifest),
    ).toBe("local");
  });

  it("detects the beta channel from version_name", () => {
    expect(
      resolveReleaseChannel({
        name: BETA_BRAND_DISPLAY_NAME,
        version: "0.0.0",
        version_name: "0.2026.330.1845-beta",
      } as chrome.runtime.Manifest),
    ).toBe("beta");
  });

  it("falls back to stable for release manifests", () => {
    expect(
      resolveReleaseChannel({
        name: STABLE_DISPLAY_NAME,
        version: "1.2.3",
      } as chrome.runtime.Manifest),
    ).toBe("stable");
  });
});

describe("SettingsProvider hydration", () => {
  let root: Root | null = null;

  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
      configurable: true,
      value: true,
    });
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem: vi.fn(() => null),
        setItem: vi.fn(),
        removeItem: vi.fn(),
      },
    });
  });

  afterEach(async () => {
    if (root) {
      const currentRoot = root;
      root = null;
      await act(async () => {
        currentRoot.unmount();
      });
    }

    document.body.innerHTML = "";
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("does not queue simple-settings autosave before settings finish loading", async () => {
    const deferredSettings = createDeferred<GetSettingsResponse>();
    const sendMessage = vi.fn(async (message: { type: string }) => {
      switch (message.type) {
        case EXTENSION_COMMAND_TYPES.getControlState:
          return baseControlResponse;
        case EXTENSION_COMMAND_TYPES.getSettings:
          return await deferredSettings.promise;
        case EXTENSION_COMMAND_TYPES.saveSimpleSettings:
          return baseSaveResponse;
        default:
          throw new Error(`Unexpected runtime message: ${message.type}`);
      }
    });
    const storageGet = vi.fn(async () => ({}));

    Object.defineProperty(globalThis, "chrome", {
      configurable: true,
      value: {
        runtime: {
          id: "abc",
          sendMessage,
          getManifest: vi.fn(() => ({
            version: "1.0.0",
            name: STABLE_DISPLAY_NAME,
          })),
        },
        storage: {
          local: {
            get: storageGet,
          },
        },
      },
    });

    document.body.innerHTML = '<div id="root"></div>';
    const container = document.getElementById("root");
    if (!container) {
      throw new Error("Missing test root.");
    }

    root = createRoot(container);
    await act(async () => {
      root?.render(createElement(SettingsProvider, null, createElement(TestHarness)));
    });
    await flushEffects();

    const toggleButton = document.getElementById("fingerprint-toggle");
    if (!(toggleButton instanceof HTMLButtonElement)) {
      throw new Error("Missing toggle button.");
    }

    await act(async () => {
      toggleButton.click();
      vi.advanceTimersByTime(AUTOSAVE_DELAY_MS + 10);
    });
    await flushEffects();

    expect(
      sendMessage.mock.calls.some(
        ([message]) => message?.type === EXTENSION_COMMAND_TYPES.saveSimpleSettings,
      ),
    ).toBe(false);

    deferredSettings.resolve(baseSettingsResponse);
    await flushEffects();

    expect(document.getElementById("settings-loaded")?.textContent).toBe("loaded");
    expect(storageGet).not.toHaveBeenCalled();
  });

  it("defaults browser surface protections to enabled before settings load", async () => {
    const deferredSettings = createDeferred<GetSettingsResponse>();
    const sendMessage = vi.fn(async (message: { type: string }) => {
      switch (message.type) {
        case EXTENSION_COMMAND_TYPES.getControlState:
          return baseControlResponse;
        case EXTENSION_COMMAND_TYPES.getSettings:
          return await deferredSettings.promise;
        default:
          throw new Error(`Unexpected runtime message: ${message.type}`);
      }
    });

    Object.defineProperty(globalThis, "chrome", {
      configurable: true,
      value: {
        runtime: {
          id: "abc",
          sendMessage,
          getManifest: vi.fn(() => ({
            version: "1.0.0",
            name: STABLE_DISPLAY_NAME,
          })),
        },
        storage: { local: { get: vi.fn(async () => ({})) } },
      },
    });

    document.body.innerHTML = '<div id="root"></div>';
    const container = document.getElementById("root");
    if (!container) {
      throw new Error("Missing test root.");
    }

    root = createRoot(container);
    await act(async () => {
      root?.render(createElement(SettingsProvider, null, createElement(TestHarness)));
    });
    await flushEffects();

    // Before the load resolves the switch must read ON, matching the
    // enabled-by-default contract, so a slow load can never show a false-negative.
    expect(document.getElementById("settings-loaded")?.textContent).toBe("loading");
    expect(document.getElementById("browser-fingerprint-spoofing")?.textContent).toBe(
      "on",
    );

    deferredSettings.resolve(baseSettingsResponse);
    await flushEffects();

    // The loaded value (false in this fixture) is then applied verbatim.
    expect(document.getElementById("settings-loaded")?.textContent).toBe("loaded");
    expect(document.getElementById("browser-fingerprint-spoofing")?.textContent).toBe(
      "off",
    );
  });

  it("retries a failed initial load without enabling autosave", async () => {
    let settingsAttempts = 0;
    const sendMessage = vi.fn(async (message: { type: string }) => {
      switch (message.type) {
        case EXTENSION_COMMAND_TYPES.getControlState:
          return baseControlResponse;
        case EXTENSION_COMMAND_TYPES.getSettings:
          settingsAttempts += 1;
          if (settingsAttempts === 1) {
            throw new Error("service worker not ready");
          }
          return baseSettingsResponse;
        case EXTENSION_COMMAND_TYPES.saveSimpleSettings:
          return baseSaveResponse;
        default:
          throw new Error(`Unexpected runtime message: ${message.type}`);
      }
    });

    Object.defineProperty(globalThis, "chrome", {
      configurable: true,
      value: {
        runtime: {
          id: "abc",
          sendMessage,
          getManifest: vi.fn(() => ({
            version: "1.0.0",
            name: STABLE_DISPLAY_NAME,
          })),
        },
        storage: { local: { get: vi.fn(async () => ({})) } },
      },
    });

    document.body.innerHTML = '<div id="root"></div>';
    const container = document.getElementById("root");
    if (!container) {
      throw new Error("Missing test root.");
    }

    root = createRoot(container);
    await act(async () => {
      root?.render(createElement(SettingsProvider, null, createElement(TestHarness)));
    });
    await flushEffects();

    // First load rejected: stay unloaded (autosave disabled) and keep the
    // enabled-by-default switch, never persisting default state over storage.
    expect(document.getElementById("settings-loaded")?.textContent).toBe("loading");
    expect(document.getElementById("browser-fingerprint-spoofing")?.textContent).toBe(
      "on",
    );

    await act(async () => {
      vi.advanceTimersByTime(LOAD_RETRY_DELAY_MS + 10);
    });
    await flushEffects();

    expect(document.getElementById("settings-loaded")?.textContent).toBe("loaded");
    expect(
      sendMessage.mock.calls.some(
        ([message]) => message?.type === EXTENSION_COMMAND_TYPES.saveSimpleSettings,
      ),
    ).toBe(false);
  });

  it("uses the background-owned theme state during initial load", async () => {
    const sendMessage = vi.fn(async (message: { type: string }) => {
      switch (message.type) {
        case EXTENSION_COMMAND_TYPES.getControlState:
          return baseControlResponse;
        case EXTENSION_COMMAND_TYPES.getSettings:
          return baseSettingsResponse;
        default:
          throw new Error(`Unexpected runtime message: ${message.type}`);
      }
    });

    Object.defineProperty(globalThis, "chrome", {
      configurable: true,
      value: {
        runtime: {
          id: "abc",
          sendMessage,
          getManifest: vi.fn(() => ({
            version: "1.0.0",
            name: STABLE_DISPLAY_NAME,
          })),
        },
        storage: {
          local: {
            get: vi.fn(async () => ({
              themeMode: "light",
              themeAccentPreset: "blue",
              highContrastMode: true,
            })),
          },
        },
      },
    });

    document.body.innerHTML = '<div id="root"></div>';
    const container = document.getElementById("root");
    if (!container) {
      throw new Error("Missing test root.");
    }

    root = createRoot(container);
    await act(async () => {
      root?.render(createElement(SettingsProvider, null, createElement(TestHarness)));
    });
    await flushEffects();

    expect(document.getElementById("settings-loaded")?.textContent).toBe("loaded");
    expect(document.getElementById("theme-mode")?.textContent).toBe("system");
  });

  it("keeps shared spoofing state when disabling browser surface protections and the response omits that field", async () => {
    const initialSharedSpoofing = {
      canvas: false,
      navigator: true,
    };
    const sendMessage = vi.fn(async (message: ExtensionCommand) => {
      switch (message.type) {
        case EXTENSION_COMMAND_TYPES.getControlState:
          return baseControlResponse;
        case EXTENSION_COMMAND_TYPES.getSettings:
          return {
            ...baseSettingsResponse,
            browserFingerprintSpoofingEnabled: true,
            sharedSpoofing: initialSharedSpoofing,
          };
        case EXTENSION_COMMAND_TYPES.saveSimpleSettings:
          return {
            ok: true,
            themeMode: baseSaveResponse.themeMode,
            themeAccentPreset: baseSaveResponse.themeAccentPreset,
            reduceMotion: baseSaveResponse.reduceMotion,
            debugMode: baseSaveResponse.debugMode,
            watchPositionDelay: baseSaveResponse.watchPositionDelay,
            osmConsent: baseSaveResponse.osmConsent,
            browserFingerprintSpoofingEnabled: false,
            sharedWorkerHandlingMode: baseSaveResponse.sharedWorkerHandlingMode,
            sharedWorkerCompatibilityMode:
              baseSaveResponse.sharedWorkerCompatibilityMode,
            trustedSites: baseSaveResponse.trustedSites,
            highContrastMode: baseSaveResponse.highContrastMode,
            defaultNoiseRadius: baseSaveResponse.defaultNoiseRadius,
            randomizeGeneratedLocationByDefault:
              baseSaveResponse.randomizeGeneratedLocationByDefault,
            generatedLocationRandomizationRadiusKm:
              baseSaveResponse.generatedLocationRandomizationRadiusKm,
            showBadgeQueryCount: baseSaveResponse.showBadgeQueryCount,
            includeDateCallsInBadgeCount: baseSaveResponse.includeDateCallsInBadgeCount,
          };
        default:
          throw new Error(`Unexpected runtime message: ${message.type}`);
      }
    });

    Object.defineProperty(globalThis, "chrome", {
      configurable: true,
      value: {
        runtime: {
          id: "abc",
          sendMessage,
          getManifest: vi.fn(() => ({
            version: "1.0.0",
            name: STABLE_DISPLAY_NAME,
          })),
        },
        storage: {
          local: {
            get: vi.fn(async () => ({})),
          },
        },
      },
    });

    document.body.innerHTML = '<div id="root"></div>';
    const container = document.getElementById("root");
    if (!container) {
      throw new Error("Missing test root.");
    }

    root = createRoot(container);
    await act(async () => {
      root?.render(createElement(SettingsProvider, null, createElement(TestHarness)));
    });
    await flushEffects();

    const toggleButton = document.getElementById("fingerprint-toggle-off");
    if (!(toggleButton instanceof HTMLButtonElement)) {
      throw new Error("Missing toggle-off button.");
    }

    await act(async () => {
      toggleButton.click();
      vi.advanceTimersByTime(AUTOSAVE_DELAY_MS + 10);
    });
    await flushEffects();

    expect(
      sendMessage.mock.calls.find(
        ([message]) => message?.type === EXTENSION_COMMAND_TYPES.saveSimpleSettings,
      )?.[0],
    ).toEqual(
      expect.objectContaining({
        type: EXTENSION_COMMAND_TYPES.saveSimpleSettings,
        browserFingerprintSpoofingEnabled: false,
        sharedSpoofing: initialSharedSpoofing,
      }),
    );
    expect(document.getElementById("shared-spoofing")?.textContent).toBe(
      JSON.stringify(initialSharedSpoofing),
    );
  });

  it("uses a pending override for theme accent preset autosave", async () => {
    const sendMessage = vi.fn(async (message: ExtensionCommand) => {
      switch (message.type) {
        case EXTENSION_COMMAND_TYPES.getControlState:
          return baseControlResponse;
        case EXTENSION_COMMAND_TYPES.getSettings:
          return baseSettingsResponse;
        case EXTENSION_COMMAND_TYPES.saveSimpleSettings:
          return {
            ...baseSaveResponse,
            themeAccentPreset: message.themeAccentPreset,
          };
        default:
          throw new Error(`Unexpected runtime message: ${message.type}`);
      }
    });

    Object.defineProperty(globalThis, "chrome", {
      configurable: true,
      value: {
        runtime: {
          id: "abc",
          sendMessage,
          getManifest: vi.fn(() => ({
            version: "1.0.0",
            name: STABLE_DISPLAY_NAME,
          })),
        },
        storage: {
          local: {
            get: vi.fn(async () => ({})),
          },
        },
      },
    });

    document.body.innerHTML = '<div id="root"></div>';
    const container = document.getElementById("root");
    if (!container) {
      throw new Error("Missing test root.");
    }

    root = createRoot(container);
    await act(async () => {
      root?.render(createElement(SettingsProvider, null, createElement(TestHarness)));
    });
    await flushEffects();

    const accentButton = document.getElementById("theme-accent-blue");
    if (!(accentButton instanceof HTMLButtonElement)) {
      throw new Error("Missing theme accent button.");
    }

    await act(async () => {
      accentButton.click();
      vi.advanceTimersByTime(AUTOSAVE_DELAY_MS + 10);
    });
    await flushEffects();

    expect(
      sendMessage.mock.calls.find(
        ([message]) => message?.type === EXTENSION_COMMAND_TYPES.saveSimpleSettings,
      )?.[0],
    ).toEqual(
      expect.objectContaining({
        type: EXTENSION_COMMAND_TYPES.saveSimpleSettings,
        themeAccentPreset: "blue",
      }),
    );
    expect(document.getElementById("theme-accent-preset")?.textContent).toBe("blue");
  });

  it("keeps edit rule dialog state while closing so animated content does not collapse", async () => {
    const sendMessage = vi.fn(async (message: { type: string }) => {
      switch (message.type) {
        case EXTENSION_COMMAND_TYPES.getControlState:
          return baseControlResponse;
        case EXTENSION_COMMAND_TYPES.getSettings:
          return baseSettingsResponse;
        default:
          throw new Error(`Unexpected runtime message: ${message.type}`);
      }
    });

    Object.defineProperty(globalThis, "chrome", {
      configurable: true,
      value: {
        runtime: {
          id: "abc",
          sendMessage,
          getManifest: vi.fn(() => ({
            version: "1.0.0",
            name: STABLE_DISPLAY_NAME,
          })),
        },
        storage: {
          local: {
            get: vi.fn(async () => ({})),
          },
        },
      },
    });

    document.body.innerHTML = '<div id="root"></div>';
    const container = document.getElementById("root");
    if (!container) {
      throw new Error("Missing test root.");
    }

    root = createRoot(container);
    await act(async () => {
      root?.render(createElement(SettingsProvider, null, createElement(TestHarness)));
    });
    await flushEffects();

    const openButton = document.getElementById("open-edit-rule");
    const closeButton = document.getElementById("close-rule");
    if (
      !(openButton instanceof HTMLButtonElement) ||
      !(closeButton instanceof HTMLButtonElement)
    ) {
      throw new Error("Missing rule dialog buttons.");
    }

    await act(async () => {
      openButton.click();
    });
    await flushEffects();

    expect(document.getElementById("rule-dialog-opened")?.textContent).toBe("open");
    expect(document.getElementById("rule-dialog-mode")?.textContent).toBe("edit");
    expect(document.getElementById("editing-rule-pattern")?.textContent).toBe(
      "example.com",
    );

    await act(async () => {
      closeButton.click();
    });
    await flushEffects();

    expect(document.getElementById("rule-dialog-opened")?.textContent).toBe("closed");
    expect(document.getElementById("rule-dialog-mode")?.textContent).toBe("edit");
    expect(document.getElementById("editing-rule-pattern")?.textContent).toBe(
      "example.com",
    );
  });

  it("does not preselect a preset for an unsaved Default Rule draft", async () => {
    const sendMessage = vi.fn(async (message: { type: string }) => {
      switch (message.type) {
        case EXTENSION_COMMAND_TYPES.getControlState:
          return baseControlResponse;
        case EXTENSION_COMMAND_TYPES.getSettings:
          return {
            ...baseSettingsResponse,
            locations: [
              {
                id: "warsaw",
                label: "Warsaw",
                latitude: 52.2297,
                longitude: 21.0122,
                accuracy: 25,
                noiseRadius: 50,
                language: "pl-PL",
                languages: ["pl-PL", "pl"],
                timeZone: "Europe/Warsaw",
              },
            ],
          } satisfies GetSettingsResponse;
        default:
          throw new Error(`Unexpected runtime message: ${message.type}`);
      }
    });

    Object.defineProperty(globalThis, "chrome", {
      configurable: true,
      value: {
        runtime: {
          id: "abc",
          sendMessage,
          getManifest: vi.fn(() => ({
            version: "1.0.0",
            name: STABLE_DISPLAY_NAME,
          })),
        },
        storage: {
          local: {
            get: vi.fn(async () => ({})),
          },
        },
      },
    });

    document.body.innerHTML = '<div id="root"></div>';
    const container = document.getElementById("root");
    if (!container) {
      throw new Error("Missing test root.");
    }

    root = createRoot(container);
    await act(async () => {
      root?.render(createElement(SettingsProvider, null, createElement(TestHarness)));
    });
    await flushEffects();

    expect(document.getElementById("settings-loaded")?.textContent).toBe("loaded");
    expect(document.getElementById("global-fallback-draft-location")?.textContent).toBe(
      "",
    );

    const openButton = document.getElementById("open-default-rule");
    if (!(openButton instanceof HTMLButtonElement)) {
      throw new Error("Missing default rule button.");
    }

    await act(async () => {
      openButton.click();
    });
    await flushEffects();

    expect(document.getElementById("global-fallback-draft-location")?.textContent).toBe(
      "",
    );
  });

  it("opens a manual location as an unsaved draft without persisting immediately", async () => {
    const sendMessage = vi.fn(async (message: { type: string }) => {
      switch (message.type) {
        case EXTENSION_COMMAND_TYPES.getControlState:
          return baseControlResponse;
        case EXTENSION_COMMAND_TYPES.getSettings:
          return baseSettingsResponse;
        case EXTENSION_COMMAND_TYPES.saveLocationModel:
          throw new Error("saveLocationModel should not run before Save.");
        default:
          throw new Error(`Unexpected runtime message: ${message.type}`);
      }
    });

    Object.defineProperty(globalThis, "chrome", {
      configurable: true,
      value: {
        runtime: {
          id: "abc",
          sendMessage,
          getManifest: vi.fn(() => ({
            version: "1.0.0",
            name: STABLE_DISPLAY_NAME,
          })),
        },
        storage: {
          local: {
            get: vi.fn(async () => ({})),
          },
        },
      },
    });

    document.body.innerHTML = '<div id="root"></div>';
    const container = document.getElementById("root");
    if (!container) {
      throw new Error("Missing test root.");
    }

    root = createRoot(container);
    await act(async () => {
      root?.render(createElement(SettingsProvider, null, createElement(TestHarness)));
    });
    await flushEffects();

    const addButton = document.getElementById("add-profile");
    if (!(addButton instanceof HTMLButtonElement)) {
      throw new Error("Missing add profile button.");
    }

    await act(async () => {
      addButton.click();
    });
    await flushEffects();

    expect(document.getElementById("profiles-count")?.textContent).toBe("0");
    expect(document.getElementById("profile-dialog-opened")?.textContent).toBe("open");
    expect(document.getElementById("editing-profile-index")?.textContent).toBe("");
    expect(
      sendMessage.mock.calls.some(
        ([message]) => message?.type === EXTENSION_COMMAND_TYPES.saveLocationModel,
      ),
    ).toBe(false);
  });

  it("routes generated locations through candidate selection without persisting ephemeral state", async () => {
    const sendMessage = vi.fn(async (message: ExtensionCommand) => {
      switch (message.type) {
        case EXTENSION_COMMAND_TYPES.getControlState:
          return baseControlResponse;
        case EXTENSION_COMMAND_TYPES.getSettings:
          return {
            ...baseSettingsResponse,
            osmConsent: "granted",
          } satisfies GetSettingsResponse;
        case EXTENSION_COMMAND_TYPES.createLocationDraft:
          return {
            ok: true,
            candidates: [
              {
                id: "warsaw-pl",
                label: "Warsaw, Poland",
                description: "Warsaw, Masovian Voivodeship, Poland",
                sourceLabel: "Warsaw, Masovian Voivodeship, Poland",
                latitude: 52.2297,
                longitude: 21.0122,
                address: {
                  city: "Warsaw",
                  country: "Poland",
                  country_code: "pl",
                },
              },
              {
                id: "warsaw-us",
                label: "Warsaw, United States",
                description: "Warsaw, Nebraska, United States",
                sourceLabel: "Warsaw, Nebraska, United States",
                latitude: 41.2995,
                longitude: -96.2801,
                address: {
                  village: "Warsaw",
                  country: "United States",
                  country_code: "us",
                },
              },
            ],
          } satisfies LocationDraftResponse;
        case EXTENSION_COMMAND_TYPES.createDraftFromCandidate:
          return {
            ok: true,
            location: {
              id: "warsaw-poland",
              label: "Warsaw, Poland",
              latitude: 52.2297,
              longitude: 21.0122,
              accuracy: 25,
              noiseRadius: 50,
              language: "pl-PL",
              languages: ["pl-PL", "pl"],
              timeZone: "Europe/Warsaw",
              sourceLabel: "Warsaw, Masovian Voivodeship, Poland",
              languageSelection: {
                options: [
                  {
                    value: "pl-PL",
                    label: "Polish [pl-PL]",
                    language: "pl-PL",
                    languages: ["pl-PL", "pl"],
                  },
                ],
                selectedValue: "pl-PL",
                required: false,
              },
            },
          } satisfies LocationDraftResponse;
        case EXTENSION_COMMAND_TYPES.saveLocationModel:
          return {
            ok: true,
            locations: message.locations,
            rules: message.rules,
            ...(message.containerAssignments
              ? { containerAssignments: message.containerAssignments }
              : {}),
          } satisfies SaveLocationResponse;
        default:
          throw new Error(`Unexpected runtime message: ${message.type}`);
      }
    });

    Object.defineProperty(globalThis, "chrome", {
      configurable: true,
      value: {
        runtime: {
          id: "abc",
          sendMessage,
          getManifest: vi.fn(() => ({
            version: "1.0.0",
            name: STABLE_DISPLAY_NAME,
          })),
        },
        storage: {
          local: {
            get: vi.fn(async () => ({})),
          },
        },
      },
    });

    document.body.innerHTML = '<div id="root"></div>';
    const container = document.getElementById("root");
    if (!container) {
      throw new Error("Missing test root.");
    }

    root = createRoot(container);
    await act(async () => {
      root?.render(createElement(SettingsProvider, null, createElement(TestHarness)));
    });
    await flushEffects();

    await act(async () => {
      document.getElementById("set-generator-query-warsaw")?.click();
    });
    await flushEffects();

    await act(async () => {
      document.getElementById("run-profile-generator")?.click();
    });
    await flushEffects();

    expect(document.getElementById("profile-generator-step")?.textContent).toBe(
      "result",
    );
    expect(
      document.getElementById("profile-search-candidates-count")?.textContent,
    ).toBe("2");
    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: EXTENSION_COMMAND_TYPES.createLocationDraft,
        query: "Warsaw",
        randomizeWithinMeters: 10000,
      }),
    );

    await act(async () => {
      document.getElementById("select-first-search-candidate")?.click();
      document.getElementById("disable-generator-randomization")?.click();
    });
    await flushEffects();

    await act(async () => {
      document.getElementById("continue-search-candidate")?.click();
    });
    await flushEffects();

    expect(document.getElementById("profile-generator-step")?.textContent).toBe(
      "confirm",
    );
    expect(sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: EXTENSION_COMMAND_TYPES.createDraftFromCandidate,
        randomizeWithinMeters: false,
      }),
    );

    await act(async () => {
      document.getElementById("save-generator-profile")?.click();
    });
    await flushEffects();

    const saveCall = sendMessage.mock.calls.find(
      ([message]) => message?.type === EXTENSION_COMMAND_TYPES.saveLocationModel,
    );
    expect(saveCall?.[0]).toEqual(
      expect.objectContaining({
        type: EXTENSION_COMMAND_TYPES.saveLocationModel,
        locations: [
          expect.objectContaining({
            id: "warsaw-poland",
            label: "Warsaw, Poland",
          }),
        ],
      }),
    );
    expect(saveCall?.[0]).not.toHaveProperty("searchCandidates");
    expect(saveCall?.[0]).not.toHaveProperty("shouldRandomize");
  });

  it("asks before overriding an existing rule pattern", async () => {
    const sendMessage = vi.fn(async (message: ExtensionCommand) => {
      switch (message.type) {
        case EXTENSION_COMMAND_TYPES.getControlState:
          return baseControlResponse;
        case EXTENSION_COMMAND_TYPES.getSettings:
          return baseSettingsResponse;
        case EXTENSION_COMMAND_TYPES.saveLocationModel:
          return {
            ok: true,
            locations: message.locations,
            rules: message.rules,
            ...(message.containerAssignments
              ? { containerAssignments: message.containerAssignments }
              : {}),
          } satisfies SaveLocationResponse;
        default:
          throw new Error(`Unexpected runtime message: ${message.type}`);
      }
    });

    Object.defineProperty(globalThis, "chrome", {
      configurable: true,
      value: {
        runtime: {
          id: "abc",
          sendMessage,
          getManifest: vi.fn(() => ({
            version: "1.0.0",
            name: STABLE_DISPLAY_NAME,
          })),
        },
        storage: {
          local: {
            get: vi.fn(async () => ({})),
          },
        },
      },
    });

    document.body.innerHTML = '<div id="root"></div>';
    const container = document.getElementById("root");
    if (!container) {
      throw new Error("Missing test root.");
    }

    root = createRoot(container);
    await act(async () => {
      root?.render(createElement(SettingsProvider, null, createElement(TestHarness)));
    });
    await flushEffects();

    const seedButton = document.getElementById("seed-existing-rule");
    const openButton = document.getElementById("open-add-rule");
    const setPatternButton = document.getElementById("set-duplicate-rule-pattern");
    const submitButton = document.getElementById("submit-rule");
    const declineButton = document.getElementById("confirm-dialog-no");
    const confirmButton = document.getElementById("confirm-dialog-yes");
    if (
      !(seedButton instanceof HTMLButtonElement) ||
      !(openButton instanceof HTMLButtonElement) ||
      !(setPatternButton instanceof HTMLButtonElement) ||
      !(submitButton instanceof HTMLButtonElement) ||
      !(declineButton instanceof HTMLButtonElement) ||
      !(confirmButton instanceof HTMLButtonElement)
    ) {
      throw new Error("Missing duplicate-rule test buttons.");
    }

    await act(async () => {
      seedButton.click();
      openButton.click();
      setPatternButton.click();
    });
    await flushEffects();

    await act(async () => {
      submitButton.click();
    });
    await flushEffects();

    expect(document.getElementById("confirm-dialog-opened")?.textContent).toBe("open");
    expect(document.getElementById("confirm-dialog-title")?.textContent).toBe(
      "Overwrite existing rule?",
    );
    expect(document.getElementById("confirm-dialog-confirm-label")?.textContent).toBe(
      "Overwrite",
    );
    expect(document.getElementById("confirm-dialog-cancel-label")?.textContent).toBe(
      "No",
    );
    expect(document.getElementById("rules-count")?.textContent).toBe("1");
    expect(
      sendMessage.mock.calls.some(
        ([message]) => message?.type === EXTENSION_COMMAND_TYPES.saveLocationModel,
      ),
    ).toBe(false);

    await act(async () => {
      declineButton.click();
    });
    await flushEffects();

    expect(document.getElementById("confirm-dialog-opened")?.textContent).toBe(
      "closed",
    );
    expect(document.getElementById("rule-dialog-opened")?.textContent).toBe("open");
    expect(document.getElementById("rules-count")?.textContent).toBe("1");

    const reopenedSubmitButton = document.getElementById("submit-rule");
    if (!(reopenedSubmitButton instanceof HTMLButtonElement)) {
      throw new Error("Missing reopened duplicate-rule submit button.");
    }

    await act(async () => {
      reopenedSubmitButton.click();
    });
    await flushEffects();

    await act(async () => {
      confirmButton.click();
    });
    await flushEffects();
    await flushEffects();

    expect(document.getElementById("confirm-dialog-opened")?.textContent).toBe(
      "closed",
    );
    expect(document.getElementById("rule-dialog-opened")?.textContent).toBe("closed");
    expect(document.getElementById("rules-count")?.textContent).toBe("1");
    expect(document.getElementById("rule-patterns")?.textContent).toBe("example.com");
    expect(
      sendMessage.mock.calls.some(
        ([message]) => message?.type === EXTENSION_COMMAND_TYPES.saveLocationModel,
      ),
    ).toBe(true);
  });

  it("saves a new rule without a blank locationId", async () => {
    const sendMessage = vi.fn(async (message: ExtensionCommand) => {
      switch (message.type) {
        case EXTENSION_COMMAND_TYPES.getControlState:
          return baseControlResponse;
        case EXTENSION_COMMAND_TYPES.getSettings:
          return baseSettingsResponse;
        case EXTENSION_COMMAND_TYPES.saveLocationModel:
          return {
            ok: true,
            locations: message.locations,
            rules: message.rules,
            ...(message.containerAssignments
              ? { containerAssignments: message.containerAssignments }
              : {}),
          } satisfies SaveLocationResponse;
        default:
          throw new Error(`Unexpected runtime message: ${message.type}`);
      }
    });

    Object.defineProperty(globalThis, "chrome", {
      configurable: true,
      value: {
        runtime: {
          id: "abc",
          sendMessage,
          getManifest: vi.fn(() => ({
            version: "1.0.0",
            name: STABLE_DISPLAY_NAME,
          })),
        },
        storage: {
          local: {
            get: vi.fn(async () => ({})),
          },
        },
      },
    });

    document.body.innerHTML = '<div id="root"></div>';
    const container = document.getElementById("root");
    if (!container) {
      throw new Error("Missing test root.");
    }

    root = createRoot(container);
    await act(async () => {
      root?.render(createElement(SettingsProvider, null, createElement(TestHarness)));
    });
    await flushEffects();

    const openButton = document.getElementById("open-add-rule");
    const setPatternButton = document.getElementById("set-unique-rule-pattern");
    const submitButton = document.getElementById("submit-rule");
    if (
      !(openButton instanceof HTMLButtonElement) ||
      !(setPatternButton instanceof HTMLButtonElement) ||
      !(submitButton instanceof HTMLButtonElement)
    ) {
      throw new Error("Missing new-rule test buttons.");
    }

    await act(async () => {
      openButton.click();
      setPatternButton.click();
    });
    await flushEffects();

    await act(async () => {
      submitButton.click();
    });
    await flushEffects();

    const saveCall = sendMessage.mock.calls.find(
      ([message]) => message?.type === EXTENSION_COMMAND_TYPES.saveLocationModel,
    );
    expect(saveCall).toBeDefined();
    expect(saveCall?.[0]).toMatchObject({
      type: EXTENSION_COMMAND_TYPES.saveLocationModel,
      rules: [
        {
          pattern: "new.example.com",
          enabled: true,
        },
      ],
    });
    expect(
      (
        saveCall?.[0] as Extract<
          ExtensionCommand,
          { type: typeof EXTENSION_COMMAND_TYPES.saveLocationModel }
        >
      ).rules[0],
    ).not.toHaveProperty("locationId");
  });

  it("creates a manual location only after saving the editor draft", async () => {
    const sendMessage = vi.fn(async (message: ExtensionCommand) => {
      switch (message.type) {
        case EXTENSION_COMMAND_TYPES.getControlState:
          return baseControlResponse;
        case EXTENSION_COMMAND_TYPES.getSettings:
          return baseSettingsResponse;
        case EXTENSION_COMMAND_TYPES.saveLocationModel:
          return {
            ok: true,
            locations: message.locations,
            rules: message.rules,
            ...(message.containerAssignments
              ? { containerAssignments: message.containerAssignments }
              : {}),
          } satisfies SaveLocationResponse;
        default:
          throw new Error(`Unexpected runtime message: ${message.type}`);
      }
    });

    Object.defineProperty(globalThis, "chrome", {
      configurable: true,
      value: {
        runtime: {
          id: "abc",
          sendMessage,
          getManifest: vi.fn(() => ({
            version: "1.0.0",
            name: STABLE_DISPLAY_NAME,
          })),
        },
        storage: {
          local: {
            get: vi.fn(async () => ({})),
          },
        },
      },
    });

    document.body.innerHTML = '<div id="root"></div>';
    const container = document.getElementById("root");
    if (!container) {
      throw new Error("Missing test root.");
    }

    root = createRoot(container);
    await act(async () => {
      root?.render(createElement(SettingsProvider, null, createElement(TestHarness)));
    });
    await flushEffects();

    const saveButton = document.getElementById("save-new-profile");
    if (!(saveButton instanceof HTMLButtonElement)) {
      throw new Error("Missing save new profile button.");
    }

    await act(async () => {
      saveButton.click();
    });
    await flushEffects();

    expect(document.getElementById("profiles-count")?.textContent).toBe("1");
    expect(
      sendMessage.mock.calls.some(
        ([message]) => message?.type === EXTENSION_COMMAND_TYPES.saveLocationModel,
      ),
    ).toBe(true);
  });

  it("saves a generated location without opening the editor", async () => {
    const sendMessage = vi.fn(async (message: ExtensionCommand) => {
      switch (message.type) {
        case EXTENSION_COMMAND_TYPES.getControlState:
          return baseControlResponse;
        case EXTENSION_COMMAND_TYPES.getSettings:
          return baseSettingsResponse;
        case EXTENSION_COMMAND_TYPES.saveLocationModel:
          return {
            ok: true,
            locations: message.locations,
            rules: message.rules,
            ...(message.containerAssignments
              ? { containerAssignments: message.containerAssignments }
              : {}),
          } satisfies SaveLocationResponse;
        default:
          throw new Error(`Unexpected runtime message: ${message.type}`);
      }
    });

    Object.defineProperty(globalThis, "chrome", {
      configurable: true,
      value: {
        runtime: {
          id: "abc",
          sendMessage,
          getManifest: vi.fn(() => ({
            version: "1.0.0",
            name: STABLE_DISPLAY_NAME,
          })),
        },
        storage: {
          local: {
            get: vi.fn(async () => ({})),
          },
        },
      },
    });

    document.body.innerHTML = '<div id="root"></div>';
    const container = document.getElementById("root");
    if (!container) {
      throw new Error("Missing test root.");
    }

    root = createRoot(container);
    await act(async () => {
      root?.render(createElement(SettingsProvider, null, createElement(TestHarness)));
    });
    await flushEffects();

    const seedButton = document.getElementById("seed-generator-profile");
    const saveButton = document.getElementById("save-generator-profile");
    if (
      !(seedButton instanceof HTMLButtonElement) ||
      !(saveButton instanceof HTMLButtonElement)
    ) {
      throw new Error("Missing generator buttons.");
    }

    await act(async () => {
      seedButton.click();
    });
    await flushEffects();

    await act(async () => {
      saveButton.click();
    });
    await flushEffects();

    expect(document.getElementById("profiles-count")?.textContent).toBe("1");
    expect(document.getElementById("profile-dialog-opened")?.textContent).toBe(
      "closed",
    );
  });
});
