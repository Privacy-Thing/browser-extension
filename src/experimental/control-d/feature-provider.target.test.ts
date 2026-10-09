import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createControlDProvider, resolverIdFrom } from "./feature-provider";

import type { RuleFeatureBinding } from "@/shared/provider-feature";

const fixture = vi.hoisted(() => ({
  config: {
    enabled: true,
    connected: true,
    status: "ready",
    lastError: null,
    resolverDoh: "https://dns.controld.com/test-resolver",
    locationMappings: { warsaw: { proxyPk: "WAW", confirmed: true, status: "exact" } },
    managedServices: {} as Record<string, { rulePattern: string; proxyPk: string }>,
  },
  rules: [{ pattern: "video.example.com", locationId: "warsaw", enabled: true }],
  services: vi.fn(async () => [{ pk: "video", name: "Video", category: "video" }]),
  query: vi.fn(async (_resolverId: string, hostname: string) => ({
    hostname,
    status: "matched" as const,
    serviceId: "video",
  })),
}));
vi.mock("./client", () => ({
  ControlDClient: class {
    listServices = fixture.services;
    queryDomain = fixture.query;
  },
}));
vi.mock("./recognition-setup", () => ({
  loadRecognitionState: vi.fn(async () => ({
    phase: "ready",
    resolverDoh: "https://dns.controld.com/test-resolver",
  })),
}));
vi.mock("./storage", () => ({
  loadControlDConfig: vi.fn(async () => fixture.config),
  loadControlDApiKey: vi.fn(async () => "test-only-key"),
}));
vi.mock("@/background/storage/rules", () => ({
  loadRules: vi.fn(async () => fixture.rules),
}));

let cache: Record<string, unknown>;
const binding: RuleFeatureBinding = {
  rulePattern: "video.example.com",
  providerId: "control-d",
  featureId: "video",
  featureName: "Video",
  featureType: "service",
};
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-09T10:00:00Z"));
  fixture.services.mockClear();
  fixture.query.mockClear();
  fixture.config.status = "ready";
  fixture.config.managedServices = {};
  fixture.config.locationMappings.warsaw.proxyPk = "WAW";
  fixture.rules[0]!.enabled = true;
  cache = {};
  vi.stubGlobal("chrome", {
    storage: {
      local: {
        get: vi.fn(async (key: string) => ({ [key]: cache[key] })),
        set: vi.fn(async (values: Record<string, unknown>) =>
          Object.assign(cache, values),
        ),
      },
    },
  });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("Control D feature provider", () => {
  it("recognizes each individual domain through the resolver without constructing a domain catalogue", async () => {
    const provider = createControlDProvider();
    expect(await provider.recognizeDomain("video.example.com")).toMatchObject({
      featureId: "video",
      status: "matched",
      matchSource: "domain-test",
    });
    expect(await provider.recognizeDomain("stream.example.net")).toMatchObject({
      featureId: "video",
      status: "matched",
    });
    expect(fixture.query.mock.calls).toEqual([
      ["test-resolver", "video.example.com"],
      ["test-resolver", "stream.example.net"],
    ]);
    expect(fixture.services).toHaveBeenCalledOnce();
  });

  it("reports queued until the source's current route is applied", async () => {
    const provider = createControlDProvider();
    expect((await provider.getStatus(binding)).syncStatus).toBe("queued");
    fixture.config.managedServices.video = {
      rulePattern: binding.rulePattern,
      proxyPk: "WAW",
    };
    expect((await provider.getStatus(binding)).syncStatus).toBe("synced");
    fixture.config.locationMappings.warsaw.proxyPk = "PAR";
    expect((await provider.getStatus(binding)).syncStatus).toBe("queued");
    fixture.config.locationMappings.warsaw.proxyPk = "WAW";
    fixture.rules[0]!.enabled = false;
    expect((await provider.getStatus(binding)).syncStatus).toBe("queued");
    fixture.config.status = "conflict";
    expect((await provider.getStatus(binding)).syncStatus).toBe("error");
  });

  it("keeps cached metadata through restart and a failed refresh", async () => {
    const first = await createControlDProvider().getFeatures();
    expect(await createControlDProvider().getFeatures()).toEqual(first);
    expect(fixture.services).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(25 * 60 * 60 * 1_000);
    fixture.services.mockRejectedValueOnce(new Error("Unavailable"));
    const restarted = createControlDProvider();
    expect(await restarted.getFeatures()).toEqual(first);
    expect((await restarted.getStatus()).error).toContain("cached");
  });

  it("rejects resolver URLs with foreign origins, userinfo, query strings or extra paths", () => {
    for (const url of [
      "https://example.com/token",
      "https://user@dns.controld.com/token",
      "https://dns.controld.com/token?x=1",
      "https://dns.controld.com/token/extra",
    ]) {
      expect(() => resolverIdFrom(url)).toThrow("rejected");
    }
  });
});
