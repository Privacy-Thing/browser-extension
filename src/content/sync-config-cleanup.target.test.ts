// @vitest-environment jsdom

import { findRuntimeConfigElement } from "@privacy-brand/refract-browser/common/runtime-config";
import { afterEach, describe, expect, it } from "vitest";

import { RUNTIME_APPLIED_ATTR } from "@/shared/build-id-test-values";
import type { RuntimeSnapshot } from "@/shared/types";

const APPLIED_MARKER_ATTR = `data-${RUNTIME_APPLIED_ATTR}`;

const createSnapshot = (): RuntimeSnapshot => ({
  geo: { latitude: 52.23, longitude: 21.01, accuracy: 25, noiseRadius: 100 },
  locale: {
    language: "pl-PL",
    languages: ["pl-PL"],
    timeZone: "Europe/Warsaw",
    acceptLanguage: "pl-PL,pl;q=0.9",
  },
  date: { baseEpochMs: 0, offsetMs: 0, timeZone: "Europe/Warsaw" },
  debugMode: false,
  watchPositionDelay: [60, 500],
});

afterEach(() => {
  document.documentElement.removeAttribute(APPLIED_MARKER_ATTR);
  findRuntimeConfigElement()?.remove();
});

describe("injectRuntimeConfig handoff cleanup", () => {
  it("does not trust a page-owned applied marker to suppress the handoff", async () => {
    document.documentElement.setAttribute(APPLIED_MARKER_ATTR, "");
    const { injectRuntimeConfig } = await import("@/content/sync-config");

    injectRuntimeConfig(createSnapshot());
    expect(findRuntimeConfigElement()).not.toBeNull();
  });

  it("keeps the handoff element when the runtime has not applied yet", async () => {
    const { injectRuntimeConfig } = await import("@/content/sync-config");

    injectRuntimeConfig(createSnapshot());
    // Runtime is still observing for it (e.g. window.name was missed) — keep it.
    expect(findRuntimeConfigElement()).not.toBeNull();
  });
});
