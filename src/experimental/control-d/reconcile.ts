/* eslint-disable max-lines-per-function, max-params, sonarjs/cognitive-complexity -- Reconcile keeps remote ownership checks in one module. */
import type { ControlDClient } from "./client";
import { ControlDApiError, type ControlDRule } from "./client";
import { compileControlDState, type ControlDCompilation } from "./compiler";
import type {
  ControlDDiff,
  ControlDConfig,
  ControlDManagedFolder,
  ControlDProxyLocation,
} from "./contracts";
import {
  controlDEndpointName,
  controlDFolderName,
  controlDProfileName,
  controlDRuleComment,
} from "./resource-names";

import { loadLocations } from "@/background/storage/locations";
import { loadRules } from "@/background/storage/rules";

export class ControlDConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ControlDConflictError";
  }
}

export type ControlDPreparedSync = {
  compilation: ControlDCompilation;
  proxies: ControlDProxyLocation[];
  diff: ControlDDiff;
};

const profileName = controlDProfileName;
const endpointName = (instanceId: string): string =>
  controlDEndpointName(instanceId, __PT_BROWSER_TARGET__);
const folderName = controlDFolderName;
const ruleComment = controlDRuleComment;
const normalizedResourceName = (name: string): string =>
  name
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, "-")
    .replaceAll(/^-|-$/g, "");
const resourceNameMatches = (actual: string, expected: string): boolean =>
  actual === expected ||
  normalizedResourceName(actual) === normalizedResourceName(expected);

const canonicalRules = (rules: readonly ControlDRule[]): unknown[] =>
  [...rules]
    .sort((left, right) => left.hostname.localeCompare(right.hostname))
    .map((rule) => ({
      hostname: rule.hostname,
      groupId: rule.groupId,
      action: rule.action,
      via: rule.via,
      status: rule.status,
      comment: rule.comment,
    }));

