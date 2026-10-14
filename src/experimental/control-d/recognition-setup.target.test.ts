import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  DIAGNOSTIC_COMMANDS,
  RECOGNITION_STORE_KEY,
  createRecognitionController,
  ensureControlDRecognition,
  isDiagnosticCommand,
  isRecognitionSweepActive,
  loadRecognitionState,
  resetRecognitionRuntime,
  toRecognitionSummary,
  whenRecognitionSettled,
  type RecognitionDeps,
} from "./recognition-setup";
import { controlDEndpointName, controlDProfileName } from "./resource-names";

import { FEATURE_EVENTS } from "@/shared/provider-feature";

const CODE = "ABCDE-FGHJK";
const SECRET = "lookup-secret";

type Profile = { id: string; name: string };
type Device = { id: string; name: string; profileIds: string[]; resolver: string };
type Service = { PK: string; name: string; category: string };
type Call = { method: string; url: string; body: string | null };
type StoredService = { PK: string; do: number; status: number };

const storage: Record<string, unknown> = {};
let profiles: Profile[] = [];
let devices: Device[] = [];
let services: Service[] = [];
let profileServices: Record<string, StoredService[]> = {};
let groups: Record<string, { PK: number; group: string }[]> = {};
let rules: Record<string, { PK: string }[]> = {};
let failDevice = false;
let extraProfileOnCreate = false;
let rejectStatus = new Map<string, number>();
let allowKey = true;
const calls: Call[] = [];
const sendMessage = vi.fn(async (_message: unknown) => undefined);

const json = (body: unknown, status = 200, headers?: HeadersInit): Response =>
  new Response(JSON.stringify({ success: status < 400, body }), {
    status,
    ...(headers ? { headers } : {}),
  });

const resetWorld = (): void => {
  profiles = [{ id: "main-profile", name: controlDProfileName(CODE) }];
  devices = [
    {
      id: "browser-device",
      name: controlDEndpointName(CODE, "chromium"),
      profileIds: ["main-profile"],
      resolver: "https://dns.controld.com/browser-secret",
    },
  ];
  services = [
    { PK: "netflix", name: "Netflix", category: "video" },
    { PK: "zoom", name: "Zoom", category: "tools" },
  ];
  profileServices = {};
  groups = {};
  rules = {};
  failDevice = false;
  extraProfileOnCreate = false;
  rejectStatus = new Map();
  allowKey = true;
  calls.length = 0;
  sendMessage.mockClear();
};

const deviceBody = (device: Device) => ({
  PK: device.id,
  name: device.name,
  profile: device.profileIds[0] ? { PK: device.profileIds[0] } : 0,
  ...(device.profileIds[1] ? { profile2: { PK: device.profileIds[1] } } : {}),
  resolvers: { doh: device.resolver },
});

const serviceBody = (profileId: string) =>
  (profileServices[profileId] ?? []).map((action) => {
    const service = services.find((item) => item.PK === action.PK);
    return {
      PK: action.PK,
      name: service?.name ?? action.PK,
      category: service?.category ?? "video",
      action: { do: action.do, status: action.status },
    };
  });

const recordBypass = (profileId: string, pk: string): void => {
  const current = profileServices[profileId] ?? [];
  profileServices[profileId] = [
    ...current.filter((item) => item.PK !== pk),
    { PK: pk, do: 1, status: 1 },
  ];
};

