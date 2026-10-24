import type { XRayLiveReason } from "@privacy-brand/xray-protocol";

import { CMD_XRAY_INSPECTOR_LIVE } from "@/shared/extension-contract";
import type { SpoofingSurfaceMethodId } from "@/shared/types";

/** Trap binding for one document; `m: null` disarms. `r` orders updates. */
export type InspectorLiveCommand = {
  r: number;
  m: readonly SpoofingSurfaceMethodId[] | null;
  e: boolean;
};

/** Sent by the background to one frame; `command: null` only probes the frame. */
export type InspectorLiveMessage = {
  type: typeof CMD_XRAY_INSPECTOR_LIVE;
  opened: boolean;
  command: InspectorLiveCommand | null;
};

export type InspectorLiveFrameResult =
  | { appliedVia: "live"; endpoints: number }
  | { appliedVia: "not-live"; reason: XRayLiveReason; endpoints: number };

const LIVE_REASONS: readonly string[] = [
  "opened-window",
  "same-origin-frame",
  "no-channel",
  "late-runtime",
];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const isLiveCommand = (value: unknown): value is InspectorLiveCommand =>
  isRecord(value) &&
  typeof value.r === "number" &&
  Number.isSafeInteger(value.r) &&
  value.r >= 0 &&
  typeof value.e === "boolean" &&
  (value.m === null ||
    (Array.isArray(value.m) &&
      value.m.length > 0 &&
      value.m.length <= 128 &&
      value.m.every((method) => typeof method === "string" && method.length <= 64)));

export const isInspectorLiveMessage = (value: unknown): value is InspectorLiveMessage =>
  isRecord(value) &&
  value.type === CMD_XRAY_INSPECTOR_LIVE &&
  typeof value.opened === "boolean" &&
  (value.command === null || isLiveCommand(value.command)) &&
  Object.keys(value).length === 3;

export const isLiveFrameResult = (value: unknown): value is InspectorLiveFrameResult =>
  isRecord(value) &&
  typeof value.endpoints === "number" &&
  (value.appliedVia === "live" ||
    (value.appliedVia === "not-live" &&
      typeof value.reason === "string" &&
      LIVE_REASONS.includes(value.reason)));
