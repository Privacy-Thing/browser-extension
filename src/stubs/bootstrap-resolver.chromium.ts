import {
  readPreloadedState,
  type PreloadedRuntimeState,
  resolvePreloadedSnapshot,
} from "@/content/preloaded-runtime";
import { safeSendMessage, safeSendForResponse } from "@/content/safe-messaging";
import { BUILD_BROWSER_TARGET } from "@/shared/build-flags";
import { CMD_LOG_EVENT, CMD_RESOLVE_SNAPSHOT } from "@/shared/extension-contract";
import type { ResolveSnapshotResponse, RuntimeSnapshot } from "@/shared/types";

export type BootstrapSnapshotChannel =
  | "dom-runtime-config"
  | "preloaded-state"
  | "background-message"
  | "background-fallback-miss";

export type ChromiumFallbackResult = {
  snapshot: RuntimeSnapshot | null;
  channel: "preloaded-state" | "background-message" | "background-fallback-miss";
};

const resolveBgSnapshot = async (hostname: string): Promise<RuntimeSnapshot | null> => {
  const response = await safeSendForResponse<ResolveSnapshotResponse>({
    type: CMD_RESOLVE_SNAPSHOT,
    hostname,
  });

  return response?.snapshot ?? null;
};

export const reportBootstrapChannel = (
  channel: BootstrapSnapshotChannel,
  snapshot: RuntimeSnapshot | null,
): void => {
  if (!snapshot?.debugMode) {
    return;
  }

  safeSendMessage({
    type: CMD_LOG_EVENT,
    event: "Bootstrap.channel-used",
    details: {
      browserTarget: BUILD_BROWSER_TARGET,
      channel,
      hadSnapshot: true,
    },
  });
};

export const resolveChromiumFallback = async (
  hostname: string,
  {
    readPreloadedState: readState = readPreloadedState,
    resolveBackground = resolveBgSnapshot,
  }: {
    readPreloadedState?: () => Promise<PreloadedRuntimeState | null>;
    resolveBackground?: (hostname: string) => Promise<RuntimeSnapshot | null>;
  } = {},
): Promise<ChromiumFallbackResult> => {
  const preloadedState = await readState();
  const preloadedSnapshot = resolvePreloadedSnapshot(hostname, preloadedState);
  if (preloadedSnapshot) {
    return { snapshot: preloadedSnapshot, channel: "preloaded-state" };
  }

  const backgroundSnapshot = await resolveBackground(hostname);
  return backgroundSnapshot
    ? { snapshot: backgroundSnapshot, channel: "background-message" }
    : { snapshot: null, channel: "background-fallback-miss" };
};

export const queryUserScriptsStatus = async () => ({
  hasPermission: false,
  registrationCount: 0,
  lastSyncSucceeded: false,
  ready: false,
});

export const resolveFirefoxBgSnapshot = resolveBgSnapshot;
export const resolveFirefoxPreload = resolvePreloadedSnapshot;
