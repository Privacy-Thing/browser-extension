// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BUILD_BROWSER_TARGET } from "@/shared/build-flags";
import { EXTENSION_COMMAND_TYPES } from "@/shared/extension-contract";
import {
  DEFAULT_CONTAINER_ICON,
  CONTAINER_COLOR_TOKENS,
  CONTAINER_COLOR_SWATCHES,
  getContainerIconUrl,
} from "@/shared/firefox-containers";
import {
  type ContainerAssignment,
  DEFAULT_ACCENT_PRESET,
  type ContainerPresentation,
  type ExtensionCommand,
  type GetControlStateResponse,
  type GetSettingsResponse,
} from "@/shared/types";
import { observeElement } from "@/test-utils/dom";
import { flushReactEffects } from "@/test-utils/react";
import { Tabs } from "@/ui/components/ui/tabs";
import { GlobalFallbackRuleDialog } from "@/ui/options/components/modals/GlobalFallbackRuleDialog";
import { RuleDialog } from "@/ui/options/components/modals/RuleDialog";
import { ContainersTab } from "@/ui/options/components/tabs/ContainersTab";
import { RulesTab } from "@/ui/options/components/tabs/RulesTab";
import {
  PAGE_ANCHORS,
  SECTION_ANCHORS,
  SETTINGS_SUBPAGE_ANCHORS,
  SETTING_ANCHORS,
  getContainerAnchor,
  getContainerModalAnchor,
  getFallbackModalAnchor,
  getRuleModalAnchor,
} from "@/ui/options/navigation";
import { App } from "@/ui/options/options-page";
import { SettingsProvider } from "@/ui/options/state/SettingsContext";

vi.mock("@/ui/options/components/tabs/containers-auto-refresh", () => ({
  setupAutoRefresh: () => () => {},
}));

vi.mock("@/shared/container-service", () => ({
  listContainers: vi.fn(async () => ({
    available: true,
    containers: [
      {
        cookieStoreId: "firefox-container-1",
        name: "Work",
        icon: DEFAULT_CONTAINER_ICON,
        iconUrl: getContainerIconUrl(DEFAULT_CONTAINER_ICON),
        color: "orange",
        colorCode: "#f59e0b",
      },
    ],
  })),
  createContainer: vi.fn(),
  updateContainer: vi.fn(),
  removeContainer: vi.fn(),
  hydrateAssignments: vi.fn(
    (
      assignments: readonly ContainerAssignment[],
      containers: readonly ContainerPresentation[],
    ) => {
      const containersById = new Map(
        containers.map((container) => [container.cookieStoreId, container] as const),
      );
      const hydratedAssignments: Array<
        ContainerAssignment & {
          container: ContainerPresentation;
        }
      > = [];
      const orphanedAssignments: ContainerAssignment[] = [];

      for (const assignment of assignments) {
        const container = containersById.get(assignment.cookieStoreId);
        if (container) {
          hydratedAssignments.push({ ...assignment, container });
        } else {
          orphanedAssignments.push(assignment);
        }
      }

      return {
        hydratedAssignments,
        orphanedAssignments,
      };
    },
  ),
}));

const baseSettingsResponse: GetSettingsResponse = {
  ok: true,
  locations: [
    {
      id: "warsaw",
      label: "Warsaw",
      latitude: 52.2297,
      longitude: 21.0122,
      accuracy: 30,
      noiseRadius: 50,
      language: "pl-PL",
      languages: ["pl-PL", "pl"],
      timeZone: "Europe/Warsaw",
    },
  ],
  rules: [
    {
      pattern: "example.com",
      locationId: "warsaw",
      enabled: true,
    },
  ],
  trustedSites: [],
  globalFallbackRule: {
    enabled: true,
    locationId: "warsaw",
    ruleSeedKey: "seed123",
    fingerprintSurfaceOverrides: { geolocation: false },
  },
  themeMode: "system",
  themeAccentPreset: DEFAULT_ACCENT_PRESET,
  reduceMotion: false,
  debugMode: false,
  watchPositionDelay: [60, 500],
  osmConsent: "denied",
  browserFingerprintSpoofingEnabled: true,
  featureFlags: { temporalApi: false },
  sharedWorkerHandlingMode: "native",
  sharedWorkerCompatibilityMode: true,
  sharedSpoofing: undefined,
  containerAssignments: [
    { cookieStoreId: "firefox-container-1", locationId: "warsaw" },
  ],
  highContrastMode: false,
  defaultNoiseRadius: 50,
  randomizeGeneratedLocationByDefault: true,
  generatedLocationRandomizationRadiusKm: 10,
  showBadgeQueryCount: true,
  includeDateCallsInBadgeCount: true,
  notice: null,
};

