import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  DIAGNOSTIC_COMMANDS,
  RECOGNITION_LIMITATIONS,
  RECOGNITION_STORE_KEY,
  createRecognitionController,
  isDiagnosticCommand,
  loadRecognitionState,
  type RecognitionResponse,
} from "./recognition-setup";
import { controlDEndpointName, controlDProfileName } from "./resource-names";

const CODE = "ABCDE-FGHJK";
const SECRET = "lookup-secret";

type Profile = { id: string; name: string };
type Device = { id: string; name: string; profileIds: string[]; resolver: string };
type Service = { PK: string; name: string; category: string };
type Call = { method: string; url: string; body: string | null };

const storage: Record<string, unknown> = {};
let profiles: Profile[] = [];
let devices: Device[] = [];
let services: Service[] = [];
let profileServices: Record<string, { PK: string; do: number; status: number }[]> = {};
let groups: Record<string, { PK: number; group: string }[]> = {};
let rules: Record<string, { PK: string }[]> = {};
let failDevice = false;
let extraProfileOnCreate = false;
const calls: Call[] = [];

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify({ success: status < 400, body }), { status });

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
  calls.length = 0;
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

const handle = (call: Call): Response => {
  const url = new URL(call.url);
  const path = url.pathname;
  if (call.method === "GET" && path === "/services/categories/all") {
    return json({ services });
  }
  if (call.method === "GET" && path === "/profiles") return json({ profiles });
  if (call.method === "GET" && path === "/devices")
    return json({ devices: devices.map(deviceBody) });
  if (call.method === "GET" && path === "/devices/types") {
    return json({ types: { "browser-other": "Other Browser" } });
  }
  const profileId = /^\/profiles\/([^/]+)/.exec(path)?.[1];
  const decoded = profileId ? decodeURIComponent(profileId) : "";
  if (call.method === "GET" && decoded && path.endsWith("/services")) {
    return json({ services: serviceBody(decoded) });
  }
  if (call.method === "GET" && decoded && path.endsWith("/groups")) {
    return json({ groups: groups[decoded] ?? [] });
  }
  if (call.method === "GET" && decoded && path.endsWith("/rules/all")) {
    return json({ rules: rules[decoded] ?? [] });
  }
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
  if (call.method === "PUT" && decoded && path.endsWith("/services")) {
    const body = JSON.parse(call.body ?? "{}") as { services?: { PK: string }[] };
    profileServices[decoded] = (body.services ?? []).flatMap((service) =>
      service.PK ? [{ PK: service.PK, do: 1, status: 1 }] : [],
    );
    return json({ services: [] });
  }
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

const controller = () =>
  createRecognitionController({
    fetchImpl,
    loadApiKey: async () => "token",
    createToken: () => "preview-token",
    createCode: () => CODE,
  });

const previewAndApply = async (): Promise<RecognitionResponse> => {
  const api = controller();
  await api.respond({ type: DIAGNOSTIC_COMMANDS.preview });
  return api.respond({
    type: DIAGNOSTIC_COMMANDS.apply,
    previewToken: "preview-token",
  });
};

const writesSince = (start: number): Call[] =>
  calls.slice(start).filter((call) => call.method !== "GET");

beforeEach(() => {
  for (const key of Object.keys(storage)) Reflect.deleteProperty(storage, key);
  resetWorld();
  vi.stubGlobal("chrome", {
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

describe("Control D diagnostic recognition setup", () => {
  it("exposes the diagnostic commands and a safe unloaded state", async () => {
    expect(isDiagnosticCommand({ type: DIAGNOSTIC_COMMANDS.getState })).toBe(true);
    expect(isDiagnosticCommand({ type: DIAGNOSTIC_COMMANDS.preview })).toBe(true);
    expect(
      isDiagnosticCommand({ type: DIAGNOSTIC_COMMANDS.apply, previewToken: "token" }),
    ).toBe(true);
    expect(isDiagnosticCommand({ type: DIAGNOSTIC_COMMANDS.apply })).toBe(false);
    expect(isDiagnosticCommand({ type: "query" })).toBe(false);
    expect(RECOGNITION_STORE_KEY).toBe("pt.experimental.control-d.v2.recognition");

    const state = await loadRecognitionState();
    expect(state.phase).toBe("not-setup");
    expect(state.resolverDoh).toBeNull();
    expect(storage[RECOGNITION_STORE_KEY]).toBeUndefined();
    await expect(
      controller().respond({ type: "query-domain", hostname: "example.com" }),
    ).resolves.toMatchObject({
      ok: false,
      error: "Unknown diagnostic command.",
      summary: { phase: "not-setup", hasResolver: false },
    });
    expect(calls).toEqual([]);
  });

  it("does not treat a stored resolver-less record as ready", async () => {
    storage[RECOGNITION_STORE_KEY] = {
      version: 1,
      phase: "ready",
      code: CODE,
      profileId: "lookup-profile",
      endpointId: "lookup-endpoint",
      resolverDoh: null,
      servicePks: ["netflix"],
      expectedFingerprint: null,
      freshFingerprint: null,
      lastError: null,
    };

    expect((await loadRecognitionState()).phase).toBe("error");
    expect((await loadRecognitionState()).resolverDoh).toBeNull();
  });

  it("previews creation with read-only catalogue, profile, and endpoint checks", async () => {
    const result = await controller().respond({ type: DIAGNOSTIC_COMMANDS.preview });

    expect(result).toMatchObject({
      ok: true,
      summary: { phase: "not-setup", hasResolver: false, serviceCount: 0 },
      preview: {
        token: "preview-token",
        profileCreateCount: 1,
        endpointCreateCount: 1,
        serviceCount: 2,
      },
    });
    expect(calls.every((call) => call.method === "GET")).toBe(true);
    expect(calls.map((call) => new URL(call.url).pathname)).toEqual([
      "/services/categories/all",
      "/profiles",
      "/devices",
    ]);
    expect(JSON.stringify(result)).not.toContain(SECRET);
    expect(JSON.stringify(result)).not.toContain("browser-secret");
  });

  it("applies only the reviewed lookup resources and keeps the resolver out of the summary", async () => {
    const result = await previewAndApply();
    const profilePost = calls.find(
      (call) => call.method === "POST" && call.url.endsWith("/profiles"),
    );
    const devicePost = calls.find(
      (call) => call.method === "POST" && call.url.endsWith("/devices"),
    );
    const bypass = calls.find((call) => call.method === "PUT");

    expect(result.ok).toBe(true);
    expect(result.summary).toMatchObject({
      phase: "ready",
      code: CODE,
      profileId: "lookup-profile",
      endpointId: "lookup-endpoint",
      hasResolver: true,
      serviceCount: 2,
      lastError: null,
    });
    expect(JSON.stringify(result.summary)).not.toContain(SECRET);
    expect(profilePost?.body).toContain("name=PT+Lookup+ABCDE-FGHJK");
    expect(devicePost?.body).toContain("name=PT+Probe+ABCDE-FGHJK");
    expect(devicePost?.body).toContain("profile_id=lookup-profile");
    expect("PT Lookup ABCDE-FGHJK".length).toBeLessThanOrEqual(32);
    expect("PT Probe ABCDE-FGHJK".length).toBeLessThanOrEqual(32);
    expect(profilePost?.body).not.toContain("Privacy+Thing");
    expect(devicePost?.body).not.toContain("PT+Browser");
    expect(devicePost?.body).not.toContain("PT+Firefox");
    expect(bypass?.url).toBe(
      "https://api.controld.com/profiles/lookup-profile/services",
    );
    expect(bypass?.body).toBe(
      JSON.stringify({
        services: [
          { PK: "netflix", do: 1, status: 1 },
          { PK: "zoom", do: 1, status: 1 },
        ],
      }),
    );
    expect(calls.some((call) => call.method === "DELETE")).toBe(false);
    expect(calls.some((call) => call.url.includes("/default"))).toBe(false);
    expect(calls.some((call) => call.url.includes("main-profile"))).toBe(false);
    expect(calls.some((call) => call.url.includes("dns.controld.com"))).toBe(false);
    expect(await loadRecognitionState()).toMatchObject({
      phase: "ready",
      resolverDoh: SECRET,
      servicePks: ["netflix", "zoom"],
    });
    expect(storage["pt.experimental.control-d.v2.config"]).toBeUndefined();
  });

  it("saves the lookup code before creating remote resources", async () => {
    let release: (() => void) | undefined;
    let opened: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const started = new Promise<void>((resolve) => {
      opened = resolve;
    });
    const api = createRecognitionController({
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
      loadApiKey: async () => "token",
      createToken: () => "preview-token",
      createCode: () => CODE,
    });
    await api.respond({ type: DIAGNOSTIC_COMMANDS.preview });
    const pending = api.respond({
      type: DIAGNOSTIC_COMMANDS.apply,
      previewToken: "preview-token",
    });
    await started;
    expect(calls.some((call) => call.method === "POST")).toBe(false);
    expect(storage[RECOGNITION_STORE_KEY]).toMatchObject({
      code: CODE,
      phase: "error",
      resolverDoh: null,
    });
    release?.();
    await pending;
  });

  it("refuses a stale preview without writing and preserves the ready resolver", async () => {
    expect((await previewAndApply()).summary.phase).toBe("ready");
    const api = controller();
    await api.respond({ type: DIAGNOSTIC_COMMANDS.preview });
    groups["lookup-profile"] = [{ PK: 4, group: "Custom" }];
    const start = calls.length;
    const result = await api.respond({
      type: DIAGNOSTIC_COMMANDS.apply,
      previewToken: "preview-token",
    });

    expect(result).toMatchObject({
      ok: false,
      error: "Control D changed since the preview. Review it again.",
      summary: { phase: "stale", hasResolver: true, lastError: expect.any(String) },
    });
    expect(writesSince(start)).toEqual([]);
    expect((await loadRecognitionState()).resolverDoh).toBe(SECRET);
    expect(JSON.stringify(result.summary)).not.toContain(SECRET);
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
  ])("refuses %s without changing remote resources", async (_label, mutate) => {
    expect((await previewAndApply()).summary.phase).toBe("ready");
    mutate();
    const start = calls.length;
    const result = await controller().respond({ type: DIAGNOSTIC_COMMANDS.preview });

    expect(result.ok).toBe(false);
    expect(result.preview).toBeUndefined();
    expect(result.summary.phase).toBe("stale");
    expect(result.summary.hasResolver).toBe(true);
    expect(writesSince(start)).toEqual([]);
    expect((await loadRecognitionState()).resolverDoh).toBe(SECRET);
    expect(JSON.stringify(result)).not.toContain("other-secret");
  });

  it("does not adopt the managed browser profile or its endpoint", async () => {
    const result = await previewAndApply();

    expect(result.summary.profileId).toBe("lookup-profile");
    expect(result.summary.endpointId).toBe("lookup-endpoint");
    expect(
      devices.find((device) => device.id === "browser-device")?.profileIds,
    ).toEqual(["main-profile"]);
    expect((await loadRecognitionState()).resolverDoh).not.toBe("browser-secret");
  });

  it("keeps a failed device create recoverable without claiming ready", async () => {
    failDevice = true;
    const failed = await previewAndApply();
    expect(failed.summary.phase).toBe("error");
    expect(failed.summary.hasResolver).toBe(false);
    expect(await loadRecognitionState()).toMatchObject({
      phase: "error",
      code: CODE,
      profileId: "lookup-profile",
      endpointId: null,
      resolverDoh: null,
    });

    failDevice = false;
    const api = controller();
    const reviewed = await api.respond({ type: DIAGNOSTIC_COMMANDS.preview });
    const start = calls.length;
    const applied = await api.respond({
      type: DIAGNOSTIC_COMMANDS.apply,
      previewToken: "preview-token",
    });

    expect(reviewed.preview).toMatchObject({
      profileCreateCount: 0,
      endpointCreateCount: 1,
    });
    expect(applied.summary.phase).toBe("ready");
    expect(
      calls
        .slice(start)
        .some((call) => call.method === "POST" && call.url.endsWith("/profiles")),
    ).toBe(false);
  });

  it("rejects an endpoint that also enforces another profile", async () => {
    extraProfileOnCreate = true;
    const result = await previewAndApply();

    expect(result.ok).toBe(false);
    expect(result.summary.phase).not.toBe("ready");
    expect((await loadRecognitionState()).resolverDoh).toBeNull();
    expect(calls.some((call) => call.method === "DELETE")).toBe(false);
  });

  it("requires an explicit fresh preview before apply and does not query DNS", async () => {
    const api = controller();
    const skipped = await api.respond({
      type: DIAGNOSTIC_COMMANDS.apply,
      previewToken: "preview-token",
    });
    expect(skipped).toMatchObject({
      ok: false,
      error: "Preview and review the diagnostic setup before applying.",
    });
    expect(calls).toEqual([]);
    expect(RECOGNITION_LIMITATIONS.join(" ")).toContain("overridden");
    expect(RECOGNITION_LIMITATIONS.join(" ")).toContain("browser DNS");
  });

  it("runs preview and apply one at a time", async () => {
    let release: (() => void) | undefined;
    let opened: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const started = new Promise<void>((resolve) => {
      opened = resolve;
    });
    let catalogues = 0;
    const api = createRecognitionController({
      fetchImpl: async (input, init) => {
        if (requestUrl(input).includes("/services/categories/all")) {
          catalogues += 1;
          opened?.();
          await gate;
        }
        return fetchImpl(input, init);
      },
      loadApiKey: async () => "token",
      createToken: () => "preview-token",
      createCode: () => CODE,
    });
    const first = api.respond({ type: DIAGNOSTIC_COMMANDS.preview });
    const second = api.respond({ type: DIAGNOSTIC_COMMANDS.preview });
    await started;
    expect(catalogues).toBe(1);
    release?.();
    await first;
    await second;
    expect(catalogues).toBe(2);
  });

  it("does not call Control D when the API key is missing", async () => {
    const api = createRecognitionController({
      fetchImpl,
      loadApiKey: async () => null,
    });
    await expect(
      api.respond({ type: DIAGNOSTIC_COMMANDS.preview }),
    ).resolves.toMatchObject({
      ok: false,
      error: "Connect a Control D API key first.",
      summary: { phase: "not-setup" },
    });
    expect(calls).toEqual([]);
  });
});
