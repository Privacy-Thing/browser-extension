import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { BUILD_BROWSER_TARGET } from "@/shared/build-flags";
import { EXTENSION_COMMAND_TYPES } from "@/shared/extension-contract";
import type { InspectorLiveMessage } from "@/shared/inspector-live-contract";

type Listener = (details: { tabId: number; frameId?: number }) => void;
const listeners: Record<string, Listener> = {};
const sent: { message: InspectorLiveMessage; target: Record<string, unknown> }[] = [];
let responses: (target: Record<string, unknown>) => unknown;
const frames = [
  { frameId: 0, documentId: "top", url: "https://probe.example/" },
  { frameId: 1, documentId: "blank", url: "about:blank" },
  { frameId: 2, documentId: "cross", url: "https://ads.example/frame" },
  { frameId: 3, documentId: "srcdoc", url: "about:srcdoc" },
];
const key = (target: Record<string, unknown>) =>
  BUILD_BROWSER_TARGET === "chromium" ? target.documentId : target.frameId;

beforeEach(() => {
  vi.resetModules();
  sent.length = 0;
  const stored: Record<string, unknown> = {};
  const event = (name: string) => ({
    addListener: (listener: Listener) => {
      listeners[name] = listener;
    },
  });
  vi.stubGlobal("chrome", {
    storage: {
      session: {
        get: vi.fn(async () => structuredClone(stored)),
        set: vi.fn(async (value: Record<string, unknown>) => {
          Object.assign(stored, structuredClone(value));
        }),
      },
    },
    tabs: {
      onRemoved: event("removed"),
      sendMessage: vi.fn(
        async (
          _tabId: number,
          message: InspectorLiveMessage,
          target: Record<string, unknown>,
        ) => {
          sent.push({ message, target });
          return responses(target);
        },
      ),
    },
    webNavigation: {
      onCreatedNavigationTarget: event("created"),
      onCommitted: event("committed"),
      getAllFrames: vi.fn(async () => frames),
    },
  });
});
afterEach(() => vi.unstubAllGlobals());

it("addresses every runtime document of the tab and aggregates its coverage", async () => {
  const live = await import("./inspector-live");
  responses = (target) => {
    const frame = key(target);
    if (frame === "srcdoc" || frame === 3)
      return { appliedVia: "not-live", reason: "same-origin-frame", endpoints: 2 };
    if (frame === "cross" || frame === 2) throw new Error("No receiving end");
    return { appliedVia: "live", endpoints: 2 };
  };
  const result = await live.applyInspectorLive(7, {
    methods: ["battery.manager.level"],
    mode: "every-call",
  });
  expect(result).toEqual({
    top: true,
    coverage: { live: 1, notLive: 2, reasons: ["no-channel", "same-origin-frame"] },
  });
  // about:blank realms follow their parent runtime and are not addressed.
  expect(sent.map(({ target }) => target)).toEqual(
    BUILD_BROWSER_TARGET === "chromium"
      ? [{ documentId: "top" }, { documentId: "cross" }, { documentId: "srcdoc" }]
      : [{ frameId: 0 }, { frameId: 2 }, { frameId: 3 }],
  );
  expect(sent[0]!.message).toEqual({
    type: EXTENSION_COMMAND_TYPES.applyXRayInspectorLive,
    opened: false,
    command: { r: expect.any(Number), m: ["battery.manager.level"], e: true },
  });
});

it("orders live revisions even when the clock does not advance", async () => {
  vi.spyOn(Date, "now").mockReturnValue(1_000);
  const live = await import("./inspector-live");
  responses = () => ({ appliedVia: "live", endpoints: 1 });
  await live.applyInspectorLive(7, null);
  await live.applyInspectorLive(7, null);
  const [first, second] = sent
    .filter(({ target }) => key(target) === "top" || key(target) === 0)
    .map(({ message }) => message.command!.r);
  expect(first).toBe(1_000);
  expect(second).toBe(1_001);
  vi.restoreAllMocks();
});

it("marks a script-opened tab until its next top-level document", async () => {
  const live = await import("./inspector-live");
  live.trackOpenedTabs();
  responses = () => ({ appliedVia: "live", endpoints: 2 });
  const opened = async () => {
    sent.length = 0;
    await live.probeInspectorLive(9);
    return sent[0]!.message.opened;
  };
  expect(await opened()).toBe(false);
  listeners.created!({ tabId: 9 });
  expect(await opened()).toBe(true);
  listeners.committed!({ tabId: 9, frameId: 0 });
  listeners.committed!({ tabId: 9, frameId: 4 });
  expect(await opened()).toBe(true);
  listeners.committed!({ tabId: 9, frameId: 0 });
  expect(await opened()).toBe(false);
  listeners.created!({ tabId: 9 });
  (listeners.removed as unknown as (tabId: number) => void)(9);
  expect(await opened()).toBe(false);
  // The probe asks the top document only and sends no binding.
  expect(sent).toEqual([
    {
      message: {
        type: EXTENSION_COMMAND_TYPES.applyXRayInspectorLive,
        opened: false,
        command: null,
      },
      target: { frameId: 0 },
    },
  ]);
});

it("survives a background restart with the opened mark", async () => {
  let live = await import("./inspector-live");
  live.trackOpenedTabs();
  listeners.created!({ tabId: 4 });
  responses = () => ({ appliedVia: "live", endpoints: 2 });
  await live.probeInspectorLive(4);
  vi.resetModules();
  live = await import("./inspector-live");
  sent.length = 0;
  await live.probeInspectorLive(4);
  expect(sent[0]!.message.opened).toBe(true);
});
