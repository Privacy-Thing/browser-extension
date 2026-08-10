// @vitest-environment jsdom

import { act, createElement, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { OptionsTab } from "@/ui/options/components/tabs/OptionsTab";

const {
  scheduleAutosaveMock,
  setSharedSpoofingMock,
  setWorkerModeMock,
  useSettingsValue,
  themeValue,
} = vi.hoisted(() => ({
  scheduleAutosaveMock: vi.fn(),
  setSharedSpoofingMock: vi.fn(),
  setWorkerModeMock: vi.fn(),
  useSettingsValue: {
    browserFingerprintSpoofingEnabled: true,
    setFingerprintSpoofing: vi.fn(),
    sharedSpoofing: undefined,
    setSharedSpoofing: vi.fn(),
    sharedWorkerHandlingMode: "native" as const,
    setWorkerMode: vi.fn(),
    themeMode: "system" as const,
    setThemeMode: vi.fn(),
    themeAccentPreset: "teal" as const,
    setThemeAccentPreset: vi.fn(),
    osmConsent: "denied" as const,
    setOsmConsent: vi.fn(),
    highContrastMode: false,
    setHighContrastMode: vi.fn(),
    showBadgeQueryCount: true,
    setShowBadgeQueryCount: vi.fn(),
    includeDateCallsInBadgeCount: true,
    setCountDateCalls: vi.fn(),
    settingsLoaded: true,
    navigateToAnchor: vi.fn(),
    scheduleAutosave: vi.fn(),
    highlightedAnchorId: null,
  },
  themeValue: {
    theme: "light",
    highContrast: false,
    setPreference: vi.fn(),
    setAccentPreset: vi.fn(),
    reduceMotion: false,
    motionOverride: false,
    setReduceMotion: vi.fn(),
    setHighContrast: vi.fn(),
  },
}));

vi.mock("@/shared/browser-fingerprint", () => ({
  parseChromiumUaVersion: () => null,
  readFingerprintSource: vi.fn(async () => undefined),
}));

vi.mock("@/ui/components/SettingsControlCard", () => ({
  SettingsControlCard: ({
    anchorId,
    title,
    description,
    action,
    children,
  }: {
    anchorId: string;
    title: ReactNode;
    description?: ReactNode;
    action?: ReactNode;
    children?: ReactNode;
  }) => (
    <section id={anchorId} data-testid="settings-control-card">
      {title}
      {description ? <div>{description}</div> : null}
      {action}
      {children}
    </section>
  ),
}));

vi.mock("@/ui/components/SettingsHelpCard", () => ({
  SettingsHelpCard: ({ children }: { children?: ReactNode }) => (
    <aside>{children}</aside>
  ),
}));

vi.mock("@/ui/components/SettingsSectionCard", () => ({
  SettingsSectionCard: ({
    anchorId,
    title,
    description,
    headerActions,
    children,
  }: {
    anchorId: string;
    title: ReactNode;
    description?: ReactNode;
    headerActions?: ReactNode;
    children?: ReactNode;
  }) => (
    <section id={anchorId}>
      {title}
      {description ? <div>{description}</div> : null}
      {headerActions}
      {children}
    </section>
  ),
}));

vi.mock("@/ui/components/SettingsSubcard", () => ({
  SettingsSubcard: () => null,
}));

vi.mock("@/ui/components/ui/tabs", () => ({
  TabsContent: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/ui/options/components/modals/GeolocationAdvancedSettingsDialog", () => ({
  GeoSettingsDialog: () => null,
  isGeoSettingsAnchor: () => false,
}));

vi.mock("@/ui/options/state/SettingsContext", () => ({
  useSettings: () => useSettingsValue,
}));

vi.mock("@/ui/shared/ThemeProvider", () => ({
  useTheme: () => themeValue,
}));

const renderWithRoot = async (): Promise<Root> => {
  document.body.innerHTML = '<div id="root"></div>';
  const container = document.getElementById("root");
  if (!container) {
    throw new Error("Missing test root.");
  }

  const root = createRoot(container);
  await act(async () => {
    root.render(createElement(OptionsTab));
  });
  return root;
};

describe("OptionsTab Shared Worker handling", () => {
  let root: Root | null = null;

  beforeEach(() => {
    Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
      configurable: true,
      value: true,
    });
    scheduleAutosaveMock.mockReset();
    setSharedSpoofingMock.mockReset();
    setWorkerModeMock.mockReset();
    useSettingsValue.scheduleAutosave = scheduleAutosaveMock;
    useSettingsValue.setSharedSpoofing = setSharedSpoofingMock;
    useSettingsValue.setWorkerMode = setWorkerModeMock;
    useSettingsValue.browserFingerprintSpoofingEnabled = true;
    useSettingsValue.sharedSpoofing = undefined;
    useSettingsValue.sharedWorkerHandlingMode = "native";
    themeValue.reduceMotion = false;
    themeValue.motionOverride = false;
    themeValue.setReduceMotion.mockReset();
  });

  afterEach(async () => {
    if (root) {
      await act(async () => {
        root?.unmount();
      });
      root = null;
    }
    Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("renders Dedicated and Shared Worker handling directly after Service Workers", async () => {
    root = await renderWithRoot();

    const serviceWorkerHeading = Array.from(document.querySelectorAll("h3")).find(
      (element) => element.textContent === "Service Workers",
    );
    const sharedWorkerHeading = Array.from(document.querySelectorAll("h3")).find(
      (element) => element.textContent === "Dedicated & Shared Workers",
    );

    expect(serviceWorkerHeading).toBeDefined();
    expect(sharedWorkerHeading).toBeDefined();
    expect(
      serviceWorkerHeading?.closest('[data-testid="settings-control-card"]')
        ?.nextElementSibling,
    ).toBe(sharedWorkerHeading?.closest('[data-testid="settings-control-card"]'));

    const sharedWorkerCard = sharedWorkerHeading?.closest(
      '[data-testid="settings-control-card"]',
    );
    expect(sharedWorkerCard?.textContent).toContain(
      "Choose how Dedicated and Shared Workers run by default.",
    );
    expect(sharedWorkerCard?.textContent).toContain(
      "Native — Runs Dedicated and Shared Workers normally, without Privacy Thing protection.",
    );
    expect(sharedWorkerCard?.textContent).toContain(
      "Spoof — Tries to apply Privacy Thing’s spoofed values before workers start.",
    );
    expect(sharedWorkerCard?.textContent).toContain(
      "Strict — Blocks a worker before startup when Privacy Thing can tell that spoofing cannot be confirmed.",
    );
  });

  it("shows the disabled upcoming Language selector without saving settings", async () => {
    root = await renderWithRoot();

    const languageTrigger = document.getElementById("language-trigger");

    expect(languageTrigger).toBeInstanceOf(HTMLButtonElement);
    expect((languageTrigger as HTMLButtonElement).disabled).toBe(true);
    expect(languageTrigger?.textContent).toContain("English");
    expect(document.body.textContent).toContain("Language");
    expect(document.body.textContent).toContain("SOON");
    expect(scheduleAutosaveMock).not.toHaveBeenCalled();
  });

  it("states which external requests map consent allows", async () => {
    root = await renderWithRoot();

    expect(document.body.textContent).toContain(
      "Allow location search and map requests",
    );
    expect(document.body.textContent).toContain(
      "send search queries to OpenStreetMap Nominatim when you search for locations",
    );
    expect(document.body.textContent).toContain(
      "request vector tiles and fonts from OpenFreeMap when map previews are displayed",
    );
    expect(document.body.textContent).not.toContain(
      "Use location search and map previews",
    );
  });

  it("saves the Shared Worker handling mode", async () => {
    root = await renderWithRoot();

    const strictButton = Array.from(document.querySelectorAll("button")).find(
      (element) => element.textContent === "Strict",
    );
    if (!(strictButton instanceof HTMLButtonElement)) {
      throw new Error("Missing Strict button.");
    }

    await act(async () => {
      strictButton.click();
    });

    expect(setWorkerModeMock).toHaveBeenCalledWith("strict");
    expect(scheduleAutosaveMock).toHaveBeenCalledWith({
      sharedWorkerHandlingMode: "strict",
      sharedWorkerCompatibilityMode: false,
    });
  });

  it("disables Worker handling while global protections are off", async () => {
    useSettingsValue.browserFingerprintSpoofingEnabled = false;
    root = await renderWithRoot();

    const workerHeading = Array.from(document.querySelectorAll("h3")).find(
      (element) => element.textContent === "Dedicated & Shared Workers",
    );
    const workerCard = workerHeading?.closest('[data-testid="settings-control-card"]');
    const modeButtons = Array.from(workerCard?.querySelectorAll("button") ?? []);

    expect(modeButtons).toHaveLength(3);
    expect(modeButtons.every((button) => button.disabled)).toBe(true);

    await act(async () => {
      modeButtons.find((button) => button.textContent === "Strict")?.click();
    });

    expect(setWorkerModeMock).not.toHaveBeenCalled();
    expect(scheduleAutosaveMock).not.toHaveBeenCalled();
  });

  it("uses semantic Service Worker handling controls", async () => {
    root = await renderWithRoot();

    const serviceWorkerGroup = Array.from(
      document.querySelectorAll('[role="group"]'),
    ).find(
      (element) =>
        element.getAttribute("aria-labelledby") ===
        "setting-options-service-worker-blocking__title",
    );
    if (!serviceWorkerGroup) {
      throw new Error("Missing Service Workers control.");
    }

    const allowButton = Array.from(serviceWorkerGroup.querySelectorAll("button")).find(
      (element) => element.textContent === "Allow",
    );
    const blockButton = Array.from(serviceWorkerGroup.querySelectorAll("button")).find(
      (element) => element.textContent === "Block",
    );
    if (!(blockButton instanceof HTMLButtonElement)) {
      throw new Error("Missing Block button.");
    }

    expect(allowButton).toBeDefined();

    await act(async () => {
      blockButton.click();
    });

    expect(setSharedSpoofingMock).toHaveBeenCalledWith(
      expect.objectContaining({ serviceWorker: true }),
    );
    expect(scheduleAutosaveMock).toHaveBeenCalledWith({
      sharedSpoofing: expect.objectContaining({ serviceWorker: true }),
    });
  });

  it("shows the system override and disables the effective reduced-motion switch", async () => {
    themeValue.reduceMotion = true;
    themeValue.motionOverride = true;
    root = await renderWithRoot();

    const switchControl = document.querySelector<HTMLButtonElement>(
      '[aria-labelledby="setting-reduce-motion__title"]',
    );
    expect(switchControl).not.toBeNull();
    expect(switchControl?.disabled).toBe(true);
    expect(document.body.textContent).toContain(
      "Reduced motion is enabled by your system accessibility setting.",
    );
  });
});
