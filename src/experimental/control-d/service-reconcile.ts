import type { ControlDClient, ControlDRule } from "./client";
import { compileControlDServices, isControlDBinding } from "./compiler";
import type {
  ControlDCompiledService,
  ControlDConfig,
  ControlDDiff,
  ControlDManagedService,
  ControlDMapping,
  ControlDServiceAction,
  ControlDServiceConflict,
} from "./contracts";
import type { ControlDProfileService } from "./services";

import type { RuleFeatureBinding } from "@/shared/provider-feature";
import type { DomainRule, Location } from "@/shared/types";

export type ControlDServicePlan = {
  add: ControlDCompiledService[];
  update: ControlDCompiledService[];
  remove: string[];
  unchanged: number;
  blocking: ControlDServiceConflict[];
  repairable: ControlDServiceConflict[];
};

type ServiceContext = {
  remote: readonly ControlDProfileService[] | null;
  managed: Readonly<Record<string, ControlDManagedService>>;
  repair: boolean;
};

const emptyPlan = (): ControlDServicePlan => ({
  add: [],
  update: [],
  remove: [],
  unchanged: 0,
  blocking: [],
  repairable: [],
});

const serviceConflict = (
  code: ControlDServiceConflict["code"],
  servicePk: string,
  message: string,
  rulePattern: string,
): ControlDServiceConflict => ({ code, servicePk, message, rulePattern });

const remoteChanged = (servicePk: string): string =>
  `Managed Control D service ${servicePk} changed remotely. Review the diff and use repair explicitly.`;

export const hashControlDValue = async (value: unknown): Promise<string> => {
  const encoded = new TextEncoder().encode(JSON.stringify(value));
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
};

export const canonicalBindings = (bindings: readonly RuleFeatureBinding[]) =>
  [...bindings]
    .map((binding) => ({
      rulePattern: binding.rulePattern,
      providerId: binding.providerId,
      featureId: binding.featureId,
      featureName: binding.featureName,
      featureType: binding.featureType,
    }))
    .sort((left, right) =>
      `${left.providerId}\0${left.rulePattern}\0${left.featureId}`.localeCompare(
        `${right.providerId}\0${right.rulePattern}\0${right.featureId}`,
      ),
    );

export const canonicalManaged = (
  managed: Readonly<Record<string, ControlDManagedService>> | undefined,
) =>
  Object.entries(managed ?? {})
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([servicePk, service]) => ({
      servicePk,
      rulePattern: service.rulePattern,
      proxyPk: service.proxyPk,
      do: service.action.do,
      status: service.action.status,
      via: service.action.via,
      viaV6: service.action.viaV6,
    }));

export const canonicalServices = (services: readonly ControlDProfileService[]) =>
  [...services]
    .sort((left, right) => left.pk.localeCompare(right.pk))
    .map((service) => ({
      pk: service.pk,
      name: service.name,
      category: service.category,
      action: service.action,
      status: service.status,
      via: service.via,
      viaV6: service.viaV6,
    }));

export const canonicalRules = (rules: readonly ControlDRule[]): unknown[] =>
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

export const hashControlDInputs = (
  config: ControlDConfig,
  rules: readonly DomainRule[],
  locations: readonly Location[],
  bindings: readonly RuleFeatureBinding[] = [],
) =>
  hashControlDValue({
    rules,
    locations,
    bindings: canonicalBindings(bindings),
    enabled: config.enabled,
    connected: config.connected,
    resourceIdentity: config.resourceIdentity,
    profileId: config.profileId,
    endpointId: config.endpointId,
    managedFolders: config.managedFolders,
    managedServices: canonicalManaged(config.managedServices),
    locationMappings: config.locationMappings,
    lastSyncedHash: config.lastSyncedHash,
  });

