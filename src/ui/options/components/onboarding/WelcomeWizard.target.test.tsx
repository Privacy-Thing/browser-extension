// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EXTENSION_COMMAND_TYPES } from "@/shared/extension-contract";
import { PAGE_ANCHORS } from "@/ui/options/navigation";

const settingsMock = vi.hoisted(() => ({
  value: {
    setProfiles: vi.fn(),
    setOsmConsent: vi.fn(),
    setFingerprintSpoofing: vi.fn(),
    sharedSpoofing: undefined,
    setSharedSpoofing: vi.fn(),
    globalFallbackRule: undefined as
      { enabled?: boolean; locationId?: string } | undefined,
    setGlobalFallbackRule: vi.fn(),
    isFallbackEnabled: false,
    fallbackLocationId: "",
    setHighContrastMode: vi.fn(),
    setOnboardingOptions: vi.fn(),
    openFallbackDialog: vi.fn(),
    submitOnboardingFallback: vi.fn(),
    onboardingCompleted: false,
    setOnboardingCompleted: vi.fn(),
    randomizeGeneratedLocationByDefault: true,
    generatedLocationRandomizationRadiusKm: 10,
    settingsLoaded: true,
  },
}));

const themeMock = vi.hoisted(() => ({
  value: {
    theme: "light",
    preference: "system",
    setPreference: vi.fn(async () => {}),
    accentPreset: "teal",
    setAccentPreset: vi.fn(async () => {}),
    reduceMotion: false,
    motionOverride: false,
    setReduceMotion: vi.fn(async () => {}),
    highContrast: false,
    setHighContrast: vi.fn(async () => {}),
  },
}));

vi.mock("@/ui/options/state/SettingsContext", () => ({
  useSettings: () => settingsMock.value,
}));

vi.mock("@/ui/shared/ThemeProvider", () => ({
  useTheme: () => themeMock.value,
}));

const renderWizard = async () => {
  const { WelcomeWizard } =
    await import("@/ui/options/components/onboarding/WelcomeWizard");
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);

  await act(async () => {
    root.render(<WelcomeWizard onComplete={vi.fn()} />);
  });

  return { host, root };
};

const clickByText = async (text: string | RegExp) => {
  const element = [...document.querySelectorAll("button")].find((button) =>
    text instanceof RegExp
      ? text.test(button.textContent ?? "")
      : (button.textContent ?? "").includes(text),
  );

  if (!(element instanceof HTMLButtonElement)) {
    throw new Error(`Missing button: ${String(text)}`);
  }

  await act(async () => {
    element.click();
  });
};

