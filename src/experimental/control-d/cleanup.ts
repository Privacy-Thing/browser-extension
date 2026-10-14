import {
  ControlDApiError,
  deviceProfileIds,
  type ControlDClient,
  type ControlDDevice,
  type ControlDGroup,
  type ControlDRule,
} from "./client";
import type {
  CleanupReason,
  CleanupResource,
  ControlDConfig,
  ControlDManagedFolder,
} from "./contracts";
import type { RecognitionState } from "./recognition-setup";
import {
  controlDRuleComment,
  isControlDEndpointName,
  isControlDFolderName,
  parseControlDProfileCode,
} from "./resource-names";
import { canonicalRules, hashControlDValue } from "./service-reconcile";
import type { ControlDProfileService } from "./services";

export type CleanupClient = Pick<
  ControlDClient,
  | "listProfiles"
  | "listDevices"
  | "listGroups"
  | "listCustomRules"
  | "listProfileServices"
  | "deleteGroup"
  | "deleteProfileService"
  | "deleteDevice"
  | "deleteProfile"
>;

export const isCleanupNotFound = (error: unknown): boolean =>
  error instanceof ControlDApiError && error.status === 404;

// A disappearing profile is safe to treat as absent, never as an empty owned profile.
const absentOn404 = async <T>(read: () => Promise<T[]>): Promise<T[]> => {
  try {
    return await read();
  } catch (error) {
    if (isCleanupNotFound(error)) return [];
    throw error;
  }
};

type ProfileScope = {
  id: string;
  code: string | null;
  name: string;
  endpointId: string | null;
  lookup: boolean;
};

type PlanContext = {
  client: CleanupClient;
  config: ControlDConfig;
  recognition: RecognitionState;
  devices: ControlDDevice[];
  resources: CleanupResource[];
};

const resource = (
  scope: ProfileScope,
  kind: CleanupResource["kind"],
  id: string,
  name: string,
): CleanupResource => ({
  key: `${scope.id}/${kind}/${id}`,
  kind,
  id,
  name,
  profileId: scope.id,
  disposition: "delete",
  reason: null,
  ruleHostnames: [],
  dependsOn: [],
});

const skip = (item: CleanupResource, reason: CleanupReason): CleanupResource => ({
  ...item,
  disposition: "skipped",
  reason,
});

const matchesService = (
  service: ControlDProfileService,
  scope: ProfileScope,
  context: PlanContext,
): boolean => {
  if (scope.lookup) {
    return (
      context.recognition.servicePks.includes(service.pk) &&
      service.action === 1 &&
      service.status === 1 &&
      (service.via === null || service.via === "-1") &&
      (service.viaV6 === null || service.viaV6 === "-1")
    );
  }
  const owned = context.config.managedServices?.[service.pk];
  return (
    owned !== undefined &&
    service.action === owned.action.do &&
    service.status === owned.action.status &&
    service.via === owned.action.via &&
    service.viaV6 === owned.action.viaV6
  );
};

const folderReason = async (input: {
  group: ControlDGroup | undefined;
  owned: ControlDManagedFolder | undefined;
  contents: ControlDRule[];
  code: string | null;
}): Promise<CleanupReason | null> => {
  const { group, owned, contents, code } = input;
  if (!owned) return "not-recorded";
  if (!group) return contents.length > 0 ? "content-changed" : "already-deleted";
  if (!code || !isControlDFolderName(group.name, code, owned.proxyPk))
    return "name-changed";
  if (group.action !== 3 || group.via !== owned.proxyPk || !owned.remoteHash)
    return "content-changed";
  if ((await hashControlDValue(canonicalRules(contents))) !== owned.remoteHash)
    return "content-changed";
  if (contents.some((rule) => rule.comment !== controlDRuleComment(code)))
    return "content-changed";
  return null;
};

const planServices = (
  scope: ProfileScope,
  context: PlanContext,
  services: ControlDProfileService[],
) => {
  const { config, resources } = context;
  const serviceIds = new Set([
    ...services.map((item) => item.pk),
    ...(scope.lookup
      ? context.recognition.servicePks
      : Object.keys(config.managedServices ?? {})),
  ]);
  for (const id of serviceIds) {
    const current = services.find((item) => item.pk === id);
    const recorded = scope.lookup
      ? context.recognition.servicePks.includes(id)
      : config.managedServices?.[id] !== undefined;
    const item = resource(scope, "service", id, current?.name ?? id);
    if (!recorded) resources.push(skip(item, "not-recorded"));
    else if (!current) resources.push({ ...item, reason: "already-deleted" });
    else
      resources.push(
        matchesService(current, scope, context) ? item : skip(item, "content-changed"),
      );
  }
};

