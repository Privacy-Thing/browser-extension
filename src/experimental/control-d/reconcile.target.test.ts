import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  ControlDClient,
  ControlDDevice,
  ControlDGroup,
  ControlDRule,
} from "./client";
import type { ControlDConfig, ControlDProxyLocation } from "./contracts";
import {
  applyControlDSync,
  ControlDConflictError,
  prepareControlDSync,
} from "./reconcile";

import { loadLocations } from "@/background/storage/locations";
import { loadRules } from "@/background/storage/rules";

vi.mock("@/background/storage/locations", () => ({ loadLocations: vi.fn() }));
vi.mock("@/background/storage/rules", () => ({ loadRules: vi.fn() }));

const proxy: ControlDProxyLocation = {
  pk: "WAW",
  city: "Warsaw",
  countryCode: "PL",
  countryName: "Poland",
  latitude: 52.2,
  longitude: 21,
};

const berlinProxy: ControlDProxyLocation = {
  pk: "BER",
  city: "Berlin",
  countryCode: "DE",
  countryName: "Germany",
  latitude: 52.52,
  longitude: 13.4,
};

const config = (): ControlDConfig => ({
  version: 2,
  enabled: true,
  connected: true,
  autoSyncEnabled: false,
  status: "ready",
  resourceIdentity: { code: "ABCDE-FGHJK" },
  profileId: null,
  endpointId: null,
  resolverDoh: null,
  dnsVerification: null,
  managedFolders: {},
  locationMappings: {},
  lastSyncedHash: null,
  lastAttemptAt: null,
  lastSuccessAt: null,
  lastError: null,
});

class FakeClient {
  profiles: Array<{ id: string; name: string }> = [];
  groups: ControlDGroup[] = [];
  devices: ControlDDevice[] = [];
  rules = new Map<number, ControlDRule[]>();
  createRulesCalls = 0;
  updateRulesCalls = 0;
  deleteRuleCalls = 0;
  setDefaultBypassCalls = 0;
  createdDeviceIcon: string | null = null;
  proxies = [proxy];
  failNextCreateRules = false;

  async listProfiles() {
    return this.profiles;
  }

  async createProfile(name: string) {
    this.profiles.push({ id: "profile-1", name });
  }

  async setDefaultBypass() {
    this.setDefaultBypassCalls += 1;
  }

  async listGroups() {
    return this.groups;
  }

  async createGroup(_profileId: string, name: string, proxyPk: string) {
    const id = this.groups.length + 7;
    this.groups.push({ id, name, action: 3, via: proxyPk });
    this.rules.set(id, []);
  }

  async listRules(_profileId: string, folderId: number) {
    return this.rules.get(folderId) ?? [];
  }

  async createRules(
    _profileId: string,
    folderId: number,
    proxyPk: string,
    hostnames: readonly string[],
    comment: string,
  ) {
    if (this.failNextCreateRules) {
      this.failNextCreateRules = false;
      throw new Error("simulated rule write failure");
    }
    this.createRulesCalls += hostnames.length;
    const current = this.rules.get(folderId) ?? [];
    this.rules.set(folderId, [
      ...current,
      ...hostnames.map((hostname) => ({
        hostname,
        groupId: folderId,
        action: 3,
        via: proxyPk,
        status: 1,
        comment,
      })),
    ]);
  }

  async updateRules(
    _profileId: string,
    folderId: number,
    proxyPk: string,
    hostnames: readonly string[],
    comment: string,
  ) {
    this.updateRulesCalls += hostnames.length;
    const selected = new Set(hostnames);
    const moved: ControlDRule[] = [];
    for (const [sourceId, rules] of this.rules) {
      moved.push(
        ...rules
          .filter((rule) => selected.has(rule.hostname))
          .map((rule) => ({
            ...rule,
            groupId: folderId,
            action: 3,
            via: proxyPk,
            status: 1,
            comment,
          })),
      );
      this.rules.set(
        sourceId,
        rules.filter((rule) => !selected.has(rule.hostname)),
      );
    }
    this.rules.set(folderId, [...(this.rules.get(folderId) ?? []), ...moved]);
  }

  async deleteRule(_profileId: string, hostname: string) {
    this.deleteRuleCalls += 1;
    for (const [folderId, rules] of this.rules) {
      this.rules.set(
        folderId,
        rules.filter((rule) => rule.hostname !== hostname),
      );
    }
  }

  async listProxies() {
    return this.proxies;
  }

  async listDevices() {
    return this.devices;
  }

  async listDeviceTypes() {
    return ["browser-chrome", "browser-firefox", "browser-other"];
  }