export const remoteSnapshot = async (
  client: ControlDClient,
  config: ControlDConfig,
  bindings: readonly RuleFeatureBinding[],
) => {
  const profiles = await client.listProfiles();
  const profile = config.profileId
    ? profiles.find((item) => item.id === config.profileId)
    : null;
  const groups = profile ? await client.listGroups(profile.id) : [];
  const rules = profile
    ? await Promise.all(
        Object.values(config.managedFolders).map(async (folder) => ({
          id: folder.folderId,
          rules: canonicalRules(await client.listRules(profile.id, folder.folderId)),
        })),
      )
    : [];
  const device = config.endpointId
    ? (await client.listDevices()).find((item) => item.id === config.endpointId)
    : null;
  const services = await readProfileServices(
    client,
    config,
    bindings,
    profile?.id ?? null,
  );
  return {
    hash: await hashControlDValue(
      withServiceHash({ profiles, groups, rules, device }, services),
    ),
    services,
  };
};

export const servicesAreRelevant = (
  bindings: readonly RuleFeatureBinding[],
  config: ControlDConfig,
): boolean =>
  bindings.some(isControlDBinding) ||
  Object.keys(config.managedServices ?? {}).length > 0;

export const readProfileServices = async (
  client: ControlDClient,
  config: ControlDConfig,
  bindings: readonly RuleFeatureBinding[],
  profileId: string | null,
): Promise<ControlDProfileService[] | null> => {
  if (!profileId || !servicesAreRelevant(bindings, config)) return null;
  return client.listProfileServices(profileId);
};

export const withServiceHash = (
  base: Record<string, unknown>,
  services: readonly ControlDProfileService[] | null,
): Record<string, unknown> =>
  services === null ? base : { ...base, services: canonicalServices(services) };

const actionMatches = (
  remote: ControlDProfileService,
  action: ControlDServiceAction,
): boolean =>
  remote.action === action.do &&
  remote.status === action.status &&
  remote.via === action.via &&
  remote.viaV6 === action.viaV6;

const classifyDesired = (
  service: ControlDCompiledService,
  context: ServiceContext,
  plan: ControlDServicePlan,
): void => {
  const current = context.remote?.find((item) => item.pk === service.servicePk);
  const owned = context.managed[service.servicePk];
  if (owned && !context.remote) {
    plan.blocking.push(
      serviceConflict(
        "remote-service-changed",
        service.servicePk,
        `Managed Control D service ${service.servicePk} has no profile.`,
        service.rulePattern,
      ),
    );
    return;
  }
  if (context.remote && current && !owned) {
    plan.blocking.push(
      serviceConflict(
        "unowned-service",
        service.servicePk,
        `Control D service ${service.servicePk} already exists and is not managed by Privacy Thing.`,
        service.rulePattern,
      ),
    );
    return;
  }
  if (owned && context.remote && !current) {
    plan.add.push(service);
    if (!context.repair) {
      plan.repairable.push(
        serviceConflict(
          "remote-service-changed",
          service.servicePk,
          remoteChanged(service.servicePk),
          service.rulePattern,
        ),
      );
    }
    return;
  }
  if (owned && current && !actionMatches(current, owned.action)) {
    plan.update.push(service);
    if (!context.repair) {
      plan.repairable.push(
        serviceConflict(
          "remote-service-changed",
          service.servicePk,
          remoteChanged(service.servicePk),
          service.rulePattern,
        ),
      );
    }
    return;
  }
  if (!current) {
    plan.add.push(service);
    return;
  }
  if (!actionMatches(current, service.action)) {
    plan.update.push(service);
    return;
  }
  plan.unchanged += 1;
};

