import type { FirefoxTimeLocaleState } from "@privacy-brand/refract-browser/common/firefox-shim-state";

import {
  formatOffset,
  getDateLocaleTokens,
  getTimezoneName,
} from "./date-locale-helpers";
import type { DatePrototypeMethods } from "./date-prototype-methods";
import {
  getTimeZoneOffsetMinutes,
  resolveFxDateTimeArgs,
  toAdjustedDate,
} from "./firefox-time-locale";
import {
  createZonedSetters,
  type ZonedDateSetterMethods,
} from "./zoned-date-semantics";

type FxDateMethodsOptions = {
  NativeDate: typeof Date;
  NativeIntlDateTimeFormat: typeof Intl.DateTimeFormat;
  syncBootstrapState: () => void;
  getTimeLocaleState: () => FirefoxTimeLocaleState | null;
};

type FxDateContext = FxDateMethodsOptions & {
  getNativeTime: (date: Date) => number;
  getSyncedState: () => FirefoxTimeLocaleState | null;
  getAdjustedDate: (date: Date) => Date;
  getSetters: () => ZonedDateSetterMethods | null;
  getTokens: (
    date: Date,
    state: FirefoxTimeLocaleState,
  ) => ReturnType<typeof getDateLocaleTokens>;
};

const createFxDateContext = ({
  NativeDate,
  NativeIntlDateTimeFormat,
  syncBootstrapState,
  getTimeLocaleState,
}: FxDateMethodsOptions): FxDateContext => {
  const getNativeTime = (date: Date): number => NativeDate.prototype.getTime.call(date);
  const setNativeTime = (date: Date, epochMs: number): number =>
    NativeDate.prototype.setTime.call(date, epochMs);
  const setterCache = new Map<string, ZonedDateSetterMethods>();
  const getSyncedState = (): FirefoxTimeLocaleState | null => {
    syncBootstrapState();
    return getTimeLocaleState();
  };
  const getAdjustedDate = (date: Date): Date =>
    toAdjustedDate(date, NativeDate, getSyncedState());
  const getSetters = (): ZonedDateSetterMethods | null => {
    const state = getSyncedState();
    if (!state) return null;
    const cached = setterCache.get(state.timeZone);
    if (cached) return cached;
    const setters = createZonedSetters({
      NativeDate,
      DateTimeFormat: NativeIntlDateTimeFormat,
      timeZone: state.timeZone,
      getTime: getNativeTime,
      setTime: setNativeTime,
    });
    setterCache.set(state.timeZone, setters);
    return setters;
  };
  const getTokens = (date: Date, state: FirefoxTimeLocaleState) =>
    getDateLocaleTokens(NativeIntlDateTimeFormat, date, state.timeZone);
  return {
    NativeDate,
    NativeIntlDateTimeFormat,
    syncBootstrapState,
    getTimeLocaleState,
    getNativeTime,
    getSyncedState,
    getAdjustedDate,
    getSetters,
    getTokens,
  };
};

const getFxStringParts = (context: FxDateContext, date: Date) => {
  const state = context.getSyncedState();
  if (Number.isNaN(context.getNativeTime(date)) || !state) return null;
  return {
    tokens: context.getTokens(date, state),
    offsetMinutes: getTimeZoneOffsetMinutes(
      state.timeZone,
      context.getNativeTime(date),
    ),
    timezoneName: getTimezoneName(
      context.NativeIntlDateTimeFormat,
      date,
      state.timeZone,
    ),
  };
};

type FxStringMethods = Pick<
  DatePrototypeMethods,
  | "getTimezoneOffset"
  | "toTimeString"
  | "toDateString"
  | "toString"
  | "toLocaleDateString"
  | "toLocaleTimeString"
  | "toLocaleString"
>;