  async createDevice(name: string, profileId: string, icon: string) {
    this.createdDeviceIcon = icon;
    const device = {
      id: "device-1",
      name: name.toLowerCase().replaceAll(" ", "-"),
      profileId,
      resolverDoh: "https://dns.controld.com/secret",
    };
    this.devices.push(device);
    return device;
  }
}

const asClient = (client: FakeClient): ControlDClient =>
  client as unknown as ControlDClient;

beforeEach(() => {
  vi.mocked(loadLocations).mockResolvedValue([
    {
      id: "warsaw",
      label: "Warsaw",
      latitude: 52.23,
      longitude: 21.01,
      countryCode: "PL",
      accuracy: 25,
      noiseRadius: 50,
      language: "pl",
      languages: ["pl"],
      timeZone: "Europe/Warsaw",
    },
  ]);
  vi.mocked(loadRules).mockResolvedValue([
    { pattern: "*example.com", enabled: true, locationId: "warsaw" },
  ]);
});

describe("Control D reconcile", () => {
  it("creates isolated resources once and is idempotent", async () => {
    const fake = new FakeClient();
    const initial = config();
    const firstPrepared = await prepareControlDSync(asClient(fake), initial);

    expect(firstPrepared.diff).toMatchObject({
      createProfile: true,
      createEndpoint: true,
      createFolders: 1,
      addRules: 1,
    });

    const applied = await applyControlDSync({
      client: asClient(fake),
      config: initial,
      prepared: firstPrepared,
      confirmApproximate: false,
      repair: false,
    });
    expect(applied).toMatchObject({
      profileId: "profile-1",
      endpointId: "device-1",
      status: "ready",
      autoSyncEnabled: true,
    });
    expect(fake.createRulesCalls).toBe(1);
    expect(fake.createdDeviceIcon).toBe(
      __PT_BROWSER_TARGET__ === "firefox" ? "browser-firefox" : "browser-other",
    );
    fake.devices.push({
      id: "device-manual",
      name: "Manually attached endpoint",
      profileId: "profile-1",
      resolverDoh: null,
    });

    const secondPrepared = await prepareControlDSync(asClient(fake), applied);
    expect(secondPrepared.diff).toMatchObject({
      createProfile: false,
      createEndpoint: false,
      createFolders: 0,
      addRules: 0,
      updateRules: 0,
      deleteRules: 0,
      unchangedRules: 1,
    });

    await applyControlDSync({
      client: asClient(fake),
      config: applied,
      prepared: secondPrepared,
      confirmApproximate: true,
      repair: false,
    });
    expect(fake.createRulesCalls).toBe(1);
    expect(fake.updateRulesCalls).toBe(0);
    expect(fake.deleteRuleCalls).toBe(0);
    expect(fake.devices).toHaveLength(2);
    expect(fake.devices).toContainEqual(
      expect.objectContaining({
        id: "device-manual",
        profileId: "profile-1",
      }),
    );
  });

  it("uses saved resource IDs when Control D normalizes their names", async () => {
    const fake = new FakeClient();
    const initial = config();
    const firstPrepared = await prepareControlDSync(asClient(fake), initial);
    const applied = await applyControlDSync({
      client: asClient(fake),
      config: initial,
      prepared: firstPrepared,
      confirmApproximate: false,
      repair: false,
    });

    fake.profiles[0]!.name = "privacy-thing-profile";
    fake.groups[0]!.name = "privacy-thing-folder";

    const secondPrepared = await prepareControlDSync(asClient(fake), applied);
    await expect(
      applyControlDSync({
        client: asClient(fake),
        config: applied,
        prepared: secondPrepared,
        confirmApproximate: true,
        repair: false,
      }),
    ).resolves.toMatchObject({
      profileId: "profile-1",
      endpointId: "device-1",
      status: "ready",
    });
  });

  it("accepts a saved endpoint when the managed profile is the second enforced profile", async () => {
    const fake = new FakeClient();
    const initial = config();
    const prepared = await prepareControlDSync(asClient(fake), initial);
    const applied = await applyControlDSync({
      client: asClient(fake),
      config: initial,
      prepared,
      confirmApproximate: false,
      repair: false,
    });
    fake.devices[0]!.profileId = "main-profile";
    fake.devices[0]!.enforcedProfileIds = ["main-profile", "profile-1"];

    await expect(prepareControlDSync(asClient(fake), applied)).resolves.toMatchObject({
      diff: expect.objectContaining({ createEndpoint: false }),
    });
  });

  it("rejects a saved endpoint reassigned to another profile", async () => {
    const fake = new FakeClient();
    const initial = config();
    const prepared = await prepareControlDSync(asClient(fake), initial);
    const applied = await applyControlDSync({
      client: asClient(fake),
      config: initial,
      prepared,
      confirmApproximate: false,
      repair: false,
    });
    fake.devices[0]!.profileId = "foreign-profile";

    await expect(prepareControlDSync(asClient(fake), applied)).rejects.toThrow(
      "uses another profile",
    );
  });

  it("stops before writes when a managed rule drifts remotely", async () => {
    const fake = new FakeClient();
    const initial = config();
    const prepared = await prepareControlDSync(asClient(fake), initial);
    const applied = await applyControlDSync({
      client: asClient(fake),
      config: initial,
      prepared,
      confirmApproximate: false,
      repair: false,
    });
    fake.rules.set(7, [
      {
        ...(fake.rules.get(7)?.[0] as ControlDRule),
        comment: "manually changed",
      },
    ]);
    const drifted = await prepareControlDSync(asClient(fake), applied);

    await expect(
      applyControlDSync({
        client: asClient(fake),
        config: applied,
        prepared: drifted,
        confirmApproximate: true,
        repair: false,
      }),
    ).rejects.toBeInstanceOf(ControlDConflictError);
    expect(fake.updateRulesCalls).toBe(0);
    expect(fake.deleteRuleCalls).toBe(0);
  });

  it("preflights every managed folder before writing any folder", async () => {
    vi.mocked(loadLocations).mockResolvedValue([
      ...(await loadLocations()),
      {
        id: "berlin",
        label: "Berlin",
        latitude: 52.52,
        longitude: 13.4,
        countryCode: "DE",
        accuracy: 25,
        noiseRadius: 50,
        language: "de",
        languages: ["de"],
        timeZone: "Europe/Berlin",
      },
    ]);
    vi.mocked(loadRules).mockResolvedValue([
      { pattern: "*example.com", enabled: true, locationId: "warsaw" },
      { pattern: "*example.de", enabled: true, locationId: "berlin" },
    ]);

    const fake = new FakeClient();
    fake.proxies = [proxy, berlinProxy];
    const initial = config();
    const prepared = await prepareControlDSync(asClient(fake), initial);
    const applied = await applyControlDSync({
      client: asClient(fake),
      config: initial,
      prepared,
      confirmApproximate: false,
      repair: false,
    });
    const writesBeforeDrift = fake.createRulesCalls;
    const defaultsBeforeDrift = fake.setDefaultBypassCalls;
    const berlinFolder = applied.managedFolders.BER;
    expect(berlinFolder).toBeDefined();
    fake.rules.set(berlinFolder!.folderId, [
      {
        ...(fake.rules.get(berlinFolder!.folderId)?.[0] as ControlDRule),
        comment: "manually changed",
      },
    ]);
    vi.mocked(loadRules).mockResolvedValue([
      { pattern: "*example.com", enabled: true, locationId: "warsaw" },
      { pattern: "*new-example.com", enabled: true, locationId: "warsaw" },
      { pattern: "*example.de", enabled: true, locationId: "berlin" },
    ]);
    const drifted = await prepareControlDSync(asClient(fake), applied);

    await expect(
      applyControlDSync({
        client: asClient(fake),
        config: applied,
        prepared: drifted,
        confirmApproximate: true,
        repair: false,
      }),
    ).rejects.toBeInstanceOf(ControlDConflictError);
    expect(fake.createRulesCalls).toBe(writesBeforeDrift);
    expect(fake.updateRulesCalls).toBe(0);
    expect(fake.deleteRuleCalls).toBe(0);
    expect(fake.setDefaultBypassCalls).toBe(defaultsBeforeDrift);
  });

  it("recovers its uniquely named resources after a partial first failure", async () => {
    const fake = new FakeClient();
    const initial = config();
    const prepared = await prepareControlDSync(asClient(fake), initial);
    fake.failNextCreateRules = true;

    await expect(
      applyControlDSync({
        client: asClient(fake),
        config: initial,
        prepared,
        confirmApproximate: false,
        repair: false,
      }),
    ).rejects.toThrow("simulated rule write failure");
    expect(fake.profiles).toHaveLength(1);
    expect(fake.devices).toHaveLength(1);
    expect(fake.groups).toHaveLength(1);

    const retryPrepared = await prepareControlDSync(asClient(fake), initial);
    const recovered = await applyControlDSync({
      client: asClient(fake),
      config: initial,
      prepared: retryPrepared,
      confirmApproximate: false,
      repair: false,
    });

    expect(recovered).toMatchObject({
      profileId: "profile-1",
      endpointId: "device-1",
      status: "ready",
    });
    expect(fake.profiles).toHaveLength(1);
    expect(fake.devices).toHaveLength(1);
    expect(fake.groups).toHaveLength(1);
    expect(fake.createRulesCalls).toBe(1);
  });
});

