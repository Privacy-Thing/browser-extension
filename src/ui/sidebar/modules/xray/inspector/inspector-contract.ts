// Local copy of the X-Ray Inspector contract (PT-73). Replace these types and
// command constants with imports from `@privacy-brand/xray-protocol` once the
// runtime half of the feature lands there; keep the shapes identical until then.

export type XRayInspectorMode = "first-call" | "every-call";
export type XRayInspectorAppliedVia = "live" | "reload" | "next-load";
// eslint-disable-next-line local/max-symbol-name-length -- PT-73 xray-protocol contract name
export type XRayInspectorUnavailableReason =
  "unsupported-url" | "trusted-site" | "protection-paused" | "no-runtime";
export type XRayInspectorApply = "now" | "next-load";

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

// eslint-disable-next-line local/max-symbol-name-length -- PT-73 xray-protocol contract name
export interface XRayInspectorCommandResult {
  state: XRayInspectorState;
  appliedVia: XRayInspectorAppliedVia;
}

// eslint-disable-next-line local/max-symbol-name-length -- PT-73 xray-protocol contract name
export const CMD_XRAY_GET_INSPECTOR_STATE = "pt:xray-get-inspector-state";
export const CMD_XRAY_SET_INSPECTOR = "pt:xray-set-inspector";
export const CMD_XRAY_CLEAR_INSPECTOR = "pt:xray-clear-inspector";

export type XRayInspectorCommand =
  | { type: typeof CMD_XRAY_GET_INSPECTOR_STATE; tabId: number }
  | {
      type: typeof CMD_XRAY_SET_INSPECTOR;
      tabId: number;
      methodIds: readonly string[];
      mode: XRayInspectorMode;
      apply: XRayInspectorApply;
    }
  | { type: typeof CMD_XRAY_CLEAR_INSPECTOR; tabId: number; apply: XRayInspectorApply };
