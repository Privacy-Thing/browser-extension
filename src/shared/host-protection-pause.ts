import type { EXTENSION_COMMAND_TYPES } from "./extension-contract";
import type { RuntimeSnapshot } from "./types";
/** Exact top-document host exceptions; never a domain rule or a preference. */
export type HostProtectionPause = {
  hostname: string;
  id: string;
  expiresAt: number | null;
  workerTest?: WorkerTestKind | undefined;
};

export type WorkerTestKind = "service-worker" | "shared-worker";

export type HostPauseStatus = {
  workerTest?: HostProtectionPause | undefined;
  pause: HostProtectionPause | null;
  reloadRequired: boolean;
};

export const HOST_PAUSE_DURATION_MS = 10 * 60_000;

export const isHostPauseActive = (
  pause: HostProtectionPause,
  now = Date.now(),
): boolean => pause.expiresAt === null || now < pause.expiresAt;

export const findHostPause = (
  hostname: string,
  pauses: readonly HostProtectionPause[],
  now = Date.now(),
): HostProtectionPause | undefined =>
  pauses.find((pause) => pause.hostname === hostname && isHostPauseActive(pause, now));

export const isHostProtectionPause = (value: unknown): value is HostProtectionPause => {
  const item = value as Partial<HostProtectionPause> | null;
  return (
    item !== null &&
    typeof item === "object" &&
    typeof item.hostname === "string" &&
    typeof item.id === "string" &&
    (item.workerTest === undefined ||
      item.workerTest === "service-worker" ||
      item.workerTest === "shared-worker") &&
    (item.expiresAt === null ||
      (typeof item.expiresAt === "number" && Number.isFinite(item.expiresAt)))
  );
};

export const parseHostPauses = (value: unknown): HostProtectionPause[] =>
  Array.isArray(value) ? value.filter(isHostProtectionPause) : [];

export type SetHostPauseCommand = {
  type: typeof EXTENSION_COMMAND_TYPES.setHostProtectionPause;
  tabId?: number;
  duration: "ten-minutes" | "session" | "resume";
};

/** Worker tests leave every unrelated runtime field intact. */
export const applyHostOverride = (
  snapshot: RuntimeSnapshot | null,
  pause: HostProtectionPause,
): RuntimeSnapshot | null => {
  if (!pause.workerTest) return null;
  if (!snapshot) return snapshot;
  return pause.workerTest === "service-worker"
    ? {
        ...snapshot,
        hostOverrideExpiresAt: pause.expiresAt ?? undefined,
        blockServiceWorkerRegistration: false,
      }
    : {
        ...snapshot,
        hostOverrideExpiresAt: pause.expiresAt ?? undefined,
        sharedWorkerHandlingMode: "native",
        sharedWorkerCompatibilityMode: true,
      };
};