it("moves hostnames between proxy folders without deleting the destination and remains idempotent", async () => {
  const fake = new FakeClient();
  fake.proxies = [proxy, berlinProxy];
  let current = config();
  current = await applyControlDSync({
    client: asClient(fake),
    config: current,
    prepared: await prepareControlDSync(asClient(fake), current),
    confirmApproximate: false,
    repair: false,
  });
  const locations = await loadLocations();
  vi.mocked(loadLocations).mockResolvedValue(
    locations.map((location) => ({ ...location, countryCode: "DE" })),
  );
  current = { ...current, locationMappings: {} };
  const preview = await prepareControlDSync(asClient(fake), current);
  expect(preview.diff.updateRules).toBe(1);
  expect(preview.diff.deleteRules).toBe(0);
  current = await applyControlDSync({
    client: asClient(fake),
    config: current,
    prepared: preview,
    confirmApproximate: false,
    repair: false,
  });
  const destination = current.managedFolders.BER!.folderId;
  expect(fake.rules.get(destination)).toMatchObject([
    { hostname: "*example.com", via: "BER" },
  ]);
  expect(fake.rules.get(current.managedFolders.WAW!.folderId)).toEqual([]);
  const next = await prepareControlDSync(asClient(fake), current);
  expect(next.diff).toMatchObject({
    addRules: 0,
    updateRules: 0,
    deleteRules: 0,
    unchangedRules: 1,
  });
  await applyControlDSync({
    client: asClient(fake),
    config: current,
    prepared: next,
    confirmApproximate: false,
    repair: false,
  });
  expect(fake.deleteRuleCalls).toBe(0);
});
it("rejects remote changes after preview before any write, including repair", async () => {
  const fake = new FakeClient();
  const current = config();
  const prepared = await prepareControlDSync(asClient(fake), current);
  fake.profiles.push({ id: "new-other", name: "Changed" });
  await expect(
    applyControlDSync({
      client: asClient(fake),
      config: current,
      prepared,
      confirmApproximate: true,
      repair: true,
    }),
  ).rejects.toThrow("Remote setup changed");
  expect(fake.setDefaultBypassCalls).toBe(0);
  expect(fake.createRulesCalls).toBe(0);
});
it("does not approve a newly approximate mapping during unattended sync", async () => {
  const fake = new FakeClient();
  vi.mocked(loadLocations).mockResolvedValue(
    (await loadLocations()).map((location) => ({ ...location, countryCode: "DE" })),
  );
  const current = config();
  const prepared = await prepareControlDSync(asClient(fake), current);
  expect(prepared.diff.requiresApproximationConfirmation).toBe(true);
  await expect(
    applyControlDSync({
      client: asClient(fake),
      config: current,
      prepared,
      confirmApproximate: false,
      repair: false,
    }),
  ).rejects.toThrow("Confirm every approximate");
  expect(fake.profiles).toEqual([]);
});

