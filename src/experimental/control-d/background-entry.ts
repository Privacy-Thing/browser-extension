/* eslint-disable max-params -- Logging keeps redaction context explicit. */
import { ControlDApiError, ControlDClient } from "./client";
import {
  CONTROL_D_COMMANDS,
  isControlDCommand,
  type ControlDCommand,
  type ControlDConfig,
  type ControlDMapping,
  type ControlDPreparedSnapshot,
} from "./contracts";
import {
  hashControlDInputs,
  applyControlDSync,
  ControlDConflictError,
  isControlDAuthError,
  prepareControlDSync,
  type ControlDPreparedSync,
} from "./reconcile";
import { adoptRecoverySet, discoverRecoverySets } from "./recovery";
import { redactControlDLogValue } from "./redaction";
import { generateResourceCode } from "./resource-names";
import {
  forgetControlDApiKey,
  loadControlDApiKey,
  loadControlDConfig,
  saveControlDApiKey,
  saveControlDConfig,
  toControlDPublicState,
} from "./storage";
import { createControlDSyncQueue } from "./sync-queue";

import { logExtensionEvent } from "@/background/logger";
import { loadLocations, LOCATIONS_STORAGE_KEY } from "@/background/storage/locations";
import { loadRules, RULES_STORAGE_KEY } from "@/background/storage/rules";
import { fireAndForget } from "@/shared/async";
import { ExtensionLogLevel, LogCategory } from "@/shared/types";

type BackgroundEntryDeps = {
  getDebugMode: () => boolean | Promise<boolean>;
};

type SyncResult =
  | {
      ok: true;
      next: ControlDConfig;
      prepared: ControlDPreparedSync;
    }
  | { ok: false; failed: ControlDConfig; error: unknown }
  | null;

const toPreparedSnapshot = (
  { diff, proxies }: ControlDPreparedSync,
  token: string,
): ControlDPreparedSnapshot => ({ diff, proxies, token });

const log = (
  deps: BackgroundEntryDeps,
  event: string,
  details: Record<string, unknown>,
  level = ExtensionLogLevel.Info,
  apiKey?: string,
): void => {
  fireAndForget(
    Promise.resolve(deps.getDebugMode()).then((enabled) => {
      logExtensionEvent({
        enabled,
        category: LogCategory.System,
        event,
        level,
        payload: {
          details: redactControlDLogValue(details, apiKey) as Record<string, unknown>,
        },
      });
    }),
  );
};

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : "Control D integration failed.";

const apiErrorDetails = (error: unknown): Record<string, unknown> => {
  if (!(error instanceof ControlDApiError)) {
    return {
      status: null,
      requestId: null,
      retryAfter: null,
      cause: null,
      operation: null,
      apiCode: null,
    };
  }
  return {
    status: error.status,
    requestId: error.requestId,
    retryAfter: error.retryAfterSeconds,
    cause: error.causeMessage,
    operation: error.operation,
    apiCode: error.apiCode,
  };
};

const withoutResolvedConflict = async (
  config: ControlDConfig,
): Promise<ControlDConfig> => {
  if (!config.lastError && config.status !== "conflict") return config;
  const resolved: ControlDConfig = {
    ...config,
    lastError: null,
    status: config.status === "conflict" ? "ready" : config.status,
  };
  await saveControlDConfig(resolved);
  return resolved;
};

const saveFailure = async (
  config: ControlDConfig,
  error: unknown,
): Promise<ControlDConfig> => {
  const authError = isControlDAuthError(error);
  const conflict = error instanceof ControlDConflictError;
  let status: ControlDConfig["status"] = "error";
  if (authError) status = "auth-error";
  else if (conflict) status = "conflict";
  const failed: ControlDConfig = {
    ...config,
    status,
    autoSyncEnabled: authError || conflict ? false : config.autoSyncEnabled,
    lastAttemptAt: new Date().toISOString(),
    lastError: errorMessage(error),
  };
  await saveControlDConfig(failed);
  return failed;
};

const isMapping = (value: unknown): value is ControlDMapping => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<ControlDMapping>;
  return (
    typeof candidate.locationId === "string" &&
    (typeof candidate.proxyPk === "string" || candidate.proxyPk === null) &&
    ["exact", "approximate", "skipped"].includes(candidate.status ?? "") &&
    typeof candidate.confirmed === "boolean"
  );
};

