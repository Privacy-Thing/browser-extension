import type {
  SurfaceOverrides,
  SharedWorkerHandlingMode,
} from "@/shared/fingerprint-types";

/**
 * Maps the popup's boolean "block service workers" toggle onto the
 * `serviceWorker` surface override: `true` force-blocks; `false` clears the
 * override so the rule inherits the global default. Returns `undefined` when no
 * overrides remain so callers can omit the key entirely.
 */
export const applyServiceWorkerBlock = (
  overrides: SurfaceOverrides | undefined,
  block: boolean,
): SurfaceOverrides | undefined => {
  const next = { ...(overrides ?? {}) } as Record<string, boolean | undefined>;
  if (block) {
    next.serviceWorker = true;
  } else {
    delete next.serviceWorker;
  }
  return Object.keys(next).length > 0 ? (next as SurfaceOverrides) : undefined;
};

/** Applies the same tri-state override used by the full Options rule editor. */
export const applyServiceWorkerRule = (
  overrides: SurfaceOverrides | undefined,
  override: boolean | undefined,
): SurfaceOverrides | undefined => {
  const next = { ...(overrides ?? {}) } as Record<string, unknown>;
  if (override === undefined) delete next.serviceWorker;
  else next.serviceWorker = override;
  return Object.keys(next).length > 0 ? (next as SurfaceOverrides) : undefined;
};

/** Applies the shared per-rule mode used for Dedicated and Shared Workers. */
export const applyWorkerMode = (
  overrides: SurfaceOverrides | undefined,
  override: SharedWorkerHandlingMode | undefined,
): SurfaceOverrides | undefined => {
  const next = { ...(overrides ?? {}) } as Record<string, unknown>;
  if (override === undefined) delete next.sharedWorker;
  else next.sharedWorker = override;
  return Object.keys(next).length > 0 ? (next as SurfaceOverrides) : undefined;
};

/**
 * Applies the popup's regional-preset choice without disturbing unrelated
 * per-surface overrides. Disabled means neither geo nor time/locale may inherit
 * an active preset; enabled restores inheritance for both surfaces.
 */
export const applyRegionalPreset = (
  overrides: SurfaceOverrides | undefined,
  enabled: boolean | undefined,
): SurfaceOverrides | undefined => {
  if (enabled === undefined) return overrides;

  const next = { ...(overrides ?? {}) } as Record<string, unknown>;
  delete next.geolocation;
  delete next.timeLocale;
  if (!enabled) {
    next.geolocation = false;
    next.timeLocale = false;
  }
  return Object.keys(next).length > 0 ? (next as SurfaceOverrides) : undefined;
};
