import { z } from "zod";

import { registerFeatureProviders } from "@/background/feature-provider-registry";
import {
  withConfigMutation,
  withConfigurationLock,
} from "@/background/settings-import-transaction";
import {
  loadFeatureState,
  saveFeatureCache,
  saveFeatureState,
} from "@/background/storage/provider-features";
import { loadRules } from "@/background/storage/rules";
import { compileDomainPattern } from "@/shared/domain-match";
import {
  FEATURE_COMMANDS,
  bindingPatterns,
  type ProviderFeature,
  type ProviderBadgeColors,
  type ProviderFeatureCommand,
  type ProviderFeatureMatch,
  type ProviderFeatureReply,
  type ProviderFeatureState,
  type RuleFeatureBinding,
} from "@/shared/provider-feature";

export type FeatureProvider = {
  id: string;
  name: string;
  initials?: string;
  badgeColors?: ProviderBadgeColors;
  capabilities: { catalogue: boolean; domainRecognition: boolean; ruleSync: boolean };
  getStatus: (binding?: RuleFeatureBinding | null) => Promise<{
    available: boolean;
    syncStatus: string;
    error: string | null;
    recognitionStatus?: "ready" | "preparing" | "blocked" | "unavailable";
  }>;
  getFeatures: () => Promise<ProviderFeature[]>;
  recognizeDomain: (hostname: string) => Promise<ProviderFeatureMatch>;
};

const commandSchema = z.object({
  type: z.enum([
    FEATURE_COMMANDS.getState,
    FEATURE_COMMANDS.recognize,
    FEATURE_COMMANDS.confirm,
    FEATURE_COMMANDS.dismiss,
    FEATURE_COMMANDS.detach,
  ]),
  providerId: z.string().min(1).max(100).optional(),
  rulePattern: z
    .string()
    .max(1_024)
    .transform((value) => value.trim().toLowerCase()),
  hostname: z.string().max(253),
  featureId: z.string().min(1).max(200).optional(),
});

export const isFeatureCommand = (value: unknown): boolean =>
  typeof value === "object" &&
  value !== null &&
  Object.values(FEATURE_COMMANDS).includes((value as ProviderFeatureCommand).type);

