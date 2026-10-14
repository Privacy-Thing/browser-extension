import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { registerFeatureMessages } from "./plugin-feature-messages";

import type * as ProviderFeatures from "@/background/provider-features";
import { FEATURE_COMMANDS } from "@/shared/provider-feature";

const respond = vi.hoisted(() => vi.fn(async () => ({ ok: true })));
const createController = vi.hoisted(() => vi.fn(() => ({ respond })));

vi.mock("@/background/provider-features", async (importOriginal) => {
  const actual = await importOriginal<typeof ProviderFeatures>();
  return { ...actual, createFeatureController: createController };
});

type MessageListener = (
  message: unknown,
  sender: { id?: string; url?: string },
  sendResponse: (response: unknown) => void,
) => boolean | undefined;

const listeners = new Set<MessageListener>();
const extensionId = "extension-id";
const extensionPage = `chrome-extension://${extensionId}/src/ui/options/index.html`;
const getState = {
  type: FEATURE_COMMANDS.getState,
  rulePattern: "example.com",
  hostname: "example.com",
};

const deliver = (message: unknown, sender: { id?: string; url?: string }) => {
  const sent = vi.fn();
  let handled = false;
  for (const listener of listeners) {
    if (listener(message, sender, sent)) handled = true;
  }
  return { handled, sent };
};

const settle = async (): Promise<void> => {
  const pending = respond.mock.results.at(-1)?.value;
  if (pending instanceof Promise) await pending;
  await Promise.resolve();
};

beforeEach(() => {
  listeners.clear();
  respond.mockReset();
  respond.mockResolvedValue({ ok: true });
  createController.mockClear();
  vi.stubGlobal("chrome", {
    runtime: {
      id: extensionId,
      getURL: (path: string) => `chrome-extension://${extensionId}${path}`,
      onMessage: {
        addListener: (listener: MessageListener) => {
          listeners.add(listener);
        },
        removeListener: (listener: MessageListener) => {
          listeners.delete(listener);
        },
      },
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("feature message router", () => {
  it("rejects feature commands from content scripts and foreign extension URLs", () => {
    registerFeatureMessages([]);
    const senders = [
      { id: extensionId, url: "https://example.com/" },
      { id: "other-extension", url: "chrome-extension://other-extension/page.html" },
      { id: extensionId, url: `chrome-extension://${extensionId}.evil/page.html` },
      { id: extensionId },
    ];
    for (const sender of senders) {
      const delivery = deliver(getState, sender);
      expect(delivery.handled).toBe(false);
      expect(delivery.sent).not.toHaveBeenCalled();
    }
    expect(respond).not.toHaveBeenCalled();
  });

  it("dispatches permitted getState and ignores other messages", async () => {
    registerFeatureMessages([]);
    const page = { id: extensionId, url: extensionPage };
    const ignored = deliver({ type: "pt.plugin.get-state" }, page);
    expect(ignored.handled).toBe(false);
    const delivery = deliver(getState, page);
    expect(delivery.handled).toBe(true);
    expect(createController).toHaveBeenCalledOnce();
    expect(respond).toHaveBeenCalledExactlyOnceWith(getState);
    await settle();
    expect(delivery.sent).toHaveBeenCalledExactlyOnceWith({ ok: true });
    expect(ignored.sent).not.toHaveBeenCalled();
  });

  it("unsubscribes the feature listener", async () => {
    const stop = registerFeatureMessages([]);
    stop();
    const delivery = deliver(getState, { id: extensionId, url: extensionPage });
    await settle();
    expect(listeners.size).toBe(0);
    expect(delivery.handled).toBe(false);
    expect(delivery.sent).not.toHaveBeenCalled();
    expect(respond).not.toHaveBeenCalled();
  });
});