const classifyRemovals = (
  desired: readonly ControlDCompiledService[],
  context: ServiceContext,
  plan: ControlDServicePlan,
): void => {
  const desiredIds = new Set(desired.map((service) => service.servicePk));
  for (const [servicePk, owned] of Object.entries(context.managed)) {
    if (desiredIds.has(servicePk)) continue;
    if (!context.remote) {
      plan.blocking.push(
        serviceConflict(
          "remote-service-changed",
          servicePk,
          `Managed Control D service ${servicePk} has no profile.`,
          owned.rulePattern,
        ),
      );
      continue;
    }
    const current = context.remote.find((item) => item.pk === servicePk);
    if (!current) continue;
    if (!actionMatches(current, owned.action)) {
      plan.blocking.push(
        serviceConflict(
          "remote-service-changed",
          servicePk,
          `Managed Control D service ${servicePk} changed remotely and was left in place.`,
          owned.rulePattern,
        ),
      );
      continue;
    }
    plan.remove.push(servicePk);
  }
};

export const planServiceOps = (
  desired: readonly ControlDCompiledService[],
  remote: readonly ControlDProfileService[] | null,
  managed: Readonly<Record<string, ControlDManagedService>>,
  repair: boolean,
): ControlDServicePlan => {
  const plan = emptyPlan();
  const context = { remote, managed, repair };
  for (const service of desired) classifyDesired(service, context, plan);
  classifyRemovals(desired, context, plan);
  return plan;
};

export const servicePlanError = (
  plan: ControlDServicePlan,
  repair: boolean,
): string | null => {
  if (plan.blocking.length > 0) {
    return plan.blocking.map((item) => item.message).join(" ");
  }
  if (!repair && plan.repairable.length > 0) {
    return plan.repairable.map((item) => item.message).join(" ");
  }
  return null;
};

export const serviceDiffFields = (
  plan: ControlDServicePlan,
): Pick<
  ControlDDiff,
  | "addServices"
  | "updateServices"
  | "deleteServices"
  | "unchangedServices"
  | "serviceErrors"
> => {
  const serviceErrors = [...plan.blocking, ...plan.repairable];
  return {
    addServices: plan.add.length,
    updateServices: plan.update.length,
    deleteServices: plan.remove.length,
    unchangedServices: plan.unchanged,
    ...(serviceErrors.length > 0 ? { serviceErrors } : {}),
  };
};

const serviceIdentity = (services: readonly ControlDCompiledService[]) =>
  [...services]
    .sort((left, right) => left.servicePk.localeCompare(right.servicePk))
    .map((service) => ({
      servicePk: service.servicePk,
      rulePattern: service.rulePattern,
      proxyPk: service.proxyPk,
      do: service.action.do,
      status: service.action.status,
      via: service.action.via,
      viaV6: service.action.viaV6,
    }));

export const sameServices = (
  left: readonly ControlDCompiledService[],
  right: readonly ControlDCompiledService[],
): boolean =>
  JSON.stringify(serviceIdentity(left)) === JSON.stringify(serviceIdentity(right));

export const serviceListChanged = (
  previous: readonly ControlDProfileService[] | null,
  next: readonly ControlDProfileService[],
): boolean =>
  previous !== null &&
  JSON.stringify(canonicalServices(previous)) !==
    JSON.stringify(canonicalServices(next));

export const openServiceSync = ({
  rules,
  bindings,
  mappings,
  remote,
  config,
}: {
  rules: readonly DomainRule[];
  bindings: readonly RuleFeatureBinding[];
  mappings: Readonly<Record<string, ControlDMapping>>;
  remote: readonly ControlDProfileService[] | null;
  config: ControlDConfig;
}): {
  services: ControlDCompiledService[];
  fields: Partial<
    Pick<
      ControlDDiff,
      | "addServices"
      | "updateServices"
      | "deleteServices"
      | "unchangedServices"
      | "serviceErrors"
    >
  >;
  conflict: string | null;
  blocking: string | null;
} => {
  const compiled = compileControlDServices({ rules, bindings, mappings });
  if (compiled.conflicts.length > 0) {
    return {
      services: [],
      fields: {},
      conflict: compiled.conflicts.map((item) => item.message).join(" "),
      blocking: null,
    };
  }
  if (!servicesAreRelevant(bindings, config)) {
    return { services: compiled.services, fields: {}, conflict: null, blocking: null };
  }
  const plan = planServiceOps(
    compiled.services,
    remote,
    config.managedServices ?? {},
    false,
  );
  return {
    services: compiled.services,
    fields: serviceDiffFields(plan),
    conflict: null,
    blocking: plan.blocking.map((item) => item.message).join(" ") || null,
  };
};

