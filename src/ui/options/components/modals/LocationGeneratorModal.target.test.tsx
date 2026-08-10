// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LocationGeneratorModal } from "./LocationGeneratorModal";

import { flushReactEffects } from "@/test-utils/react";
import type { LazyProfileDraftMapProps } from "@/ui/options/components/map/LazyProfileDraftMap";
import { useSettings } from "@/ui/options/state/SettingsContext";

vi.mock("@/ui/components/ui/form-dialog-shell", () => ({
  FormDialogShell: ({
    children,
    footer,
  }: {
    children?: React.ReactNode;
    footer?: React.ReactNode;
  }) => (
    <div data-testid="form-dialog-shell">
      {children}
      <div data-testid="form-dialog-footer">{footer}</div>
    </div>
  ),
}));

const { lazyProfileDraftMapMock } = vi.hoisted(() => ({
  lazyProfileDraftMapMock: vi.fn((_props: LazyProfileDraftMapProps) => (
    <div data-testid="generator-map" />
  )),
}));

vi.mock("@/ui/components/map/LazyProfileDraftMap", () => ({
  LazyProfileDraftMap: lazyProfileDraftMapMock,
}));

vi.mock("@/ui/options/components/map/LazyProfileDraftMap", () => ({
  LazyProfileDraftMap: lazyProfileDraftMapMock,
}));

vi.mock("@/ui/options/components/modals/LocationDetailsFields", () => ({
  LocationDetailsFields: () => <div data-testid="generator-location-details" />,
}));

vi.mock("@/ui/options/state/SettingsContext", () => ({
  useSettings: vi.fn(),
}));

const useSettingsMock = vi.mocked(useSettings);

const basePendingProfileDraft = {
  id: "poznan",
  label: "Poznan, Poland",
  latitude: 52.4064,
  longitude: 16.9252,
  accuracy: 25,
  noiseRadius: 50,
  language: "pl",
  languages: ["pl"],
  preferEnglishContent: false,
  timeZone: "Europe/Warsaw",
  sourceLabel: "Poznan, Greater Poland, Poland",
  languageSelection: {
    options: [
      {
        value: "pl",
        label: "Polish [pl]",
        language: "pl",
        languages: ["pl"],
      },
    ],
    selectedValue: "pl",
    required: false,
  },
};

const renderWithRoot = async (): Promise<Root> => {
  document.body.innerHTML = '<div id="root"></div>';
  const container = document.getElementById("root");
  if (!container) {
    throw new Error("Missing test root.");
  }

  const root = createRoot(container);
  await act(async () => {
    root.render(<LocationGeneratorModal />);
  });
  await flushReactEffects();
  return root;
};

