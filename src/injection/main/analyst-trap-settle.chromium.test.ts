// @vitest-environment jsdom

import { getWindowSeedPrefix } from "@privacy-brand/refract-browser/common/runtime-config";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { setMainWorldSnapshot } from "@/background/main-world-injection";
import {
  RUNTIME_CONFIG_ATTR,
  RUNTIME_DISABLED_ATTR,
  RUNTIME_PAYLOAD_ATTR,
  RUNTIME_READY_EVENT_NAME,
} from "@/shared/build-id-test-values";
import type { RuntimeSnapshot } from "@/shared/types";

const mocks = vi.hoisted(() => ({ pause: vi.fn() }));

// The debugger statement is the only sink replaced; selection handling is real.
vi.mock("@privacy-brand/refract-core/runtime/analyst-trap", () => ({
  pause: mocks.pause,
}));
// Spoofing surfaces are not under test.
vi.mock("@privacy-brand/refract-core/runtime/install", () => ({
  getRefractRuntimeState: vi.fn(() => undefined),
  installRuntimeOnce: vi.fn(() => ({})),
  updateRefractSnapshot: vi.fn(),
}));

const snapshot = (analystTraps?: RuntimeSnapshot["analystTraps"]): RuntimeSnapshot => ({
  geo: { latitude: 52.23, longitude: 21.01, accuracy: 25, noiseRadius: 100 },
  locale: {
    language: "pl-PL",
    languages: ["pl-PL"],
    timeZone: "Europe/Warsaw",
    acceptLanguage: "pl-PL",
  },
  date: { baseEpochMs: 0, offsetMs: 0, timeZone: "Europe/Warsaw" },
  debugMode: false,
  watchPositionDelay: [60, 500],
  authKey: "settle-test",
  ...(analystTraps ? { analystTraps } : {}),
});
const everyDate = { methods: ["date.now"], mode: "every-call" } as const;
const firstBattery = {
  methods: ["battery.manager.level"],
  mode: "first-call",
} as const;

/** What the previous document's runtime stores in window.name while unloading. */
const unloadSeed = (value: RuntimeSnapshot): string =>
  getWindowSeedPrefix() +
  btoa(
    JSON.stringify({
      kind: "snapshot",
      previousName: "",
      sourceHostname: location.hostname,
      snapshot: value,
    }),
  );

/** The background's tab-aware delivery after the document commits. */
const deliverAfterCommit = (value: RuntimeSnapshot): void =>
  setMainWorldSnapshot({
    snapshot: value,
    readyEvent: RUNTIME_READY_EVENT_NAME,
    markerAttr: RUNTIME_CONFIG_ATTR,
    payloadAttr: RUNTIME_PAYLOAD_ATTR,
    offAttr: RUNTIME_DISABLED_ATTR,
  });

const startDocument = async (seed: RuntimeSnapshot) => {
  window.name = unloadSeed(seed);
  await import("@/injection/main/index");
  const usage =
    await import("@privacy-brand/refract-browser/common/surface-usage-emitter");
  return (methodId: "date.now" | "battery.manager.level") =>
    usage.markSurfaceUsed(methodId === "date.now" ? "timeLocale" : "battery", methodId);
};

describe("Chromium Inspector selection after commit", () => {
  beforeEach(() => mocks.pause.mockReset());
  afterEach(() => {
    vi.resetModules();
    window.name = "";
    document.head.innerHTML = "";
  });

  it("replaces a selection that the document took from the previous document's unload seed", async () => {
    const read = await startDocument(snapshot(everyDate));
    read("date.now");
    expect(mocks.pause).toHaveBeenCalledTimes(1);
    deliverAfterCommit(snapshot(firstBattery));
    mocks.pause.mockReset();
    read("date.now");
    expect(mocks.pause).not.toHaveBeenCalled();
    read("battery.manager.level");
    read("battery.manager.level");
    expect(mocks.pause).toHaveBeenCalledTimes(1);
    deliverAfterCommit(snapshot());
    mocks.pause.mockReset();
    read("battery.manager.level");
    expect(mocks.pause).not.toHaveBeenCalled();
  });

  it("keeps first-call state when the delivered selection is unchanged", async () => {
    const read = await startDocument(snapshot(firstBattery));
    read("battery.manager.level");
    deliverAfterCommit(snapshot(firstBattery));
    read("battery.manager.level");
    expect(mocks.pause).toHaveBeenCalledTimes(1);
  });
});