export const hashControlDValue = async (value: unknown): Promise<string> => {
  const encoded = new TextEncoder().encode(JSON.stringify(value));
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

const desiredByProxy = (compilation: ControlDCompilation): Map<string, string[]> => {
  const result = new Map<string, string[]>();
  for (const rule of compilation.rules) {
    const current = result.get(rule.proxyPk) ?? [];
    current.push(rule.hostname);
    result.set(rule.proxyPk, current);
  }
  for (const hostnames of result.values()) hostnames.sort();
  return result;
};

const compareFolderRules = (
  remoteRules: readonly ControlDRule[],
  desiredHostnames: readonly string[],
  folderId: number,
  proxyPk: string,
  expectedComment: string,
): Pick<
  ControlDDiff,
  "addRules" | "updateRules" | "deleteRules" | "unchangedRules"
> => {
  const desired = new Set(desiredHostnames);
  const remote = new Map(remoteRules.map((rule) => [rule.hostname, rule]));
  let addRules = 0;
  let updateRules = 0;
  let unchangedRules = 0;

  for (const hostname of desired) {
    const rule = remote.get(hostname);
    if (!rule) {
      addRules += 1;
      continue;
    }
    if (
      (rule.groupId === null || rule.groupId === folderId) &&
      (rule.action === null || rule.action === 3) &&
      (rule.via === null || rule.via === proxyPk) &&
      (rule.status === null || rule.status === 1) &&
      (rule.comment === null || rule.comment === expectedComment)
    ) {
      unchangedRules += 1;
    } else {
      updateRules += 1;
    }
  }

  return {
    addRules,
    updateRules,
    deleteRules: remoteRules.filter((rule) => !desired.has(rule.hostname)).length,
    unchangedRules,
  };
};

const emptyCounts = () => ({
  addRules: 0,
  updateRules: 0,
  deleteRules: 0,
  unchangedRules: 0,
});

export const prepareControlDSync = async (
  client: ControlDClient,
  config: ControlDConfig,
): Promise<ControlDPreparedSync> => {
  const [rules, locations, proxies, profiles] = await Promise.all([
    loadRules(),
    loadLocations(),
    client.listProxies(),
    client.listProfiles(),
  ]);
  if (proxies.length === 0) {
    throw new Error("Control D returned no usable proxy locations.");
  }

  const compilation = compileControlDState({
    rules,
    locations,
    proxies,
    storedMappings: config.locationMappings,
  });
  const desired = desiredByProxy(compilation);
  const counts = emptyCounts();
  let createFolders = desired.size;
  const knownProfile = config.profileId
    ? profiles.find((profile) => profile.id === config.profileId)
    : undefined;

  if (config.profileId && !knownProfile) {
    throw new ControlDConflictError("The managed Control D profile is missing.");
  }
  if (knownProfile) {
    const groups = await client.listGroups(knownProfile.id);
    createFolders = 0;
    for (const [proxyPk, hostnames] of desired) {
      const managed = config.managedFolders[proxyPk];
      const group = managed
        ? groups.find((candidate) => candidate.id === managed.folderId)
        : undefined;
      if (!group) {
        if (managed) {
          throw new ControlDConflictError(
            `Managed folder ${managed.folderId} is missing.`,
          );
        }
        createFolders += 1;
        counts.addRules += hostnames.length;
        continue;
      }
      if (
        (group.action !== null && group.action !== 3) ||
        (group.via !== null && group.via !== proxyPk)
      ) {
        throw new ControlDConflictError(`Managed folder ${group.id} was changed.`);
      }
      const remoteRules = await client.listRules(knownProfile.id, group.id);
      const folderCounts = compareFolderRules(
        remoteRules,
        hostnames,
        group.id,
        proxyPk,
        ruleComment(config.instanceId),
      );
      counts.addRules += folderCounts.addRules;
      counts.updateRules += folderCounts.updateRules;
      counts.deleteRules += folderCounts.deleteRules;
      counts.unchangedRules += folderCounts.unchangedRules;
    }

    for (const [proxyPk, managed] of Object.entries(config.managedFolders)) {
      if (desired.has(proxyPk)) continue;
      const group = groups.find((candidate) => candidate.id === managed.folderId);
      if (!group) {
        throw new ControlDConflictError(
          `Managed folder ${managed.folderId} is missing.`,
        );
      }
      counts.deleteRules += (await client.listRules(knownProfile.id, group.id)).length;
    }
  } else {
    counts.addRules = compilation.rules.length;
  }

  const devices = knownProfile ? await client.listDevices() : [];
  const knownEndpoint = config.endpointId
    ? devices.find((device) => device.id === config.endpointId)
    : undefined;
  if (config.endpointId && !knownEndpoint) {
    throw new ControlDConflictError("The managed Control D endpoint is missing.");
  }
  if (knownEndpoint?.profileId && knownEndpoint.profileId !== knownProfile?.id) {
    throw new ControlDConflictError(
      "The managed Control D endpoint uses another profile.",
    );
  }

  return {
    compilation,
    proxies,
    diff: {
      createProfile: !knownProfile,
      createEndpoint: !knownEndpoint,
      createFolders,
      ...counts,
      warnings: compilation.warnings,
      mappings: Object.values(compilation.mappings),
      requiresApproximationConfirmation: Object.values(compilation.mappings).some(
        (mapping) => mapping.status === "approximate" && !mapping.confirmed,
      ),
    },
  };
};

const requireUniqueProfile = async (
  client: ControlDClient,
  name: string,
): Promise<string> => {
  const matches = (await client.listProfiles()).filter((profile) =>
    resourceNameMatches(profile.name, name),
  );
  if (matches.length !== 1 || !matches[0]) {
    throw new Error("Could not uniquely identify the managed Control D profile.");
  }
  return matches[0].id;
};

const ensureProfile = async (
  client: ControlDClient,
  config: ControlDConfig,
): Promise<string> => {
  const name = profileName(config.instanceId);
  const profiles = await client.listProfiles();
  if (config.profileId) {
    const managed = profiles.find((profile) => profile.id === config.profileId);
    if (!managed) throw new ControlDConflictError("The managed profile is missing.");
    return managed.id;
  }
  const existing = profiles.filter((profile) =>
    resourceNameMatches(profile.name, name),
  );
  if (existing.length > 1) {
    throw new ControlDConflictError("More than one managed profile has the same name.");
  }
  if (existing[0]) return existing[0].id;
  await client.createProfile(name);
  return requireUniqueProfile(client, name);
};

const ensureEndpoint = async (
  client: ControlDClient,
  config: ControlDConfig,
  profileId: string,
): Promise<{ id: string; resolverDoh: string | null }> => {
  if (config.endpointId) {
    const existing = (await client.listDevices()).find(
      (device) => device.id === config.endpointId,
    );
    if (!existing) throw new ControlDConflictError("The managed endpoint is missing.");
    if (existing.profileId && existing.profileId !== profileId) {
      throw new ControlDConflictError("The managed endpoint uses another profile.");
    }
    return { id: existing.id, resolverDoh: existing.resolverDoh };
  }

  const name = endpointName(config.instanceId);
  const existing = (await client.listDevices()).filter((device) =>
    resourceNameMatches(device.name, name),
  );
  if (existing.length > 1) {
    throw new ControlDConflictError(
      "More than one managed endpoint has the same name.",
    );
  }
  if (existing[0]) {
    if (existing[0].profileId && existing[0].profileId !== profileId) {
      throw new ControlDConflictError("The recoverable endpoint uses another profile.");
    }
    return { id: existing[0].id, resolverDoh: existing[0].resolverDoh };
  }

  const types = await client.listDeviceTypes();
  const preferredTypes =
    __PT_BROWSER_TARGET__ === "firefox"
      ? ["browser-firefox", "browser-other"]
      : ["browser-other", "browser-chrome", "browser-edge", "browser-brave"];
  const icon =
    preferredTypes.find((candidate) => types.includes(candidate)) ??
    types.find((type) => type.startsWith("browser-"));
  if (!icon) throw new Error("Control D returned no supported browser endpoint type.");
  const created = await client.createDevice(name, profileId, icon);
  if (created) return { id: created.id, resolverDoh: created.resolverDoh };
  const recovered = (await client.listDevices()).filter((device) =>
    resourceNameMatches(device.name, name),
  );
  if (recovered.length !== 1 || !recovered[0]) {
    throw new Error("Could not identify the newly created Control D endpoint.");
  }
  return { id: recovered[0].id, resolverDoh: recovered[0].resolverDoh };
};

const assertNoDrift = async (
  remoteRules: readonly ControlDRule[],
  managed: ControlDManagedFolder | undefined,
  repair: boolean,
): Promise<void> => {
  if (!managed?.remoteHash || repair) return;
  const remoteHash = await hashControlDValue(canonicalRules(remoteRules));
  if (remoteHash !== managed.remoteHash) {
    throw new ControlDConflictError(
      "Managed Control D rules changed remotely. Review the diff and use repair explicitly.",
    );
  }
};

export const applyControlDSync = async ({
  client,
  config,
  prepared,
  confirmApproximate,
  repair,
}: {
  client: ControlDClient;
  config: ControlDConfig;
  prepared: ControlDPreparedSync;
  confirmApproximate: boolean;
  repair: boolean;
}): Promise<ControlDConfig> => {
  if (prepared.diff.requiresApproximationConfirmation && !confirmApproximate) {
    throw new Error("Confirm every approximate location mapping before applying.");
  }

  const confirmedMappings = Object.fromEntries(
    Object.values(prepared.compilation.mappings).map((mapping) => [
      mapping.locationId,
      mapping.status === "approximate" && confirmApproximate
        ? { ...mapping, confirmed: true }
        : mapping,
    ]),
  );
  const nextConfig: ControlDConfig = {
    ...config,
    locationMappings: confirmedMappings,
  };
  const profileId = await ensureProfile(client, nextConfig);
  const desired = desiredByProxy(prepared.compilation);
  const groups = await client.listGroups(profileId);
  const preflightRules = new Map<number, ControlDRule[]>();
  for (const [proxyPk, managed] of Object.entries(nextConfig.managedFolders)) {
    const group = groups.find((candidate) => candidate.id === managed.folderId);
    if (!group) {
      throw new ControlDConflictError(`Managed folder ${managed.folderId} is missing.`);
    }
    if (
      (group.action !== null && group.action !== 3) ||
      (group.via !== null && group.via !== proxyPk)
    ) {
      throw new ControlDConflictError(`Managed folder ${group.id} was changed.`);
    }
    const remoteRules = await client.listRules(profileId, group.id);
    await assertNoDrift(remoteRules, managed, repair);
    if (
      remoteRules.some((rule) => rule.groupId !== null && rule.groupId !== group.id)
    ) {
      throw new ControlDConflictError(
        `Folder ${group.id} returned rules owned elsewhere.`,
      );
    }
    preflightRules.set(group.id, remoteRules);
  }

  await client.setDefaultBypass(profileId);
  const endpoint = await ensureEndpoint(client, nextConfig, profileId);
  const managedFolders: Record<string, ControlDManagedFolder> = {
    ...nextConfig.managedFolders,
  };

  for (const [proxyPk, hostnames] of desired) {
    const known = managedFolders[proxyPk];
    let group = known
      ? groups.find((candidate) => candidate.id === known.folderId)
      : undefined;
    if (!group) {
      if (known) {
        throw new ControlDConflictError(`Managed folder ${known.folderId} is missing.`);
      }
      const name = folderName(nextConfig.instanceId, proxyPk);
      const matches = groups.filter((candidate) =>
        resourceNameMatches(candidate.name, name),
      );
      if (matches.length > 1) {
        throw new ControlDConflictError(
          `More than one managed folder exists for ${proxyPk}.`,
        );
      }
      group = matches[0];
      if (!group) {
        await client.createGroup(profileId, name, proxyPk);
        const refreshed = (await client.listGroups(profileId)).filter((candidate) =>
          resourceNameMatches(candidate.name, name),
        );
        if (refreshed.length !== 1 || !refreshed[0]) {
          throw new Error(`Could not identify the managed folder for ${proxyPk}.`);
        }
        group = refreshed[0];
      }
    }
    if (
      (group.action !== null && group.action !== 3) ||
      (group.via !== null && group.via !== proxyPk)
    ) {
      throw new ControlDConflictError(`Managed folder ${group.id} was changed.`);
    }

    const remoteRules =
      preflightRules.get(group.id) ?? (await client.listRules(profileId, group.id));
    if (
      remoteRules.some((rule) => rule.groupId !== null && rule.groupId !== group.id)
    ) {
      throw new ControlDConflictError(
        `Folder ${group.id} returned rules owned elsewhere.`,
      );
    }

    const desiredSet = new Set(hostnames);
    const existingSet = new Set(remoteRules.map((rule) => rule.hostname));
    const toDelete = remoteRules
      .filter((rule) => !desiredSet.has(rule.hostname))
      .map((rule) => rule.hostname);
    const toCreate = hostnames.filter((hostname) => !existingSet.has(hostname));
    const toUpdate = remoteRules
      .filter(
        (rule) =>
          desiredSet.has(rule.hostname) &&
          ((rule.action !== null && rule.action !== 3) ||
            (rule.via !== null && rule.via !== proxyPk) ||
            (rule.status !== null && rule.status !== 1) ||
            (rule.comment !== null &&
              rule.comment !== ruleComment(nextConfig.instanceId))),
      )
      .map((rule) => rule.hostname);

    for (const hostname of toDelete) await client.deleteRule(profileId, hostname);
    await client.createRules(
      profileId,
      group.id,
      proxyPk,
      toCreate,
      ruleComment(nextConfig.instanceId),
    );
    await client.updateRules(
      profileId,
      group.id,
      proxyPk,
      toUpdate,
      ruleComment(nextConfig.instanceId),
    );

    const finalRules = await client.listRules(profileId, group.id);
    managedFolders[proxyPk] = {
      proxyPk,
      folderId: group.id,
      remoteHash: await hashControlDValue(canonicalRules(finalRules)),
    };
  }

  for (const [proxyPk, managed] of Object.entries(managedFolders)) {
    if (desired.has(proxyPk)) continue;
    const remoteRules = preflightRules.get(managed.folderId) ?? [];
    for (const rule of remoteRules) await client.deleteRule(profileId, rule.hostname);
    managedFolders[proxyPk] = {
      ...managed,
      remoteHash: await hashControlDValue([]),
    };
  }

  return {
    ...nextConfig,
    connected: true,
    autoSyncEnabled: true,
    status: "ready",
    profileId,
    endpointId: endpoint.id,
    resolverDoh: endpoint.resolverDoh ?? nextConfig.resolverDoh,
    managedFolders,
    lastSyncedHash: await hashControlDValue(prepared.compilation.rules),
    lastAttemptAt: new Date().toISOString(),
    lastSuccessAt: new Date().toISOString(),
    lastError: null,
  };
};

export const isControlDAuthError = (error: unknown): boolean =>
  error instanceof ControlDApiError && (error.status === 401 || error.status === 403);