const handle = (call: Call): Response => {
  const url = new URL(call.url);
  const path = url.pathname;
  if (call.method === "GET" && path === "/services/categories/all")
    return json({ services });
  if (call.method === "GET" && path === "/profiles") return json({ profiles });
  if (call.method === "GET" && path === "/devices") {
    return json({ devices: devices.map(deviceBody) });
  }
  if (call.method === "GET" && path === "/devices/types") {
    return json({ types: { "browser-other": "Other Browser" } });
  }
  const profileMatch = /^\/profiles\/([^/]+)(?:\/(.*))?$/.exec(path);
  const decoded = profileMatch?.[1] ? decodeURIComponent(profileMatch[1]) : "";
  const rest = profileMatch?.[2] ?? "";
  if (call.method === "GET" && rest === "services")
    return json({ services: serviceBody(decoded) });
  if (call.method === "GET" && rest === "groups")
    return json({ groups: groups[decoded] ?? [] });
  if (call.method === "GET" && rest === "rules/all")
    return json({ rules: rules[decoded] ?? [] });
  if (call.method === "POST" && path === "/profiles") {
    profiles.push({ id: "lookup-profile", name: "PT Lookup ABCDE-FGHJK" });
    return json({});
  }
  if (call.method === "POST" && path === "/devices") {
    if (failDevice) return json({ error: { message: "unavailable" } }, 500);
    devices.push({
      id: "lookup-endpoint",
      name: "PT Probe ABCDE-FGHJK",
      profileIds: extraProfileOnCreate
        ? ["lookup-profile", "main-profile"]
        : ["lookup-profile"],
      resolver: `https://dns.controld.com/${SECRET}`,
    });
    return json({
      device: {
        PK: "lookup-endpoint",
        resolvers: { doh: `https://dns.controld.com/${SECRET}` },
      },
    });
  }
  const servicePut = /^services\/([^/]+)$/.exec(rest);
  const servicePk = servicePut?.[1] ? decodeURIComponent(servicePut[1]) : "";
  if (call.method === "PUT" && servicePk) {
    const status = rejectStatus.get(servicePk);
    if (status === 429) {
      return json({ error: { message: "slow" } }, 429, { "retry-after": "0" });
    }
    if (status) return json({ error: { message: "rejected" } }, status);
    const params = new URLSearchParams(call.body ?? "");
    if (params.get("do") !== "1" || params.get("status") !== "1") return json({}, 400);
    recordBypass(decoded, servicePk);
    return json({ services: [] });
  }
  if (call.method === "PUT" && rest === "services") return json({}, 400);
  return json({}, 404);
};

const requestBody = (body: BodyInit | null | undefined): string | null => {
  if (typeof body === "string") return body;
  if (body instanceof URLSearchParams) return body.toString();
  return null;
};

const requestUrl = (input: RequestInfo | URL): string => {
  if (typeof input === "string") return input;
  return input instanceof URL ? input.toString() : input.url;
};

const fetchImpl: typeof fetch = vi.fn(async (input, init) => {
  const call = {
    method: init?.method ?? "GET",
    url: requestUrl(input),
    body: requestBody(init?.body),
  };
  calls.push(call);
  return handle(call);
});

const deps = (): RecognitionDeps => ({
  fetchImpl,
  loadApiKey: async () => (allowKey ? "token" : null),
  createCode: () => CODE,
});

const settle = async () => {
  const immediate = await ensureControlDRecognition(deps());
  await whenRecognitionSettled();
  return { immediate, state: await loadRecognitionState() };
};

const writes = (): Call[] => calls.filter((call) => call.method !== "GET");
const puts = (): Call[] => calls.filter((call) => call.method === "PUT");
const events = (): unknown[] => sendMessage.mock.calls.map((call) => call[0]);

const seedLookup = (): void => {
  profiles.push({ id: "lookup-profile", name: "PT Lookup ABCDE-FGHJK" });
  devices.push({
    id: "lookup-endpoint",
    name: "PT Probe ABCDE-FGHJK",
    profileIds: ["lookup-profile"],
    resolver: `https://dns.controld.com/${SECRET}`,
  });
  storage[RECOGNITION_STORE_KEY] = {
    version: 2,
    phase: "preparing",
    code: CODE,
    profileId: "lookup-profile",
    endpointId: "lookup-endpoint",
    resolverDoh: null,
    servicePks: [],
    failedPks: [],
    expectedFingerprint: null,
    freshFingerprint: null,
    lastError: null,
    verifiedAt: null,
  };
};

beforeEach(async () => {
  await whenRecognitionSettled();
  resetRecognitionRuntime();
  for (const key of Object.keys(storage)) Reflect.deleteProperty(storage, key);
  resetWorld();
  vi.stubGlobal("chrome", {
    runtime: { sendMessage },
    storage: {
      local: {
        get: vi.fn(async (key: string) =>
          key in storage ? { [key]: storage[key] } : {},
        ),
        set: vi.fn(async (value: Record<string, unknown>) =>
          Object.assign(storage, value),
        ),
        remove: vi.fn(async (key: string) => Reflect.deleteProperty(storage, key)),
      },
    },
  });
});

