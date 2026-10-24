import { afterEach, describe, expect, it, vi } from "vitest";

import { createInspectorApi, InspectorMissingError } from "./inspector-api";
import {
  CMD_XRAY_CLEAR_INSPECTOR,
  CMD_XRAY_GET_INSPECTOR_STATE,
  CMD_XRAY_SET_INSPECTOR,
  type XRayInspectorState,
} from "./inspector-contract";

const armedState: XRayInspectorState = {
  available: true,
  armed: true,
  methodIds: ["battery.manager.level"],
  mode: "first-call",
  pendingReload: false,
  appliesLive: false,
  trappableMethodIds: ["battery.manager.level", "date.now"],
};

const stubRuntime = (sendMessage: (message: unknown) => Promise<unknown>) => {
  const spy = vi.fn(sendMessage);
  vi.stubGlobal("chrome", { runtime: { id: "test-extension", sendMessage: spy } });
  return spy;
};

describe("runtime Inspector API", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reads the per-tab state through the background command", async () => {
    const send = stubRuntime(() => Promise.resolve(armedState));
    await expect(createInspectorApi().get(7)).resolves.toEqual(armedState);
    expect(send).toHaveBeenCalledWith({ type: CMD_XRAY_GET_INSPECTOR_STATE, tabId: 7 });
  });

  it.each([
    ["resolves without a response", () => Promise.resolve(undefined)],
    [
      "rejects because nobody answered",
      () =>
        Promise.reject(
          new Error("The message port closed before a response was received."),
        ),
    ],
    ["answers with an unknown shape", () => Promise.resolve({ ok: true })],
  ])(
    "degrades to unavailable (no-runtime) when the background %s",
    async (_case, reply) => {
      stubRuntime(reply);
      await expect(createInspectorApi().get(7)).resolves.toMatchObject({
        available: false,
        unavailableReason: "no-runtime",
        armed: false,
        trappableMethodIds: [],
      });
    },
  );

  it("surfaces background errors instead of hiding them as no-runtime", async () => {
    stubRuntime(() => Promise.resolve({ ok: false, error: "Tab is gone." }));
    await expect(createInspectorApi().get(7)).rejects.toThrow("Tab is gone.");
  });

  it.each(["now", "next-load"] as const)(
    "sends the selection, mode and apply=%s when arming",
    async (apply) => {
      const send = stubRuntime(() =>
        Promise.resolve({ state: armedState, appliedVia: "reload" }),
      );
      await expect(
        createInspectorApi().set({
          tabId: 3,
          methodIds: ["battery.manager.level"],
          mode: "every-call",
          apply,
        }),
      ).resolves.toEqual({ state: armedState, appliedVia: "reload" });
      expect(send).toHaveBeenCalledWith({
        type: CMD_XRAY_SET_INSPECTOR,
        tabId: 3,
        methodIds: ["battery.manager.level"],
        mode: "every-call",
        apply,
      });
    },
  );

  it("sends apply with the clear command", async () => {
    const disarmed = { ...armedState, armed: false, methodIds: [] };
    const send = stubRuntime(() =>
      Promise.resolve({ state: disarmed, appliedVia: "next-load" }),
    );
    await createInspectorApi().clear({ tabId: 3, apply: "next-load" });
    expect(send).toHaveBeenCalledWith({
      type: CMD_XRAY_CLEAR_INSPECTOR,
      tabId: 3,
      apply: "next-load",
    });
  });

  it("reports a missing runtime when a command is not understood", async () => {
    stubRuntime(() => Promise.resolve(undefined));
    await expect(
      createInspectorApi().clear({ tabId: 3, apply: "now" }),
    ).rejects.toBeInstanceOf(InspectorMissingError);
  });
});
