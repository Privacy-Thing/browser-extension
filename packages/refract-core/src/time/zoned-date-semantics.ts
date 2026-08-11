import {
  getDateParts,
  type DateLocaleParts,
  type DateTimeFormatLike,
} from "./date-locale-helpers";
import { getTimeZoneOffsetMinutes } from "./timezone-offset";

export type ZonedDateFields = Omit<DateLocaleParts, "day"> & {
  milliseconds: number;
};

type NativeDateReaders = {
  getFullYear: (date: Date) => number;
  getMonth: (date: Date) => number;
  getDate: (date: Date) => number;
  getHours: (date: Date) => number;
  getMinutes: (date: Date) => number;
  getSeconds: (date: Date) => number;
  getMilliseconds: (date: Date) => number;
};

export type ZonedDateOptions = {
  NativeDate: typeof Date;
  DateTimeFormat: DateTimeFormatLike;
  timeZone: string;
};

const OFFSET_PROBE_HOURS = [-48, -24, -12, 0, 12, 24, 48] as const;

const getEpochMilliseconds = (epochMs: number): number => {
  const remainder = epochMs % 1000;
  return remainder < 0 ? remainder + 1000 : remainder;
};

const fieldsMatch = (
  actual: DateLocaleParts | null,
  expected: ZonedDateFields,
  epochMs: number,
): boolean =>
  actual !== null &&
  actual.year === expected.year &&
  actual.month === expected.month &&
  actual.date === expected.date &&
  actual.hours === expected.hours &&
  actual.minutes === expected.minutes &&
  actual.seconds === expected.seconds &&
  getEpochMilliseconds(epochMs) === expected.milliseconds;

export const getZonedDateFields = (
  date: Date,
  options: ZonedDateOptions,
  getTime: (date: Date) => number,
): ZonedDateFields | null => {
  const epochMs = getTime(date);
  const parts = getDateParts(options.DateTimeFormat, getTime, date, options.timeZone);
  return parts
    ? {
        year: parts.year,
        month: parts.month,
        date: parts.date,
        hours: parts.hours,
        minutes: parts.minutes,
        seconds: parts.seconds,
        milliseconds: getEpochMilliseconds(epochMs),
      }
    : null;
};

/**
 * Resolves wall-clock fields in an IANA time zone using Temporal/ECMAScript's
 * "compatible" disambiguation: earlier during overlaps and forward by the gap
 * during nonexistent local times.
 */
export const resolveZonedDateFields = (
  fields: ZonedDateFields,
  options: ZonedDateOptions,
): number => {
  const localEpochMs = options.NativeDate.UTC(
    fields.year,
    fields.month,
    fields.date,
    fields.hours,
    fields.minutes,
    fields.seconds,
    fields.milliseconds,
  );
  if (!Number.isFinite(localEpochMs)) {
    return Number.NaN;
  }

  const offsets = new Set<number>();
  for (const hours of OFFSET_PROBE_HOURS) {
    offsets.add(
      getTimeZoneOffsetMinutes(options.timeZone, localEpochMs + hours * 3_600_000),
    );
  }

  const matchingEpochs: number[] = [];
  const getTime = (date: Date): number =>
    options.NativeDate.prototype.getTime.call(date);
  for (const offsetMinutes of offsets) {
    const candidateEpochMs = localEpochMs + offsetMinutes * 60_000;
    const candidate = new options.NativeDate(candidateEpochMs);
    const parts = getDateParts(
      options.DateTimeFormat,
      getTime,
      candidate,
      options.timeZone,
    );
    if (fieldsMatch(parts, fields, candidateEpochMs)) {
      matchingEpochs.push(candidateEpochMs);
    }
  }

  if (matchingEpochs.length > 0) {
    return Math.min(...matchingEpochs);
  }

  // A forward transition has no exact instant for wall times inside the gap.
  // The pre-transition offset is numerically the greatest UTC-local offset;
  // applying it advances the result by the size of the gap.
  return localEpochMs + Math.max(...offsets) * 60_000;
};

const readNormalizedUtcFields = (
  date: Date,
  NativeDate: typeof Date,
): ZonedDateFields => ({
  year: NativeDate.prototype.getUTCFullYear.call(date),
  month: NativeDate.prototype.getUTCMonth.call(date),
  date: NativeDate.prototype.getUTCDate.call(date),
  hours: NativeDate.prototype.getUTCHours.call(date),
  minutes: NativeDate.prototype.getUTCMinutes.call(date),
  seconds: NativeDate.prototype.getUTCSeconds.call(date),
  milliseconds: NativeDate.prototype.getUTCMilliseconds.call(date),
});

