import type { EXTENSION_COMMAND_TYPES } from "./extension-contract";
/** Exact top-document host exceptions; never a domain rule or a preference. */
export type HostProtectionPause = {
  hostname: string;
  id: string;
  expiresAt: number | null;
};

export type HostPauseStatus = {
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