const controlStateResponse: GetControlStateResponse = {
  ok: true,
  state: { panicMode: false },
};

const baseGlobalFallbackRule = baseSettingsResponse.globalFallbackRule!;

type SaveSettingsMessage = {
  type: typeof EXTENSION_COMMAND_TYPES.saveSimpleSettings;
} & Pick<
  GetSettingsResponse,
  | "globalFallbackRule"
  | "themeMode"
  | "themeAccentPreset"
  | "reduceMotion"
  | "debugMode"
  | "watchPositionDelay"
  | "osmConsent"
  | "browserFingerprintSpoofingEnabled"
  | "sharedWorkerHandlingMode"
  | "sharedWorkerCompatibilityMode"
  | "sharedSpoofing"
  | "highContrastMode"
>;

type RuntimeMessage =
  | Extract<ExtensionCommand, { type: typeof EXTENSION_COMMAND_TYPES.getControlState }>
  | Extract<ExtensionCommand, { type: typeof EXTENSION_COMMAND_TYPES.getSettings }>
  | Extract<
      ExtensionCommand,
      { type: typeof EXTENSION_COMMAND_TYPES.saveLocationModel }
    >
  | SaveSettingsMessage;

const installChromeMock = (
  settingsResponse: GetSettingsResponse = baseSettingsResponse,
) => {
  let currentSettingsResponse = settingsResponse;
  const sendMessage = vi.fn(async (message: RuntimeMessage) => {
    switch (message.type) {
      case EXTENSION_COMMAND_TYPES.getControlState:
        return controlStateResponse;
      case EXTENSION_COMMAND_TYPES.getSettings:
        return currentSettingsResponse;
      case EXTENSION_COMMAND_TYPES.saveSimpleSettings:
        currentSettingsResponse = {
          ...currentSettingsResponse,
          globalFallbackRule: message.globalFallbackRule,
          themeMode: message.themeMode,
          themeAccentPreset: message.themeAccentPreset,
          reduceMotion: message.reduceMotion,
          debugMode: message.debugMode,
          watchPositionDelay: message.watchPositionDelay,
          osmConsent: message.osmConsent,
          browserFingerprintSpoofingEnabled: message.browserFingerprintSpoofingEnabled,
          sharedWorkerHandlingMode: message.sharedWorkerHandlingMode,
          sharedWorkerCompatibilityMode: message.sharedWorkerCompatibilityMode,
          sharedSpoofing: message.sharedSpoofing,
          highContrastMode: message.highContrastMode,
        };
        return currentSettingsResponse;
      case EXTENSION_COMMAND_TYPES.saveLocationModel:
        currentSettingsResponse = {
          ...currentSettingsResponse,
          locations: message.locations,
          rules: message.rules,
          ...(message.containerAssignments
            ? { containerAssignments: message.containerAssignments }
            : {}),
        };
        return currentSettingsResponse;
    }

    throw new Error("Unexpected runtime message.");
  });

  Object.defineProperty(globalThis, "chrome", {
    configurable: true,
    value: {
      runtime: {
        id: "abc",
        sendMessage,
        getManifest: () => ({ version: "0.0.0" }),
        getURL: (path: string) => `chrome-extension://test/${path}`,
      },
      storage: {
        onChanged: {
          addListener: vi.fn(),
          removeListener: vi.fn(),
        },
        local: {
          get: vi.fn(async () => ({
            themeMode: currentSettingsResponse.themeMode,
            themeAccentPreset: currentSettingsResponse.themeAccentPreset,
            highContrastMode: currentSettingsResponse.highContrastMode,
          })),
          set: vi.fn(async () => undefined),
        },
      },
    },
  });

  return { sendMessage };
};