const LOCAL_ISO_DATE_TIME =
  /^([+-]\d{6}|\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?(?:\.(\d{1,3}))?$/;

const parseIsoLocalFields = (
  value: string,
  NativeDate: typeof Date,
): ZonedDateFields | null => {
  const match = LOCAL_ISO_DATE_TIME.exec(value);
  if (!match || Number.isNaN(NativeDate.parse(value))) {
    return null;
  }

  const [, year, month, date, hours, minutes = "0", seconds = "0", fraction = "0"] =
    match;
  const normalized = new NativeDate(
    NativeDate.UTC(
      Number(year),
      Number(month) - 1,
      Number(date),
      Number(hours),
      Number(minutes),
      Number(seconds),
      Number(fraction.padEnd(3, "0")),
    ),
  );
  return readNormalizedUtcFields(normalized, NativeDate);
};

const isIsoDateOnly = (value: string): boolean =>
  /^(?:[+-]\d{6}|\d{4})-\d{2}-\d{2}$/.test(value);

const EXPLICIT_ZONE_SUFFIX = /(?:[zZ]|[+-]\d{2}:?\d{2}|[gG][mM][tT][+-]\d{4})$/;

const stripZoneDescription = (value: string): string => {
  if (!value.endsWith(")")) return value;
  const openingParenthesis = value.lastIndexOf("(");
  if (openingParenthesis === -1) return value;
  const description = value.slice(openingParenthesis + 1, -1);
  if (description.includes("(") || description.includes(")")) return value;
  return value.slice(0, openingParenthesis).trimEnd();
};

const hasExplicitTimeZone = (value: string): boolean =>
  EXPLICIT_ZONE_SUFFIX.test(stripZoneDescription(value));

export const isLocalDateString = (value: string): boolean => {
  const trimmed = value.trim();
  return !isIsoDateOnly(trimmed) && !hasExplicitTimeZone(trimmed);
};

const isPrimitive = (value: unknown): boolean =>
  value === null || (typeof value !== "object" && typeof value !== "function");

const toDatePrimitive = (value: unknown): unknown => {
  if (isPrimitive(value)) {
    return value;
  }

  const objectValue = value as Record<PropertyKey, unknown>;
  const exoticToPrimitive = objectValue[Symbol.toPrimitive];
  if (exoticToPrimitive !== undefined) {
    if (typeof exoticToPrimitive !== "function") {
      throw new TypeError("Cannot convert object to primitive value");
    }
    const primitive = Reflect.apply(exoticToPrimitive, value, ["default"]);
    if (!isPrimitive(primitive)) {
      throw new TypeError("Cannot convert object to primitive value");
    }
    return primitive;
  }

  for (const methodName of ["valueOf", "toString"] as const) {
    const method = objectValue[methodName];
    if (typeof method !== "function") {
      continue;
    }
    const primitive = Reflect.apply(method, value, []);
    if (isPrimitive(primitive)) {
      return primitive;
    }
  }

  throw new TypeError("Cannot convert object to primitive value");
};

export const parseZonedDateValue = (
  value: unknown,
  options: ZonedDateOptions,
  nativeReaders: NativeDateReaders,
): number => {
  if (typeof value === "symbol") {
    return options.NativeDate.parse(value as never);
  }

  const stringValue = String(value);
  const parsed = parseZonedDateString(stringValue, options, nativeReaders);
  return parsed ?? options.NativeDate.parse(stringValue);
};

export const parseZonedDateString = (
  value: string,
  options: ZonedDateOptions,
  nativeReaders: NativeDateReaders,
): number | null => {
  const trimmed = value.trim();
  if (!isLocalDateString(trimmed)) {
    return null;
  }

  const nativeEpochMs = options.NativeDate.parse(trimmed);
  if (Number.isNaN(nativeEpochMs)) {
    return Number.NaN;
  }

  const isoFields = parseIsoLocalFields(trimmed, options.NativeDate);
  if (isoFields) {
    return resolveZonedDateFields(isoFields, options);
  }

  const nativeDate = new options.NativeDate(nativeEpochMs);
  return resolveZonedDateFields(
    {
      year: nativeReaders.getFullYear(nativeDate),
      month: nativeReaders.getMonth(nativeDate),
      date: nativeReaders.getDate(nativeDate),
      hours: nativeReaders.getHours(nativeDate),
      minutes: nativeReaders.getMinutes(nativeDate),
      seconds: nativeReaders.getSeconds(nativeDate),
      milliseconds: nativeReaders.getMilliseconds(nativeDate),
    },
    options,
  );
};

export const createNativeDateReaders = (NativeDate: typeof Date): NativeDateReaders => {
  const {
    getFullYear,
    getMonth,
    getDate,
    getHours,
    getMinutes,
    getSeconds,
    getMilliseconds,
  } = NativeDate.prototype;
  return {
    getFullYear: (date) => getFullYear.call(date),
    getMonth: (date) => getMonth.call(date),
    getDate: (date) => getDate.call(date),
    getHours: (date) => getHours.call(date),
    getMinutes: (date) => getMinutes.call(date),
    getSeconds: (date) => getSeconds.call(date),
    getMilliseconds: (date) => getMilliseconds.call(date),
  };
};

export const constructZonedDate = (
  args: readonly unknown[],
  options: ZonedDateOptions,
  nativeReaders: NativeDateReaders,
): Date => {
  if (args.length === 0) {
    return new options.NativeDate(options.NativeDate.now());
  }

  if (args.length === 1) {
    const [value] = args;
    if (value !== null && (typeof value === "object" || typeof value === "function")) {
      try {
        return new options.NativeDate(options.NativeDate.prototype.getTime.call(value));
      } catch {
        // Values without [[DateValue]] follow the normal ToPrimitive path.
      }
    }

    const primitive = toDatePrimitive(value);
    if (typeof primitive === "string") {
      const parsed = parseZonedDateString(primitive, options, nativeReaders);
      if (parsed !== null) {
        return new options.NativeDate(parsed);
      }
    }
    return Reflect.construct(options.NativeDate, [primitive]) as Date;
  }

  const normalizedEpochMs = Reflect.apply(
    options.NativeDate.UTC,
    options.NativeDate,
    args,
  ) as number;
  if (Number.isNaN(normalizedEpochMs)) {
    return new options.NativeDate(Number.NaN);
  }

  return new options.NativeDate(
    resolveZonedDateFields(
      readNormalizedUtcFields(
        new options.NativeDate(normalizedEpochMs),
        options.NativeDate,
      ),
      options,
    ),
  );
};

export type ZonedDateSetterMethods = {
  setFullYear(this: Date, year: number, month?: number, date?: number): number;
  setMonth(this: Date, month: number, date?: number): number;
  setDate(this: Date, date: number): number;
  setHours(
    this: Date,
    hours: number,
    minutes?: number,
    seconds?: number,
    ms?: number,
  ): number;
  setMinutes(this: Date, minutes: number, seconds?: number, ms?: number): number;
  setSeconds(this: Date, seconds: number, ms?: number): number;
  setMilliseconds(this: Date, ms: number): number;
  setYear(this: Date, year: number): number;
};

type ZonedDateSettersOptions = ZonedDateOptions & {
  getTime: (date: Date) => number;
  setTime: (date: Date, epochMs: number) => number;
  logger?: (method: string, args: unknown[], result?: unknown) => void;
};

type UtcSetterName =
  | "setUTCFullYear"
  | "setUTCMonth"
  | "setUTCDate"
  | "setUTCHours"
  | "setUTCMinutes"
  | "setUTCSeconds"
  | "setUTCMilliseconds";

export const createZonedSetters = (
  options: ZonedDateSettersOptions,
): ZonedDateSetterMethods => {
  const applySetter = (
    receiver: Date,
    method: UtcSetterName,
    args: unknown[],
    recoverInvalid = false,
  ): number => {
    const currentFields = getZonedDateFields(receiver, options, options.getTime);
    if (!currentFields && !recoverInvalid) {
      const result = options.setTime(receiver, Number.NaN);
      options.logger?.(method.replace("UTC", ""), args, result);
      return result;
    }

    const scratch = currentFields
      ? new options.NativeDate(
          options.NativeDate.UTC(
            currentFields.year,
            currentFields.month,
            currentFields.date,
            currentFields.hours,
            currentFields.minutes,
            currentFields.seconds,
            currentFields.milliseconds,
          ),
        )
      : new options.NativeDate(Number.NaN);
    const setter = options.NativeDate.prototype[method] as (
      ...values: unknown[]
    ) => number;
    const normalizedEpochMs = Reflect.apply(setter, scratch, args);
    const methodName = method.replace("UTC", "");
    if (Number.isNaN(normalizedEpochMs)) {
      const result = options.setTime(receiver, Number.NaN);
      options.logger?.(methodName, args, result);
      return result;
    }

    const epochMs = resolveZonedDateFields(
      readNormalizedUtcFields(scratch, options.NativeDate),
      options,
    );
    const result = options.setTime(receiver, epochMs);
    options.logger?.(methodName, args, result);
    return result;
  };

  return {
    setFullYear(this: Date, ...args: [number, number?, number?]): number {
      return applySetter(this, "setUTCFullYear", args, true);
    },
    setMonth(this: Date, ...args: [number, number?]): number {
      return applySetter(this, "setUTCMonth", args);
    },
    setDate(this: Date, ...args: [number]): number {
      return applySetter(this, "setUTCDate", args);
    },
    setHours(this: Date, ...args: [number, number?, number?, number?]): number {
      return applySetter(this, "setUTCHours", args);
    },
    setMinutes(this: Date, ...args: [number, number?, number?]): number {
      return applySetter(this, "setUTCMinutes", args);
    },
    setSeconds(this: Date, ...args: [number, number?]): number {
      return applySetter(this, "setUTCSeconds", args);
    },
    setMilliseconds(this: Date, ...args: [number]): number {
      return applySetter(this, "setUTCMilliseconds", args);
    },
    setYear(this: Date, year: number): number {
      const numericYear = Number(year);
      const normalizedYear =
        numericYear >= 0 && numericYear <= 99 ? numericYear + 1900 : numericYear;
      const result = applySetter(this, "setUTCFullYear", [normalizedYear], true);
      options.logger?.("setYear", [year], result);
      return result;
    },
  };
};
