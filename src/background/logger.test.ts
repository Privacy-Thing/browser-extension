import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ExtensionLogLevel, LogCategory } from "@/shared/types";

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
};

const createDeferred = <T>(): Deferred<T> => {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

describe("background logger", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("waits for queued writes before returning logs", async () => {
    const firstRead = createDeferred<Record<string, unknown>>();
    const storageState: Record<string, unknown> = {};

    const get = vi
      .fn()
      .mockImplementationOnce(() => firstRead.promise)
      .mockImplementation(async (key?: string) =>
        key === "logs" && "logs" in storageState ? { logs: storageState.logs } : {},
      );
    const set = vi.fn(async (entries: Record<string, unknown>) => {
      Object.assign(storageState, entries);
    });
    const remove = vi.fn(async () => {
      Reflect.deleteProperty(storageState, "logs");
    });

    vi.stubGlobal("chrome", {
      storage: {
        session: { get, set, remove },
      },
    });

    const { getExtensionLogs, logExtensionEvent } = await import("@/background/logger");

    logExtensionEvent({
      enabled: true,
      category: LogCategory.System,
      event: "FirefoxBootstrap.shim-installed",
    });

    let resolved = false;
    const logsPromise = getExtensionLogs().then((result) => {
      resolved = true;
      return result;
    });

    await Promise.resolve();
    expect(resolved).toBe(false);

    firstRead.resolve({});

    await expect(logsPromise).resolves.toMatchObject({
      ok: true,
      logs: [
        expect.objectContaining({
          category: LogCategory.System,
          level: ExtensionLogLevel.Info,
          event: "FirefoxBootstrap.shim-installed",
        }),
      ],
    });
  });

  it("serializes clear operations after queued writes", async () => {
    const firstRead = createDeferred<Record<string, unknown>>();
    const storageState: Record<string, unknown> = {};

    const get = vi
      .fn()
      .mockImplementationOnce(() => firstRead.promise)
      .mockImplementation(async (key?: string) =>
        key === "logs" && "logs" in storageState ? { logs: storageState.logs } : {},
      );
    const set = vi.fn(async (entries: Record<string, unknown>) => {
      Object.assign(storageState, entries);
    });
    const remove = vi.fn(async () => {
      Reflect.deleteProperty(storageState, "logs");
    });

    vi.stubGlobal("chrome", {
      storage: {
        session: { get, set, remove },
      },
    });

    const { clearExtensionLogs, getExtensionLogs, logExtensionEvent } =
      await import("@/background/logger");

    logExtensionEvent({
      enabled: true,
      category: LogCategory.System,
      event: "FirefoxBootstrap.state-applied",
    });
    const clearPromise = clearExtensionLogs();

    firstRead.resolve({});

    await expect(clearPromise).resolves.toEqual({ ok: true });
    await expect(getExtensionLogs()).resolves.toEqual({ ok: true, logs: [] });
    expect(remove).toHaveBeenCalledOnce();
  });

  it("normalizes legacy stored logs without a level to info", async () => {
    vi.stubGlobal("chrome", {
      storage: {
        session: {
          get: vi.fn(async () => ({
            logs: [
              {
                id: "legacy",
                time: "2026-06-05T00:00:00.000Z",
                category: LogCategory.System,
                event: "legacy.event",
              },
            ],
          })),
          set: vi.fn(),
          remove: vi.fn(),
        },
      },
    });

    const { getExtensionLogs } = await import("@/background/logger");

    await expect(getExtensionLogs()).resolves.toEqual({
      ok: true,
      logs: [
        {
          id: "legacy",
          time: "2026-06-05T00:00:00.000Z",
          category: LogCategory.System,
          level: ExtensionLogLevel.Info,
          event: "legacy.event",
        },
      ],
    });
  });

  it("maps legacy debug level entries to verbose", async () => {
    vi.stubGlobal("chrome", {
      storage: {
        session: {
          get: vi.fn(async () => ({
            logs: [
              {
                id: "legacy-debug",
                time: "2026-06-05T00:00:00.000Z",
                category: LogCategory.System,
                level: "debug",
                event: "legacy.debug-event",
              },
            ],
          })),
          set: vi.fn(),
          remove: vi.fn(),
        },
      },
    });

    const { getExtensionLogs } = await import("@/background/logger");

    await expect(getExtensionLogs()).resolves.toEqual({
      ok: true,
      logs: [
        {
          id: "legacy-debug",
          time: "2026-06-05T00:00:00.000Z",
          category: LogCategory.System,
          level: ExtensionLogLevel.Verbose,
          event: "legacy.debug-event",
        },
      ],
    });
  });
});
