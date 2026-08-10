// @vitest-environment jsdom

import type { SharedWorkerStatus } from "@privacy-brand/xray-protocol";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { RuntimeSnapshot } from "@/shared/types";
import { XRaySurfacesSection } from "@/ui/sidebar/modules/xray/XRaySurfacesSection";

vi.mock("@/ui/components/ui/button", () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}));

const snapshot: RuntimeSnapshot = {
  geo: { latitude: 52.23, longitude: 21.01, accuracy: 100, noiseRadius: 500 },
  locale: {
    language: "pl-PL",
    languages: ["pl-PL"],
    timeZone: "Europe/Warsaw",
    acceptLanguage: "pl-PL",
  },
  date: { baseEpochMs: 0, offsetMs: 3600000, timeZone: "Europe/Warsaw" },
  debugMode: false,
  watchPositionDelay: [60, 500] as [number, number],
};

const renderSection = async (
  snapshotArg: RuntimeSnapshot = snapshot,
  sharedWorkerStatus?: SharedWorkerStatus,
): Promise<Root> => {
  document.body.innerHTML = '<div id="root"></div>';
  const container = document.getElementById("root");
  if (!container) {
    throw new Error("Missing test root.");
  }

  const root = createRoot(container);
  await act(async () => {
    root.render(
      <XRaySurfacesSection
        snapshot={snapshotArg}
        {...(sharedWorkerStatus ? { sharedWorkerStatus } : {})}
        displayedProfileLabel="Warsaw"
        locationId={null}
      />,
    );
  });
  return root;
};

describe("XRaySurfacesSection", () => {
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
  });

  it("shows Shared Worker native compatibility as an intentional status", async () => {
    root = await renderSection();

    const text = document.body.textContent ?? "";
    expect(text).toContain("Shared Worker");
    expect(text).toContain("Native for compatibility");
  });

  it("shows blob-wrapper spoofing when SharedWorker compatibility mode is off without a browser status", async () => {
    root = await renderSection({
      ...snapshot,
      sharedWorkerCompatibilityMode: false,
    });

    expect(document.body.textContent).toContain("Spoofed via blob wrapper");
  });

  it("shows Firefox response-rewrite SharedWorker spoofing distinctly", async () => {
    root = await renderSection(
      {
        ...snapshot,
        sharedWorkerCompatibilityMode: false,
      },
      "response-rewrite-preserved-identity",
    );

    expect(document.body.textContent).toContain("Spoofed via response rewrite");
  });

  it("shows cache-sensitive Firefox SharedWorker rewrite distinctly", async () => {
    root = await renderSection(
      {
        ...snapshot,
        sharedWorkerCompatibilityMode: false,
      },
      "response-rewrite-cache-sensitive",
    );

    expect(document.body.textContent).toContain("Rewrite fallback; cache-sensitive");
  });

  it("shows SharedWorker identity conflicts distinctly", async () => {
    root = await renderSection(
      {
        ...snapshot,
        sharedWorkerCompatibilityMode: false,
      },
      "identity-conflict",
    );

    expect(document.body.textContent).toContain("Identity conflict");
  });

  it("hides fingerprint values when their per-surface toggles are disabled", async () => {
    root = await renderSection({
      ...snapshot,
      fingerprint: {
        platform: "Spoof OS",
        userAgent: "Spoof UA",
        hardwareConcurrency: 12,
        deviceMemory: 8,
        screen: { width: 1440, height: 900, colorDepth: 24, pixelDepth: 24 },
        webGL: { renderer: "Fake GPU", vendor: "Fake Vendor", suppressDebugInfo: true },
        spoofingToggles: {
          navigator: false,
          screen: false,
          webGL: true,
        },
      },
    });

    const text = document.body.textContent ?? "";
    expect(text).not.toContain("Spoof OS");
    expect(text).not.toContain("Spoof UA");
    expect(text).not.toContain("12 / 8 GB");
    expect(text).not.toContain("1440×900");
    expect(text).not.toContain("Fake GPU");
    expect(text).not.toContain("Fake Vendor");
    expect(text).toContain("GPU debug");
  });
});
