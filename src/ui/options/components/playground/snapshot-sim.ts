import {
  detectLanguagePolicy,
  serializeAcceptLanguage,
} from "@/shared/accept-language";
import { getTimeZoneOffsetMinutes } from "@/shared/time-zone-offset";
import type { BrowserFingerprint, RuntimeSnapshot } from "@/shared/types";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type SpoofedDateValues = {
  getTimezoneOffset: () => number;
  toString: () => string;
  toDateString: () => string;
  toTimeString: () => string;
  toLocaleString: () => string;
  toLocaleDateString: () => string;
  toLocaleTimeString: () => string;
};

export type SpoofedLocaleValues = {
  language: string;
  languages: readonly string[];
  timeZone: string;
  acceptLanguage: string;
};

export type SpoofedGeoValues = {
  latitude: number;
  longitude: number;
  accuracy: number;
  noiseRadius: number;
};

export type SpoofedRuntime = {
  locale: SpoofedLocaleValues;
  date: SpoofedDateValues;
  geo: SpoofedGeoValues;
  fingerprint?: BrowserFingerprint;
};

export type SystemValues = {
  language: string;
  languages: readonly string[];
  timeZone: string;
  acceptLanguage: string;
  dateString: string;
  dateToDateString: string;
  dateToTimeString: string;
  dateLocaleString: string;
  dateLocaleDateString: string;
  dateLocaleTimeString: string;
  timezoneOffset: number;
};

// ---------------------------------------------------------------------------
// Private helpers — logic copied from installDatePatch in early-runtime.ts
// ---------------------------------------------------------------------------

/**
 * Formats a timezone offset (as returned by `getTimezoneOffset()`) into the
 * GMT±HHMM string used in Date.prototype.toString / toTimeString.
 *
 * Sign convention matches the JS spec: `getTimezoneOffset()` is positive when
 * behind UTC (e.g. +300 for New York EST → "GMT-0500"), and negative when
 * ahead of UTC (e.g. -540 for Tokyo → "GMT+0900").
 */
const formatOffset = (offsetMinutes: number): string => {
  const min = Math.abs(offsetMinutes);
  const hours = Math.floor(min / 60)
    .toString()
    .padStart(2, "0");
  const minutes = (min % 60).toString().padStart(2, "0");
  const sign = offsetMinutes > 0 ? "-" : "+";
  return `GMT${sign}${hours}${minutes}`;
};

/**
 * Resolves the long-form IANA timezone display name for the given Date and
 * timezone identifier (e.g. "Japan Standard Time" for Asia/Tokyo).
 */
const getTimezoneName = (date: Date, timeZone: string): string => {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      timeZoneName: "long",
    }).formatToParts(date);
    return parts.find((p) => p.type === "timeZoneName")?.value ?? timeZone;
  } catch {
    return timeZone;
  }
};

/**
 * Breaks `realDate` into weekday / month / day / year / time tokens formatted
 * according to `timeZone`. The runtime and simulator both keep the native
 * epoch, so no timezone-offset arithmetic is performed here.
 *
 * The "24" hour value produced by some Intl implementations is normalised to
 * "00" to match V8 / SpiderMonkey native Date behaviour.
 */
const getTokens = (realDate: Date, timeZone: string) => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(realDate);

  const map = new Map(parts.map((p) => [p.type, p.value]));
  const hour = map.get("hour") === "24" ? "00" : map.get("hour");

  return {
    weekday: map.get("weekday"),
    month: map.get("month"),
    day: map.get("day"),
    year: map.get("year"),
    time: `${hour}:${map.get("minute")}:${map.get("second")}`,
  };
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Creates a live spoofed-runtime view that mirrors what `installDatePatch` in
 * `src/injection/main/early-runtime.ts` would cause each patched browser API
 * to return, but **without touching any global prototype or constructor**.
 *
 * `Date.now()` and Date instances keep the true epoch. The profile timezone is
 * applied only while reading local calendar fields or formatting strings,
 * which is exactly what this simulator does.
 *
 * ### Liveness
 *
 * Each method call re-evaluates `Date.now()` via `getRealDate()`, so the
 * values returned stay current as time advances — there is no snapshot of the
 * moment at which `createSpoofedRuntime` was called.
 */
