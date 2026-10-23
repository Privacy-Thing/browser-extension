import { describe, expect, it, vi } from "vitest";

import { planControlDCleanup, type CleanupClient } from "./cleanup";
import { executeControlDCleanup } from "./cleanup-execution";
import {
  ControlDApiError,
  type ControlDDevice,
  type ControlDGroup,
  type ControlDProfile,
  type ControlDRule,
} from "./client";
import type { ControlDConfig } from "./contracts";
import type { RecognitionState } from "./recognition-setup";
import { canonicalRules, hashControlDValue } from "./service-reconcile";
import type { ControlDProfileService } from "./services";

const code = "ABCDE-FGHJK";
const recognition = (): RecognitionState => ({
  phase: "not-setup",
  code: null,
  profileId: null,
  endpointId: null,
  resolverDoh: null,
  servicePks: [],
  expectedFingerprint: null,
  freshFingerprint: null,
  lastError: null,
});
const fixture = async () => {
  const profiles: ControlDProfile[] = [
    { id: "p", name: `Privacy Thing ${code}` },
    { id: "foreign", name: `Privacy Thing ${code}` },
  ];
  const devices: ControlDDevice[] = [
    { id: "e", name: `PT Browser ${code}`, profileId: "p", resolverDoh: "resolver" },
  ];
  const groups: Record<string, ControlDGroup[]> = {
    p: [{ id: 1, name: `PT ${code} WAW`, action: 3, via: "WAW" }],
  };
  const rules: Record<string, ControlDRule[]> = {
    p: [
      {
        hostname: "owned.test",
        groupId: 1,
        action: 3,
        status: 1,
        via: "WAW",
        comment: `PT ${code}`,
      },
    ],
  };
  const services: Record<string, ControlDProfileService[]> = {
    p: [
      {
        pk: "video",
        name: "Video",
        category: "video",
        action: 3,
        status: 1,
        via: "WAW",
        viaV6: null,
      },
    ],
  };
  const config: ControlDConfig = {
    version: 2,
    enabled: true,
    connected: true,
    autoSyncEnabled: true,
    status: "ready",
    resourceIdentity: { code },
    profileId: "p",
    endpointId: "e",
    resolverDoh: "resolver",
    dnsVerification: null,
    managedFolders: {
      WAW: {
        proxyPk: "WAW",
        folderId: 1,
        remoteHash: await hashControlDValue(canonicalRules(rules.p ?? [])),
      },
    },
    managedServices: {
      video: {
        rulePattern: "owned.test",
        proxyPk: "WAW",
        action: { do: 3, status: 1, via: "WAW", viaV6: null },
      },
    },
    locationMappings: {},
    lastSyncedHash: "local-input-hash",
    lastAttemptAt: null,
    lastSuccessAt: null,
    lastError: null,
  };
  const calls: string[] = [];
  const client: CleanupClient = {
    listProfiles: vi.fn(async () => profiles),
    listDevices: vi.fn(async () => devices),
    listGroups: vi.fn(async (id) => groups[id] ?? []),
    listCustomRules: vi.fn(async (id) => rules[id] ?? []),
    listProfileServices: vi.fn(async (id) => services[id] ?? []),
    deleteGroup: vi.fn(async (id, folder) => {
      calls.push(`folder:${id}:${folder}`);
      groups[id] = (groups[id] ?? []).filter((item) => item.id !== folder);
      rules[id] = (rules[id] ?? []).filter((item) => item.groupId !== folder);
    }),
    deleteProfileService: vi.fn(async (id, service) => {
      calls.push(`service:${id}:${service}`);
      services[id] = (services[id] ?? []).filter((item) => item.pk !== service);
    }),
    deleteDevice: vi.fn(async (id) => {
      calls.push(`endpoint:${id}`);
      const index = devices.findIndex((item) => item.id === id);
      if (index >= 0) devices.splice(index, 1);
    }),
    deleteProfile: vi.fn(async (id) => {
      calls.push(`profile:${id}`);
      const index = profiles.findIndex((item) => item.id === id);
      if (index >= 0) profiles.splice(index, 1);
    }),
  };
  const state = { config, recognition: recognition() };
  const plan = () => planControlDCleanup(client, config, state.recognition);
  const checkpoint = vi.fn(async () => undefined);
  const run = async () =>
    executeControlDCleanup({ client, resources: await plan(), state, checkpoint });
  return {
    profiles,
    devices,
    groups,
    rules,
    services,
    config,
    client,
    state,
    plan,
    run,
    calls,
    checkpoint,
  };
};

