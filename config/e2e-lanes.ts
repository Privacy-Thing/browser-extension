export const E2E_OWNERSHIP_LANES = {
  core: ["extension-fingerprint.spec.ts", "extension-runtime.spec.ts"],
  product: [
    "extension-options-locations.spec.ts",
    "extension-options-navigation.spec.ts",
    "extension-options-rules.spec.ts",
    "extension-popup.spec.ts",
    "extension-state.spec.ts",
    "extension-storage-migration.spec.ts",
  ],
  publish: ["extension-notifications-publish.spec.ts"],
  release: [
    "browserleaks-manual.spec.ts",
    "creepjs-diagnostic.spec.ts",
    "google-maps-diagnostic.spec.ts",
    "service-worker-blocking-live.spec.ts",
  ],
  "firefox-runtime": [
    "firefox-runtime-bootstrap-followup.spec.ts",
    "firefox-runtime-bootstrap.spec.ts",
    "firefox-runtime-core.spec.ts",
    "firefox-runtime-edge.spec.ts",
    "firefox-runtime-transport-refresh.spec.ts",
    "firefox-runtime-transport-state.spec.ts",
    "firefox-runtime-transport.spec.ts",
  ],
} as const;

export type E2EOwnershipLane = keyof typeof E2E_OWNERSHIP_LANES;
export type E2EExecutionLane = E2EOwnershipLane;

const publishFiles = [
  ...E2E_OWNERSHIP_LANES.core,
  ...E2E_OWNERSHIP_LANES.product,
  ...E2E_OWNERSHIP_LANES.publish,
];

export const resolveE2ELaneFiles = (lane: E2EExecutionLane): readonly string[] =>
  lane === "publish" ? publishFiles : E2E_OWNERSHIP_LANES[lane];

export const parseE2ELane = (value: string | undefined): E2EExecutionLane => {
  const lane = value?.trim() || "core";
  if (lane === "publish" || lane in E2E_OWNERSHIP_LANES) {
    return lane as E2EExecutionLane;
  }
  throw new Error(
    `Unsupported PT_E2E_LANE=${JSON.stringify(lane)}. Expected core, product, release, publish, or firefox-runtime.`,
  );
};
