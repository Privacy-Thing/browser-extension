import type { FirefoxTimeLocaleState } from "@privacy-brand/refract-browser/common/firefox-shim-state";

import { withDefaultLocales, withDefaultTimeZone } from "./intl-defaults";
import { getTimeZoneOffsetMinutes } from "./timezone-offset";

type FxTimezoneOffsetReader = (date: Date) => number;

const hasOnlyDigits = (value: string): boolean =>
  [...value].every((character) => character >= "0" && character <= "9");

const isIsoDateOnly = (value: string): boolean => {
  const parts = value.split("-");
  return (
    parts.length === 3 &&
    parts[0]?.length === 4 &&
    parts[1]?.length === 2 &&
    parts[2]?.length === 2 &&
    parts.every(hasOnlyDigits)
  );
};

const hasExplicitZoneSuffix = (value: string): boolean =>
  /(?:[zZ]|[+-]\d{2}:\d{2}|[+-]\d{4})$/.test(value);

const isIsoDateTimeWithOffset = (value: string): boolean => {
  const separatorIndex = value.indexOf("T");
  if (separatorIndex <= 0) {
    return false;
  }

  const datePart = value.slice(0, separatorIndex);
  if (!isIsoDateOnly(datePart)) {
    return false;
  }

  const timePart = value.slice(separatorIndex + 1);
  return (
    hasExplicitZoneSuffix(timePart) &&
    !Number.isNaN(Date.parse(`1970-01-01T${timePart}`))
  );
};

export const isLocalDateArgs = (args: readonly unknown[]): boolean => {
  if (args.length === 0) {
    return false;
  }

  if (args.length > 1) {
    return true;
  }

  const [firstArg] = args;
  if (firstArg instanceof Date || typeof firstArg === "number") {
    return false;
  }

  if (typeof firstArg === "string") {
    const value = firstArg.trim();
    return !isIsoDateTimeWithOffset(value) && !isIsoDateOnly(value);
  }

  return false;
};

export const toAdjustedDate = (
  date: Date,
  NativeDateCtor: DateConstructor,
  timeLocaleState: FirefoxTimeLocaleState | null,
): Date => {
  const nativeTime = date.getTime();
  if (Number.isNaN(nativeTime)) {
    return new NativeDateCtor("invalid date");
  }

  const offsetDeltaMinutes = getFxOffsetDelta(
    date,
    (currentDate) => NativeDateCtor.prototype.getTimezoneOffset.call(currentDate),
    timeLocaleState,
  );
  return new NativeDateCtor(nativeTime + offsetDeltaMinutes * 60 * 1000);
};

export const getFxOffsetDelta = (
  date: Date,
  getNativeTimezoneOffset: FxTimezoneOffsetReader,
  timeLocaleState: FirefoxTimeLocaleState | null,
): number => {
  const nativeOffset = getNativeTimezoneOffset(date);
  const nativeTime = date.getTime();
  const hasSpoofedTimeLocale = timeLocaleState !== null && !Number.isNaN(nativeTime);
  const spoofedOffset = hasSpoofedTimeLocale
    ? getTimeZoneOffsetMinutes(timeLocaleState.timeZone, nativeTime)
    : nativeOffset;
  return nativeOffset - spoofedOffset;
};

export const adjustLocalDateCtor = (
  date: Date,
  getNativeTimezoneOffset: FxTimezoneOffsetReader,
  timeLocaleState: FirefoxTimeLocaleState | null,
): void => {
  const nativeTime = date.getTime();
  if (Number.isNaN(nativeTime) || !timeLocaleState) {
    return;
  }

  const offsetDeltaMinutes = getFxOffsetDelta(
    date,
    getNativeTimezoneOffset,
    timeLocaleState,
  );
  date.setTime(nativeTime - offsetDeltaMinutes * 60 * 1000);
};

export const resolveFxDateTimeArgs = <TOptions extends Intl.DateTimeFormatOptions>(
  locales: Intl.LocalesArgument | undefined,
  options: TOptions | undefined,
  timeLocaleState: FirefoxTimeLocaleState | null,
): {
  locales: Intl.LocalesArgument | undefined;
  options: TOptions | undefined;
} => ({
  locales: withDefaultLocales(
    locales,
    timeLocaleState
      ? {
          languages: timeLocaleState.formattingLanguages ?? timeLocaleState.languages,
          timeZone: timeLocaleState.timeZone,
        }
      : null,
  ),
  options: withDefaultTimeZone(options, timeLocaleState),
});

export { withDefaultLocales, withDefaultTimeZone, getTimeZoneOffsetMinutes };
