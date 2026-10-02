// @vitest-environment jsdom

import type { GetXRayStateResponse } from "@privacy-brand/xray-protocol";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildSurfaceAssessments } from "@/background/surface-assessments";
import { EXTENSION_COMMAND_TYPES } from "@/shared/extension-contract";
import type { SidebarPushEvent } from "@/shared/sidebar-events";
import { useXRayState } from "@/ui/sidebar/useXRayState";

const snapshot: Extract<GetXRayStateResponse, { ok: true }>["snapshot"] = {
  geo: { latitude: 0, longitude: 0, accuracy: 0, noiseRadius: 50 },
  locale: {
    language: "en",
    languages: ["en"],
    timeZone: "UTC",
    acceptLanguage: "en",
  },
  date: { baseEpochMs: 0, offsetMs: 0, timeZone: "UTC" },
  debugMode: false,
  watchPositionDelay: [60, 500],
  geolocationEnabled: false,
  timeLocaleEnabled: false,
  fingerprint: {},
};

const initialXRayState: GetXRayStateResponse = {
  ok: true,
  hostname: "example.com",
  snapshot,
  displayedProfileLabel: null,
  locationId: null,
  rulePattern: null,
  assessments: buildSurfaceAssessments({
    source: "site-rule",
    snapshot,
    runtimeExpected: true,
  }),
  accessedCategories: {},
  failedCategories: {},
  explanation: null,
};

const Harness = ({ tabId = 7 }: { tabId?: number }) => {
  const { state } = useXRayState(tabId);
  return createElement("pre", null, JSON.stringify(state));
};

describe("useXRayState", () => {
  let root: Root | null = null;
  let pushSidebarEvent: ((event: SidebarPushEvent) => void) | null = null;

  beforeEach(() => {
    Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
      configurable: true,
      value: true,
    });
    document.body.innerHTML = '<div id="root"></div>';
    pushSidebarEvent = null;

    vi.stubGlobal("chrome", {
      runtime: {
        id: "abc",
        connect: vi.fn(() => ({
          onMessage: {
            addListener: vi.fn((listener: (event: SidebarPushEvent) => void) => {
              pushSidebarEvent = listener;
            }),
          },
          onDisconnect: { addListener: vi.fn() },
          disconnect: vi.fn(),
        })),
        lastError: undefined,
        sendMessage: vi.fn((message) => {
          expect(message).toEqual({
            type: EXTENSION_COMMAND_TYPES.getXRayState,
            tabId: 7,
          });
          return Promise.resolve(initialXRayState);
        }),
      },
      tabs: {
        onUpdated: {
          addListener: vi.fn(),
          removeListener: vi.fn(),
        },
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
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    document.body.innerHTML = "";
    Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
  });

  it("merges late surface usage updates into the current XRay state", async () => {
    const container = document.getElementById("root");
    if (!container) throw new Error("Missing test root.");
    root = createRoot(container);

    await act(async () => {
      root?.render(createElement(Harness));
    });

    expect(document.body.textContent).toContain('"accessedCategories":{}');
    expect(pushSidebarEvent).not.toBeNull();

    await act(async () => {
      pushSidebarEvent?.({
        type: "surface-usage-updated",
        tabId: 7,
        categories: ["canvas"],
        queryCounts: { canvas: 3 },
        methodCounts: { "canvas.toDataURL": 2 },
      });
    });

    expect(document.body.textContent).toContain('"canvas":true');
    expect(document.body.textContent).toContain(
      '"key":"canvas","group":"rendering-media","applicability":"applicable","evidence":{"policy":"protect","installation":"installed","integrity":"intact","enforcement":"javascript","reasons":[]},"activity":{"accessed":true',
    );
    expect(document.body.textContent).toContain('"presentation":"protected"');
    expect(document.body.textContent).toContain('"queryCounts":{"canvas":3}');
    expect(document.body.textContent).toContain(
      '"methodCounts":{"canvas.toDataURL":2}',
    );
  });
});

describe("sidebar tab snapshot ownership", () => {
  it("hides the previous tab and ignores its late response after switching tabs", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
      configurable: true,
      value: true,
    });
    let resolveA: ((response: GetXRayStateResponse) => void) | undefined;
    let resolveB: ((response: GetXRayStateResponse) => void) | undefined;
    const sendMessage = vi.fn(
      (message: { tabId: number }) =>
        new Promise<GetXRayStateResponse>((resolve) => {
          if (message.tabId === 7) resolveA = resolve;
          else resolveB = resolve;
        }),
    );
    vi.stubGlobal("chrome", {
      runtime: {
        id: "abc",
        sendMessage,
        connect: () => ({
          onMessage: { addListener: vi.fn() },
          onDisconnect: { addListener: vi.fn() },
          disconnect: vi.fn(),
        }),
      },
      tabs: { onUpdated: { addListener: vi.fn(), removeListener: vi.fn() } },
    });
    const root = createRoot(container);
    try {
      await act(async () => root.render(createElement(Harness, { tabId: 7 })));
      await act(async () => resolveA?.(initialXRayState));
      expect(container.textContent).toContain('"hostname":"example.com"');
      await act(async () => root.render(createElement(Harness, { tabId: 8 })));
      expect(container.textContent).toBe("null");
      await act(async () => root.render(createElement(Harness, { tabId: 7 })));
      // The response for B must not overwrite A after a rapid A → B → A switch.
      await act(async () => resolveB?.({ ...initialXRayState, hostname: "b.example" }));
      expect(container.textContent).not.toContain("b.example");
      await act(async () => resolveA?.({ ...initialXRayState, hostname: "a.example" }));
      expect(container.textContent).toContain("a.example");
    } finally {
      await act(async () => root.unmount());
      container.remove();
      vi.unstubAllGlobals();
      Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
    }
  });
});
