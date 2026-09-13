import type { ControlDClient, ControlDRule } from "./client";
import type {
  ControlDConfig,
  ControlDManagedFolder,
  ControlDRecoveryCandidate,
} from "./contracts";
import { hashControlDValue } from "./reconcile";
import {
  isControlDEndpointName,
  isControlDFolderName,
  parseControlDProfileCode,
} from "./resource-names";

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

export const discoverRecoverySets = async (
  client: ControlDClient,
): Promise<ControlDRecoveryCandidate[]> => {
  const [profiles, devices] = await Promise.all([
    client.listProfiles(),
    client.listDevices(),
  ]);
  const recognizedProfiles = profiles.flatMap((profile) => {
    const code = parseControlDProfileCode(profile.name);
    return code ? [{ profile, code }] : [];
  });
  const candidates = await Promise.all(
    recognizedProfiles.map(async ({ profile, code }) => {
      const groups = await client.listGroups(profile.id);
      const namedGroups = groups.filter((group) =>
        group.name.startsWith(`PT ${code} `),
      );
      const managedGroups = groups.filter(
        (group) =>
          group.via !== null && isControlDFolderName(group.name, code, group.via),
      );
      const namedEndpoints = devices.filter((device) =>
        isControlDEndpointName(device.name, code),
      );
      const endpoints = namedEndpoints.filter(
        (device) => device.profileId === profile.id,
      );
      const routes = new Set<string>();
      let duplicateRoute = false;
      for (const group of managedGroups) {
        const route = group.via ?? "";
        if (routes.has(route)) duplicateRoute = true;
        routes.add(route);
      }
      const invalidGroup = namedGroups.some(
        (group) =>
          !group.via ||
          !isControlDFolderName(group.name, code, group.via) ||
          (group.action !== null && group.action !== 3),
      );
      const ambiguous =
        endpoints.length > 1 ||
        duplicateRoute ||
        invalidGroup ||
        namedEndpoints.length !== endpoints.length ||
        recognizedProfiles.filter((item) => item.code === code).length > 1;
      let compatibility: ControlDRecoveryCandidate["compatibility"] = "ready";
      if (ambiguous) compatibility = "ambiguous";
      else if (endpoints.length === 0) compatibility = "profile-only";
      return {
        code,
        profileId: profile.id,
        profileName: profile.name,
        endpointId: endpoints.length === 1 ? (endpoints[0]?.id ?? null) : null,
        endpointName: endpoints.length === 1 ? (endpoints[0]?.name ?? null) : null,
        managedFolderCount: managedGroups.length,
        compatibility,
        issue: ambiguous
          ? "This setup has duplicate managed endpoints or route folders."
          : null,
      };
    }),
  );
  return candidates.sort((left, right) =>
    left.profileName.localeCompare(right.profileName),
  );
};

export const adoptRecoverySet = async ({
  client,
  config,
  profileId,
  endpointId,
  code,
}: {
  client: ControlDClient;
  config: ControlDConfig;
  profileId: string;
  endpointId: string | null;
  code: string;
}): Promise<ControlDConfig> => {
  const candidates = await discoverRecoverySets(client);
  const candidate = candidates.find(
    (item) =>
      item.profileId === profileId &&
      item.endpointId === endpointId &&
      item.code === code,
  );
  if (!candidate || candidate.compatibility === "ambiguous") {
    throw new Error("The selected Privacy Thing setup is no longer recoverable.");
  }
  const [groups, devices] = await Promise.all([
    client.listGroups(profileId),
    client.listDevices(),
  ]);
  const endpoint = endpointId
    ? devices.find(
        (device) =>
          device.id === endpointId &&
          device.profileId === profileId &&
          isControlDEndpointName(device.name, code),
      )
    : undefined;
  if (endpointId && !endpoint) {
    throw new Error("The selected Privacy Thing endpoint is no longer available.");
  }
  const managedFolders: Record<string, ControlDManagedFolder> = {};
  for (const group of groups) {
    if (!group.via || !isControlDFolderName(group.name, code, group.via)) continue;
    if (managedFolders[group.via]) {
      throw new Error("The selected setup has duplicate managed route folders.");
    }
    const rules = await client.listRules(profileId, group.id);
    managedFolders[group.via] = {
      proxyPk: group.via,
      folderId: group.id,
      remoteHash: await hashControlDValue(canonicalRules(rules)),
    };
  }
  return {
    ...config,
    resourceIdentity: { code },
    profileId,
    endpointId,
    resolverDoh: endpoint?.resolverDoh ?? null,
    dnsVerification: null,
    managedFolders,
    locationMappings: {},
    autoSyncEnabled: false,
    status: "ready",
    lastSyncedHash: null,
    lastAttemptAt: new Date().toISOString(),
    lastSuccessAt: null,
    lastError: null,
  };
};
