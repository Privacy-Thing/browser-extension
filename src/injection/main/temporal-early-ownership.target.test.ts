// @vitest-environment jsdom

import {
  hasEarlyTemporalOwner,
  markEarlyTemporalOwner,
  readConfigElement,
  writeConfigElement,
} from "@privacy-brand/refract-browser/common/runtime-config";
import { afterEach, describe, expect, it } from "vitest";

import type { RuntimeSnapshot } from "@/shared/types";

const snapshot = {
  geo: { latitude: 0, longitude: 0, accuracy: 0, noiseRadius: 0 },
  locale: {
    language: "pl-PL",
    languages: ["pl-PL"],
    timeZone: "Europe/Warsaw",
    acceptLanguage: "pl-PL,pl;q=0.9",
  },
  date: { baseEpochMs: 0, offsetMs: 0, timeZone: "Europe/Warsaw" },
  debugMode: false,
  watchPositionDelay: [60, 500],
  temporalApiEnabled: true,
} satisfies RuntimeSnapshot;

describe("Chromium early Temporal ownership handoff", () => {
  afterEach(() => {
    document.head.innerHTML = "";
    document.body.innerHTML = "";
  });

  it("marks the existing config without changing its snapshot payload", () => {
    expect(writeConfigElement(document, snapshot)).toBe(true);
    expect(hasEarlyTemporalOwner(document)).toBe(false);

    expect(markEarlyTemporalOwner(document)).toBe(true);

    expect(hasEarlyTemporalOwner(document)).toBe(true);
    expect(readConfigElement(document)).toEqual(snapshot);
  });
});
