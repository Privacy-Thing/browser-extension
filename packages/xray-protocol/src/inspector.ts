import { z } from "zod";

import {
  CMD_XRAY_GET_INSPECTOR_STATE,
  CMD_XRAY_SET_INSPECTOR,
  CMD_XRAY_CLEAR_INSPECTOR,
} from "./inspector-commands";
import { SurfaceMethodIdSchema } from "./surface-methods";

export type XRayInspectorMode = "first-call" | "every-call";
export type XRayInspectorAppliedVia = "live" | "reload" | "next-load";
// Stable public protocol spelling.
// eslint-disable-next-line local/max-symbol-name-length
export type XRayInspectorUnavailableReason =
  "unsupported-url" | "trusted-site" | "protection-paused" | "no-runtime";

export interface XRayInspectorState {
  available: boolean;
  unavailableReason?: XRayInspectorUnavailableReason;
  armed: boolean;
  methodIds: readonly string[];
  mode: XRayInspectorMode;
  pendingReload: boolean;
  appliesLive: boolean;
  trappableMethodIds: readonly string[];
}

export {
  CMD_XRAY_GET_INSPECTOR_STATE,
  CMD_XRAY_SET_INSPECTOR,
  CMD_XRAY_CLEAR_INSPECTOR,
} from "./inspector-commands";

const tabId = z.number().int().nonnegative().safe();
const apply = z.enum(["now", "next-load"]);
export const XRayInspectorModeSchema = z.enum(["first-call", "every-call"]);
export const AnalystTrapsSchema = z
  .object({
    methods: z.array(SurfaceMethodIdSchema).min(1).max(128).readonly(),
    mode: XRayInspectorModeSchema,
  })
  .strict();
export type AnalystTraps = z.infer<typeof AnalystTrapsSchema>;

// eslint-disable-next-line local/max-symbol-name-length
export const XRayInspectorCommandSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal(CMD_XRAY_GET_INSPECTOR_STATE), tabId }).strict(),
  z
    .object({
      type: z.literal(CMD_XRAY_SET_INSPECTOR),
      tabId,
      methodIds: z.array(SurfaceMethodIdSchema).min(1).max(128),
      mode: XRayInspectorModeSchema,
      apply,
    })
    .strict(),
  z.object({ type: z.literal(CMD_XRAY_CLEAR_INSPECTOR), tabId, apply }).strict(),
]);
export type XRayInspectorCommand = z.infer<typeof XRayInspectorCommandSchema>;

/** Why a document of the tab receives the selection on its next load instead. */
export const XRayLiveReasonSchema = z.enum([
  "opened-window",
  "same-origin-frame",
  "no-channel",
  "late-runtime",
]);
export type XRayLiveReason = z.infer<typeof XRayLiveReasonSchema>;
export const XRayLiveCoverageSchema = z
  .object({
    live: z.number().int().nonnegative(),
    notLive: z.number().int().nonnegative(),
    reasons: z.array(XRayLiveReasonSchema).readonly(),
  })
  .strict();
export type XRayLiveCoverage = z.infer<typeof XRayLiveCoverageSchema>;

export type XRayInspectorApplyResult = {
  state: XRayInspectorState;
  appliedVia: XRayInspectorAppliedVia;
  /** Present when a live update was attempted; counts documents of the tab. */
  liveCoverage?: XRayLiveCoverage;
};