describe("LocationGeneratorModal", () => {
  let root: Root | null = null;

  beforeEach(() => {
    Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
      configurable: true,
      value: true,
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
    Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
    vi.clearAllMocks();
  });

  it("keeps confirm-step content visible after close starts", async () => {
    useSettingsMock.mockReturnValue({
      isGeneratorOpen: true,
      closeGenerator: vi.fn(),
      generatorStep: "confirm",
      setGeneratorStep: vi.fn(),
      searchQuery: "Poznan",
      setSearchQuery: vi.fn(),
      pendingDraft: basePendingProfileDraft,
      updatePendingDraft: vi.fn(),
      defaultNoiseRadius: 50,
      isDraftPending: false,
      saveInFlight: false,
      runGenerator: vi.fn(),
      saveGenerator: vi.fn(),
    } as never);

    root = await renderWithRoot();
    expect(
      document.querySelector('[data-testid="generator-location-details"]'),
    ).not.toBeNull();

    useSettingsMock.mockReturnValue({
      isGeneratorOpen: false,
      closeGenerator: vi.fn(),
      generatorStep: "confirm",
      setGeneratorStep: vi.fn(),
      searchQuery: "Poznan",
      setSearchQuery: vi.fn(),
      pendingDraft: basePendingProfileDraft,
      updatePendingDraft: vi.fn(),
      defaultNoiseRadius: 50,
      isDraftPending: false,
      saveInFlight: false,
      runGenerator: vi.fn(),
      saveGenerator: vi.fn(),
    } as never);

    await act(async () => {
      root?.render(<LocationGeneratorModal />);
    });
    await flushReactEffects();

    expect(
      document.querySelector('[data-testid="generator-location-details"]'),
    ).not.toBeNull();
  });

  it("passes separate range and accuracy radii into the map preview", async () => {
    useSettingsMock.mockReturnValue({
      isGeneratorOpen: true,
      closeGenerator: vi.fn(),
      generatorStep: "confirm",
      setGeneratorStep: vi.fn(),
      searchQuery: "Poznan",
      setSearchQuery: vi.fn(),
      pendingDraft: basePendingProfileDraft,
      updatePendingDraft: vi.fn(),
      defaultNoiseRadius: 50,
      isDraftPending: false,
      saveInFlight: false,
      runGenerator: vi.fn(),
      saveGenerator: vi.fn(),
    } as never);

    root = await renderWithRoot();

    const lastCall = lazyProfileDraftMapMock.mock.lastCall?.[0];
    expect(lastCall?.rangeRadius).toBe(50);
    expect(lastCall?.accuracyRadius).toBe(25);
  });

  it("shows the language picker when the generator is on the language step", async () => {
    useSettingsMock.mockReturnValue({
      isGeneratorOpen: true,
      closeGenerator: vi.fn(),
      generatorStep: "language",
      setGeneratorStep: vi.fn(),
      searchQuery: "Ottawa",
      setSearchQuery: vi.fn(),
      pendingDraft: {
        ...basePendingProfileDraft,
        label: "Ottawa, Canada",
        language: "en-CA",
        languages: ["en-CA", "en"],
        languageSelection: {
          options: [
            {
              value: "en-CA",
              label: "English (Canada) [en-CA]",
              language: "en-CA",
              languages: ["en-CA", "en"],
            },
            {
              value: "fr-CA",
              label: "French (Canada) [fr-CA]",
              language: "fr-CA",
              languages: ["fr-CA", "fr"],
            },
          ],
          selectedValue: "",
          required: true,
        },
      },
      updatePendingDraft: vi.fn(),
      defaultNoiseRadius: 50,
      isDraftPending: false,
      saveInFlight: false,
      runGenerator: vi.fn(),
      saveGenerator: vi.fn(),
    } as never);

    root = await renderWithRoot();

    expect(document.getElementById("profile-generator-language-select")).not.toBeNull();
  });

  it("keeps Cancel on the left as a ghost action on the search step", async () => {
    useSettingsMock.mockReturnValue({
      isGeneratorOpen: true,
      closeGenerator: vi.fn(),
      generatorStep: "search",
      setGeneratorStep: vi.fn(),
      searchQuery: "",
      setSearchQuery: vi.fn(),
      pendingDraft: null,
      updatePendingDraft: vi.fn(),
      defaultNoiseRadius: 50,
      isDraftPending: false,
      saveInFlight: false,
      runGenerator: vi.fn(),
      saveGenerator: vi.fn(),
    } as never);

    root = await renderWithRoot();

    const footer = document.querySelector('[data-testid="profile-generator-footer"]');
    const cancelButton = document.getElementById("close-profile-generator-dialog");
    expect(footer?.className).toContain("sm:justify-between");
    expect(cancelButton?.className).toContain("text-muted-foreground");
    expect(cancelButton?.className).toContain("hover:bg-accent");
  });

  it("shows coordinate randomization on the search step", async () => {
    const setShouldRandomize = vi.fn();
    useSettingsMock.mockReturnValue({
      isGeneratorOpen: true,
      closeGenerator: vi.fn(),
      generatorStep: "search",
      setGeneratorStep: vi.fn(),
      searchQuery: "",
      setSearchQuery: vi.fn(),
      shouldRandomize: true,
      setShouldRandomize,
      radiusKm: 10,
      setRadiusKm: vi.fn(),
      pendingDraft: null,
      updatePendingDraft: vi.fn(),
      defaultNoiseRadius: 50,
      isDraftPending: false,
      saveInFlight: false,
      runGenerator: vi.fn(),
      saveGenerator: vi.fn(),
    } as never);

    root = await renderWithRoot();

    const randomizeSwitch = document.getElementById("profile-generator-randomize");
    const randomizeInput = document.getElementById(
      "profile-generator-randomize-radius",
    );
    expect(randomizeSwitch).not.toBeNull();
    expect(randomizeInput).toBeInstanceOf(HTMLInputElement);
    expect((randomizeInput as HTMLInputElement | null)?.value).toBe("10");
    expect(document.body.textContent).toContain("Randomize coordinates within");
    expect(document.body.textContent).toContain("Read why.");

    await act(async () => {
      randomizeSwitch?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(setShouldRandomize).toHaveBeenCalledWith(false);
  });

  it("shows search candidates and keeps Continue disabled until one is selected", async () => {
    useSettingsMock.mockReturnValue({
      isGeneratorOpen: true,
      closeGenerator: vi.fn(),
      generatorStep: "result",
      setGeneratorStep: vi.fn(),
      searchQuery: "Warsaw",
      setSearchQuery: vi.fn(),
      searchCandidates: [
        {
          id: "warsaw-pl",
          label: "Warsaw, Poland",
          description: "Warsaw, Masovian Voivodeship, Poland",
          sourceLabel: "Warsaw, Masovian Voivodeship, Poland",
          latitude: 52.2297,
          longitude: 21.0122,
        },
        {
          id: "warsaw-us",
          label: "Warsaw, United States",
          description: "Warsaw, Nebraska, United States",
          sourceLabel: "Warsaw, Nebraska, United States",
          latitude: 41.2995,
          longitude: -96.2801,
        },
      ],
      selectedCandidateId: "",
      setSelectedCandidateId: vi.fn(),
      pendingDraft: null,
      updatePendingDraft: vi.fn(),
      defaultNoiseRadius: 50,
      isDraftPending: false,
      saveInFlight: false,
      runGenerator: vi.fn(),
      selectCandidate: vi.fn(),
      saveGenerator: vi.fn(),
    } as never);

    root = await renderWithRoot();

    expect(document.getElementById("profile-generator-result-select")).not.toBeNull();
    expect(document.body.textContent).toContain("Warsaw, Poland");
    expect(document.body.textContent).toContain("Warsaw, United States");
    expect(
      (
        document.getElementById(
          "continue-profile-generator-result",
        ) as HTMLButtonElement | null
      )?.disabled,
    ).toBe(true);
  });

  it("continues with the selected search candidate", async () => {
    const selectCandidate = vi.fn();
    useSettingsMock.mockReturnValue({
      isGeneratorOpen: true,
      closeGenerator: vi.fn(),
      generatorStep: "result",
      setGeneratorStep: vi.fn(),
      searchQuery: "Warsaw",
      setSearchQuery: vi.fn(),
      searchCandidates: [
        {
          id: "warsaw-pl",
          label: "Warsaw, Poland",
          description: "Warsaw, Masovian Voivodeship, Poland",
          sourceLabel: "Warsaw, Masovian Voivodeship, Poland",
          latitude: 52.2297,
          longitude: 21.0122,
        },
      ],
      selectedCandidateId: "warsaw-pl",
      setSelectedCandidateId: vi.fn(),
      pendingDraft: null,
      updatePendingDraft: vi.fn(),
      defaultNoiseRadius: 50,
      isDraftPending: false,
      saveInFlight: false,
      runGenerator: vi.fn(),
      selectCandidate,
      saveGenerator: vi.fn(),
    } as never);

    root = await renderWithRoot();

    await act(async () => {
      document.getElementById("continue-profile-generator-result")?.click();
    });

    expect(selectCandidate).toHaveBeenCalledTimes(1);
  });

  it("returns from confirm to result when search disambiguation was shown", async () => {
    const setGeneratorStep = vi.fn();
    useSettingsMock.mockReturnValue({
      isGeneratorOpen: true,
      closeGenerator: vi.fn(),
      generatorStep: "confirm",
      setGeneratorStep,
      searchQuery: "Warsaw",
      setSearchQuery: vi.fn(),
      searchCandidates: [
        {
          id: "warsaw-pl",
          label: "Warsaw, Poland",
          description: "Warsaw, Masovian Voivodeship, Poland",
          sourceLabel: "Warsaw, Masovian Voivodeship, Poland",
          latitude: 52.2297,
          longitude: 21.0122,
        },
        {
          id: "warsaw-us",
          label: "Warsaw, United States",
          description: "Warsaw, Nebraska, United States",
          sourceLabel: "Warsaw, Nebraska, United States",
          latitude: 41.2995,
          longitude: -96.2801,
        },
      ],
      selectedCandidateId: "warsaw-pl",
      setSelectedCandidateId: vi.fn(),
      pendingDraft: basePendingProfileDraft,
      updatePendingDraft: vi.fn(),
      defaultNoiseRadius: 50,
      isDraftPending: false,
      saveInFlight: false,
      runGenerator: vi.fn(),
      saveGenerator: vi.fn(),
    } as never);

    root = await renderWithRoot();

    await act(async () => {
      document.getElementById("profile-generator-back")?.click();
    });

    expect(setGeneratorStep).toHaveBeenCalledWith("result");
  });

  it("renders Back as a ghost action with a left arrow on later steps", async () => {
    useSettingsMock.mockReturnValue({
      isGeneratorOpen: true,
      closeGenerator: vi.fn(),
      generatorStep: "language",
      setGeneratorStep: vi.fn(),
      searchQuery: "Ottawa",
      setSearchQuery: vi.fn(),
      pendingDraft: {
        ...basePendingProfileDraft,
        label: "Ottawa, Canada",
        language: "en-CA",
        languages: ["en-CA", "en"],
        languageSelection: {
          options: [
            {
              value: "en-CA",
              label: "English (Canada) [en-CA]",
              language: "en-CA",
              languages: ["en-CA", "en"],
            },
          ],
          selectedValue: "en-CA",
          required: true,
        },
      },
      updatePendingDraft: vi.fn(),
      defaultNoiseRadius: 50,
      isDraftPending: false,
      saveInFlight: false,
      runGenerator: vi.fn(),
      saveGenerator: vi.fn(),
    } as never);

    root = await renderWithRoot();

    const backButton = document.getElementById("profile-generator-back");
    expect(backButton?.className).toContain("text-muted-foreground");
    expect(backButton?.querySelector(".fa-arrow-left")).not.toBeNull();
  });
});
