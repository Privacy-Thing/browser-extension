import type { GetXRayStateResponse } from "@privacy-brand/xray-protocol";

import { unavailableInspector } from "../modules/xray/inspector/inspector-api";
import type {
  XRayInspectorState,
  XRayInspectorUnavailableReason,
} from "../modules/xray/inspector/inspector-contract";

import { createXRayStoryState } from "./xray-story-fixtures";

import { buildSurfaceAssessments } from "@/background/surface-assessments";
import {
  SPOOFING_SURFACE_METHODS,
  type SurfaceMethodQueryCounts,
} from "@/shared/spoofing-surfaces";

export const INSPECTOR_STORY_PRESETS = [
  "idle",
  "live",
  "armed",
  "pending-reload",
  "error",
  "slow",
  "unsupported-url",
  "trusted-site",
  "protection-paused",
  "no-runtime",
] as const;

export type InspectorStoryPreset = (typeof INSPECTOR_STORY_PRESETS)[number];

const PAGE_METHOD_COUNTS: SurfaceMethodQueryCounts = {
  "battery.manager.level": 4,
  "battery.getBattery": 1,
  "date.now": 128,
  "intl.resolvedOptions": 3,
  "canvas.toDataURL": 2,
  "canvas.getImageData": 2,
  "webGL.getParameter": 3,
  "navigator.hardwareConcurrency": 1,
};

/** The rule in these stories leaves Screen and Temporal native, so those rows stay disabled. */
export const STORY_TRAPPABLE_IDS = SPOOFING_SURFACE_METHODS.filter(
  (method) => method.surfaceKey !== "screen" && !method.id.startsWith("temporal."),
).map((method) => method.id);

export const createInspectorXRayState = (): GetXRayStateResponse => {
  const state = createXRayStoryState("active");
  if (!state.ok || !state.snapshot) return state;
  const snapshot = {
    ...state.snapshot,
    fingerprint: {
      ...state.snapshot.fingerprint,
      spoofingToggles: { screen: false },
    },
  };
  const accessedCategories = {
    ...state.accessedCategories,
    battery: true as const,
    timeLocale: true as const,
  };
  return {
    ...state,
    snapshot,
    accessedCategories,
    methodCounts: PAGE_METHOD_COUNTS,
    assessments: buildSurfaceAssessments({
      source: "site-rule",
      snapshot,
      runtimeExpected: true,
      accessedCategories,
      queryCounts: { ...state.queryCounts, battery: 5, timeLocale: 131 },
      methodCounts: PAGE_METHOD_COUNTS,
    }),
  };
};

const readyState = (
  overrides: Partial<XRayInspectorState> = {},
): XRayInspectorState => ({
  available: true,
  armed: false,
  methodIds: [],
  mode: "first-call",
  pendingReload: false,
  appliesLive: false,
  trappableMethodIds: STORY_TRAPPABLE_IDS,
  ...overrides,
});

const UNAVAILABLE_PRESETS: readonly InspectorStoryPreset[] = [
  "unsupported-url",
  "trusted-site",
  "protection-paused",
  "no-runtime",
];

export const createInspectorPreset = (
  preset: InspectorStoryPreset,
): XRayInspectorState => {
  if (UNAVAILABLE_PRESETS.includes(preset)) {
    return unavailableInspector(preset as XRayInspectorUnavailableReason);
  }
  switch (preset) {
    case "live":
      return readyState({ appliesLive: true });
    case "armed":
      return readyState({
        armed: true,
        methodIds: ["battery.manager.level", "canvas.toDataURL"],
      });
    case "pending-reload":
      return readyState({
        armed: true,
        methodIds: ["battery.manager.level"],
        pendingReload: true,
      });
    default:
      return readyState();
  }
};
