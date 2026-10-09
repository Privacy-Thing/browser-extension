import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createFeatureController, type FeatureProvider } from "./provider-features";

import {
  loadFeatureState,
  reconcileFeatureRefs,
  saveFeatureState,
} from "@/background/storage/provider-features";
import { RULES_STORAGE_KEY, saveRules } from "@/background/storage/rules";
import {
  FEATURE_COMMANDS,
  type ProviderFeatureReply,
  type RuleFeatureBinding,
} from "@/shared/provider-feature";

const data: Record<string, unknown> = {};
const binding: RuleFeatureBinding = {
  rulePattern: "video.example.com",
  providerId: "provider",
  featureId: "video",
  featureName: "Video",
  featureType: "service",
};
const request = (type: string, extra: Record<string, unknown> = {}) => ({
  type,
  providerId: "provider",
  rulePattern: "video.example.com",
  hostname: "video.example.com",
  ...extra,
});
const stateOf = (reply: ProviderFeatureReply) => {
  if (!reply.ok) throw new Error(reply.error);
  return reply.state;
};
const provider = (): FeatureProvider => ({
  id: "provider",
  name: "Example provider",
  capabilities: { catalogue: true, domainRecognition: true, ruleSync: true },
  getStatus: vi.fn(async () => ({ available: true, syncStatus: "ready", error: null })),
  getFeatures: vi.fn<FeatureProvider["getFeatures"]>(async () => [
    { providerId: "provider", featureId: "video", type: "service", name: "Video" },
  ]),
  recognizeDomain: vi.fn<FeatureProvider["recognizeDomain"]>(async (hostname) => ({
    hostname,
    providerId: "provider",
    featureId: "video",
    matchSource: "domain-test",
    status: "matched",
    checkedAt: new Date().toISOString(),
  })),
});

beforeEach(() => {
  Object.keys(data).forEach((key) => Reflect.deleteProperty(data, key));
  vi.stubGlobal("chrome", {
    storage: {
      local: {
        get: vi.fn(async (keys: string | string[]) =>
          Object.fromEntries(
            (Array.isArray(keys) ? keys : [keys])
              .filter((key) => key in data)
              .map((key) => [key, data[key]]),
          ),
        ),
        set: vi.fn(async (values: Record<string, unknown>) => {
          Object.assign(data, values);
        }),
        remove: vi.fn(async (key: string) => {
          Reflect.deleteProperty(data, key);
        }),
      },
    },
  });
  data[RULES_STORAGE_KEY] = [
    {
      pattern: "video.example.com",
      enabled: true,
      ruleSeedKey: "abc123",
      authKey: "abcdefgh",
    },
  ];
});
afterEach(() => vi.unstubAllGlobals());

