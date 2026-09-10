import { beforeEach, describe, expect, it, vi } from "vitest";

import { registerControlD } from "./background-entry";
import { CONTROL_D_COMMANDS } from "./contracts";

import { logExtensionEvent } from "@/background/logger";

vi.mock("@/background/logger", () => ({
  logExtensionEvent: vi.fn(),
}));

type MessageListener = (
  message: unknown,
  sender: { id?: string },
  sendResponse: (response: unknown) => void,
) => boolean;

const storageState: Record<string, unknown> = {};
let messageListener: MessageListener;

beforeEach(() => {
  vi.clearAllMocks();
  for (const key of Object.keys(storageState))
    Reflect.deleteProperty(storageState, key);

  vi.stubGlobal("chrome", {
    runtime: {
      id: "extension-id",
      onMessage: {
        addListener: vi.fn((listener: MessageListener) => {
          messageListener = listener;
        }),
      },
    },
    storage: {
      local: {
        get: vi.fn(async (key: string) =>
          key in storageState ? { [key]: storageState[key] } : {},
        ),
        set: vi.fn(async (values: Record<string, unknown>) => {
          Object.assign(storageState, values);
        }),
        remove: vi.fn(async (key: string) => Reflect.deleteProperty(storageState, key)),
      },
      onChanged: { addListener: vi.fn() },
    },
  });
});

describe("Control D background entry", () => {
  it("persists a toggle action in extension logs when debug mode comes from storage", async () => {
    registerControlD({ getDebugMode: async () => true });

    const response = await new Promise<unknown>((resolve) => {
      expect(
        messageListener(
          { type: CONTROL_D_COMMANDS.setEnabled, enabled: true },
          { id: "extension-id" },
          resolve,
        ),
      ).toBe(true);
    });

    expect(response).toMatchObject({ ok: true, state: { enabled: true } });
    await vi.waitFor(() => {
      expect(logExtensionEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          enabled: true,
          event: "control-d.integration.toggled",
        }),
      );
    });
  });
});