export const normalizeFeatureHost = (input: string): string => {
  const hostname = new URL(`https://${input}`).hostname
    .toLowerCase()
    .replace(/\.$/, "");
  if (
    !/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(hostname) ||
    hostname.length > 253 ||
    /[\s/?#@\\:]/.test(input) ||
    hostname.includes("..")
  ) {
    throw new Error("Enter a hostname to recognize.");
  }
  return hostname;
};

const unavailableState = (): ProviderFeatureState => ({
  available: false,
  providerId: "",
  providerName: "",
  features: [],
  match: null,
  binding: null,
  dismissed: false,
  syncStatus: "unavailable",
  error: null,
});

const sameMatch = (left: ProviderFeatureMatch, right: ProviderFeatureMatch): boolean =>
  left.providerId === right.providerId &&
  left.hostname === right.hostname &&
  left.featureId === right.featureId &&
  left.status === right.status;

const badgeMetadata = (provider: FeatureProvider) => ({
  ...(provider.badgeColors ? { badgeColors: provider.badgeColors } : {}),
});

const operationErrorCode = (failure: unknown): { errorCode?: string } =>
  typeof failure === "object" &&
  failure !== null &&
  "code" in failure &&
  typeof failure.code === "string"
    ? { errorCode: failure.code }
    : {};

class FeatureController {
  private readonly pending = new Map<string, Promise<ProviderFeatureMatch>>();
  private readonly lastQueryAt = new Map<string, number>();

  constructor(private readonly providers: readonly FeatureProvider[]) {
    registerFeatureProviders(providers);
  }

  private async readState(
    provider: FeatureProvider,
    command: ProviderFeatureCommand,
  ): Promise<ProviderFeatureState> {
    const stored = await loadFeatureState();
    const binding =
      stored.featureBindings.find(
        (item) =>
          bindingPatterns(item).includes(command.rulePattern) &&
          item.providerId === provider.id,
      ) ?? null;
    let status = await provider.getStatus(binding);
    let features: ProviderFeature[] = [];
    let error = status.error;
    if (status.available && provider.capabilities.catalogue) {
      try {
        features = await provider.getFeatures();
        status = await provider.getStatus(binding);
        error = status.error;
      } catch (failure) {
        error =
          failure instanceof Error
            ? failure.message
            : "Provider catalogue is unavailable.";
      }
    }
    const hostname = command.hostname ? normalizeFeatureHost(command.hostname) : "";
    let match =
      stored.featureMatches.find(
        (item) => item.providerId === provider.id && item.hostname === hostname,
      ) ?? null;
    if (
      !match &&
      binding?.confirmedAt &&
      binding.matchSource &&
      (!hostname || !binding.matchedHostname || hostname === binding.matchedHostname)
    ) {
      match = {
        hostname: binding.matchedHostname ?? hostname,
        providerId: provider.id,
        featureId: binding.featureId,
        matchSource: binding.matchSource,
        status: "matched",
        checkedAt: binding.matchCheckedAt ?? binding.confirmedAt,
      };
    }
    return {
      ...status,
      error,
      providerId: provider.id,
      providerName: provider.name,
      ...badgeMetadata(provider),
      providerInitials:
        provider.initials ??
        provider.name
          .split(/\s+/)
          .map((word) => word[0])
          .join("")
          .slice(0, 2),
      features,
      match,
      binding,
      bindings: stored.featureBindings.filter(
        (item) => item.providerId === provider.id,
      ),
      groupPatterns: binding ? bindingPatterns(binding) : [],
      ...(binding
        ? {
            decorator: {
              providerId: provider.id,
              providerName: provider.name,
              ...badgeMetadata(provider),
              initials:
                provider.initials ??
                provider.name
                  .split(/\s+/)
                  .map((word) => word[0])
                  .join("")
                  .slice(0, 2),
              featureId: binding.featureId,
              label: binding.featureName,
              type: binding.featureType,
            },
          }
        : {}),
      dismissed:
        match !== null &&
        stored.dismissedMatches.some((item) => sameMatch(item, match)),
    };
  }

  private async recognize(provider: FeatureProvider, hostname: string): Promise<void> {
    if (!provider.capabilities.domainRecognition)
      throw new Error("This provider cannot recognize domains.");
    const key = `${provider.id}:${hostname}`;
    const stored = await loadFeatureState();
    const cached = stored.featureMatches.find(
      (match) => match.providerId === provider.id && match.hostname === hostname,
    );
    const ttl = cached?.status === "matched" ? 6 * 60 * 60 * 1_000 : 15 * 60 * 1_000;
    if (
      cached &&
      cached.matchSource !== "manual" &&
      Date.now() - Date.parse(cached.checkedAt) < ttl
    ) {
      return;
    }
    let request = this.pending.get(key);
    if (!request) {
      if (Date.now() - (this.lastQueryAt.get(key) ?? -Infinity) < 5_000)
        throw new Error("Please wait before checking this domain again.");
      this.lastQueryAt.set(key, Date.now());
      request = provider.recognizeDomain(hostname).catch((error: unknown) => {
        if (
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          error.code === "recognition-preparing"
        )
          this.lastQueryAt.delete(key);
        throw error;
      });
      this.pending.set(key, request);
    }
    try {
      const match = await request;
      await withConfigurationLock(async () => {
        const latest = await loadFeatureState();
        await saveFeatureCache({
          featureMatches: [
            ...latest.featureMatches.filter(
              (item) => item.providerId !== provider.id || item.hostname !== hostname,
            ),
            match,
          ].slice(-256),
          dismissedMatches: latest.dismissedMatches,
        });
      });
    } finally {
      this.pending.delete(key);
    }
  }

  private async mutate(
    provider: FeatureProvider,
    command: ProviderFeatureCommand,
  ): Promise<void> {
    const features =
      command.type === FEATURE_COMMANDS.confirm ? await provider.getFeatures() : [];
    await withConfigMutation(async () => {
      const stored = await loadFeatureState();
      if (command.type === FEATURE_COMMANDS.detach) {
        await saveFeatureState({
          ...stored,
          featureBindings: stored.featureBindings.filter(
            (binding) =>
              binding.rulePattern !== command.rulePattern ||
              binding.providerId !== provider.id,
          ),
        });
        return;
      }
      if (command.type === FEATURE_COMMANDS.dismiss) {
        const match = stored.featureMatches.find(
          (item) =>
            item.providerId === provider.id &&
            item.hostname === normalizeFeatureHost(command.hostname),
        );
        if (match)
          await saveFeatureCache({
            featureMatches: stored.featureMatches,
            dismissedMatches: [
              ...stored.dismissedMatches.filter((item) => !sameMatch(item, match)),
              match,
            ].slice(-256),
          });
        return;
      }
      if (!provider.capabilities.ruleSync)
        throw new Error("This provider cannot synchronize rule features.");
      if (!(await loadRules()).some((rule) => rule.pattern === command.rulePattern))
        throw new Error("Save the domain rule before confirming its feature.");
      const feature = features.find(
        (item) =>
          item.providerId === provider.id && item.featureId === command.featureId,
      );
      if (!feature) throw new Error("Choose an available provider feature.");
      const conflict = stored.featureBindings.find(
        (binding) =>
          binding.providerId === provider.id &&
          binding.featureId === feature.featureId &&
          binding.rulePattern !== command.rulePattern,
      );
      if (conflict)
        throw new Error(`This feature is already linked to ${conflict.rulePattern}.`);
      const evidence = stored.featureMatches.find(
        (item) =>
          item.providerId === provider.id &&
          item.hostname === command.hostname &&
          item.featureId === feature.featureId &&
          item.status === "matched" &&
          item.matchSource === "domain-test",
      );
      await saveFeatureState({
        ...stored,
        featureBindings: [
          ...stored.featureBindings.filter(
            (binding) =>
              binding.rulePattern !== command.rulePattern ||
              binding.providerId !== provider.id,
          ),
          {
            rulePattern: command.rulePattern,
            providerId: provider.id,
            featureId: feature.featureId,
            featureName: feature.name,
            featureType: feature.type,
            matchSource: evidence ? "domain-test" : "manual",
            ...(evidence
              ? {
                  matchedHostname: evidence.hostname,
                  matchCheckedAt: evidence.checkedAt,
                }
              : {}),
            confirmedAt: new Date().toISOString(),
          },
        ],
      });
    });
  }

  async respond(input: unknown): Promise<ProviderFeatureReply> {
    const parsed = commandSchema.safeParse(input);
    if (!parsed.success)
      return { ok: false, error: "Invalid provider feature command." };
    const command = parsed.data;
    const provider = command.providerId
      ? this.providers.find((item) => item.id === command.providerId)
      : this.providers[0];
    if (!provider) return { ok: true, state: unavailableState() };
    try {
      if (command.hostname) command.hostname = normalizeFeatureHost(command.hostname);
      if (
        command.type === FEATURE_COMMANDS.recognize &&
        !compileDomainPattern(command.rulePattern).test(command.hostname)
      )
        throw new Error("Choose a hostname covered by the source rule.");
      const status = await provider.getStatus();
      if (
        (command.type === FEATURE_COMMANDS.recognize ||
          command.type === FEATURE_COMMANDS.confirm) &&
        !status.available
      )
        throw new Error("Connect and enable this provider first.");
      if (command.type === FEATURE_COMMANDS.recognize)
        await this.recognize(provider, normalizeFeatureHost(command.hostname));
      else if (command.type !== FEATURE_COMMANDS.getState)
        await this.mutate(provider, command);
      return { ok: true, state: await this.readState(provider, command) };
    } catch (failure) {
      const error =
        failure instanceof Error
          ? failure.message
          : "Provider feature operation failed.";
      const state = await this.readState(provider, command).catch(() =>
        unavailableState(),
      );
      return {
        ok: false,
        error,
        ...operationErrorCode(failure),
        state: { ...state, error },
      };
    }
  }
}

export const createFeatureController = (providers: readonly FeatureProvider[]) =>
  new FeatureController(providers);