describe("Control D cleanup ownership and execution", () => {
  it("plans without writes, deletes only recorded resources, and orders children before endpoints and profiles", async () => {
    const f = await fixture();
    expect((await f.plan()).map((item) => item.kind)).toEqual([
      "folder",
      "service",
      "endpoint",
      "profile",
    ]);
    expect(f.calls).toEqual([]);
    const results = await f.run();
    expect(results.every((item) => item.status === "deleted")).toBe(true);
    expect(f.calls).toEqual([
      "folder:p:1",
      "service:p:video",
      "endpoint:e",
      "profile:p",
    ]);
    expect(f.profiles).toEqual([{ id: "foreign", name: `Privacy Thing ${code}` }]);
    expect(f.config.profileId).toBeNull();
    expect(f.checkpoint).toHaveBeenCalledTimes(4);
    expect(await f.run()).toEqual([]);
  });

  it("skips unrecorded look-alike folders and services and preserves their parent", async () => {
    const f = await fixture();
    f.groups.p?.push({ id: 2, name: `PT ${code} LHR`, action: 3, via: "LHR" });
    f.services.p?.push({
      pk: "foreign",
      name: "Foreign",
      category: "video",
      action: 3,
      status: 1,
      via: "WAW",
      viaV6: null,
    });
    const plan = await f.plan();
    expect(plan.find((item) => item.id === "2")?.reason).toBe("not-recorded");
    expect(plan.find((item) => item.id === "foreign")?.reason).toBe("not-recorded");
    expect(plan.find((item) => item.kind === "profile")?.reason).toBe(
      "contains-preserved",
    );
    await f.run();
    expect(f.calls).not.toContain("profile:p");
    expect(f.groups.p?.map((item) => item.id)).toEqual([2]);
  });

  it.each(["profile", "folder", "endpoint"])("skips a renamed %s", async (kind) => {
    const f = await fixture();
    if (kind === "profile") f.profiles[0]!.name = "Renamed";
    if (kind === "folder") f.groups.p![0]!.name = "Renamed";
    if (kind === "endpoint") f.devices[0]!.name = "Renamed";
    expect((await f.plan()).find((item) => item.kind === kind)?.reason).toBe(
      "name-changed",
    );
    await f.run();
    expect(f.calls).not.toContain("profile:p");
  });

  it("skips remotely edited rules by the recorded remoteHash, even if their comments still match", async () => {
    const f = await fixture();
    f.rules.p![0]!.via = "LHR";
    const plan = await f.plan();
    expect(plan.find((item) => item.kind === "folder")?.reason).toBe("content-changed");
    expect(plan.find((item) => item.kind === "profile")?.reason).toBe(
      "contains-preserved",
    );
    await f.run();
    expect(f.calls).not.toContain("folder:p:1");
    expect(f.rules.p).toHaveLength(1);
  });

  it("refuses a rule without the ownership comment even if a recovery recorded its hash", async () => {
    const f = await fixture();
    f.rules.p![0]!.comment = null;
    f.config.managedFolders.WAW!.remoteHash = await hashControlDValue(
      canonicalRules(f.rules.p ?? []),
    );
    expect((await f.plan()).find((item) => item.kind === "folder")?.reason).toBe(
      "content-changed",
    );
    await f.run();
    expect(f.calls).not.toContain("folder:p:1");
  });

  it("preserves folders without a recorded hash and changed service actions", async () => {
    const f = await fixture();
    f.config.managedFolders.WAW!.remoteHash = "";
    f.services.p![0]!.status = 0;
    expect(
      (await f.plan()).filter((item) => item.reason === "content-changed"),
    ).toHaveLength(2);
  });

  it("never deletes a shared profile or an endpoint using another profile", async () => {
    const f = await fixture();
    f.devices.push({ id: "other", name: "Foreign", profileId: "p", resolverDoh: null });
    expect((await f.plan()).find((item) => item.kind === "profile")?.reason).toBe(
      "shared-profile",
    );
    f.devices[0]!.enforcedProfileIds = ["p", "foreign"];
    expect((await f.plan()).find((item) => item.id === "e")?.reason).toBe(
      "content-changed",
    );
  });

  it("handles a DELETE 404 as already deleted and is safe to retry", async () => {
    const f = await fixture();
    vi.mocked(f.client.deleteGroup)
      .mockReset()
      .mockImplementationOnce(async () => {
        f.groups.p = [];
        f.rules.p = [];
        throw new ControlDApiError("gone", 404, null, null);
      });
    const results = await f.run();
    expect(results[0]).toMatchObject({ status: "deleted", reason: "already-deleted" });
    expect(results.every((item) => item.status === "deleted")).toBe(true);
    expect(await f.run()).toEqual([]);
  });

  it("treats a repeated folder DELETE (HTTP 400, code 40003) as deleted only when the folder is gone", async () => {
    const gone = await fixture();
    vi.mocked(gone.client.deleteGroup)
      .mockReset()
      .mockImplementationOnce(async () => {
        gone.groups.p = [];
        gone.rules.p = [];
        throw new ControlDApiError("missing", 400, null, null, null, null, 40003);
      });
    const goneResults = await gone.run();
    expect(goneResults[0]).toMatchObject({
      status: "deleted",
      reason: "already-deleted",
    });

    const present = await fixture();
    vi.mocked(present.client.deleteGroup)
      .mockReset()
      .mockRejectedValueOnce(
        new ControlDApiError("invalid", 400, null, null, null, null, 40003),
      );
    const presentResults = await present.run();
    expect(presentResults[0]).toMatchObject({ status: "failed" });
  });

  it("returns sanitized per-resource failures and retries only remaining IDs", async () => {
    const f = await fixture();
    vi.mocked(f.client.deleteGroup).mockRejectedValueOnce(
      new ControlDApiError("Bearer secret resolver.example", 403, null, null),
    );
    const first = await f.run();
    expect(first.map((item) => item.status)).toEqual([
      "failed",
      "deleted",
      "deleted",
      "failed",
    ]);
    expect(first[0]?.message).toBe("Control D cleanup request failed (HTTP 403).");
    expect(first[3]?.reason).toBe("dependency-failed");
    expect(f.config.managedFolders.WAW).toBeDefined();
    const second = await f.run();
    expect(second.every((item) => item.status === "deleted")).toBe(true);
    expect(f.calls).toEqual([
      "service:p:video",
      "endpoint:e",
      "folder:p:1",
      "profile:p",
    ]);
  });

  it("rechecks drift between plan and execution without deleting newly added foreign content", async () => {
    const f = await fixture();
    const resources = await f.plan();
    f.rules.p?.push({
      hostname: "foreign.test",
      groupId: 1,
      action: 1,
      status: 1,
      via: null,
      comment: null,
    });
    const results = await executeControlDCleanup({
      client: f.client,
      resources,
      state: f.state,
      checkpoint: f.checkpoint,
    });
    expect(results[0]).toMatchObject({ status: "skipped", reason: "content-changed" });
    expect(f.calls).not.toContain("folder:p:1");
    expect(f.calls).not.toContain("profile:p");
  });

  it("includes recognition resources only when their IDs are recorded and names/actions match", async () => {
    const f = await fixture();
    f.profiles.push({ id: "lookup", name: `PT Lookup ${code}` });
    f.devices.push({
      id: "probe",
      name: `PT Probe ${code}`,
      profileId: "lookup",
      resolverDoh: "probe",
    });
    expect((await f.plan()).some((item) => item.id === "lookup")).toBe(false);
    f.state.recognition = {
      ...recognition(),
      code,
      profileId: "lookup",
      endpointId: "probe",
      servicePks: ["lookup-service"],
    };
    f.services.lookup = [
      {
        pk: "lookup-service",
        name: "Lookup service",
        category: "video",
        action: 1,
        status: 1,
        via: null,
        viaV6: null,
      },
    ];
    const plan = await f.plan();
    expect(
      plan.filter((item) => item.profileId === "lookup").map((item) => item.kind),
    ).toEqual(["service", "endpoint", "profile"]);
    const results = await f.run();
    expect(results.every((item) => item.status === "deleted")).toBe(true);
    expect(f.calls.indexOf("service:lookup:lookup-service")).toBeLessThan(
      f.calls.indexOf("endpoint:probe"),
    );
    expect(f.state.recognition.profileId).toBeNull();
  });

  it("skips changed recognition services and preserves a lookup profile with custom rules", async () => {
    const f = await fixture();
    f.profiles.push({ id: "lookup", name: `PT Lookup ${code}` });
    f.state.recognition = {
      ...recognition(),
      code,
      profileId: "lookup",
      servicePks: ["lookup-service"],
    };
    f.services.lookup = [
      {
        pk: "lookup-service",
        name: "Lookup service",
        category: "video",
        action: 3,
        status: 1,
        via: "WAW",
        viaV6: null,
      },
    ];
    f.rules.lookup = [
      {
        hostname: "foreign.test",
        groupId: 0,
        action: 1,
        status: 1,
        via: null,
        comment: null,
      },
    ];
    const plan = await f.plan();
    expect(plan.find((item) => item.id === "lookup-service")?.reason).toBe(
      "content-changed",
    );
    expect(plan.find((item) => item.id === "lookup")?.reason).toBe(
      "contains-preserved",
    );
  });
});