const planContent = async (scope: ProfileScope, context: PlanContext) => {
  const { client, config, resources } = context;
  const [groups, rules, services] = await Promise.all([
    absentOn404(() => client.listGroups(scope.id)),
    absentOn404(() => client.listCustomRules(scope.id)),
    absentOn404(() => client.listProfileServices(scope.id)),
  ]);
  const managed = scope.lookup ? [] : Object.values(config.managedFolders);
  const groupIds = new Set([
    ...groups.map((group) => group.id),
    ...managed.map((item) => item.folderId),
  ]);
  for (const id of groupIds) {
    const group = groups.find((item) => item.id === id);
    const owned = managed.find((item) => item.folderId === id);
    const contents = rules.filter((rule) => rule.groupId === id);
    const item = resource(scope, "folder", String(id), group?.name ?? String(id));
    item.ruleHostnames = contents.map((rule) => rule.hostname).sort();
    const reason = await folderReason({ group, owned, contents, code: scope.code });
    resources.push(
      reason && reason !== "already-deleted" ? skip(item, reason) : { ...item, reason },
    );
  }
  // Root rules and rules in unrecognized folders must also block parent deletion.
  for (const rule of rules.filter(
    (item) => item.groupId === null || !groupIds.has(item.groupId),
  )) {
    resources.push(
      skip(resource(scope, "rule", rule.hostname, rule.hostname), "not-recorded"),
    );
  }
  planServices(scope, context, services);
};

const planEndpoint = (scope: ProfileScope, context: PlanContext) => {
  if (!scope.endpointId) return;
  const endpoint = context.devices.find((item) => item.id === scope.endpointId);
  const item = resource(
    scope,
    "endpoint",
    scope.endpointId,
    endpoint?.name ?? scope.endpointId,
  );
  if (!endpoint) {
    context.resources.push({ ...item, reason: "already-deleted" });
    return;
  }
  const named =
    scope.code &&
    (scope.lookup
      ? endpoint.name === `PT Probe ${scope.code}`
      : isControlDEndpointName(endpoint.name, scope.code));
  const ids = deviceProfileIds(endpoint);
  let reason: CleanupReason | null = null;
  if (!named) reason = "name-changed";
  else if (ids.length !== 1 || ids[0] !== scope.id) reason = "content-changed";
  context.resources.push(reason ? skip(item, reason) : item);
};

const planProfile = async (
  scope: ProfileScope,
  context: PlanContext,
  actualName: string | null,
) => {
  const start = context.resources.length;
  if (actualName !== null) await planContent(scope, context);
  planEndpoint(scope, context);
  const item = resource(scope, "profile", scope.id, actualName ?? scope.name);
  const children = context.resources.slice(start);
  item.dependsOn = children.map((child) => child.key);
  const named =
    scope.code !== null &&
    (scope.lookup
      ? actualName === `PT Lookup ${scope.code}`
      : parseControlDProfileCode(actualName ?? "") === scope.code);
  let reason: CleanupReason | null = null;
  if (actualName === null) reason = "already-deleted";
  else if (!named) reason = "name-changed";
  else if (children.some((child) => child.disposition === "skipped"))
    reason = "contains-preserved";
  else if (
    context.devices.some(
      (device) =>
        device.id !== scope.endpointId && deviceProfileIds(device).includes(scope.id),
    )
  )
    reason = "shared-profile";
  // Renaming the parent revokes ownership of its contents as well.
  if (actualName !== null && !named) {
    context.resources.splice(
      start,
      children.length,
      ...children.map((child) => skip(child, "name-changed")),
    );
  }
  context.resources.push(
    reason && reason !== "already-deleted" ? skip(item, reason) : { ...item, reason },
  );
};

export const planControlDCleanup = async (
  client: CleanupClient,
  config: ControlDConfig,
  recognition: RecognitionState,
): Promise<CleanupResource[]> => {
  const [profiles, devices] = await Promise.all([
    client.listProfiles(),
    client.listDevices(),
  ]);
  const context: PlanContext = { client, config, recognition, devices, resources: [] };
  const scopes: ProfileScope[] = [];
  if (config.profileId)
    scopes.push({
      id: config.profileId,
      code: config.resourceIdentity?.code ?? null,
      name: config.profileId,
      endpointId: config.endpointId,
      lookup: false,
    });
  if (recognition.profileId && recognition.profileId !== config.profileId)
    scopes.push({
      id: recognition.profileId,
      code: recognition.code,
      name: recognition.profileId,
      endpointId: recognition.endpointId,
      lookup: true,
    });
  for (const scope of scopes) {
    await planProfile(
      scope,
      context,
      profiles.find((item) => item.id === scope.id)?.name ?? null,
    );
  }
  // Partial creation may have left an endpoint without a recorded profile.
  if (!config.profileId && config.endpointId)
    planEndpoint(
      {
        id: "",
        code: config.resourceIdentity?.code ?? null,
        name: "",
        endpointId: config.endpointId,
        lookup: false,
      },
      context,
    );
  if (!recognition.profileId && recognition.endpointId)
    planEndpoint(
      {
        id: "",
        code: recognition.code,
        name: "",
        endpointId: recognition.endpointId,
        lookup: true,
      },
      context,
    );
  const rank = { rule: 0, folder: 0, service: 0, endpoint: 1, profile: 2 };
  return context.resources.sort((left, right) => rank[left.kind] - rank[right.kind]);
};