const waitForElement = async (selector: string): Promise<HTMLElement> => {
  const observed = observeElement<HTMLElement>(document, selector);
  await flushReactEffects();
  const element = await observed;
  await flushReactEffects();
  return element;
};

const renderWithRoot = async (
  element: ReturnType<typeof createElement>,
): Promise<Root> => {
  document.body.innerHTML = '<div id="root"></div>';
  const container = document.getElementById("root");
  if (!container) {
    throw new Error("Missing test root.");
  }

  const root = createRoot(container);
  await act(async () => {
    root.render(element);
  });
  await flushReactEffects();
  return root;
};

describe("Options deeplink auto-open", () => {
  let root: Root | null = null;

  beforeEach(() => {
    installChromeMock();
    Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
      configurable: true,
      value: true,
    });
    window.history.replaceState(null, "", "/");
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem: vi.fn(() => null),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
      },
    });
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockReturnValue({
        matches: false,
        media: "",
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }),
    });
    Object.defineProperty(window.HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: vi.fn(),
    });
    Object.defineProperty(globalThis, "ResizeObserver", {
      configurable: true,
      value: class {
        observe() {}
        disconnect() {}
        unobserve() {}
      },
    });
  });

  afterEach(async () => {
    if (root) {
      await act(async () => {
        root?.unmount();
      });
      root = null;
    }
    Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
    vi.restoreAllMocks();
    document.body.innerHTML = "";
  });

  it("opens the Default Rule dialog from its deeplink anchor", async () => {
    window.history.replaceState(null, "", `/#${getFallbackModalAnchor()}`);

    root = await renderWithRoot(
      createElement(SettingsProvider, null, createElement(GlobalFallbackRuleDialog)),
    );

    const dialogAnchor = await waitForElement(`#${getFallbackModalAnchor()}`);
    expect(dialogAnchor).not.toBeNull();
    expect(document.getElementById("global-fallback-rule-form")).not.toBeNull();
  });

  it("hydrates the Default Rule dialog from loaded settings when opened from a deeplink anchor", async () => {
    installChromeMock({
      ...baseSettingsResponse,
      globalFallbackRule: {
        enabled: false,
        locationId: baseGlobalFallbackRule.locationId,
        ruleSeedKey: baseGlobalFallbackRule.ruleSeedKey,
        ...(baseGlobalFallbackRule.fingerprintSurfaceOverrides
          ? {
              fingerprintSurfaceOverrides:
                baseGlobalFallbackRule.fingerprintSurfaceOverrides,
            }
          : {}),
      },
    });
    window.history.replaceState(null, "", `/#${getFallbackModalAnchor()}`);

    root = await renderWithRoot(
      createElement(SettingsProvider, null, createElement(GlobalFallbackRuleDialog)),
    );

    await waitForElement(`#${getFallbackModalAnchor()}`);
    const enabledSwitch = document.getElementById("dialog-default-rule-enabled");
    expect(enabledSwitch?.getAttribute("data-state")).toBe("unchecked");
    expect(document.activeElement?.id).toBe("dialog-default-rule-enabled");
  });

  it("closes the Default Rule dialog after saving when opened from a deeplink anchor", async () => {
    window.history.replaceState(null, "", `/#${getFallbackModalAnchor()}`);

    root = await renderWithRoot(
      createElement(SettingsProvider, null, createElement(GlobalFallbackRuleDialog)),
    );

    await waitForElement(`#${getFallbackModalAnchor()}`);

    await act(async () => {
      document
        .querySelector<HTMLButtonElement>(
          '#global-fallback-rule-form button[type="submit"]',
        )
        ?.click();
    });

    for (let attempt = 0; attempt < 20; attempt += 1) {
      await flushReactEffects();
      if (!document.getElementById("global-fallback-rule-form")) {
        break;
      }
    }

    expect(document.getElementById("global-fallback-rule-form")).toBeNull();
  });

  it("opens the container editor from its deeplink anchor", async () => {
    window.history.replaceState(
      null,
      "",
      `/#${getContainerAnchor("firefox-container-1")}`,
    );

    root = await renderWithRoot(
      createElement(
        SettingsProvider,
        null,
        createElement(Tabs, { value: "containers" }, createElement(ContainersTab)),
      ),
    );

    const dialogAnchor = await waitForElement(
      `#${getContainerModalAnchor("firefox-container-1")}`,
    );
    const dialog = document.getElementById("container-editor-dialog");
    expect(dialogAnchor).not.toBeNull();
    expect(dialog).not.toBeNull();
    expect(dialog?.style.getPropertyValue("--gw-dialog-accent-color")).toBe(
      CONTAINER_COLOR_SWATCHES.orange,
    );
    expect(dialog?.style.getPropertyValue("--primary")).toBe(
      CONTAINER_COLOR_TOKENS.orange,
    );
    expect(dialog?.style.getPropertyValue("--ring")).toBe(
      CONTAINER_COLOR_TOKENS.orange,
    );
    expect(dialog?.style.getPropertyValue("--scrollbar-thumb")).toBe(
      CONTAINER_COLOR_SWATCHES.orange,
    );
    expect(dialog?.style.getPropertyValue("--scrollbar-thumb-hover")).toBe(
      "var(--gw-dialog-accent-peak)",
    );
    expect(document.activeElement?.id).toBe("container-editor-name");
  });

  it("opens the rule dialog from its deeplink modal anchor", async () => {
    window.history.replaceState(null, "", `/#${getRuleModalAnchor("example.com")}`);

    root = await renderWithRoot(
      createElement(SettingsProvider, null, createElement(RuleDialog)),
    );

    const dialogAnchor = await waitForElement(`#${getRuleModalAnchor("example.com")}`);
    expect(dialogAnchor).not.toBeNull();
    expect(document.getElementById("rule-dialog-form")).not.toBeNull();
    expect(document.activeElement?.id).toBe("dialog-rule-pattern");
  });

  it("shows the Default Rule preview for containers without their own assignment", async () => {
    installChromeMock({
      ...baseSettingsResponse,
      globalFallbackRule: {
        ...baseGlobalFallbackRule,
        fingerprintSurfaceOverrides: undefined,
      },
      containerAssignments: [],
    });
    window.history.replaceState(
      null,
      "",
      `/#${getContainerAnchor("firefox-container-1")}`,
    );

    root = await renderWithRoot(
      createElement(
        SettingsProvider,
        null,
        createElement(Tabs, { value: "containers" }, createElement(ContainersTab)),
      ),
    );

    await waitForElement(`#${getContainerModalAnchor("firefox-container-1")}`);

    const previewTitle = Array.from(document.querySelectorAll("h3")).find(
      (element) => element.textContent === "No saved settings yet",
    );
    expect(previewTitle).not.toBeUndefined();
    expect(previewTitle?.className).toContain("text-primary");
    expect(document.body.textContent).toContain("Default Rule");
    expect(document.body.textContent).toContain(
      "This container does not have its own Privacy Thing settings yet, so it uses the Default Rule preset: Warsaw. Save container settings to give it its own setup.",
    );
  });

  it("distinguishes an enabled but unconfigured Default Rule in the container preview", async () => {
    installChromeMock({
      ...baseSettingsResponse,
      globalFallbackRule: {
        enabled: true,
        ruleSeedKey: baseGlobalFallbackRule.ruleSeedKey,
      },
      containerAssignments: [],
    });
    window.history.replaceState(
      null,
      "",
      `/#${getContainerAnchor("firefox-container-1")}`,
    );

    root = await renderWithRoot(
      createElement(
        SettingsProvider,
        null,
        createElement(Tabs, { value: "containers" }, createElement(ContainersTab)),
      ),
    );

    await waitForElement(`#${getContainerModalAnchor("firefox-container-1")}`);

    expect(document.body.textContent).toContain(
      "This container does not have its own Privacy Thing settings yet. The Default Rule is enabled, but it does not have a preset or custom protection settings yet. Save container settings to give this container its own setup, or finish configuring the Default Rule.",
    );
  });

  it("shows the Default Rule row in the Containers table", async () => {
    root = await renderWithRoot(
      createElement(
        SettingsProvider,
        null,
        createElement(Tabs, { value: "containers" }, createElement(ContainersTab)),
      ),
    );

    await waitForElement('[data-panel="containers"]');

    expect(document.body.textContent).toContain("Default Rule");
    expect(document.body.textContent).toContain(
      "Default settings when nothing more specific applies.",
    );
  });

  it("shows a Default Rule match in Rule Inspector", async () => {
    installChromeMock({
      ...baseSettingsResponse,
      rules: [],
      trustedSites: [],
      globalFallbackRule: {
        ...baseGlobalFallbackRule,
        enabled: true,
        fingerprintSurfaceOverrides: undefined,
      },
    });

    root = await renderWithRoot(
      createElement(
        SettingsProvider,
        null,
        createElement(Tabs, { value: "rules" }, createElement(RulesTab)),
      ),
    );

    const input = (await waitForElement("#rules-preview-hostname")) as HTMLInputElement;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(
        input,
        "unknown.test",
      );
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await flushReactEffects();

    expect(document.body.textContent).toContain("Default Rule applies here");
    expect(document.body.textContent).toContain(
      "No Domain Rule or Trusted Site matched this hostname, so Privacy Thing would fall back to the Default Rule here.",
    );
  });

  it("loads the Locations tab lazily from its page anchor", async () => {
    window.history.replaceState(null, "", `/#${PAGE_ANCHORS.profiles}`);

    root = await renderWithRoot(createElement(App));

    const panel = await waitForElement('[data-panel="profiles"]');
    const searchInput = await waitForElement("#profiles-search");
    expect(panel.id).toBe(PAGE_ANCHORS.profiles);
    expect(searchInput).not.toBeNull();
  });

  it("resolves an Options section anchor after lazy tab load", async () => {
    window.history.replaceState(null, "", `/#${SECTION_ANCHORS.options.overview}`);

    root = await renderWithRoot(createElement(App));

    const section = await waitForElement(`#${SECTION_ANCHORS.options.overview}`);
    expect(section).not.toBeNull();
    expect(document.getElementById(PAGE_ANCHORS.options)).not.toBeNull();
    expect(window.HTMLElement.prototype.scrollIntoView).toHaveBeenCalled();
  });

  it("opens Geolocation advanced settings from the Options surface button", async () => {
    window.history.replaceState(null, "", `/#${SECTION_ANCHORS.options.overview}`);

    root = await renderWithRoot(createElement(App));

    await waitForElement('[data-panel="options"]');
    const advancedButton = Array.from(document.querySelectorAll("button")).find(
      (element) =>
        element.textContent === "Advanced" && !element.hasAttribute("data-tab"),
    );
    if (!(advancedButton instanceof HTMLButtonElement)) {
      throw new Error("Missing Geolocation advanced button.");
    }

    await act(async () => {
      advancedButton.click();
    });

    await waitForElement("#geolocation-advanced-settings-dialog");
    expect(document.body.textContent).toContain("Geolocation advanced settings");
    expect(document.body.textContent).toContain("Default Max Coordinate Radius");
    expect(document.body.textContent).toContain("Watch Position Delay Range (s)");
    expect(
      document.getElementById("close-geolocation-advanced-settings-dialog"),
    ).not.toBeNull();
  });

  it("opens Geolocation advanced settings from a moved setting anchor", async () => {
    window.history.replaceState(
      null,
      "",
      `/#${SETTING_ANCHORS.advanced.defaultNoiseRadius}`,
    );

    root = await renderWithRoot(createElement(App));

    const movedSetting = await waitForElement(
      `#${SETTING_ANCHORS.advanced.defaultNoiseRadius}`,
    );
    expect(movedSetting).not.toBeNull();
    expect(document.getElementById(PAGE_ANCHORS.options)).not.toBeNull();
    expect(
      document.getElementById("geolocation-advanced-settings-dialog"),
    ).not.toBeNull();
    expect(document.body.textContent).toContain("Geolocation advanced settings");
  });

  it("resolves an Advanced section anchor after lazy tab load", async () => {
    window.history.replaceState(null, "", `/#${SECTION_ANCHORS.advanced.runtime}`);

    root = await renderWithRoot(createElement(App));

    const section = await waitForElement(`#${SECTION_ANCHORS.advanced.runtime}`);
    expect(section).not.toBeNull();
    expect(document.getElementById(PAGE_ANCHORS.advanced)).not.toBeNull();
    expect(window.HTMLElement.prototype.scrollIntoView).toHaveBeenCalled();
  });

  it("resolves an About section anchor after lazy tab load", async () => {
    window.history.replaceState(null, "", `/#${SECTION_ANCHORS.about.overview}`);

    root = await renderWithRoot(createElement(App));

    const section = await waitForElement(`#${SECTION_ANCHORS.about.overview}`);
    expect(section).not.toBeNull();
    expect(document.getElementById(PAGE_ANCHORS.about)).not.toBeNull();
    expect(window.HTMLElement.prototype.scrollIntoView).toHaveBeenCalled();
  });

  it("shows the website, source, and bug-report links in About", async () => {
    window.history.replaceState(null, "", `/#${PAGE_ANCHORS.about}`);

    root = await renderWithRoot(createElement(App));

    await waitForElement('[data-panel="about"]');
    const links = Array.from(document.querySelectorAll<HTMLAnchorElement>("a"));
    const hrefFor = (label: string) =>
      links.find((link) => link.textContent?.includes(label))?.href;

    expect(hrefFor("Website")).toBe("https://privacything.com/");
    expect(hrefFor("Source")).toBe(
      "https://github.com/Privacy-Thing/browser-extension",
    );
    expect(hrefFor("Report bug")).toBe(
      "https://github.com/Privacy-Thing/browser-extension/issues/new?template=bug_report.yml",
    );
    expect(document.body.textContent).not.toContain("Open Playground");
  });

  it("opens a normal privacy anchor instead of forcing incomplete onboarding", async () => {
    installChromeMock({
      ...baseSettingsResponse,
      onboardingCompleted: false,
    });
    window.history.replaceState(
      null,
      "",
      `/#${SETTINGS_SUBPAGE_ANCHORS.privacyPolicy}`,
    );

    root = await renderWithRoot(createElement(App));

    const policy = await waitForElement(`#${SETTINGS_SUBPAGE_ANCHORS.privacyPolicy}`);
    expect(policy).not.toBeNull();
    expect(document.body.textContent).not.toContain("Thanks for installing");
  });

  it("navigates from lazy-loaded Locations to Playground", async () => {
    window.history.replaceState(null, "", `/#${PAGE_ANCHORS.profiles}`);

    root = await renderWithRoot(createElement(App));

    await waitForElement('[data-panel="profiles"]');
    const openPlaygroundButton = Array.from(document.querySelectorAll("button")).find(
      (element) => element.textContent?.includes("Open Playground"),
    );
    if (!(openPlaygroundButton instanceof HTMLButtonElement)) {
      throw new Error("Missing Locations playground CTA.");
    }

    await act(async () => {
      openPlaygroundButton.click();
    });

    const playgroundPanel = await waitForElement('[data-panel="playground"]');
    expect(playgroundPanel.id).toBe(PAGE_ANCHORS.playground);
  });

  it("navigates from lazy-loaded Trusted Sites back to Rules", async () => {
    installChromeMock({
      ...baseSettingsResponse,
      trustedSites: [{ pattern: "billing.example.com", enabled: true }],
    });
    window.history.replaceState(null, "", `/#${PAGE_ANCHORS["trusted-sites"]}`);

    root = await renderWithRoot(createElement(App));

    await waitForElement('[data-panel="trusted-sites"]');
    const ctaButton = Array.from(document.querySelectorAll("button")).find((element) =>
      /rules/i.test(element.textContent ?? ""),
    );
    if (!(ctaButton instanceof HTMLButtonElement)) {
      throw new Error("Missing Trusted Sites rules CTA.");
    }

    await act(async () => {
      ctaButton.click();
    });

    const rulesPanel = await waitForElement('[data-panel="rules"]');
    expect(rulesPanel.id).toBe(PAGE_ANCHORS.rules);
  });

  it.runIf(BUILD_BROWSER_TARGET === "firefox")(
    "loads the Containers tab lazily from its page anchor",
    async () => {
      window.history.replaceState(null, "", `/#${PAGE_ANCHORS.containers}`);

      root = await renderWithRoot(createElement(App));

      const panel = await waitForElement('[data-panel="containers"]');
      expect(panel.id).toBe(PAGE_ANCHORS.containers);
      expect(document.body.textContent).toContain("Default Rule");
    },
  );
});