describe("Control D automatic recognition setup", () => {
  it("accepts the exact hyphenated endpoint name returned by the live API", async () => {
    seedLookup();
    devices.find((device) => device.id === "lookup-endpoint")!.name =
      "PT-Probe-ABCDE-FGHJK";
    const { state } = await settle();
    expect(state.phase).toBe("ready");
    expect(writes().every((call) => call.method === "PUT")).toBe(true);
    expect(state.endpointId).toBe("lookup-endpoint");
  });
  it("keeps diagnostic exports from writing and starts from an empty record", async () => {
    expect(isDiagnosticCommand({ type: DIAGNOSTIC_COMMANDS.getState })).toBe(true);
    expect(isDiagnosticCommand({ type: DIAGNOSTIC_COMMANDS.apply })).toBe(false);
    expect(RECOGNITION_STORE_KEY).toBe("pt.experimental.control-d.v2.recognition");
    expect((await loadRecognitionState()).phase).toBe("not-setup");
    await expect(
      createRecognitionController().respond({ type: DIAGNOSTIC_COMMANDS.preview }),
    ).resolves.toMatchObject({ ok: false, summary: { phase: "not-setup" } });
    expect(calls).toEqual([]);
  });

  it("creates the lookup profile on first use with singular Bypass writes", async () => {
    const { immediate, state } = await settle();
    const profilePost = calls.find(
      (call) => call.method === "POST" && call.url.endsWith("/profiles"),
    );
    const devicePost = calls.find(
      (call) => call.method === "POST" && call.url.endsWith("/devices"),
    );

    expect(immediate.phase).toBe("preparing");
    expect(state).toMatchObject({
      phase: "ready",
      code: CODE,
      profileId: "lookup-profile",
      endpointId: "lookup-endpoint",
      resolverDoh: SECRET,
      servicePks: ["netflix", "zoom"],
      failedPks: [],
    });
    expect(JSON.stringify(toRecognitionSummary(state))).not.toContain(SECRET);
    expect(profilePost?.body).toContain("name=PT+Lookup+ABCDE-FGHJK");
    expect(devicePost?.body).toContain("name=PT+Probe+ABCDE-FGHJK");
    expect(devicePost?.body).toContain("profile_id=lookup-profile");
    expect(devicePost?.body).toContain("stats=0");
    expect(devicePost?.body).toContain("learn_ip=0");
    expect(devicePost?.body).not.toContain("restricted");
    expect(devicePost?.body).not.toContain("profile_id2");
    expect(devicePost?.body).not.toContain("PT+Browser");
    expect(puts().map((call) => new URL(call.url).pathname)).toEqual([
      "/profiles/lookup-profile/services/netflix",
      "/profiles/lookup-profile/services/zoom",
    ]);
    expect(puts().every((call) => call.body === "do=1&status=1")).toBe(true);
    expect(calls.some((call) => call.method === "DELETE")).toBe(false);
    expect(calls.some((call) => call.url.includes("/default"))).toBe(false);
    expect(calls.some((call) => call.url.includes("main-profile"))).toBe(false);
    expect(
      calls.some((call) => new URL(call.url).origin === "https://dns.controld.com"),
    ).toBe(false);
    expect(storage["pt.experimental.control-d.v2.config"]).toBeUndefined();
    expect(events()).toEqual([
      { type: FEATURE_EVENTS.stateChanged, providerId: "control-d" },
      { type: FEATURE_EVENTS.stateChanged, providerId: "control-d" },
      { type: FEATURE_EVENTS.stateChanged, providerId: "control-d" },
    ]);
  });

  it("notifies the UI after a failed sweep stops making requests", async () => {
    seedLookup();
    rejectStatus.set("netflix", 400);
    const activity: boolean[] = [];
    sendMessage.mockImplementation(async () => {
      activity.push(isRecognitionSweepActive());
    });
    try {
      const { state } = await settle();
      expect(state.phase).toBe("preparing");
      expect(state.lastError).not.toBeNull();
      expect(activity.at(-1)).toBe(false);
    } finally {
      sendMessage.mockImplementation(async () => undefined);
    }
  });

  it("saves the lookup code before creating the profile", async () => {
    let release: (() => void) | undefined;
    let opened: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const started = new Promise<void>((resolve) => {
      opened = resolve;
    });
    const pending = ensureControlDRecognition({
      ...deps(),
      fetchImpl: async (input, init) => {
        if (
          (init?.method ?? "GET") === "POST" &&
          requestUrl(input).endsWith("/profiles")
        ) {
          opened?.();
          await gate;
        }
        return fetchImpl(input, init);
      },
    });
    await started;
    expect(calls.some((call) => call.method === "POST")).toBe(false);
    expect(storage[RECOGNITION_STORE_KEY]).toMatchObject({
      code: CODE,
      phase: "preparing",
      resolverDoh: null,
    });
    release?.();
    await pending;
    await whenRecognitionSettled();
  });

  it("skips services that are already Bypass and persists each new one", async () => {
    seedLookup();
    recordBypass("lookup-profile", "netflix");
    let release: (() => void) | undefined;
    let opened: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const started = new Promise<void>((resolve) => {
      opened = resolve;
    });
    const pending = ensureControlDRecognition({
      ...deps(),
      fetchImpl: async (input, init) => {
        if ((init?.method ?? "GET") === "PUT" && requestUrl(input).endsWith("/zoom")) {
          opened?.();
          await gate;
        }
        return fetchImpl(input, init);
      },
    });
    await started;
    expect(storage[RECOGNITION_STORE_KEY]).toMatchObject({
      phase: "preparing",
      servicePks: ["netflix"],
    });
    expect(puts().map((call) => call.url.endsWith("/netflix"))).not.toContain(true);
    release?.();
    await pending;
    await whenRecognitionSettled();
    expect(puts().map((call) => new URL(call.url).pathname)).toEqual([
      "/profiles/lookup-profile/services/zoom",
    ]);
    expect((await loadRecognitionState()).phase).toBe("ready");
  });

  it("keeps a partial sweep preparing when one service is rejected", async () => {
    seedLookup();
    rejectStatus.set("netflix", 400);
    const { state } = await settle();
    expect(state.phase).toBe("preparing");
    expect(state.servicePks).toEqual(["zoom"]);
    expect(state.failedPks).toEqual(["netflix"]);
    expect(state.resolverDoh).toBeNull();
    expect(calls.some((call) => call.method === "DELETE")).toBe(false);
    expect(events().some((event) => JSON.stringify(event).includes("ready"))).toBe(
      false,
    );
  });

  it("stops on rate limit, keeps the cursor, and resumes the remaining service", async () => {
    seedLookup();
    rejectStatus.set("netflix", 429);
    const paused = await settle();
    expect(paused.state.phase).toBe("preparing");
    expect(paused.state.servicePks).toEqual([]);
    expect(calls.filter((call) => call.url.endsWith("/netflix"))).toHaveLength(3);
    expect(calls.some((call) => call.url.endsWith("/zoom"))).toBe(false);

    rejectStatus.clear();
    calls.length = 0;
    const resumed = await settle();
    expect(resumed.state.phase).toBe("ready");
    expect(puts().map((call) => new URL(call.url).pathname)).toEqual([
      "/profiles/lookup-profile/services/netflix",
      "/profiles/lookup-profile/services/zoom",
    ]);
  });

  it("does not trust a stored ready record when a catalogue service is not Bypass", async () => {
    seedLookup();
    storage[RECOGNITION_STORE_KEY] = {
      ...(storage[RECOGNITION_STORE_KEY] as Record<string, unknown>),
      version: 1,
      phase: "ready",
      resolverDoh: SECRET,
      servicePks: ["netflix", "zoom"],
    };
    recordBypass("lookup-profile", "netflix");
    const { state } = await settle();
    expect(
      calls.some((call) => call.method === "GET" && call.url.endsWith("/services")),
    ).toBe(true);
    expect(puts().map((call) => new URL(call.url).pathname)).toEqual([
      "/profiles/lookup-profile/services/zoom",
    ]);
    expect(state.phase).toBe("ready");
    expect(storage[RECOGNITION_STORE_KEY]).toMatchObject({
      version: 2,
      phase: "ready",
    });
  });

  it("adds a new catalogue service without rewriting Bypass services", async () => {
    seedLookup();
    recordBypass("lookup-profile", "netflix");
    recordBypass("lookup-profile", "zoom");
    storage[RECOGNITION_STORE_KEY] = {
      ...(storage[RECOGNITION_STORE_KEY] as Record<string, unknown>),
      phase: "ready",
      resolverDoh: SECRET,
      servicePks: ["netflix", "zoom"],
      verifiedAt: 0,
    };
    services.push({ PK: "hulu", name: "Hulu", category: "video" });
    const { state } = await settle();
    expect(puts().map((call) => new URL(call.url).pathname)).toEqual([
      "/profiles/lookup-profile/services/hulu",
    ]);
    expect(state.servicePks).toEqual(["hulu", "netflix", "zoom"]);
    expect(state.phase).toBe("ready");
  });

  it("repairs a missing lookup endpoint without touching the browser profile", async () => {
    seedLookup();
    devices.splice(
      devices.findIndex((device) => device.id === "lookup-endpoint"),
      1,
    );
    storage[RECOGNITION_STORE_KEY] = {
      ...(storage[RECOGNITION_STORE_KEY] as Record<string, unknown>),
      endpointId: null,
    };
    recordBypass("lookup-profile", "netflix");
    recordBypass("lookup-profile", "zoom");
    const start = calls.length;
    const { state } = await settle();
    const created = calls.slice(start).filter((call) => call.method === "POST");
    expect(created.map((call) => new URL(call.url).pathname)).toEqual(["/devices"]);
    expect(created[0]?.body).toContain("stats=0");
    expect(state.phase).toBe("ready");
    expect(calls.some((call) => call.url.includes("main-profile"))).toBe(false);
  });

  it.each([
    [
      "custom rules",
      () => {
        rules["lookup-profile"] = [{ PK: "ads.example" }];
      },
    ],
    [
      "rule folders",
      () => {
        groups["lookup-profile"] = [{ PK: 4, group: "Custom" }];
      },
    ],
    [
      "a shared profile",
      () => {
        devices.push({
          id: "other-device",
          name: "Laptop",
          profileIds: ["lookup-profile"],
          resolver: "https://dns.controld.com/other-secret",
        });
      },
    ],
    [
      "an endpoint that enforces another profile",
      () => {
        const endpoint = devices.find((device) => device.id === "lookup-endpoint");
        if (endpoint) endpoint.profileIds = ["lookup-profile", "main-profile"];
      },
    ],
  ])("blocks %s without deleting remote resources", async (_label, mutate) => {
    seedLookup();
    mutate();
    const before = JSON.stringify({ rules, groups, devices });
    const { state } = await settle();
    expect(state.phase).toBe("blocked");
    expect(state.resolverDoh).toBeNull();
    expect(writes()).toEqual([]);
    expect(calls.some((call) => call.method === "DELETE")).toBe(false);
    expect(JSON.stringify({ rules, groups, devices })).toBe(before);
    expect(JSON.stringify(toRecognitionSummary(state))).not.toContain("other-secret");
  });

  it("stops a sweep when the API key disappears and does not delete the profile", async () => {
    let putsSeen = 0;
    const { immediate } = await ensureControlDRecognition({
      ...deps(),
      loadApiKey: async () => (putsSeen === 0 ? "token" : null),
      fetchImpl: async (input, init) => {
        if ((init?.method ?? "GET") === "PUT") putsSeen += 1;
        return fetchImpl(input, init);
      },
    }).then(async (immediateState) => {
      await whenRecognitionSettled();
      return { immediate: immediateState };
    });
    expect(immediate.phase).toBe("preparing");
    const state = await loadRecognitionState();
    expect(state.phase).toBe("preparing");
    expect(state.profileId).toBe("lookup-profile");
    expect(puts()).toHaveLength(1);
    expect(calls.some((call) => call.method === "DELETE")).toBe(false);
  });

  it("keeps a failed endpoint create recoverable without claiming ready", async () => {
    failDevice = true;
    const failed = await settle();
    expect(failed.state).toMatchObject({
      phase: "preparing",
      code: CODE,
      profileId: "lookup-profile",
      endpointId: null,
      resolverDoh: null,
    });
    failDevice = false;
    const start = calls.length;
    const recovered = await settle();
    expect(recovered.state.phase).toBe("ready");
    expect(
      calls
        .slice(start)
        .some((call) => call.method === "POST" && call.url.endsWith("/profiles")),
    ).toBe(false);
  });

  it("blocks an endpoint that also enforces another profile and does not delete it", async () => {
    extraProfileOnCreate = true;
    const { state } = await settle();
    expect(state.phase).toBe("blocked");
    expect(state.resolverDoh).toBeNull();
    expect(calls.some((call) => call.method === "DELETE")).toBe(false);
    expect(puts()).toEqual([]);
  });

  it("runs one setup at a time", async () => {
    let release: (() => void) | undefined;
    let opened: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const started = new Promise<void>((resolve) => {
      opened = resolve;
    });
    let catalogues = 0;
    let held = true;
    const fetchGated: typeof fetch = async (input, init) => {
      if (requestUrl(input).includes("/services/categories/all")) {
        catalogues += 1;
        if (held) {
          held = false;
          opened?.();
          await gate;
        }
      }
      return fetchImpl(input, init);
    };
    const first = ensureControlDRecognition({ ...deps(), fetchImpl: fetchGated });
    await started;
    const second = ensureControlDRecognition({ ...deps(), fetchImpl: fetchGated });
    expect(catalogues).toBe(1);
    release?.();
    await first;
    await second;
    await whenRecognitionSettled();
    expect(catalogues).toBeGreaterThan(1);
    expect(
      profiles.filter((profile) => profile.name.startsWith("PT Lookup")),
    ).toHaveLength(1);
  });

  it("does not call Control D when the API key is missing", async () => {
    allowKey = false;
    await expect(ensureControlDRecognition(deps())).resolves.toMatchObject({
      phase: "not-setup",
    });
    expect(calls).toEqual([]);
  });
});
