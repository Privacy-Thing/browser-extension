// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ComparisonCards,
  type ComparisonCardsProps,
} from "./PlaygroundComparisonCards";

const createRuntime = (): ComparisonCardsProps["runtime"] => ({
  locale: {
    language: "ja",
    languages: ["ja", "en-US"],
    timeZone: "Asia/Tokyo",
    acceptLanguage: "ja,en-US",
  },
  date: {
    getTimezoneOffset: () => -540,
    toString: () => `spoofed string ${Date.now()}`,
    toDateString: () => `spoofed date ${Date.now()}`,
    toTimeString: () => `spoofed time ${Date.now()}`,
    toLocaleString: () => `spoofed locale ${Date.now()}`,
    toLocaleDateString: () => `spoofed locale date ${Date.now()}`,
    toLocaleTimeString: () => `spoofed locale time ${Date.now()}`,
  },
  geo: {
    latitude: 35.6762,
    longitude: 139.6503,
    accuracy: 100,
    noiseRadius: 50,
  },
});

const createProps = (): ComparisonCardsProps => ({
  runtime: createRuntime(),
  selectedLocationLabel: "Tokyo",
  systemValues: {
    language: "en-US",
    languages: ["en-US", "en"],
    timeZone: "America/New_York",
    acceptLanguage: "en-US,en",
    dateString: "",
    dateToDateString: "",
    dateToTimeString: "",
    dateLocaleString: "",
    dateLocaleDateString: "",
    dateLocaleTimeString: "",
    timezoneOffset: 300,
  },
  localFingerprint: {
    userAgent: "Mozilla/5.0",
    appVersion: "5.0",
    vendor: "Google Inc.",
    platform: "MacIntel",
    hardwareConcurrency: 8,
    webRTCAvailable: true,
    capturedFingerprint: null,
  },
  spoofedGeo: null,
  systemGeoStatus: "idle",
  systemGeo: null,
});

const renderWithRoot = async (
  props: ComparisonCardsProps = createProps(),
): Promise<Root> => {
  document.body.innerHTML = '<div id="root"></div>';
  const container = document.getElementById("root");
  if (!container) {
    throw new Error("Missing test root.");
  }

  const root = createRoot(container);
  await act(async () => {
    root.render(<ComparisonCards {...props} />);
  });

  return root;
};

describe("ComparisonCards", () => {
  let root: Root | null = null;

  afterEach(async () => {
    if (root) {
      const currentRoot = root;
      root = null;
      await act(async () => {
        currentRoot.unmount();
      });
    }

    vi.useRealTimers();
    document.body.innerHTML = "";
  });

  it("refreshes spoofed date values on the live clock tick", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-15T12:00:00.000Z"));

    root = await renderWithRoot();

    expect(document.body.textContent).toContain("spoofed time 1768478400000");

    await act(async () => {
      vi.advanceTimersByTime(1_000);
    });

    expect(document.body.textContent).toContain("spoofed time 1768478401000");
    expect(document.body.textContent).not.toContain("spoofed time 1768478400000");
  });

  it("renders the spoofed location header in uppercase", async () => {
    root = await renderWithRoot();

    const header = Array.from(document.querySelectorAll("th")).find(
      (element) => element.textContent === "Tokyo",
    );
    expect(header?.className).toContain("uppercase");
  });
});