const createFxStringMethods = (context: FxDateContext): FxStringMethods => {
  const { NativeDate } = context;
  const resolveLocale = (
    locales: Intl.LocalesArgument | undefined,
    options: Intl.DateTimeFormatOptions | undefined,
  ) => resolveFxDateTimeArgs(locales, options, context.getTimeLocaleState());
  return {
    getTimezoneOffset(this: Date): number {
      if (Number.isNaN(context.getNativeTime(this))) {
        return NativeDate.prototype.getTimezoneOffset.call(this);
      }
      const state = context.getSyncedState();
      return state
        ? getTimeZoneOffsetMinutes(state.timeZone, context.getNativeTime(this))
        : NativeDate.prototype.getTimezoneOffset.call(this);
    },
    toTimeString(this: Date): string {
      const parts = getFxStringParts(context, this);
      return parts
        ? `${parts.tokens.time} ${formatOffset(parts.offsetMinutes)} (${parts.timezoneName})`
        : NativeDate.prototype.toTimeString.call(this);
    },
    toDateString(this: Date): string {
      const state = context.getSyncedState();
      if (!state) return NativeDate.prototype.toDateString.call(this);
      const { weekday, month, day, year } = context.getTokens(this, state);
      return `${weekday} ${month} ${day} ${year}`;
    },
    toString(this: Date): string {
      const parts = getFxStringParts(context, this);
      if (!parts) return NativeDate.prototype.toString.call(this);
      const { weekday, month, day, year, time } = parts.tokens;
      return `${weekday} ${month} ${day} ${year} ${time} ${formatOffset(parts.offsetMinutes)} (${parts.timezoneName})`;
    },
    toLocaleDateString(this: Date, locales, options): string {
      const args = resolveLocale(locales, options);
      return NativeDate.prototype.toLocaleDateString.call(
        this,
        args.locales,
        args.options,
      );
    },
    toLocaleTimeString(this: Date, locales, options): string {
      const args = resolveLocale(locales, options);
      return NativeDate.prototype.toLocaleTimeString.call(
        this,
        args.locales,
        args.options,
      );
    },
    toLocaleString(this: Date, locales, options): string {
      const args = resolveLocale(locales, options);
      return NativeDate.prototype.toLocaleString.call(this, args.locales, args.options);
    },
  };
};

type FxGetterMethods = Pick<
  DatePrototypeMethods,
  | "getDate"
  | "getDay"
  | "getHours"
  | "getMinutes"
  | "getSeconds"
  | "getMilliseconds"
  | "getMonth"
  | "getFullYear"
  | "getYear"
>;

const createFxGetterMethods = (context: FxDateContext): FxGetterMethods => ({
  getDate(this: Date): number {
    return context.getAdjustedDate(this).getDate();
  },
  getDay(this: Date): number {
    return context.getAdjustedDate(this).getDay();
  },
  getHours(this: Date): number {
    return context.getAdjustedDate(this).getHours();
  },
  getMinutes(this: Date): number {
    return context.getAdjustedDate(this).getMinutes();
  },
  getSeconds(this: Date): number {
    return context.getAdjustedDate(this).getSeconds();
  },
  getMilliseconds(this: Date): number {
    return context.NativeDate.prototype.getMilliseconds.call(this);
  },
  getMonth(this: Date): number {
    return context.getAdjustedDate(this).getMonth();
  },
  getFullYear(this: Date): number {
    return context.getAdjustedDate(this).getFullYear();
  },
  getYear(this: Date): number {
    const year = context.getAdjustedDate(this).getFullYear();
    return Number.isNaN(year) ? Number.NaN : year - 1900;
  },
});

const createFxSetterMethods = (context: FxDateContext): ZonedDateSetterMethods => ({
  setFullYear(this: Date, ...args: [number, number?, number?]): number {
    return (
      context.getSetters()?.setFullYear.apply(this, args) ??
      context.NativeDate.prototype.setFullYear.apply(this, args)
    );
  },
  setMonth(this: Date, ...args: [number, number?]): number {
    return (
      context.getSetters()?.setMonth.apply(this, args) ??
      context.NativeDate.prototype.setMonth.apply(this, args)
    );
  },
  setDate(this: Date, ...args: [number]): number {
    return (
      context.getSetters()?.setDate.apply(this, args) ??
      context.NativeDate.prototype.setDate.apply(this, args)
    );
  },
  setHours(this: Date, ...args: [number, number?, number?, number?]): number {
    return (
      context.getSetters()?.setHours.apply(this, args) ??
      context.NativeDate.prototype.setHours.apply(this, args)
    );
  },
  setMinutes(this: Date, ...args: [number, number?, number?]): number {
    return (
      context.getSetters()?.setMinutes.apply(this, args) ??
      context.NativeDate.prototype.setMinutes.apply(this, args)
    );
  },
  setSeconds(this: Date, ...args: [number, number?]): number {
    return (
      context.getSetters()?.setSeconds.apply(this, args) ??
      context.NativeDate.prototype.setSeconds.apply(this, args)
    );
  },
  setMilliseconds(this: Date, ...args: [number]): number {
    return (
      context.getSetters()?.setMilliseconds.apply(this, args) ??
      context.NativeDate.prototype.setMilliseconds.apply(this, args)
    );
  },
  setYear(this: Date, ...args: [number]): number {
    return (
      context.getSetters()?.setYear.apply(this, args) ??
      (
        context.NativeDate.prototype as Date & { setYear(year: number): number }
      ).setYear.apply(this, args)
    );
  },
});

export const createFxDateMethods = (
  options: FxDateMethodsOptions,
): DatePrototypeMethods => {
  const context = createFxDateContext(options);
  return {
    ...createFxStringMethods(context),
    ...createFxGetterMethods(context),
    ...createFxSetterMethods(context),
  };
};
