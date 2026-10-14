import { isCleanupNotFound, planControlDCleanup, type CleanupClient } from "./cleanup";
import { ControlDApiError } from "./client";
import type { CleanupResource, CleanupResult, ControlDConfig } from "./contracts";
import type { RecognitionState } from "./recognition-setup";

export const cleanupFailure = (error: unknown): string =>
  error instanceof ControlDApiError && error.status > 0
    ? `Control D cleanup request failed (HTTP ${error.status}).`
    : "Control D cleanup request failed.";

export type CleanupLocalState = {
  config: ControlDConfig;
  recognition: RecognitionState;
};

const forgetDeleted = (state: CleanupLocalState, item: CleanupResource) => {
  const config = state.config;
  const lookup = state.recognition;
  if (item.profileId === config.profileId) {
    if (item.kind === "folder") {
      config.managedFolders = Object.fromEntries(
        Object.entries(config.managedFolders).filter(
          ([, folder]) => String(folder.folderId) !== item.id,
        ),
      );
    } else if (item.kind === "service") {
      const services = { ...config.managedServices };
      Reflect.deleteProperty(services, item.id);
      config.managedServices = services;
    } else if (item.kind === "profile") {
      config.profileId = null;
      config.managedFolders = {};
      config.managedServices = {};
      config.resourceIdentity = null;
      config.lastSyncedHash = null;
    }
  }
  if (item.kind === "endpoint" && item.id === config.endpointId) {
    config.endpointId = null;
    config.resolverDoh = null;
  }
  if (item.profileId === lookup.profileId && item.kind === "service") {
    lookup.servicePks = lookup.servicePks.filter((id) => id !== item.id);
  }
  if (item.kind === "endpoint" && item.id === lookup.endpointId) {
    lookup.endpointId = null;
    lookup.resolverDoh = null;
    lookup.phase = "error";
  }
  if (item.kind === "profile" && item.id === lookup.profileId) {
    lookup.profileId = null;
    lookup.code = null;
    lookup.servicePks = [];
    lookup.phase = "not-setup";
    lookup.expectedFingerprint = null;
    lookup.freshFingerprint = null;
    lookup.lastError = null;
  }
};

const removeResource = async (client: CleanupClient, item: CleanupResource) => {
  if (item.reason === "already-deleted") return;
  if (item.kind === "folder") await client.deleteGroup(item.profileId, Number(item.id));
  else if (item.kind === "service")
    await client.deleteProfileService(item.profileId, item.id);
  else if (item.kind === "endpoint") await client.deleteDevice(item.id);
  else if (item.kind === "profile") await client.deleteProfile(item.id);
};

const outcome = (
  resource: CleanupResource,
  status: CleanupResult["status"],
  reason: CleanupResult["reason"] = null,
  message: string | null = null,
): CleanupResult => ({ resource, status, reason, message });

const deleteReviewed = async (
  client: CleanupClient,
  item: CleanupResource,
  state: CleanupLocalState,
): Promise<CleanupResult> => {
  const fresh = (
    await planControlDCleanup(client, state.config, state.recognition)
  ).find((candidate) => candidate.key === item.key);
  if (!fresh || fresh.disposition === "skipped")
    return outcome(item, "skipped", fresh?.reason ?? "content-changed");
  if (
    fresh.reason !== "already-deleted" &&
    (fresh.name !== item.name ||
      JSON.stringify(fresh.ruleHostnames) !== JSON.stringify(item.ruleHostnames))
  )
    return outcome(item, "skipped", "content-changed");
  try {
    await removeResource(client, fresh);
    return outcome(item, "deleted", fresh.reason);
  } catch (error) {
    if (isCleanupNotFound(error)) return outcome(item, "deleted", "already-deleted");
    throw error;
  }
};

// Checkpoint after each successful DELETE. A worker restart can retry from these IDs,
// and a folder DELETE is atomic, so partially removed rules never invalidate its hash.
export const executeControlDCleanup = async ({
  client,
  resources,
  state,
  checkpoint,
}: {
  client: CleanupClient;
  resources: CleanupResource[];
  state: CleanupLocalState;
  checkpoint: (state: CleanupLocalState) => Promise<void>;
}): Promise<CleanupResult[]> => {
  const results: CleanupResult[] = [];
  for (const item of resources) {
    if (item.disposition === "skipped") {
      results.push(outcome(item, "skipped", item.reason));
      continue;
    }
    const dependencies = results.filter((result) =>
      item.dependsOn.includes(result.resource.key),
    );
    if (dependencies.some((result) => result.status === "failed")) {
      results.push(outcome(item, "failed", "dependency-failed"));
      continue;
    }
    if (dependencies.some((result) => result.status === "skipped")) {
      results.push(outcome(item, "skipped", "contains-preserved"));
      continue;
    }
    try {
      const result = await deleteReviewed(client, item, state);
      if (result.status === "deleted") {
        forgetDeleted(state, item);
        await checkpoint(state);
      }
      results.push(result);
    } catch (error) {
      results.push(outcome(item, "failed", null, cleanupFailure(error)));
    }
  }
  return results;
};
