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
  hashControlDInputs,
  prepareControlDSync,
} from "./reconcile";
import { planServiceOps, servicePlanError } from "./service-reconcile";
import type { ControlDProfileService } from "./services";
import { saveControlDConfig } from "./storage";

import { loadLocations } from "@/background/storage/locations";
import { loadFeatureBindings } from "@/background/storage/provider-features";
import { loadRules } from "@/background/storage/rules";
import type { RuleFeatureBinding } from "@/shared/provider-feature";
import type { DomainRule, Location } from "@/shared/types";

vi.mock("./storage", () => ({ saveControlDConfig: vi.fn() }));

vi.mock("@/background/storage/locations", () => ({ loadLocations: vi.fn() }));
vi.mock("@/background/storage/provider-features", () => ({
  loadFeatureBindings: vi.fn(async () => []),
}));
vi.mock("@/background/storage/rules", () => ({ loadRules: vi.fn() }));

const warsaw: Location = {
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
};

const berlin: Location = {
  ...warsaw,
  id: "berlin",
  label: "Berlin",
  latitude: 52.52,
  longitude: 13.4,
  countryCode: "DE",
  language: "de",
  languages: ["de"],
  timeZone: "Europe/Berlin",
};

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

const binding = (
  rulePattern: string,
  featureId: string,
  featureName = featureId,
): RuleFeatureBinding => ({
  rulePattern,
  providerId: "control-d",
  featureId,
  featureName,
  featureType: "service",
});

const domainRule = (
  pattern: string,
  locationId = warsaw.id,
  enabled = true,
): DomainRule => ({
  pattern,
  enabled,
  locationId,
});

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
  services: ControlDProfileService[] = [];
  proxies = [proxy, berlinProxy];
  serviceReads = 0;
  setCalls: Array<{ profileId: string; serviceId: string; proxyPk: string }> = [];
  deleteCalls: Array<{ profileId: string; serviceId: string }> = [];
  setDefaultBypassCalls = 0;

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

  async createDevice(name: string, profileId: string) {
    const device = {
      id: "device-1",
      name,
      profileId,
      resolverDoh: "https://dns.controld.com/secret",
    };
    this.devices.push(device);
    return device;
  }

  async listProfileServices() {
    this.serviceReads += 1;
    return this.services.map((service) => ({ ...service }));
  }

  async redirectProfileService(profileId: string, serviceId: string, proxyPk: string) {
    this.setCalls.push({ profileId, serviceId, proxyPk });
    const next = {
      pk: serviceId,
      name: serviceId,
      category: "video",
      action: 3,
      status: 1 as const,
      via: proxyPk,
      viaV6: null,
    };
    const index = this.services.findIndex((service) => service.pk === serviceId);
    const current = index === -1 ? undefined : this.services[index];
    if (!current) this.services.push(next);
    else this.services[index] = { ...current, ...next };
  }

  async deleteProfileService(profileId: string, serviceId: string) {
    this.deleteCalls.push({ profileId, serviceId });
    this.services = this.services.filter((service) => service.pk !== serviceId);
  }
}

const asClient = (client: FakeClient): ControlDClient =>
  client as unknown as ControlDClient;

const sync = async (fake: FakeClient, current: ControlDConfig, repair = false) => {
  const prepared = await prepareControlDSync(asClient(fake), current);
  const applied = await applyControlDSync({
    client: asClient(fake),
    config: current,
    prepared,
    confirmApproximate: false,
    repair,
  });
  return { prepared, applied };
};

beforeEach(() => {
  vi.mocked(saveControlDConfig).mockReset().mockResolvedValue(undefined);
  vi.mocked(loadLocations).mockResolvedValue([warsaw, berlin]);
  vi.mocked(loadRules).mockResolvedValue([domainRule("*example.com")]);
  vi.mocked(loadFeatureBindings).mockResolvedValue([]);
});