it.each(["skipped", "approximate"] as const)(
  "retains a saved %s mapping while its rules are disabled and reuses it on re-enable",
  async (status) => {
    const fake = new FakeClient();
    fake.proxies = [proxy, berlinProxy];
    const stored = {
      locationId: "warsaw",
      proxyPk: status === "skipped" ? null : "BER",
      status,
      confirmed: true,
    };
    const initial = { ...config(), locationMappings: { warsaw: stored } };
    const rules = await loadRules();
    vi.mocked(loadRules).mockResolvedValue(
      rules.map((rule) => ({ ...rule, enabled: false })),
    );
    const disabled = await prepareControlDSync(asClient(fake), initial);
    expect(disabled.compilation.mappings).toEqual({});
    const applied = await applyControlDSync({
      client: asClient(fake),
      config: initial,
      prepared: disabled,
      confirmApproximate: false,
      repair: false,
    });
    expect(applied.locationMappings.warsaw).toEqual(stored);
    vi.mocked(loadRules).mockResolvedValue(rules);
    const reenabled = await prepareControlDSync(asClient(fake), applied);
    expect(reenabled.compilation.mappings.warsaw).toMatchObject(stored);
    expect(reenabled.compilation.rules).toHaveLength(status === "skipped" ? 0 : 1);
    expect(reenabled.diff.requiresApproximationConfirmation).toBe(false);
    const resynced = await applyControlDSync({
      client: asClient(fake),
      config: applied,
      prepared: reenabled,
      confirmApproximate: false,
      repair: false,
    });
    expect(resynced.locationMappings.warsaw).toMatchObject(stored);
    expect([...fake.rules.values()].flat()).toMatchObject(
      status === "skipped" ? [] : [{ via: "BER", hostname: "*example.com" }],
    );
  },
);
