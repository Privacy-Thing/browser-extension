import tzLookup from "@photostructure/tz-lookup";

import {
  serializeAcceptLanguage,
  type AcceptLanguagePolicy,
} from "@/shared/accept-language";
import { getRuntimeLocale } from "@/shared/locale-catalog";
import { isSupportedTimeZone } from "@/shared/time-zone-validation";
import type { Location } from "@/shared/types";

export type RegionalProfile = Pick<
  Location,
  | "latitude"
  | "longitude"
  | "timeZone"
  | "language"
  | "languages"
  | "preferEnglishContent"
>;

const canonicalTimeZone = (timeZone: string): string =>
  new Intl.DateTimeFormat("en", { timeZone: timeZone.trim() }).resolvedOptions()
    .timeZone;

/** tz-lookup is approximate, especially at borders. This is advice, never validation. */
export const getSuggestedTimeZone = (
  profile: Pick<RegionalProfile, "latitude" | "longitude" | "timeZone">,
): string | null => {
  if (!isSupportedTimeZone(profile.timeZone)) return null;
  try {
    const suggested = tzLookup(profile.latitude, profile.longitude);
    if (!isSupportedTimeZone(suggested)) return null;
    return canonicalTimeZone(suggested) === canonicalTimeZone(profile.timeZone)
      ? null
      : suggested;
  } catch {
    return null;
  }
};

// Fixed UTC instants make seasonal samples reproducible without changing the draft.
export const REGIONAL_SAMPLE_EPOCHS = [
  Date.UTC(2026, 0, 15, 12, 34, 56),
  Date.UTC(2026, 6, 15, 12, 34, 56),
] as const;
export const REGIONAL_SAMPLE_NUMBER = 1234567.89;

export const buildRegionalPreview = (
  profile: Pick<
    RegionalProfile,
    "timeZone" | "language" | "languages" | "preferEnglishContent"
  >,
  policy: AcceptLanguagePolicy,
) => {
  if (!isSupportedTimeZone(profile.timeZone)) return null;
  const locale = getRuntimeLocale(profile);
  const formattingLanguages = [...(locale.formattingLanguages ?? locale.languages)];
  try {
    const date = new Intl.DateTimeFormat(formattingLanguages, {
      timeZone: profile.timeZone.trim(),
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
      timeZoneName: "short",
    });
    const number = new Intl.NumberFormat(formattingLanguages);
    return {
      ...locale,
      acceptLanguage: serializeAcceptLanguage(locale.languages, policy),
      timeZone: profile.timeZone.trim(),
      resolvedFormattingLocale: date.resolvedOptions().locale,
      dates: REGIONAL_SAMPLE_EPOCHS.map((epoch) => date.format(epoch)),
      number: number.format(REGIONAL_SAMPLE_NUMBER),
    };
  } catch {
    return null;
  }
};