describe("Control D native service reconcile", () => {
  it("does not read profile services when nothing is owned or bound", async () => {
    const fake = new FakeClient();
    fake.profiles.push({ id: "profile-1", name: "Privacy Thing" });
    const current = { ...config(), profileId: "profile-1" };

    await prepareControlDSync(asClient(fake), current);

    expect(fake.serviceReads).toBe(0);
  });

  it("adds a manual service selection and leaves it unchanged on the next sync", async () => {
    const fake = new FakeClient();
    fake.services.push({
      pk: "zoom",
      name: "Zoom",
      category: "tools",
      action: 2,
      status: 1,
      via: "192.0.2.10",
      viaV6: null,
    });
    vi.mocked(loadFeatureBindings).mockResolvedValue([
      binding("*example.com", "manual-hulu", "Hulu"),
    ]);

    const first = await sync(fake, config());

    expect(first.prepared.diff).toMatchObject({
      addServices: 1,
      updateServices: 0,
      deleteServices: 0,
      unchangedServices: 0,
    });
    expect(first.prepared.compilation.services).toEqual([
      expect.objectContaining({ servicePk: "manual-hulu", proxyPk: "WAW" }),
    ]);
    expect(fake.setCalls).toEqual([
      { profileId: "profile-1", serviceId: "manual-hulu", proxyPk: "WAW" },
    ]);
    expect(first.applied.managedServices?.["manual-hulu"]).toEqual({
      rulePattern: "*example.com",
      proxyPk: "WAW",
      action: { do: 3, status: 1, via: "WAW", viaV6: null },
    });
    expect(fake.services).toContainEqual(
      expect.objectContaining({ pk: "zoom", action: 2, via: "192.0.2.10" }),
    );

    const second = await sync(fake, first.applied);
    expect(second.prepared.diff).toMatchObject({
      addServices: 0,
      updateServices: 0,
      deleteServices: 0,
      unchangedServices: 1,
    });
    expect(fake.setCalls).toHaveLength(1);
    expect(fake.deleteCalls).toEqual([]);
    expect(fake.services.map((service) => service.pk).sort()).toEqual([
      "manual-hulu",
      "zoom",
    ]);
  });

  it.each([false, true])(
    "preserves ownership after a partial write (failed write accepted remotely: %s)",
    async (accepted) => {
      const fake = new FakeClient();
      vi.mocked(loadRules).mockResolvedValue([
        domainRule("*example.com"),
        domainRule("other.example.com"),
      ]);
      vi.mocked(loadFeatureBindings).mockResolvedValue([
        binding("*example.com", "service-a"),
        binding("other.example.com", "service-b"),
      ]);
      const redirect = fake.redirectProfileService.bind(fake);
      vi.spyOn(fake, "redirectProfileService").mockImplementation(
        async (profileId, serviceId, proxyPk) => {
          expect(saveControlDConfig).toHaveBeenCalledOnce();
          if (serviceId === "service-b") {
            if (accepted) await redirect(profileId, serviceId, proxyPk);
            throw new Error("Service write timed out");
          }
          await redirect(profileId, serviceId, proxyPk);
        },
      );
      const initial = config();
      await expect(sync(fake, initial)).rejects.toThrow("Service write timed out");
      const journal = vi.mocked(saveControlDConfig).mock.calls[0]?.[0];
      expect(journal).toMatchObject({
        status: "syncing",
        profileId: "profile-1",
        endpointId: "device-1",
        managedFolders: { WAW: expect.any(Object) },
        managedServices: {
          "service-a": { rulePattern: "*example.com", proxyPk: "WAW" },
          "service-b": { rulePattern: "other.example.com", proxyPk: "WAW" },
        },
        lastSyncedHash: initial.lastSyncedHash,
        lastSuccessAt: initial.lastSuccessAt,
      });
      if (!journal) throw new Error("Missing ownership journal");
      vi.mocked(fake.redirectProfileService).mockImplementation(redirect);
      const recovered = await sync(fake, journal, true);
      expect(recovered.prepared.diff.unchangedServices).toBe(accepted ? 2 : 1);
      expect(recovered.applied.managedServices).toEqual(journal.managedServices);
      expect(
        fake.setCalls.filter((call) => call.serviceId === "service-a"),
      ).toHaveLength(1);
    },
  );

  it("does not write native services when ownership cannot be persisted", async () => {
    const fake = new FakeClient();
    vi.mocked(loadFeatureBindings).mockResolvedValue([
      binding("*example.com", "service-a"),
    ]);
    vi.mocked(saveControlDConfig).mockRejectedValueOnce(
      new Error("Storage unavailable"),
    );
    await expect(sync(fake, config())).rejects.toThrow("Storage unavailable");
    expect(fake.setCalls).toEqual([]);
    expect(fake.deleteCalls).toEqual([]);
  });

  it.each([
    [
      "disabled",
      [domainRule("*example.com", warsaw.id, false)],
      [binding("*example.com", "manual-hulu", "Hulu")],
    ],
    ["detached", [domainRule("*example.com")], []],
    ["deleted", [], [binding("*example.com", "manual-hulu", "Hulu")]],
  ] as const)(
    "removes an owned service when the source is %s and the remote action is unchanged",
    async (_label, rules, bindings) => {
      const fake = new FakeClient();
      vi.mocked(loadFeatureBindings).mockResolvedValue([
        binding("*example.com", "manual-hulu", "Hulu"),
      ]);
      const applied = (await sync(fake, config())).applied;
      vi.mocked(loadRules).mockResolvedValue([...rules]);
      vi.mocked(loadFeatureBindings).mockResolvedValue([...bindings]);

      const removed = await sync(fake, applied);

      expect(removed.prepared.diff.deleteServices).toBe(1);
      expect(fake.deleteCalls).toEqual([
        { profileId: "profile-1", serviceId: "manual-hulu" },
      ]);
      expect(removed.applied.managedServices).toEqual({});
      expect(fake.services).toEqual([]);
    },
  );

  it("updates the route when the source location changes", async () => {
    const fake = new FakeClient();
    vi.mocked(loadFeatureBindings).mockResolvedValue([
      binding("*example.com", "netflix", "Netflix"),
    ]);
    const applied = (await sync(fake, config())).applied;
    vi.mocked(loadLocations).mockResolvedValue([
      { ...warsaw, countryCode: "DE" },
      berlin,
    ]);

    const moved = await sync(fake, { ...applied, locationMappings: {} });

    expect(moved.prepared.diff).toMatchObject({ updateServices: 1, deleteServices: 0 });
    expect(fake.setCalls.at(-1)).toEqual({
      profileId: "profile-1",
      serviceId: "netflix",
      proxyPk: "BER",
    });
    expect(moved.applied.managedServices?.netflix?.action).toEqual({
      do: 3,
      status: 1,
      via: "BER",
      viaV6: null,
    });
  });

  it("refuses to adopt an existing service, including during repair", async () => {
    const fake = new FakeClient();
    fake.profiles.push({ id: "profile-1", name: "Privacy Thing" });
    fake.services.push(
      {
        pk: "netflix",
        name: "Netflix",
        category: "video",
        action: 3,
        status: 1,
        via: "WAW",
        viaV6: null,
      },
      {
        pk: "zoom",
        name: "Zoom",
        category: "tools",
        action: 1,
        status: 0,
        via: null,
        viaV6: null,
      },
    );
    vi.mocked(loadFeatureBindings).mockResolvedValue([
      binding("*example.com", "netflix", "Netflix"),
    ]);
    const current = { ...config(), profileId: "profile-1" };

    await expect(prepareControlDSync(asClient(fake), current)).rejects.toThrow(
      /not managed by Privacy Thing/,
    );
    expect(fake.setCalls).toEqual([]);
    expect(fake.deleteCalls).toEqual([]);

    const plan = planServiceOps(
      [
        {
          servicePk: "netflix",
          featureName: "Netflix",
          rulePattern: "*example.com",
          locationId: "warsaw",
          proxyPk: "WAW",
          action: { do: 3, status: 1, via: "WAW", viaV6: null },
        },
      ],
      fake.services,
      {},
      true,
    );
    expect(servicePlanError(plan, true)).toMatch(/not managed by Privacy Thing/);
    expect(plan.unchanged).toBe(0);
    expect(plan.add).toEqual([]);
  });

  it("conflicts when an owned service changes remotely and repair restores only that service", async () => {
    const fake = new FakeClient();
    fake.services.push({
      pk: "zoom",
      name: "Zoom",
      category: "tools",
      action: 2,
      status: 1,
      via: "192.0.2.10",
      viaV6: "2001:db8::1",
    });
    vi.mocked(loadFeatureBindings).mockResolvedValue([
      binding("*example.com", "netflix", "Netflix"),
    ]);
    const applied = (await sync(fake, config())).applied;
    const netflix = fake.services.find((service) => service.pk === "netflix");
    if (!netflix) throw new Error("missing owned service");
    netflix.action = 1;
    netflix.status = 0;
    netflix.via = null;
    const writes = fake.setCalls.length;
    const bypasses = fake.setDefaultBypassCalls;
    const drifted = await prepareControlDSync(asClient(fake), applied);

    expect(drifted.diff).toMatchObject({
      updateServices: 1,
      serviceErrors: [expect.objectContaining({ code: "remote-service-changed" })],
    });
    await expect(
      applyControlDSync({
        client: asClient(fake),
        config: applied,
        prepared: drifted,
        confirmApproximate: false,
        repair: false,
      }),
    ).rejects.toThrow(/changed remotely/);
    expect(fake.setCalls).toHaveLength(writes);
    expect(fake.setDefaultBypassCalls).toBe(bypasses);

    const repaired = await applyControlDSync({
      client: asClient(fake),
      config: applied,
      prepared: drifted,
      confirmApproximate: false,
      repair: true,
    });
    expect(fake.setCalls.at(-1)).toEqual({
      profileId: "profile-1",
      serviceId: "netflix",
      proxyPk: "WAW",
    });
    expect(repaired.managedServices?.netflix?.action.via).toBe("WAW");
    expect(fake.services).toContainEqual(
      expect.objectContaining({ pk: "zoom", via: "192.0.2.10", viaV6: "2001:db8::1" }),
    );
  });

  it("does not remove an owned service whose remote action changed", async () => {
    const fake = new FakeClient();
    vi.mocked(loadFeatureBindings).mockResolvedValue([
      binding("*example.com", "netflix", "Netflix"),
    ]);
    const applied = (await sync(fake, config())).applied;
    const netflix = fake.services.find((service) => service.pk === "netflix");
    if (!netflix) throw new Error("missing owned service");
    netflix.via = "BER";
    vi.mocked(loadFeatureBindings).mockResolvedValue([]);

    await expect(prepareControlDSync(asClient(fake), applied)).rejects.toThrow(
      /left in place/,
    );
    const plan = planServiceOps([], fake.services, applied.managedServices ?? {}, true);
    expect(servicePlanError(plan, true)).toMatch(/left in place/);
    expect(plan.remove).toEqual([]);
    expect(fake.deleteCalls).toEqual([]);
    expect(fake.services.map((service) => service.pk)).toEqual(["netflix"]);
  });

  it("invalidates a preview when bindings or the remote service config change", async () => {
    const fake = new FakeClient();
    const initial = config();
    const rules = [domainRule("*example.com")];
    const locations = [warsaw, berlin];
    const withoutBindings = await hashControlDInputs(initial, rules, locations);
    expect(withoutBindings).toBe(
      await hashControlDInputs(initial, rules, locations, []),
    );
    const withBinding = await hashControlDInputs(initial, rules, locations, [
      binding("*example.com", "netflix", "Netflix"),
    ]);
    expect(withBinding).not.toBe(withoutBindings);
    const withAction = await hashControlDInputs(
      {
        ...initial,
        managedServices: {
          netflix: {
            rulePattern: "*example.com",
            proxyPk: "WAW",
            action: { do: 3, status: 1, via: "WAW", viaV6: null },
          },
        },
      },
      rules,
      locations,
      [binding("*example.com", "netflix", "Netflix")],
    );
    expect(withAction).not.toBe(withBinding);

    const prepared = await prepareControlDSync(asClient(fake), initial);
    vi.mocked(loadFeatureBindings).mockResolvedValue([
      binding("*example.com", "netflix", "Netflix"),
    ]);
    await expect(
      applyControlDSync({
        client: asClient(fake),
        config: initial,
        prepared,
        confirmApproximate: false,
        repair: false,
      }),
    ).rejects.toThrow(/Preview changed/);
    expect(fake.setCalls).toEqual([]);

    vi.mocked(loadFeatureBindings).mockResolvedValue([
      binding("*example.com", "netflix", "Netflix"),
    ]);
    const synced = await sync(fake, initial);
    const zoom = {
      pk: "zoom",
      name: "Zoom",
      category: "tools",
      action: 0,
      status: 1 as const,
      via: null,
      viaV6: null,
    };
    fake.services.push(zoom);
    const reviewed = await prepareControlDSync(asClient(fake), synced.applied);
    zoom.action = 2;
    await expect(
      applyControlDSync({
        client: asClient(fake),
        config: synced.applied,
        prepared: reviewed,
        confirmApproximate: false,
        repair: true,
      }),
    ).rejects.toThrow(/Remote setup changed/);
    expect(fake.setCalls).toHaveLength(1);
    expect(fake.services).toContainEqual(
      expect.objectContaining({ pk: "zoom", action: 2 }),
    );
  });
});