export const createSpoofedRuntime = (snapshot: RuntimeSnapshot): SpoofedRuntime => {
  if (!snapshot.geo || !snapshot.locale || !snapshot.date) {
    throw new Error("Playground preview requires runtime location data.");
  }

  const { locale } = snapshot;
  const { timeZone } = locale;
  const formattingLanguages = locale.formattingLanguages ?? locale.languages;

  /** Always reflects the true wall-clock instant at the moment of the call. */
  const getRealDate = (): Date => new Date(Date.now());

  return {
    locale: {
      language: locale.language,
      languages: locale.languages,
      timeZone: locale.timeZone,
      acceptLanguage: locale.acceptLanguage,
    },

    date: {
      getTimezoneOffset: () => getTimeZoneOffsetMinutes(timeZone, Date.now()),

      toString: () => {
        const realDate = getRealDate();
        const t = getTokens(realDate, timeZone);
        const offset = getTimeZoneOffsetMinutes(timeZone, Date.now());
        return (
          `${t.weekday} ${t.month} ${t.day} ${t.year} ${t.time} ` +
          `${formatOffset(offset)} (${getTimezoneName(realDate, timeZone)})`
        );
      },

      toDateString: () => {
        const t = getTokens(getRealDate(), timeZone);
        return `${t.weekday} ${t.month} ${t.day} ${t.year}`;
      },

      toTimeString: () => {
        const realDate = getRealDate();
        const t = getTokens(realDate, timeZone);
        const offset = getTimeZoneOffsetMinutes(timeZone, Date.now());
        return `${t.time} ${formatOffset(offset)} (${getTimezoneName(realDate, timeZone)})`;
      },

      toLocaleString: () =>
        new Intl.DateTimeFormat([...formattingLanguages], {
          timeZone,
          year: "numeric",
          month: "numeric",
          day: "numeric",
          hour: "numeric",
          minute: "numeric",
          second: "numeric",
        }).format(new Date(Date.now())),

      toLocaleDateString: () =>
        new Intl.DateTimeFormat([...formattingLanguages], {
          timeZone,
          year: "numeric",
          month: "numeric",
          day: "numeric",
        }).format(new Date(Date.now())),

      toLocaleTimeString: () =>
        new Intl.DateTimeFormat([...formattingLanguages], {
          timeZone,
          hour: "numeric",
          minute: "numeric",
          second: "numeric",
        }).format(new Date(Date.now())),
    },

    geo: {
      latitude: snapshot.geo.latitude,
      longitude: snapshot.geo.longitude,
      accuracy: snapshot.geo.accuracy,
      noiseRadius: snapshot.geo.noiseRadius,
    },
    ...(snapshot.fingerprint ? { fingerprint: snapshot.fingerprint } : {}),
  };
};

/**
 * Reads the current real (un-spoofed) browser environment values.
 * Requires access to `navigator` — throws in non-browser contexts such as a
 * pure Node.js test runner without jsdom.
 */
export const getSystemValues = (): SystemValues => {
  const now = new Date();
  const browserNavigator = navigator as Navigator;
  const languages = [...browserNavigator.languages];

  return {
    language: browserNavigator.language,
    languages,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    acceptLanguage: serializeAcceptLanguage(
      languages,
      detectLanguagePolicy(browserNavigator),
    ),
    dateString: now.toString(),
    dateToDateString: now.toDateString(),
    dateToTimeString: now.toTimeString(),
    dateLocaleString: now.toLocaleString(),
    dateLocaleDateString: now.toLocaleDateString(),
    dateLocaleTimeString: now.toLocaleTimeString(),
    timezoneOffset: now.getTimezoneOffset(),
  };
};
