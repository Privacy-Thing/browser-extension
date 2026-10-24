import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { BUILD_BROWSER_TARGET } from "@/shared/build-flags";
import { EXTENSION_COMMAND_TYPES } from "@/shared/extension-contract";
import type { InspectorLiveMessage } from "@/shared/inspector-live-contract";

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
  vi.stubGlobal("chrome", {
    tabs: {
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
    webNavigation: { getAllFrames: vi.fn(async () => frames) },
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

it("probes only the top document and sends no binding", async () => {
  const live = await import("./inspector-live");
  responses = () => ({ appliedVia: "live", endpoints: 2 });
  expect(await live.probeInspectorLive(9)).toBe(true);
  expect(sent).toEqual([
    {
      message: { type: EXTENSION_COMMAND_TYPES.applyXRayInspectorLive, command: null },
      target: { frameId: 0 },
    },
  ]);
});
