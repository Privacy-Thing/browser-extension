import { beforeEach, describe, expect, it, vi } from "vitest";

import { registerControlD } from "./background-entry";
import { CONTROL_D_COMMANDS } from "./contracts";
import { CONTROL_D_STORE_KEYS } from "./storage";

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

  it("logs regional mapping changes for View Logs in debug mode", async () => {
    registerControlD({ getDebugMode: async () => true });

    const response = await new Promise<unknown>((resolve) => {
      messageListener(
        {
          type: CONTROL_D_COMMANDS.updateMapping,
          mapping: {
            locationId: "ottawa",
            proxyPk: "YUL",
            status: "approximate",
            confirmed: false,
          },
        },
        { id: "extension-id" },
        resolve,
      );
    });

    expect(response).toMatchObject({ ok: true });
    await vi.waitFor(() => {
      expect(logExtensionEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          enabled: true,
          event: "control-d.mapping.updated",
          payload: {
            details: {
              locationId: "ottawa",
              proxyPk: "YUL",
              status: "approximate",
            },
          },
        }),
      );
    });
  });

  it("schedules automatic reconciliation when an applied integration starts", async () => {
    storageState[CONTROL_D_STORE_KEYS[0]] = {
      version: 1,
      instanceId: "existing-instance",
      enabled: true,
      connected: true,
      autoSyncEnabled: true,
      status: "ready",
      profileId: "profile-id",
      endpointId: "endpoint-id",
      resolverDoh: "https://example.test/private-resolver",
      managedFolders: {},
      locationMappings: {},
      lastSyncedHash: "hash",
      lastAttemptAt: "2026-09-10T10:00:00.000Z",
      lastSuccessAt: "2026-09-10T10:00:00.000Z",
      lastError: null,
    };
    const timeoutSpy = vi.spyOn(globalThis, "setTimeout");

    registerControlD({ getDebugMode: async () => true });

    await vi.waitFor(() => {
      expect(timeoutSpy).toHaveBeenCalledWith(expect.any(Function), 1_500);
    });
    timeoutSpy.mockRestore();
  });
});
