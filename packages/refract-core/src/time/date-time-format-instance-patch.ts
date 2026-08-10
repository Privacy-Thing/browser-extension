export type DateTimeNormalize = (
  value: Date | number | undefined,
) => Date | number | undefined;

export type DateTimeMaskNative = <TFunction extends Function>(
  fn: TFunction,
  source?: string,
  length?: number,
) => TFunction;

export type DateTimeInstanceOptions = {
  instance: Intl.DateTimeFormat;
  nativeFormat?: ((value?: Date | number) => string) | undefined;
  nativeFormatToParts: (value?: Date | number) => Intl.DateTimeFormatPart[];
  nativeFormatRange?:
    ((startDate: Date | number, endDate: Date | number) => string) | undefined;
  nativeFormatRangeToParts?:
    | ((
        startDate: Date | number,
        endDate: Date | number,
      ) => Intl.DateTimeRangeFormatPart[])
    | undefined;
  normalizeValue: DateTimeNormalize;
  maskAsNative: DateTimeMaskNative;
};

export const patchDateTimeInstance = ({
  instance,
  nativeFormat,
  nativeFormatToParts,
  nativeFormatRange,
  nativeFormatRangeToParts,
  normalizeValue,
  maskAsNative,
}: DateTimeInstanceOptions): void => {
  Object.defineProperties(instance, {
    ...(nativeFormat
      ? {
          format: {
            configurable: true,
            value: maskAsNative((value?: Date | number) =>
              nativeFormat(normalizeValue(value)),
            ),
          },
        }
      : {}),
    formatToParts: {
      configurable: true,
      value: maskAsNative((value?: Date | number) =>
        nativeFormatToParts(normalizeValue(value)),
      ),
    },
  });

  if (nativeFormatRange) {
    Object.defineProperty(instance, "formatRange", {
      configurable: true,
      value: maskAsNative((startDate: Date | number, endDate: Date | number) =>
        nativeFormatRange(
          normalizeValue(startDate) as Date | number,
          normalizeValue(endDate) as Date | number,
        ),
      ),
    });
  }

  if (nativeFormatRangeToParts) {
    Object.defineProperty(instance, "formatRangeToParts", {
      configurable: true,
      value: maskAsNative((startDate: Date | number, endDate: Date | number) =>
        nativeFormatRangeToParts(
          normalizeValue(startDate) as Date | number,
          normalizeValue(endDate) as Date | number,
        ),
      ),
    });
  }
};

export const DATE_TIME_PATCH_SOURCE = `
  const patchDateTimeInstance = ({
    instance,
    nativeFormat,
    nativeFormatToParts,
    nativeFormatRange,
    nativeFormatRangeToParts,
    normalizeValue,
    maskAsNative
  }) => {
    Object.defineProperties(instance, {
      ...(nativeFormat
        ? {
            format: {
              configurable: true,
              value: maskAsNative((value) => nativeFormat(normalizeValue(value)))
            }
          }
        : {}),
      formatToParts: {
        configurable: true,
        value: maskAsNative((value) => nativeFormatToParts(normalizeValue(value)))
      }
    });

    if (nativeFormatRange) {
      Object.defineProperty(instance, "formatRange", {
        configurable: true,
        value: maskAsNative((startDate, endDate) =>
          nativeFormatRange(normalizeValue(startDate), normalizeValue(endDate))
        )
      });
    }

    if (nativeFormatRangeToParts) {
      Object.defineProperty(instance, "formatRangeToParts", {
        configurable: true,
        value: maskAsNative((startDate, endDate) =>
          nativeFormatRangeToParts(normalizeValue(startDate), normalizeValue(endDate))
        )
      });
    }
  };
`;