describe("provider feature lifecycle", () => {
  it("keeps suggestions separate from confirmations and persists dismissal across controller restarts", async () => {
    const adapter = provider();
    const controller = createFeatureController([adapter]);
    const recognized = stateOf(
      await controller.respond(request(FEATURE_COMMANDS.recognize)),
    );
    expect(recognized.match?.featureId).toBe("video");
    expect(recognized.binding).toBeNull();
    await controller.respond(request(FEATURE_COMMANDS.dismiss));
    const restarted = createFeatureController([adapter]);
    expect(
      stateOf(await restarted.respond(request(FEATURE_COMMANDS.getState))).dismissed,
    ).toBe(true);
    expect(
      stateOf(await restarted.respond(request(FEATURE_COMMANDS.recognize))).dismissed,
    ).toBe(false);
    expect(adapter.recognizeDomain).toHaveBeenCalledOnce();
    expect((await loadFeatureState()).featureBindings).toEqual([]);
  });

  it("confirms a manual selection, rejects duplicate ownership, and detaches without changing PT rules", async () => {
    const controller = createFeatureController([provider()]);
    const reply = await controller.respond(
      request(FEATURE_COMMANDS.confirm, { featureId: "video" }),
    );
    expect(stateOf(reply).binding).toMatchObject({ ...binding, matchSource: "manual" });
    expect(stateOf(reply).match?.matchSource).toBe("manual");
    data[RULES_STORAGE_KEY] = [
      ...(data[RULES_STORAGE_KEY] as object[]),
      { pattern: "other.example.com", enabled: true },
    ];
    expect(
      await controller.respond(
        request(FEATURE_COMMANDS.confirm, {
          featureId: "video",
          rulePattern: "other.example.com",
        }),
      ),
    ).toMatchObject({ ok: false, error: expect.stringContaining("already linked") });
    await controller.respond(request(FEATURE_COMMANDS.detach));
    expect((await loadFeatureState()).featureBindings).toEqual([]);
    expect(data[RULES_STORAGE_KEY]).toHaveLength(2);
  });

  it("requires a saved rule and validates manual feature IDs", async () => {
    const controller = createFeatureController([provider()]);
    expect(
      await controller.respond(
        request(FEATURE_COMMANDS.confirm, { featureId: "unknown" }),
      ),
    ).toMatchObject({ ok: false });
    expect(
      await controller.respond(
        request(FEATURE_COMMANDS.confirm, {
          featureId: "video",
          rulePattern: "unsaved.example.com",
        }),
      ),
    ).toMatchObject({
      ok: false,
      error: expect.stringContaining("Save the domain rule"),
    });
  });

  it("keeps the last successful match and confirmed binding after provider failure", async () => {
    const adapter = provider();
    await saveFeatureState({
      featureBindings: [binding],
      featureMatches: [
        {
          hostname: "video.example.com",
          providerId: "provider",
          featureId: "video",
          matchSource: "domain-test",
          status: "matched",
          checkedAt: "2020-01-01T00:00:00.000Z",
        },
      ],
      dismissedMatches: [],
    });
    vi.mocked(adapter.recognizeDomain).mockRejectedValue(
      new Error("Provider unavailable"),
    );
    const reply = await createFeatureController([adapter]).respond(
      request(FEATURE_COMMANDS.recognize),
    );
    expect(reply).toMatchObject({
      ok: false,
      state: { binding, match: { status: "matched" }, error: "Provider unavailable" },
    });
    expect((await loadFeatureState()).featureBindings).toEqual([binding]);
  });

  it("coalesces concurrent domain checks and keeps unresolved results distinct from rejection", async () => {
    const adapter = provider();
    vi.mocked(adapter.recognizeDomain).mockImplementation(async (hostname) => ({
      hostname,
      providerId: "provider",
      featureId: null,
      matchSource: "domain-test",
      status: "overridden",
      checkedAt: new Date().toISOString(),
    }));
    const controller = createFeatureController([adapter]);
    const replies = await Promise.all([
      controller.respond(request(FEATURE_COMMANDS.recognize)),
      controller.respond(request(FEATURE_COMMANDS.recognize)),
    ]);
    expect(adapter.recognizeDomain).toHaveBeenCalledOnce();
    replies.forEach((reply) =>
      expect(stateOf(reply)).toMatchObject({
        match: { status: "overridden", featureId: null },
        binding: null,
        dismissed: false,
      }),
    );
  });

  it("repoints bindings on a stable rule identity and removes them on deletion", async () => {
    await saveFeatureState({
      featureBindings: [binding],
      featureMatches: [],
      dismissedMatches: [],
    });
    await saveRules([
      {
        pattern: "renamed.example.com",
        enabled: false,
        ruleSeedKey: "abc123",
        authKey: "abcdefgh",
      },
    ]);
    expect((await loadFeatureState()).featureBindings[0]?.rulePattern).toBe(
      "renamed.example.com",
    );
    expect((data[RULES_STORAGE_KEY] as { authKey: string }[])[0]?.authKey).toBe(
      "abcdefgh",
    );
    await saveRules([]);
    expect((await loadFeatureState()).featureBindings).toEqual([]);
  });

  it("rejects malformed and unrelated hosts without querying the provider", async () => {
    const adapter = provider();
    const controller = createFeatureController([adapter]);
    for (const hostname of [
      "user@video.example.com",
      "video.example.com?x",
      "invalid..example.com",
      "other.example.com",
    ]) {
      expect(
        await controller.respond(request(FEATURE_COMMANDS.recognize, { hostname })),
      ).toMatchObject({ ok: false });
    }
    expect(adapter.recognizeDomain).not.toHaveBeenCalled();
  });

  it("lets a disconnected provider binding be detached", async () => {
    const adapter = provider();
    await saveFeatureState({
      featureBindings: [binding],
      featureMatches: [],
      dismissedMatches: [],
    });
    vi.mocked(adapter.getStatus).mockResolvedValue({
      available: false,
      syncStatus: "queued",
      error: null,
    });
    expect(
      stateOf(
        await createFeatureController([adapter]).respond(
          request(FEATURE_COMMANDS.detach),
        ),
      ).binding,
    ).toBeNull();
    expect(data[RULES_STORAGE_KEY]).toHaveLength(1);
  });

  it("normalizes missing collections and preserves bindings when only a rule is disabled", () => {
    expect(
      reconcileFeatureRefs(
        { featureBindings: [binding], featureMatches: [], dismissedMatches: [] },
        [{ pattern: binding.rulePattern, enabled: true }],
        [{ pattern: binding.rulePattern, enabled: false }],
      ).featureBindings,
    ).toEqual([binding]);
  });
});
