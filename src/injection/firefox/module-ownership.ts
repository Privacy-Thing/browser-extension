import type { RefractModuleName } from "@privacy-brand/refract-core/runtime/state";

export type SnapshotSemantics = "install-time" | "live-read" | "explicit-refresh";

export const FIREFOX_EARLY_MODULES = [
  "geolocation",
  "permissions",
  "date-intl",
  "navigator",
  "navigator-fingerprint",
  "client-hints",
  "shared-workers",
  "service-worker-register",
] as const satisfies readonly RefractModuleName[];

export const FIREFOX_MAIN_MODULES = [
  "screen",
  "canvas",
  "webgl",
  "audio",
  "webrtc",
  "dedicated-workers",
  "iframes",
] as const satisfies readonly RefractModuleName[];

/** These modules intentionally exist independently in both bundle closures. */
export const FX_LOCAL_MODULES = [
  "surface-usage",
] as const satisfies readonly RefractModuleName[];

export const FX_SNAPSHOT_SEMANTICS = {
  geolocation: "live-read",
  permissions: "live-read",
  "date-intl": "live-read",
  navigator: "live-read",
  "navigator-fingerprint": "live-read",
  "client-hints": "live-read",
  "shared-workers": "live-read",
  "service-worker-register": "live-read",
  screen: "install-time",
  canvas: "explicit-refresh",
  webgl: "explicit-refresh",
  audio: "install-time",
  webrtc: "install-time",
  "dedicated-workers": "install-time",
  iframes: "install-time",
  "surface-usage": "live-read",
} as const satisfies Record<
  | (typeof FIREFOX_EARLY_MODULES)[number]
  | (typeof FIREFOX_MAIN_MODULES)[number]
  | (typeof FX_LOCAL_MODULES)[number],
  SnapshotSemantics
>;
