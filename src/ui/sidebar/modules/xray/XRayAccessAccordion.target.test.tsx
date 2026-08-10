// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { buildSurfaceAssessments } from "@/background/surface-assessments";
import type { RuntimeSnapshot } from "@/shared/types";
import { t } from "@/ui/i18n";
import { XRayAccessAccordion } from "@/ui/sidebar/modules/xray/XRayAccessAccordion";

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

describe("XRayAccessAccordion", () => {
  let root: Root | null = null;

  beforeEach(() => {
    Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
      configurable: true,
      value: true,
    });
    document.body.innerHTML = '<div id="root"></div>';
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

  it("renders method counts as expandable category details", async () => {
    const container = document.getElementById("root");
    if (!container) throw new Error("Missing test root.");
    root = createRoot(container);

    await act(async () => {
      root?.render(
        <XRayAccessAccordion
          assessments={buildSurfaceAssessments({
            source: "site-rule",
            snapshot,
            runtimeExpected: true,
            accessedCategories: { canvas: true },
            queryCounts: { canvas: 3 },
            methodCounts: { "canvas.toDataURL": 2 },
          })}
          surfaceSyncPending={false}
        />,
      );
    });

    const details = document.querySelector("details");
    expect(details).not.toBeNull();
    expect(document.body.textContent).toContain("Canvas");
    expect(document.body.textContent).toContain("Queried (3)");
    expect(document.body.textContent).toContain("toDataURL");
    expect(document.body.textContent).toContain("2");
  });

  it("labels the intercepted WebGL renderer query precisely", async () => {
    const container = document.getElementById("root");
    if (!container) throw new Error("Missing test root.");
    root = createRoot(container);

    await act(async () => {
      root?.render(
        <XRayAccessAccordion
          assessments={buildSurfaceAssessments({
            source: "site-rule",
            snapshot,
            runtimeExpected: true,
            accessedCategories: { webGL: true },
            queryCounts: { webGL: 1 },
            methodCounts: { "webGL.getExtension": 1 },
          })}
          surfaceSyncPending={false}
        />,
      );
    });

    expect(document.body.textContent).toContain("GPU renderer info");
    expect(document.body.textContent).not.toContain("gl.getExtension");
  });

  it("shows disabled fingerprint surfaces as off even when a fingerprint snapshot exists", async () => {
    const container = document.getElementById("root");
    if (!container) throw new Error("Missing test root.");
    root = createRoot(container);

    await act(async () => {
      root?.render(
        <XRayAccessAccordion
          assessments={buildSurfaceAssessments({
            source: "site-rule",
            runtimeExpected: true,
            snapshot: {
              ...snapshot,
              fingerprint: {
                platform: "Spoof OS",
                screen: { width: 1440, height: 900, colorDepth: 24, pixelDepth: 24 },
                spoofingToggles: { navigator: false, screen: false },
              },
            },
          })}
          surfaceSyncPending={false}
        />,
      );
    });

    expect(document.body.textContent).toContain(`Navigator${t.sidebar.accessed.off}`);
    expect(document.body.textContent).toContain(`Screen${t.sidebar.accessed.off}`);
  });

  it("omits browser-inapplicable surfaces instead of presenting them as off", async () => {
    const container = document.getElementById("root");
    if (!container) throw new Error("Missing test root.");
    root = createRoot(container);

    await act(async () => {
      root?.render(
        <XRayAccessAccordion
          assessments={buildSurfaceAssessments({
            source: "site-rule",
            snapshot,
            runtimeExpected: true,
            browserTarget: "firefox",
          })}
          surfaceSyncPending={false}
        />,
      );
    });

    expect(document.body.textContent).not.toContain("Client Hints");
    expect(document.body.textContent).not.toContain("Battery");
    expect(document.body.textContent).toContain("Navigator");
  });

  it("reports Dedicated Worker constructor activity as an armed runtime-only surface", async () => {
    const container = document.getElementById("root");
    if (!container) throw new Error("Missing test root.");
    root = createRoot(container);

    await act(async () => {
      root?.render(
        <XRayAccessAccordion
          assessments={buildSurfaceAssessments({
            source: "site-rule",
            snapshot,
            runtimeExpected: true,
            accessedCategories: { worker: true },
            queryCounts: { worker: 2 },
            methodCounts: { "worker.constructor": 2 },
          })}
          surfaceSyncPending={false}
        />,
      );
    });

    expect(document.body.textContent).toContain("Dedicated Workers");
    expect(document.body.textContent).toContain("Queried (2)");
    expect(document.body.textContent).toContain("Worker()");
  });
});
