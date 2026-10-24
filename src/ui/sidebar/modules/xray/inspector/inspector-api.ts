import {
  CMD_XRAY_CLEAR_INSPECTOR,
  CMD_XRAY_GET_INSPECTOR_STATE,
  CMD_XRAY_SET_INSPECTOR,
  XRayLiveCoverageSchema,
  type SpoofingSurfaceMethodId,
  type XRayInspectorApply,
  type XRayInspectorAppliedVia,
  type XRayInspectorApplyResult,
  type XRayInspectorCommand,
  type XRayInspectorMode,
  type XRayInspectorState,
  type XRayInspectorUnavailableReason,
} from "@privacy-brand/xray-protocol";

import { sendMessageOrThrow } from "@/ui/shared/runtime-messaging";

export interface InspectorApi {
  get: (tabId: number) => Promise<XRayInspectorState>;
  set: (request: {
    tabId: number;
    methodIds: readonly string[];
    mode: XRayInspectorMode;
    apply: XRayInspectorApply;
  }) => Promise<XRayInspectorApplyResult>;
  clear: (request: {
    tabId: number;
    apply: XRayInspectorApply;
  }) => Promise<XRayInspectorApplyResult>;
  /** Reloads the tab so documents a live update could not reach apply it. */
  reload: (tabId: number) => Promise<void>;
}

/** Thrown when the background does not implement the Inspector commands. */
export class InspectorMissingError extends Error {
  constructor() {
    super("X-Ray Inspector commands are not available.");
    this.name = "InspectorMissingError";
  }
}

export const unavailableInspector = (
  reason: XRayInspectorUnavailableReason,
): XRayInspectorState => ({
  available: false,
  unavailableReason: reason,
  armed: false,
  methodIds: [],
  mode: "first-call",
  pendingReload: false,
  appliesLive: false,
  trappableMethodIds: [],
});

const UNAVAILABLE_REASONS: readonly XRayInspectorUnavailableReason[] = [
  "unsupported-url",
  "trusted-site",
  "protection-paused",
  "no-runtime",
];
const MODES: readonly XRayInspectorMode[] = ["first-call", "every-call"];
const APPLIED_VIA: readonly XRayInspectorAppliedVia[] = ["live", "reload", "next-load"];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

export const parseInspectorState = (value: unknown): XRayInspectorState | null => {
  if (!isRecord(value)) return null;
  const {
    available,
    unavailableReason,
    armed,
    methodIds,
    mode,
    pendingReload,
    appliesLive,
    trappableMethodIds,
  } = value;
  if (
    typeof available !== "boolean" ||
    typeof armed !== "boolean" ||
    !isStringArray(methodIds) ||
    !MODES.includes(mode as XRayInspectorMode) ||
    typeof pendingReload !== "boolean" ||
    typeof appliesLive !== "boolean" ||
    !isStringArray(trappableMethodIds)
  ) {
    return null;
  }
  const reason = UNAVAILABLE_REASONS.find(
    (candidate) => candidate === unavailableReason,
  );
  return {
    available,
    ...(reason ? { unavailableReason: reason } : {}),
    armed,
    methodIds,
    mode: mode as XRayInspectorMode,
    pendingReload,
    appliesLive,
    trappableMethodIds,
  };
};

const parseCommandResult = (value: unknown): XRayInspectorApplyResult | null => {
  if (!isRecord(value)) return null;
  const state = parseInspectorState(value.state);
  const appliedVia = APPLIED_VIA.find((candidate) => candidate === value.appliedVia);
  if (!state || !appliedVia) return null;
  const coverage = XRayLiveCoverageSchema.safeParse(value.liveCoverage);
  return {
    state,
    appliedVia,
    ...(coverage.success ? { liveCoverage: coverage.data } : {}),
  };
};

// Chromium rejects with these messages when no listener answers a command;
// Firefox resolves `undefined`, which fails shape parsing below. Both mean the
// background does not know the command.
const MISSING_RECEIVER_PATTERN =
  /message port closed|receiving end does not exist|could not establish connection/i;

const send = async (command: XRayInspectorCommand): Promise<unknown> => {
  let response: unknown;
  try {
    response = await sendMessageOrThrow<unknown>(command);
  } catch (error) {
    if (error instanceof Error && MISSING_RECEIVER_PATTERN.test(error.message)) {
      throw new InspectorMissingError();
    }
    throw error;
  }
  if (isRecord(response) && response.ok === false) {
    throw new Error(
      typeof response.error === "string" ? response.error : "Inspector request failed.",
    );
  }
  return response;
};

const sendCommand = async (
  command: XRayInspectorCommand,
): Promise<XRayInspectorApplyResult> => {
  const result = parseCommandResult(await send(command));
  if (!result) throw new InspectorMissingError();
  return result;
};

/** Talks to the background through the regular extension command channel. */
export const createInspectorApi = (): InspectorApi => ({
  get: async (tabId) => {
    try {
      const state = parseInspectorState(
        await send({ type: CMD_XRAY_GET_INSPECTOR_STATE, tabId }),
      );
      return state ?? unavailableInspector("no-runtime");
    } catch (error) {
      if (error instanceof InspectorMissingError) {
        return unavailableInspector("no-runtime");
      }
      throw error;
    }
  },
  set: ({ tabId, methodIds, mode, apply }) =>
    sendCommand({
      type: CMD_XRAY_SET_INSPECTOR,
      tabId,
      // The background validates every ID against the catalog.
      methodIds: [...methodIds] as SpoofingSurfaceMethodId[],
      mode,
      apply,
    }),
  clear: ({ tabId, apply }) =>
    sendCommand({ type: CMD_XRAY_CLEAR_INSPECTOR, tabId, apply }),
  reload: (tabId) => chrome.tabs.reload(tabId),
});
