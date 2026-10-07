import { describe, expect, it } from "vitest";

import type {
  ControlDClient,
  ControlDDevice,
  ControlDGroup,
  ControlDRule,
} from "./client";
import type { ControlDConfig } from "./contracts";
import { adoptRecoverySet, discoverRecoverySets } from "./recovery";

const config = (): ControlDConfig => ({
  version: 2,
  enabled: true,
  connected: true,
  autoSyncEnabled: false,
  status: "ready",
  resourceIdentity: null,
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
  profiles = [
    { id: "managed", name: "Privacy Thing ABCDE-FGHJK" },
    { id: "legacy", name: "Privacy Thing 123e4567e89b12d3" },
    { id: "foreign", name: "Personal profile" },
  ];
  devices: ControlDDevice[] = [
    {
      id: "endpoint",
      name: "PT Browser ABCDE-FGHJK",
      profileId: "managed",
      resolverDoh: "https://dns.controld.com/secret",
    },
  ];
  groups: ControlDGroup[] = [
    {
      id: 7,
      name: "PT ABCDE-FGHJK WAW",
      action: 3,
      via: "WAW",
    },
  ];
  rules: ControlDRule[] = [
    {
      hostname: "example.com",
      groupId: 7,
      action: 3,
      via: "WAW",
      status: 1,
      comment: "PT ABCDE-FGHJK",
    },
  ];
  writes = 0;

  async listProfiles() {
    return this.profiles;
  }
  async listDevices() {
    return this.devices;
  }
  async listGroups(profileId: string) {
    return profileId === "managed" ? this.groups : [];
  }
  async listRules() {
    return this.rules;
  }
  async createProfile() {
    this.writes += 1;
  }
  async createDevice() {
    this.writes += 1;
    return null;
  }
  async createGroup() {
    this.writes += 1;
  }
  async createRules() {
    this.writes += 1;
  }
  async updateRules() {
    this.writes += 1;
  }
  async deleteRule() {
    this.writes += 1;
  }
}

const asClient = (client: FakeClient): ControlDClient =>
  client as unknown as ControlDClient;

describe("Control D recovery", () => {
  it("discovers only exact v2 Privacy Thing resources without writes", async () => {
    const client = new FakeClient();
    await expect(discoverRecoverySets(asClient(client))).resolves.toEqual([
      expect.objectContaining({
        code: "ABCDE-FGHJK",
        profileId: "managed",
        endpointId: "endpoint",
        compatibility: "ready",
      }),
    ]);
    expect(client.writes).toBe(0);
  });

  it("recovers a profile without an endpoint", async () => {
    const client = new FakeClient();
    client.devices = [];
    await expect(discoverRecoverySets(asClient(client))).resolves.toEqual([
      expect.objectContaining({ compatibility: "profile-only", endpointId: null }),
    ]);
  });

  it("marks duplicate managed endpoints as ambiguous", async () => {
    const client = new FakeClient();
    client.devices.push({ ...client.devices[0]!, id: "endpoint-2" });
    await expect(discoverRecoverySets(asClient(client))).resolves.toEqual([
      expect.objectContaining({ compatibility: "ambiguous", endpointId: null }),
    ]);
  });

  it("adopts explicitly and rebuilds ownership hashes without remote writes", async () => {
    const client = new FakeClient();
    const adopted = await adoptRecoverySet({
      client: asClient(client),
      config: config(),
      profileId: "managed",
      endpointId: "endpoint",
      code: "ABCDE-FGHJK",
    });
    expect(adopted).toMatchObject({
      resourceIdentity: { code: "ABCDE-FGHJK" },
      profileId: "managed",
      endpointId: "endpoint",
      resolverDoh: "https://dns.controld.com/secret",
      autoSyncEnabled: false,
      lastSyncedHash: null,
      managedFolders: { WAW: { proxyPk: "WAW", folderId: 7 } },
    });
    expect(client.writes).toBe(0);
  });
});