export const validateServiceApply = async ({
  client,
  config,
  bindings,
  rules,
  mappings,
  preparedServices,
  openedServices,
  profileId,
  repair,
}: {
  client: ControlDClient;
  config: ControlDConfig;
  bindings: readonly RuleFeatureBinding[];
  rules: readonly DomainRule[];
  mappings: Readonly<Record<string, ControlDMapping>>;
  preparedServices: readonly ControlDCompiledService[];
  openedServices: readonly ControlDProfileService[] | null;
  profileId: string;
  repair: boolean;
}): Promise<
  | { error: string }
  | { error: null; plan: ControlDServicePlan; services: ControlDCompiledService[] }
> => {
  const compiled = compileControlDServices({ rules, bindings, mappings });
  if (compiled.conflicts.length > 0) {
    return { error: compiled.conflicts.map((item) => item.message).join(" ") };
  }
  if (!sameServices(compiled.services, preparedServices)) {
    return { error: "Preview changed. Refresh and review before applying." };
  }
  if (!servicesAreRelevant(bindings, config)) {
    return { error: null, plan: emptyPlan(), services: compiled.services };
  }
  const fresh = await client.listProfileServices(profileId);
  if (config.profileId && serviceListChanged(openedServices, fresh)) {
    return { error: "Remote setup changed. Refresh and review the preview." };
  }
  const plan = planServiceOps(
    compiled.services,
    fresh,
    config.managedServices ?? {},
    repair,
  );
  const error = servicePlanError(plan, repair);
  return error ? { error } : { error: null, plan, services: compiled.services };
};

export const managedFromDesired = (
  desired: readonly ControlDCompiledService[],
): Record<string, ControlDManagedService> =>
  Object.fromEntries(
    desired.map((service) => [
      service.servicePk,
      {
        rulePattern: service.rulePattern,
        proxyPk: service.proxyPk,
        action: service.action,
      },
    ]),
  );

export const commitServiceOps = async (
  client: ControlDClient,
  profileId: string,
  plan: ControlDServicePlan,
  desired: readonly ControlDCompiledService[],
): Promise<Record<string, ControlDManagedService>> => {
  if (plan.add.length > 0 || plan.update.length > 0 || plan.remove.length > 0) {
    for (const servicePk of plan.remove) {
      await client.deleteProfileService(profileId, servicePk);
    }
    for (const service of [...plan.update, ...plan.add]) {
      await client.redirectProfileService(
        profileId,
        service.servicePk,
        service.proxyPk,
      );
    }
  }
  return managedFromDesired(desired);
};

export const finishServiceSync = async ({
  client,
  profileId,
  plan,
  services,
  config,
  rules,
}: {
  client: ControlDClient;
  profileId: string;
  plan: ControlDServicePlan;
  services: readonly ControlDCompiledService[];
  config: ControlDConfig;
  rules: readonly unknown[];
}): Promise<{
  managedPatch: { managedServices?: Record<string, ControlDManagedService> };
  lastSyncedHash: string;
}> => {
  const managedServices = await commitServiceOps(client, profileId, plan, services);
  const managedPatch =
    config.managedServices !== undefined || Object.keys(managedServices).length > 0
      ? { managedServices }
      : {};
  const lastSyncedHash = await hashControlDValue(
    Object.keys(managedServices).length > 0
      ? { rules, services: canonicalManaged(managedServices) }
      : rules,
  );
  return { managedPatch, lastSyncedHash };
};
