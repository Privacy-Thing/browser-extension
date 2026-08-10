// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PlaygroundTab } from "./PlaygroundTab";

import type { LazyProfileDraftMapProps } from "@/ui/options/components/map/LazyProfileDraftMap";

const { lazyProfileDraftMapMock } = vi.hoisted(() => ({
  lazyProfileDraftMapMock: vi.fn((_props: LazyProfileDraftMapProps) => (
    <div data-testid="playground-map" />
  )),
}));

vi.mock("@/ui/options/components/map/LazyProfileDraftMap", () => ({
  LazyProfileDraftMap: lazyProfileDraftMapMock,
}));

vi.mock("@/ui/options/components/playground/PlaygroundComparisonCards", () => ({
  ComparisonCards: () => <div data-testid="comparison-cards" />,
}));

vi.mock("@/ui/components/ui/tabs", () => ({
  TabsContent: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="tabs-content">{children}</div>
  ),
}));

vi.mock("@/ui/options/components/playground/usePlaygroundState", () => ({
  usePlaygroundState: () => ({
    loaded: true,
    locations: [{ id: "warsaw", label: "Warsaw", accuracy: 22 }],
    selectedLocation: { id: "warsaw", label: "Warsaw", accuracy: 22 },
    selectedLocationId: "warsaw",
    selectedProfile: null,
    tracePoints: [{ latitude: 52.2297, longitude: 21.0122, accuracy: 22 }],
    useDemoInterval: false,
    localFingerprint: null,
    runtime: null,
    snapshot: {
      geo: {
        latitude: 52.23,
        longitude: 21.01,
        noiseRadius: 75,
      },
    },
    spoofedGeo: null,
    systemGeoStatus: "idle",
    systemGeo: null,
    systemValues: null,
    effectiveTimingSummary: {
      mode: "simple",
      note: "note",
      runtimeIntervalSeconds: [1, 2],
      liveSiteIntervalSeconds: [10, 15],
      watchDelaySeconds: [5, 8],
      callbackDelayMs: [120, 180],
    },
    mapDraft: { latitude: 52.2297, longitude: 21.0122 },
    mapRadius: 22,
    previewSeedInput: "abc123",
    watchPositionDelay: [1000, 2000],
    profilesEnabled: false,
    osmConsent: "granted",
    hasNativeGeolocation: true,
    handleSelectLocation: vi.fn(),
    handleClearTrace: vi.fn(),
    handlePreviewSeedChange: vi.fn(),
    randomizePreviewSeed: vi.fn(),
    handleRequestSystemGeo: vi.fn(),
    setUseDemoInterval: vi.fn(),
    requestOsmConsent: vi.fn(),
    openSettings: vi.fn(),
  }),
}));

const renderWithRoot = async (): Promise<Root> => {
  document.body.innerHTML = '<div id="root"></div>';
  const container = document.getElementById("root");
  if (!container) {
    throw new Error("Missing test root.");
  }

  const root = createRoot(container);
  await act(async () => {
    root.render(<PlaygroundTab />);
  });

  return root;
};

describe("PlaygroundTab", () => {
  let root: Root | null = null;
  const originalResizeObserver = globalThis.ResizeObserver;

  beforeEach(() => {
    Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
      configurable: true,
      value: true,
    });
    Object.defineProperty(Element.prototype, "scrollIntoView", {
      configurable: true,
      value: vi.fn(),
      writable: true,
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
      const currentRoot = root;
      root = null;
      await act(async () => {
        currentRoot.unmount();
      });
    }

    document.body.innerHTML = "";
    Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
    if (originalResizeObserver) {
      Object.defineProperty(globalThis, "ResizeObserver", {
        configurable: true,
        value: originalResizeObserver,
      });
    } else {
      Reflect.deleteProperty(globalThis, "ResizeObserver");
    }
    Reflect.deleteProperty(Element.prototype, "scrollIntoView");
    vi.clearAllMocks();
  });

  it("passes separate accuracy and range overlays into the playground map", async () => {
    root = await renderWithRoot();

    const lastCall = lazyProfileDraftMapMock.mock.lastCall?.[0];
    expect(lastCall?.accuracyRadius).toBe(22);
    expect(lastCall?.rangeRadius).toBe(75);
    expect(lastCall?.rangeCenter).toEqual({
      latitude: 52.23,
      longitude: 21.01,
    });
  });

  it("renders preview identity controls in the sidebar", async () => {
    root = await renderWithRoot();

    expect(document.body.textContent).toContain("Preview identity");
    expect(document.body.textContent).toContain("Generate new identity");
    expect(
      (document.getElementById("playground-preview-seed") as HTMLInputElement | null)
        ?.value,
    ).toBe("abc123");
    expect(document.body.textContent).not.toContain("Rule seed");
    expect(document.body.textContent).not.toContain("Applied seed:");
  });

  it("keeps map helper copy minimal and shows clear in the map header", async () => {
    root = await renderWithRoot();

    expect(document.body.textContent).toContain("Map preview");
    expect(document.body.textContent).toContain("Clear");
    expect(document.body.textContent).not.toContain(
      "Interactive preview of the selected preset and its waypoint trail.",
    );
    expect(document.body.textContent).not.toContain("1 waypoint");
  });

  it("keeps the help card collapsed by default and expands on header click", async () => {
    root = await renderWithRoot();

    expect(document.body.textContent).toContain("How to read this preview");
    expect(document.body.textContent).not.toContain("Language, locale, and time");

    const toggle = Array.from(
      document.querySelectorAll<HTMLButtonElement>('button[aria-expanded="false"]'),
    ).find((candidate) => candidate.textContent?.includes("How to read this preview"));
    expect(toggle).not.toBeNull();

    await act(async () => {
      (toggle as HTMLButtonElement).click();
    });

    expect(document.body.textContent).toContain("Language, locale, and time");
  });
});