describe("WelcomeWizard", () => {
  let roots: Root[] = [];

  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    vi.useFakeTimers();
    window.history.replaceState(null, "", "/src/ui/options/index.html?onboarding=1");
    Object.values(settingsMock.value).forEach((value) => {
      if (typeof value === "function" && "mockReset" in value) {
        value.mockReset();
      }
    });
    settingsMock.value.globalFallbackRule = undefined;
    settingsMock.value.fallbackLocationId = "";
    settingsMock.value.onboardingCompleted = false;
    themeMock.value.reduceMotion = false;
    themeMock.value.motionOverride = false;
    themeMock.value.setReduceMotion.mockReset();
    Object.defineProperty(globalThis, "chrome", {
      configurable: true,
      value: {
        runtime: {
          id: "abc",
          getURL: (path: string) => `chrome-extension://test/${path}`,
          sendMessage: vi.fn(async (message: { type: string }) => {
            if (message.type === EXTENSION_COMMAND_TYPES.importPresetLocations) {
              return { ok: true, locations: [] };
            }
            if (message.type === EXTENSION_COMMAND_TYPES.saveSimpleSettings) {
              return {
                ok: true,
                osmConsent: "denied",
                browserFingerprintSpoofingEnabled: true,
                sharedSpoofing: undefined,
                globalFallbackRule: { enabled: false },
              };
            }
            return { ok: true };
          }),
        },
        tabs: {
          create: vi.fn(),
        },
      },
    });
  });

  afterEach(() => {
    for (const root of roots) {
      act(() => {
        root.unmount();
      });
    }
    roots = [];
    document.body.replaceChildren();
    vi.useRealTimers();
  });

  it("skips setup to the main settings page", async () => {
    const rendered = await renderWizard();
    roots.push(rendered.root);

    await clickByText("Skip setup");

    expect(settingsMock.value.setOnboardingCompleted).toHaveBeenCalledWith(true);
    expect(window.location.hash).toBe(`#${PAGE_ANCHORS.rules}`);
  });

  it("uses steady border motion for the onboarding window", async () => {
    const rendered = await renderWizard();
    roots.push(rendered.root);

    expect(
      document
        .querySelector(".gw-dialog-surface")
        ?.getAttribute("data-animation-timing"),
    ).toBe("steady");
    expect(
      document
        .querySelector(".gw-dialog-surface")
        ?.classList.contains("gw-animated-accent-halo"),
    ).toBe(true);
    expect(
      document
        .querySelector(".gw-dialog-surface")
        ?.classList.contains("gw-animated-accent-halo-surface"),
    ).toBe(true);
  });

  it("uses the animated horizontal brand logo configured for onboarding", async () => {
    const rendered = await renderWizard();
    roots.push(rendered.root);

    const logo = document.querySelector<HTMLElement>(".gw-brand-logo-horizontal");
    const thing = logo?.shadowRoot?.querySelector<HTMLElement>(".pt-brand-thing");
    expect(logo).not.toBeNull();
    expect(logo?.classList.contains("w-[300px]")).toBe(true);
    expect(logo?.classList.contains("max-w-full")).toBe(true);
    expect(logo?.classList.contains("gw-brand-logo--accent-cursor")).toBe(true);
    expect(logo?.classList.contains("gw-brand-logo--crisp-shadow")).toBe(true);
    expect(
      logo?.shadowRoot?.querySelector('[data-cursor-animated="true"]'),
    ).not.toBeNull();
    expect(thing?.dataset.lookAroundDirections).toBe("south-west south-east");
    expect(logo?.shadowRoot?.querySelectorAll('[dur="10s"]')).toHaveLength(5);
    expect(logo?.shadowRoot?.querySelectorAll('[dur="5s"]')).toHaveLength(2);
    expect(
      document.querySelector(".gw-brand-logo:not(.gw-brand-logo-horizontal)"),
    ).toBeNull();
  });

  it("uses the concise welcome copy", async () => {
    const rendered = await renderWizard();
    roots.push(rendered.root);

    expect(document.body.textContent).toContain("Thanks for installing this extension");
    expect(document.body.textContent).toContain(
      "Choose what sites see instead of exposing your real location and browser identity.",
    );
    expect(document.body.textContent).not.toContain(
      "Privacy Thing exists to protect your privacy",
    );
  });

  it("keeps onboarding logo motion disabled by the active appearance setting", async () => {
    themeMock.value.reduceMotion = true;
    const rendered = await renderWizard();
    roots.push(rendered.root);

    const logo = document.querySelector<HTMLElement>(".gw-brand-logo-horizontal");
    expect(logo?.shadowRoot?.querySelector("[data-motion-part]")).toBeNull();
    expect(
      logo?.shadowRoot?.querySelector('[data-cursor-animated="false"]'),
    ).not.toBeNull();
  });

  it("moves progress to the top of setup steps", async () => {
    const rendered = await renderWizard();
    roots.push(rendered.root);

    expect(document.querySelector("[aria-label='Setup progress']")).toBeNull();

    await clickByText("Start setup");

    const progress = document.querySelector("[aria-label='Setup progress']");
    const previous = [...document.querySelectorAll("button")].find(
      (button) => button.textContent === "Previous",
    );

    expect(progress).not.toBeNull();
    expect(progress?.parentElement?.firstElementChild).toBe(progress);
    expect(previous).toBeInstanceOf(HTMLButtonElement);
    expect(progress?.compareDocumentPosition(previous as Node)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it("uses the same explicit map request consent as Settings", async () => {
    const rendered = await renderWizard();
    roots.push(rendered.root);

    await clickByText("Start setup");

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

  it("opens the privacy policy in a modal", async () => {
    const rendered = await renderWizard();
    roots.push(rendered.root);

    await clickByText("Privacy policy");

    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog?.textContent).toContain("Privacy Policy");
    expect(dialog?.getAttribute("data-animation-timing")).toBe("steady");
    expect(document.querySelector(".gw-policy-doc")?.textContent).toContain(
      "Privacy Policy for Privacy Thing",
    );
  });

  it("sorts preset locations and uses text select actions", async () => {
    const rendered = await renderWizard();
    roots.push(rendered.root);

    await clickByText("Start setup");
    await clickByText("Next");

    expect(document.body.textContent).not.toContain("Choose preset locations");
    expect(document.body.textContent).toContain("Select all");
    expect(document.body.textContent).toContain("Clear all");

    const labels = [...document.querySelectorAll("label")]
      .map((label) => label.textContent?.trim())
      .filter(Boolean);
    const beijingIndex = labels.indexOf("Beijing");
    const berlinIndex = labels.indexOf("Berlin");
    const cairoIndex = labels.indexOf("Cairo");

    expect(beijingIndex).toBeGreaterThanOrEqual(0);
    expect(berlinIndex).toBeGreaterThan(beijingIndex);
    expect(cairoIndex).toBeGreaterThan(berlinIndex);
  });

  it("passes selected regional presets to Default Rule editing", async () => {
    const rendered = await renderWizard();
    roots.push(rendered.root);

    await clickByText("Start setup");
    await clickByText("Next");
    await clickByText("Next");
    await clickByText("Edit Default Rule");

    expect(settingsMock.value.setOnboardingOptions).toHaveBeenLastCalledWith(
      expect.arrayContaining([
        { value: "spf-beijing", label: "Beijing" },
        { value: "spf-cairo", label: "Cairo" },
      ]),
    );
    expect(settingsMock.value.openFallbackDialog).toHaveBeenCalled();
  });

  it("imports selected presets with the default coordinate randomization radius", async () => {
    const rendered = await renderWizard();
    roots.push(rendered.root);

    await clickByText("Start setup");
    await clickByText("Next");
    await clickByText("Next");
    await clickByText("Next");
    await clickByText("Next");
    await clickByText("Next");
    await clickByText("Open Settings");

    expect(chrome.runtime.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: EXTENSION_COMMAND_TYPES.importPresetLocations,
        randomizeWithinMeters: 10000,
      }),
    );
  });

  it("blocks Next when Default Rule points at an unselected preset", async () => {
    settingsMock.value.globalFallbackRule = { enabled: true, locationId: "spf-berlin" };
    const rendered = await renderWizard();
    roots.push(rendered.root);

    await clickByText("Start setup");
    await clickByText("Next");
    await clickByText("Clear all");
    await clickByText("Next");
    await clickByText("Next");

    expect(document.querySelector("[role='alert']")?.textContent).toContain(
      "Default Rule is assigned to Berlin",
    );
    expect(document.body.textContent).toContain("Choose where protection starts");
  });

  it("updates both settings and theme state when high contrast changes", async () => {
    const rendered = await renderWizard();
    roots.push(rendered.root);

    await clickByText("Start setup");
    await clickByText("Next");
    await clickByText("Next");
    await clickByText("Next");
    await clickByText("Next");

    const highContrastSwitch = document.getElementById("welcome-high-contrast");
    if (!(highContrastSwitch instanceof HTMLButtonElement)) {
      throw new Error("Missing high contrast switch.");
    }

    await act(async () => {
      highContrastSwitch.click();
    });

    expect(settingsMock.value.setHighContrastMode).toHaveBeenCalledWith(true);
    expect(themeMock.value.setHighContrast).toHaveBeenCalledWith(true);
  });

  it("shows the system override and disables reduced motion", async () => {
    themeMock.value.reduceMotion = true;
    themeMock.value.motionOverride = true;
    const rendered = await renderWizard();
    roots.push(rendered.root);

    await clickByText("Start setup");
    await clickByText("Next");
    await clickByText("Next");
    await clickByText("Next");
    await clickByText("Next");

    const reduceMotionSwitch = document.getElementById("welcome-reduce-motion");
    expect(reduceMotionSwitch).toBeInstanceOf(HTMLButtonElement);
    expect((reduceMotionSwitch as HTMLButtonElement).disabled).toBe(true);
    expect(document.body.textContent).toContain(
      "Reduced motion is enabled by your system accessibility setting.",
    );
  });
});