// eslint-disable-next-line max-lines-per-function -- Owns one single-flight lifecycle.
const createController = (deps: BackgroundEntryDeps) => {
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  const syncQueue = createControlDSyncQueue<SyncResult>();
  let rerunRequested = false;
  let preview: {
    token: string;
    inputHash: string;
    prepared: ControlDPreparedSync;
  } | null = null;
  const inputHash = async (config: ControlDConfig) =>
    hashControlDInputs(config, await loadRules(), await loadLocations());
  const createClient = (apiKey: string): ControlDClient =>
    new ControlDClient(apiKey, fetch, 12_000, (retry) =>
      log(deps, "control-d.api.retry", retry, undefined, apiKey),
    );

  const runSync = async ({
    confirmApproximate,
    repair,
    automatic,
    reviewed,
  }: {
    reviewed?: ControlDPreparedSync;
    confirmApproximate: boolean;
    repair: boolean;
    automatic: boolean;
  }): Promise<SyncResult> => {
    let config = await loadControlDConfig();
    const apiKey = await loadControlDApiKey();
    if (!apiKey) throw new Error("Connect a Control D API key first.");
    if (
      automatic &&
      (!config.enabled || !config.autoSyncEnabled || !config.lastSyncedHash)
    )
      return null;

    config = {
      ...config,
      status: "syncing",
      lastAttemptAt: new Date().toISOString(),
      lastError: null,
    };
    await saveControlDConfig(config);
    log(deps, "control-d.sync.start", { automatic, repair }, undefined, apiKey);

    try {
      const client = createClient(apiKey);
      const prepared = reviewed ?? (await prepareControlDSync(client, config));
      const next = await applyControlDSync({
        client,
        config,
        prepared,
        confirmApproximate,
        repair,
      });
      await saveControlDConfig(next);
      log(
        deps,
        "control-d.sync.success",
        {
          automatic,
          addRules: prepared.diff.addRules,
          updateRules: prepared.diff.updateRules,
          deleteRules: prepared.diff.deleteRules,
          unchangedRules: prepared.diff.unchangedRules,
        },
        undefined,
        apiKey,
      );
      return { ok: true, next, prepared };
    } catch (error) {
      const failed = await saveFailure(config, error);
      log(
        deps,
        "control-d.sync.failure",
        {
          automatic,
          error: errorMessage(error),
          ...apiErrorDetails(error),
          conflict: error instanceof ControlDConflictError,
        },
        ExtensionLogLevel.Error,
        apiKey,
      );
      return { ok: false, failed, error };
    }
  };

  const runExclusive = async ({
    confirmApproximate,
    repair,
    automatic,
  }: {
    confirmApproximate: boolean;
    repair: boolean;
    automatic: boolean;
  }): Promise<SyncResult> => {
    try {
      return await syncQueue.run(() =>
        runSync({ confirmApproximate, repair, automatic }),
      );
    } finally {
      if (rerunRequested) {
        rerunRequested = false;
        scheduleAutomatic();
      }
    }
  };

  const runAutomatic = async (): Promise<void> => {
    if (syncQueue.isBusy()) {
      rerunRequested = true;
      return;
    }
    await runExclusive({
      confirmApproximate: false,
      repair: false,
      automatic: true,
    });
  };

  const scheduleAutomatic = (): void => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      fireAndForget(runAutomatic());
    }, 1_500);
  };

  // eslint-disable-next-line max-lines-per-function, sonarjs/cognitive-complexity -- Command boundary keeps secrets in background.
  const respond = async (command: ControlDCommand): Promise<unknown> => {
    if (
      ![
        CONTROL_D_COMMANDS.getState,
        CONTROL_D_COMMANDS.preview,
        CONTROL_D_COMMANDS.apply,
        CONTROL_D_COMMANDS.repair,
        CONTROL_D_COMMANDS.dnsAction,
      ].includes(command.type as never)
    )
      preview = null;
    if (command.type === CONTROL_D_COMMANDS.getState) {
      return {
        ok: true,
        state: await toControlDPublicState(await loadControlDConfig()),
      };
    }

    if (command.type === CONTROL_D_COMMANDS.setEnabled) {
      const config = await loadControlDConfig();
      const next = { ...config, enabled: command.enabled };
      await saveControlDConfig(next);
      log(deps, "control-d.integration.toggled", { enabled: command.enabled });
      return { ok: true, state: await toControlDPublicState(next) };
    }

    if (command.type === CONTROL_D_COMMANDS.connect) {
      const apiKey = command.apiKey.trim();
      if (!apiKey) return { ok: false, error: "Enter a Control D API key." };
      const config = await loadControlDConfig();
      try {
        const client = createClient(apiKey);
        const [candidates, proxies] = await Promise.all([
          discoverRecoverySets(client),
          client.listProxies(),
        ]);
        if (proxies.length === 0) throw new Error("No usable proxy locations found.");
        await saveControlDApiKey(apiKey);
        const next: ControlDConfig = {
          ...config,
          connected: true,
          status: "ready",
          lastAttemptAt: new Date().toISOString(),
          lastError: null,
        };
        await saveControlDConfig(next);
        log(
          deps,
          "control-d.connection.success",
          { recoveryCandidates: candidates.length, proxyCount: proxies.length },
          undefined,
          apiKey,
        );
        return {
          ok: true,
          state: await toControlDPublicState(next),
          candidates,
        };
      } catch (error) {
        const failed = await saveFailure(config, error);
        log(
          deps,
          "control-d.connection.failure",
          { error: errorMessage(error) },
          ExtensionLogLevel.Error,
          apiKey,
        );
        return {
          ok: false,
          error: errorMessage(error),
          state: await toControlDPublicState(failed),
        };
      }
    }

    if (command.type === CONTROL_D_COMMANDS.disconnect) {
      const config = await loadControlDConfig();
      await forgetControlDApiKey();
      const next: ControlDConfig = {
        ...config,
        connected: false,
        autoSyncEnabled: false,
        status: "disconnected",
        dnsVerification: null,
        lastError: null,
      };
      await saveControlDConfig(next);
      log(deps, "control-d.disconnected", { resourcesPreserved: true });
      return { ok: true, state: await toControlDPublicState(next) };
    }

    if (command.type === CONTROL_D_COMMANDS.updateMapping) {
      if (!isMapping(command.mapping)) {
        return { ok: false, error: "Invalid Control D location mapping." };
      }
      const config = await loadControlDConfig();
      const next: ControlDConfig = {
        ...config,
        locationMappings: {
          ...config.locationMappings,
          [command.mapping.locationId]: command.mapping,
        },
      };
      await saveControlDConfig(next);
      log(deps, "control-d.mapping.updated", {
        locationId: command.mapping.locationId,
        proxyPk: command.mapping.proxyPk,
        status: command.mapping.status,
      });
      return { ok: true, state: await toControlDPublicState(next) };
    }

    if (command.type === CONTROL_D_COMMANDS.dnsAction) {
      log(deps, "control-d.dns.action", {
        action: command.action,
        outcome: command.outcome,
      });
      return {
        ok: true,
        state: await toControlDPublicState(await loadControlDConfig()),
      };
    }

    const config = await loadControlDConfig();
    const apiKey = await loadControlDApiKey();
    if (!apiKey) {
      return {
        ok: false,
        error: "Connect a Control D API key first.",
        state: await toControlDPublicState(config),
      };
    }

    if (command.type === CONTROL_D_COMMANDS.discover) {
      try {
        const candidates = await discoverRecoverySets(createClient(apiKey));
        return {
          ok: true,
          state: await toControlDPublicState(config),
          candidates,
        };
      } catch (error) {
        return {
          ok: false,
          error: errorMessage(error),
          state: await toControlDPublicState(config),
        };
      }
    }

    if (command.type === CONTROL_D_COMMANDS.selectNew) {
      const next: ControlDConfig = {
        ...config,
        resourceIdentity: { code: generateResourceCode() },
        profileId: null,
        endpointId: null,
        resolverDoh: null,
        dnsVerification: null,
        managedFolders: {},
        locationMappings: {},
        autoSyncEnabled: false,
        status: "ready",
        lastSyncedHash: null,
        lastSuccessAt: null,
        lastError: null,
      };
      await saveControlDConfig(next);
      return { ok: true, state: await toControlDPublicState(next) };
    }

    if (command.type === CONTROL_D_COMMANDS.adopt) {
      try {
        const next = await adoptRecoverySet({
          client: createClient(apiKey),
          config,
          profileId: command.profileId,
          endpointId: command.endpointId,
          code: command.code,
        });
        await saveControlDConfig(next);
        return { ok: true, state: await toControlDPublicState(next) };
      } catch (error) {
        return {
          ok: false,
          error: errorMessage(error),
          state: await toControlDPublicState(config),
        };
      }
    }

    if (command.type === CONTROL_D_COMMANDS.confirmDns) {
      if (!config.endpointId || !config.resolverDoh) {
        return {
          ok: false,
          error: "Synchronize an endpoint before confirming browser DNS.",
          state: await toControlDPublicState(config),
        };
      }
      const next: ControlDConfig = {
        ...config,
        dnsVerification: command.verified
          ? { endpointId: config.endpointId, verifiedAt: new Date().toISOString() }
          : null,
      };
      await saveControlDConfig(next);
      return { ok: true, state: await toControlDPublicState(next) };
    }

    if (command.type === CONTROL_D_COMMANDS.preview) {
      try {
        const prepared = await prepareControlDSync(createClient(apiKey), config);
        log(
          deps,
          "control-d.diff.ready",
          {
            addRules: prepared.diff.addRules,
            updateRules: prepared.diff.updateRules,
            deleteRules: prepared.diff.deleteRules,
            warnings: prepared.diff.warnings.length,
          },
          undefined,
          apiKey,
        );
        const resolved = await withoutResolvedConflict(config);
        const token = crypto.randomUUID();
        preview = { token, inputHash: prepared.inputHash, prepared };
        return {
          ok: true,
          state: await toControlDPublicState(resolved),
          snapshot: toPreparedSnapshot(prepared, token),
        };
      } catch (error) {
        preview = null;
        const failed = await saveFailure(config, error);
        log(
          deps,
          "control-d.diff.failure",
          {
            error: errorMessage(error),
            ...apiErrorDetails(error),
            conflict: error instanceof ControlDConflictError,
          },
          ExtensionLogLevel.Error,
          apiKey,
        );
        return {
          ok: false,
          error: errorMessage(error),
          state: await toControlDPublicState(failed),
        };
      }
    }

    if (command.type === CONTROL_D_COMMANDS.syncNow && !config.lastSyncedHash) {
      return { ok: false, error: "Preview and confirm the first synchronization." };
    }

    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    let reviewed: ControlDPreparedSync | undefined;
    if (
      command.type === CONTROL_D_COMMANDS.apply ||
      command.type === CONTROL_D_COMMANDS.repair
    ) {
      if (
        !preview ||
        command.previewToken !== preview.token ||
        preview.inputHash !== (await inputHash(config))
      ) {
        preview = null;
        return {
          ok: false,
          error: "Preview changed. Refresh and review before applying.",
        };
      }
      reviewed = preview.prepared;
      preview = null;
    }
    const result = await runSync({
      confirmApproximate:
        command.type === CONTROL_D_COMMANDS.apply ||
        command.type === CONTROL_D_COMMANDS.repair
          ? command.confirmApproximate
          : false,
      repair: command.type === CONTROL_D_COMMANDS.repair,
      automatic: false,
      ...(reviewed ? { reviewed } : {}),
    });
    if (!result) return { ok: false, error: "Synchronization did not run." };
    if (!result.ok) {
      return {
        ok: false,
        error: errorMessage(result.error),
        state: await toControlDPublicState(result.failed),
      };
    }
    return {
      ok: true,
      state: await toControlDPublicState(result.next),
      snapshot: toPreparedSnapshot(result.prepared, ""),
    };
  };

  return {
    respond: (command: ControlDCommand) =>
      syncQueue.run(async () => {
        try {
          return await respond(command);
        } finally {
          if (rerunRequested) {
            rerunRequested = false;
            scheduleAutomatic();
          }
        }
      }),
    scheduleAutomatic,
  };
};

export const registerControlD = (deps: BackgroundEntryDeps): void => {
  const controller = createController(deps);

  fireAndForget(
    loadControlDConfig().then((config) => {
      if (
        config.enabled &&
        config.connected &&
        config.autoSyncEnabled &&
        config.lastSyncedHash
      ) {
        controller.scheduleAutomatic();
      }
    }),
  );

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (
      !isControlDCommand(message) ||
      sender.id !== chrome.runtime.id ||
      !sender.url?.startsWith(chrome.runtime.getURL("/"))
    )
      return false;
    fireAndForget(controller.respond(message).then(sendResponse), (error) =>
      sendResponse({ ok: false, error: errorMessage(error) }),
    );
    return true;
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (
      areaName === "local" &&
      (RULES_STORAGE_KEY in changes || LOCATIONS_STORAGE_KEY in changes)
    ) {
      controller.scheduleAutomatic();
    }
  });
};
