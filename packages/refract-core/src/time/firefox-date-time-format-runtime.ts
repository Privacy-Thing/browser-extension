export type ResolveFxDateTimeArgs = (
  locales: Intl.LocalesArgument | undefined,
  options: Intl.DateTimeFormatOptions | undefined,
) => {
  locales: Intl.LocalesArgument | undefined;
  options: Intl.DateTimeFormatOptions | undefined;
};

export type FxDateTimeRuntimeOptions = {
  NativeIntlDateTimeFormat: typeof Intl.DateTimeFormat;
  nativeFormatGetter?:
    ((this: Intl.DateTimeFormat) => Intl.DateTimeFormat["format"]) | undefined;
  resolveDateTimeArgs: ResolveFxDateTimeArgs;
};

export type FxDateTimeRuntime = {
  trackInstance: (
    instance: object,
    locales: Intl.LocalesArgument | undefined,
    options: Intl.DateTimeFormatOptions | undefined,
  ) => void;
  isTrackedInstance: (instance: object) => boolean;
  resolvedOptions: (
    instance: Intl.DateTimeFormat,
  ) => Intl.ResolvedDateTimeFormatOptions;
  formatToParts: (
    instance: Intl.DateTimeFormat,
    date?: Date | number,
  ) => Intl.DateTimeFormatPart[];
  formatRange: (
    instance: Intl.DateTimeFormat,
    startDate: Date | number,
    endDate: Date | number,
  ) => string;
  formatRangeToParts: (
    instance: Intl.DateTimeFormat,
    startDate: Date | number,
    endDate: Date | number,
  ) => Intl.DateTimeRangeFormatPart[];
  getFormat: (instance: Intl.DateTimeFormat) => Intl.DateTimeFormat["format"];
};

export const createFxDateTimeRuntime = ({
  NativeIntlDateTimeFormat,
  nativeFormatGetter,
  resolveDateTimeArgs,
}: FxDateTimeRuntimeOptions): FxDateTimeRuntime => {
  const requestedLocales = new WeakMap<object, Intl.LocalesArgument | undefined>();
  const requestedOptions = new WeakMap<
    object,
    Intl.DateTimeFormatOptions | undefined
  >();
  const formatWrappers = new WeakMap<object, Intl.DateTimeFormat["format"]>();
  const nativeResolvedOptions = NativeIntlDateTimeFormat.prototype.resolvedOptions;
  const nativeFormatToParts = NativeIntlDateTimeFormat.prototype.formatToParts;
  const nativeFormatRange = NativeIntlDateTimeFormat.prototype.formatRange;
  const nativeFormatRangeToParts =
    NativeIntlDateTimeFormat.prototype.formatRangeToParts;

  const isTrackedInstance = (instance: object): boolean =>
    requestedLocales.has(instance) || requestedOptions.has(instance);

  const getSpoofedFormatter = (instance: object): Intl.DateTimeFormat => {
    const resolvedArgs = resolveDateTimeArgs(
      requestedLocales.get(instance),
      requestedOptions.get(instance),
    );
    return new NativeIntlDateTimeFormat(resolvedArgs.locales, resolvedArgs.options);
  };

  return {
    trackInstance(instance, locales, options) {
      requestedLocales.set(instance, locales);
      requestedOptions.set(instance, options);
    },
    isTrackedInstance,
    resolvedOptions(instance) {
      if (!isTrackedInstance(instance)) {
        return nativeResolvedOptions.call(instance);
      }

      return getSpoofedFormatter(instance).resolvedOptions();
    },
    formatToParts(instance, date) {
      if (!isTrackedInstance(instance)) {
        return nativeFormatToParts.call(instance, date);
      }

      return getSpoofedFormatter(instance).formatToParts(date);
    },
    formatRange(instance, startDate, endDate) {
      if (!isTrackedInstance(instance)) {
        return nativeFormatRange.call(instance, startDate, endDate);
      }

      return getSpoofedFormatter(instance).formatRange(startDate, endDate);
    },
    formatRangeToParts(instance, startDate, endDate) {
      if (!isTrackedInstance(instance)) {
        return nativeFormatRangeToParts.call(instance, startDate, endDate);
      }

      return getSpoofedFormatter(instance).formatRangeToParts(startDate, endDate);
    },
    getFormat(instance) {
      const cached = formatWrappers.get(instance);
      if (cached) {
        return cached;
      }

      if (nativeFormatGetter && !isTrackedInstance(instance)) {
        return Reflect.apply(
          nativeFormatGetter,
          instance,
          [],
        ) as Intl.DateTimeFormat["format"];
      }

      const wrapped = nativeFormatGetter
        ? nativeFormatGetter.call(getSpoofedFormatter(instance))
        : (date?: Date | number) => getSpoofedFormatter(instance).format(date);
      formatWrappers.set(instance, wrapped);
      return wrapped;
    },
  };
};
