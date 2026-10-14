import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { registerControlD } from "./background-entry";
import { CONTROL_D_COMMANDS, type CleanupPlan, type CleanupReport } from "./contracts";
import type * as RecognitionModule from "./recognition-setup";
import { RECOGNITION_STORE_KEY, whenRecognitionSettled } from "./recognition-setup";
import {
  loadControlDApiKey,
  loadControlDConfig,
  saveControlDApiKey,
  saveControlDConfig,
} from "./storage";

import { createPluginHooks } from "@/background/plugin-hooks";

vi.mock("@/background/logger", () => ({ logExtensionEvent: vi.fn() }));
vi.mock("./recognition-setup", async (importOriginal) => {
  const actual = await importOriginal<typeof RecognitionModule>();
  return { ...actual, whenRecognitionSettled: vi.fn(actual.whenRecognitionSettled) };
});
let listener: (
  message: unknown,
  sender: { id: string; url: string },
  send: (response: unknown) => void,
) => boolean;
let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;
const stored: Record<string, unknown> = {};
const writes: string[] = [];
let endpoint = true;
let profile = true;
let failEndpoint = false;
let lookup = false;
let probe = false;

beforeEach(async () => {
  vi.stubGlobal("indexedDB", new IDBFactory());
  vi.stubGlobal("chrome", {
    runtime: {
      id: "extension",
      getURL: (path: string) => `chrome-extension://extension${path}`,
      onMessage: {
        addListener: (value: typeof listener) => {
          listener = value;
        },
      },
    },
    storage: {
      local: {
        get: async (key: string) => ({ [key]: stored[key] }),
        set: async (values: Record<string, unknown>) => Object.assign(stored, values),
        remove: async (key: string) => Reflect.deleteProperty(stored, key),
      },
      onChanged: { addListener: vi.fn() },
    },
  });
  for (const key of Object.keys(stored)) Reflect.deleteProperty(stored, key);
  writes.length = 0;
  endpoint = true;
  profile = true;
  failEndpoint = false;
  lookup = false;
  probe = false;
  fetchMock = vi.fn(async (input, init) => {
    const path = new URL(String(input)).pathname;
    const method = init?.method ?? "GET";
    let body: unknown = {};
    if (method === "DELETE") {
      writes.push(path);
      if (path === "/devices/e" || path === "/devices/probe") {
        if (failEndpoint) return new Response("{}", { status: 403 });
        if (path === "/devices/e") endpoint = false;
        else probe = false;
      } else if (path === "/profiles/p") profile = false;
      else if (path === "/profiles/lookup") lookup = false;
      else throw new Error(`Unexpected DELETE ${path}`);
    } else if (path === "/profiles")
      body = {
        profiles: [
          ...(profile ? [{ PK: "p", name: "Privacy Thing ABCDE-FGHJK" }] : []),
          ...(lookup ? [{ PK: "lookup", name: "PT Lookup ABCDE-FGHJK" }] : []),
        ],
      };
    else if (path === "/devices")
      body = {
        devices: [
          ...(endpoint
            ? [{ PK: "e", name: "PT Browser ABCDE-FGHJK", profile_id: "p" }]
            : []),
          ...(probe
            ? [{ PK: "probe", name: "PT Probe ABCDE-FGHJK", profile_id: "lookup" }]
            : []),
        ],
      };
    else if (path.endsWith("/groups")) body = { groups: [] };
    else if (path.endsWith("/rules/all")) body = { rules: [] };
    else if (path.endsWith("/services")) body = { services: [] };
    else throw new Error(`Unexpected fake request ${method} ${path}`);
    return new Response(JSON.stringify({ success: true, body }));
  });
  vi.stubGlobal("fetch", fetchMock);
  const config = await loadControlDConfig();
  await saveControlDConfig({
    ...config,
    enabled: true,
    connected: true,
    resourceIdentity: { code: "ABCDE-FGHJK" },
    profileId: "p",
    endpointId: "e",
    resolverDoh: "resolver",
    status: "ready",
  });
  await saveControlDApiKey("fake-key-only");
  registerControlD({ hooks: createPluginHooks(), getDebugMode: () => false });
});
afterEach(() => vi.unstubAllGlobals());
const request = (message: unknown) =>
  new Promise<{
    ok: boolean;
    plan?: CleanupPlan;
    report?: CleanupReport;
    error?: string;
  }>((resolve) => {
    listener(
      message,
      { id: "extension", url: "chrome-extension://extension/options.html" },
      (response) => resolve(response as Awaited<ReturnType<typeof request>>),
    );
  });
