// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { LocationEditorModal } from "./LocationEditorModal";

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
    <div data-testid="location-editor-map" />
  )),
}));

vi.mock("@/ui/options/components/map/LazyProfileDraftMap", () => ({
  LazyProfileDraftMap: lazyProfileDraftMapMock,
}));

const { locationFieldsMock } = vi.hoisted(() => ({
  locationFieldsMock: vi.fn(
    ({
      draft,
      activeSection,
      onSectionOpenChange,
    }: {
      draft: typeof baseProfile;
      onDraftChange: (
        mutate: (current: typeof baseProfile) => typeof baseProfile,
      ) => void;
      activeSection?: "geolocation" | "locale" | "advanced" | null;
      onSectionOpenChange?: (section: "geolocation" | "locale" | null) => void;
    }) => (
      <div data-testid="location-details-fields">
        <span data-testid="location-details-label">{draft.label}</span>
        <button
          type="button"
          aria-expanded={activeSection === "geolocation"}
          onClick={() =>
            onSectionOpenChange?.(
              activeSection === "geolocation" ? null : "geolocation",
            )
          }
        >
          Geolocation
        </button>
        <button
          type="button"
          aria-expanded={activeSection === "locale"}
          onClick={() =>
            onSectionOpenChange?.(activeSection === "locale" ? null : "locale")
          }
        >
          Time &amp; language
        </button>
      </div>
    ),
  ),
}));

vi.mock("@/ui/options/components/modals/LocationDetailsFields", () => ({
  LocationDetailsFields: locationFieldsMock,
}));

vi.mock("@/ui/options/state/SettingsContext", () => ({
  useSettings: vi.fn(),
}));

const useSettingsMock = vi.mocked(useSettings);

const baseProfile = {
  id: "warsaw",
  label: "Warsaw",
  latitude: 52.2297,
  longitude: 21.0122,
  accuracy: 30,
  noiseRadius: 50,
  language: "pl-PL",
  languages: ["pl-PL", "pl"],
  timeZone: "Europe/Warsaw",
};

const createSettingsValue = ({
  profile = baseProfile,
  profileDialogOpened = true,
  profileEditorSessionId = 1,
}: {
  profile?: typeof baseProfile;
  profileDialogOpened?: boolean;
  profileEditorSessionId?: number;
} = {}) => ({
  profiles: [profile],
  editingProfileIndex: 0,
  pendingEditorDraft: null,
  profileDialogOpened,
  profileEditorSessionId,
  setProfileDialogOpened: vi.fn(),
  saveInFlight: false,
  handleDuplicateProfile: vi.fn(),
  handleRemoveProfile: vi.fn(),
  handlePersistProfile: vi.fn(),
  osmConsent: "denied",
  openOsmDialog: vi.fn(),
});

const renderWithRoot = async (): Promise<Root> => {
  document.body.innerHTML = '<div id="root"></div>';
  const container = document.getElementById("root");
  if (!container) {
    throw new Error("Missing test root.");
  }

  const root = createRoot(container);
  await act(async () => {
    root.render(<LocationEditorModal />);
  });
  await flushReactEffects();
  return root;
};

describe("LocationEditorModal", () => {
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

  it("keeps rendered content visible after close starts", async () => {
    useSettingsMock.mockReturnValue(createSettingsValue() as never);

    root = await renderWithRoot();
    expect(
      document.querySelector('[data-testid="location-details-fields"]'),
    ).not.toBeNull();

    useSettingsMock.mockReturnValue(
      createSettingsValue({ profileDialogOpened: false }) as never,
    );

    await act(async () => {
      root?.render(<LocationEditorModal />);
    });
    await flushReactEffects();

    expect(
      document.querySelector('[data-testid="location-details-fields"]'),
    ).not.toBeNull();
  });

  it("keeps unsaved draft changes when the profile reference refreshes", async () => {
    useSettingsMock.mockReturnValue(createSettingsValue() as never);
    root = await renderWithRoot();

    const onDraftChange = locationFieldsMock.mock.lastCall?.[0].onDraftChange;
    await act(async () => {
      onDraftChange?.((current: typeof baseProfile) => ({
        ...current,
        label: "Unsaved",
      }));
    });

    useSettingsMock.mockReturnValue(
      createSettingsValue({ profile: { ...baseProfile, label: "Refreshed" } }) as never,
    );
    await act(async () => {
      root?.render(<LocationEditorModal />);
    });

    expect(
      document.querySelector('[data-testid="location-details-label"]')?.textContent,
    ).toBe("Unsaved");
  });

  it("starts a fresh draft when a new editor session opens", async () => {
    useSettingsMock.mockReturnValue(createSettingsValue() as never);
    root = await renderWithRoot();

    const onDraftChange = locationFieldsMock.mock.lastCall?.[0].onDraftChange;
    await act(async () => {
      onDraftChange?.((current: typeof baseProfile) => ({
        ...current,
        label: "Unsaved",
      }));
    });

    useSettingsMock.mockReturnValue(
      createSettingsValue({
        profile: { ...baseProfile, label: "Refreshed" },
        profileEditorSessionId: 2,
      }) as never,
    );
    await act(async () => {
      root?.render(<LocationEditorModal />);
    });

    expect(
      document.querySelector('[data-testid="location-details-label"]')?.textContent,
    ).toBe("Refreshed");
  });

  it("keeps at most one editor section expanded", async () => {
    useSettingsMock.mockReturnValue(createSettingsValue() as never);
    root = await renderWithRoot();

    const geolocation = Array.from(document.querySelectorAll("button")).find(
      (button) => button.textContent === "Geolocation",
    );
    const locale = Array.from(document.querySelectorAll("button")).find(
      (button) => button.textContent === "Time & language",
    );
    if (!geolocation || !locale) throw new Error("Missing editor section controls.");

    expect(geolocation.getAttribute("aria-expanded")).toBe("true");
    expect(locale.getAttribute("aria-expanded")).toBe("false");

    await act(async () => locale.click());
    expect(geolocation.getAttribute("aria-expanded")).toBe("false");
    expect(locale.getAttribute("aria-expanded")).toBe("true");
  });

  it("passes separate range and accuracy radii into the editor map", async () => {
    useSettingsMock.mockReturnValue({
      ...createSettingsValue(),
      osmConsent: "granted",
    } as never);

    root = await renderWithRoot();

    const lastCall = lazyProfileDraftMapMock.mock.lastCall?.[0];
    expect(lastCall?.rangeRadius).toBe(50);
    expect(lastCall?.accuracyRadius).toBe(30);
  });

  it("lists dependencies and disables deletion while the preset is assigned", async () => {
    useSettingsMock.mockReturnValue({
      ...createSettingsValue(),
      regionalPresetUsage: new Map([
        [
          baseProfile.id,
          {
            locationId: baseProfile.id,
            sources: [
              {
                kind: "domain-rule",
                key: "example.com",
                label: "Domain Rule: example.com",
                enabled: false,
              },
            ],
          },
        ],
      ]),
    } as never);

    root = await renderWithRoot();

    expect(document.body.textContent).toContain("This preset is still assigned");
    expect(document.body.textContent).toContain("Domain Rule: example.com (off)");
    const deleteButton = Array.from(document.querySelectorAll("button")).find(
      (button) => button.textContent === "Delete",
    );
    expect(deleteButton?.disabled).toBe(true);
  });
});
