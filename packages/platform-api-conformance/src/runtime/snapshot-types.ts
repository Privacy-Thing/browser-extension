import type { ProbeResults, RuntimeSnapshot } from "../types.js";

export type BrowserSnapshotPair = {
  vanilla: RuntimeSnapshot;
  spoofed: RuntimeSnapshot;
  vanillaProbes: ProbeResults;
  spoofedProbes: ProbeResults;
};

export type SnapshotResult = {
  chromium: BrowserSnapshotPair;
  firefox?: BrowserSnapshotPair;
};

export type CaptureResult = {
  descriptors: RuntimeSnapshot;
  probes: ProbeResults;
};
