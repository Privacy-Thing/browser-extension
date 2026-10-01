export class InvalidTimeZoneError extends Error {}

/** Settings/background validation only; never construct Intl in injected paths. */
const supportCache = new Map<string, boolean>();
const MAX_SUPPORT_CACHE_SIZE = 256;

export const isSupportedTimeZone = (timeZone: string): boolean => {
  const normalized = timeZone.trim();
  if (!normalized) return false;
  const cached = supportCache.get(normalized);
  if (cached !== undefined) return cached;
  let supported: boolean;
  try {
    // supportedValuesOf excludes aliases and UTC in some engines. The native
    // constructor is the authority for what this browser can actually format.
    new Intl.DateTimeFormat("en", { timeZone: normalized });
    supported = true;
  } catch {
    supported = false;
  }
  if (supportCache.size >= MAX_SUPPORT_CACHE_SIZE) supportCache.clear();
  supportCache.set(normalized, supported);
  return supported;
};

export const getProfileTimeZoneError = (profile: {
  id?: string;
  label: string;
  timeZone: string;
}): string | null => {
  if (isSupportedTimeZone(profile.timeZone)) return null;
  const identity = profile.id ? ` (${profile.id})` : "";
  return `Profile "${profile.label}"${identity}: timeZone "${profile.timeZone}" is unsupported. Choose a supported time zone before saving or activating this profile.`;
};