const preview = async () =>
  (await request({ type: CONTROL_D_COMMANDS.planCleanup })).plan!;
const execute = (cleanupToken: string) =>
  request({ type: CONTROL_D_COMMANDS.executeCleanup, cleanupToken });

describe("Control D cleanup command boundary", () => {
  it("requires a reviewed, single-use token; planning performs no DELETEs", async () => {
    expect((await execute("invented")).ok).toBe(false);
    const plan = await preview();
    expect(plan.resources.map((item) => item.kind)).toEqual(["endpoint", "profile"]);
    expect(writes).toEqual([]);
    expect((await execute(plan.token)).report?.retryAvailable).toBe(false);
    expect(writes).toEqual(["/devices/e", "/profiles/p"]);
    expect(await loadControlDApiKey()).toBeNull();
    expect(await loadControlDConfig()).toMatchObject({
      connected: false,
      autoSyncEnabled: false,
      status: "disconnected",
    });
    expect((await execute(plan.token)).ok).toBe(false);
  });

  it.each([CONTROL_D_COMMANDS.getState, CONTROL_D_COMMANDS.setEnabled])(
    "invalidates a token after %s",
    async (type) => {
      const plan = await preview();
      await request({ type, enabled: true });
      expect((await execute(plan.token)).ok).toBe(false);
      expect(writes).toEqual([]);
    },
  );

  it("waits for a running recognition sweep before planning or deleting", async () => {
    let settle: () => void = () => undefined;
    vi.mocked(whenRecognitionSettled).mockImplementationOnce(
      () => new Promise<void>((resolve) => (settle = resolve)),
    );
    let planned = false;
    const pending = preview().then((plan) => {
      planned = true;
      return plan;
    });
    await vi.waitFor(() => expect(whenRecognitionSettled).toHaveBeenCalled());
    await Promise.resolve();
    expect(planned).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    settle();
    expect((await pending).resources).not.toHaveLength(0);
  });

  it("invalidates a token after local config changes", async () => {
    const plan = await preview();
    await saveControlDConfig({ ...(await loadControlDConfig()), endpointId: "other" });
    expect((await execute(plan.token)).ok).toBe(false);
    expect(writes).toEqual([]);
  });

  it("disconnects after a partial failure, retains the private key for retry and forgets it after success", async () => {
    lookup = true;
    probe = true;
    stored[RECOGNITION_STORE_KEY] = {
      version: 2,
      phase: "ready",
      code: "ABCDE-FGHJK",
      profileId: "lookup",
      endpointId: "probe",
      resolverDoh: "probe",
      servicePks: [],
      expectedFingerprint: "hash",
      freshFingerprint: "hash",
      lastError: null,
    };
    failEndpoint = true;
    const first = await execute((await preview()).token);
    expect(
      first.report?.results.filter((item) => item.status === "failed"),
    ).toHaveLength(4);
    expect(stored[RECOGNITION_STORE_KEY]).toMatchObject({
      phase: "not-setup",
      resolverDoh: null,
    });
    expect(first.report?.retryAvailable).toBe(true);
    expect(await loadControlDApiKey()).toBe("fake-key-only");
    expect(await loadControlDConfig()).toMatchObject({
      connected: false,
      autoSyncEnabled: false,
      status: "disconnected",
      endpointId: "e",
      profileId: "p",
    });
    failEndpoint = false;
    expect((await execute((await preview()).token)).report?.retryAvailable).toBe(false);
    expect(await loadControlDApiKey()).toBeNull();
  });

  it("plain Disconnect continues to forget the key without network or deletion", async () => {
    expect((await request({ type: CONTROL_D_COMMANDS.disconnect })).ok).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(await loadControlDApiKey()).toBeNull();
    expect(await loadControlDConfig()).toMatchObject({
      profileId: "p",
      endpointId: "e",
    });
  });

  it("rejects malformed execute tokens and content-script senders", async () => {
    await preview();
    expect(
      (
        await request({
          type: CONTROL_D_COMMANDS.executeCleanup,
          cleanupToken: { token: "wrong" },
        })
      ).ok,
    ).toBe(false);
    const send = vi.fn();
    expect(
      listener(
        { type: CONTROL_D_COMMANDS.planCleanup },
        { id: "extension", url: "https://example.test" },
        send,
      ),
    ).toBe(false);
    expect(send).not.toHaveBeenCalled();
    expect(writes).toEqual([]);
  });
});
