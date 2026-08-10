import type { FirefoxTimeLocaleState } from "@privacy-brand/refract-browser/common/firefox-shim-state";

import {
  finalizePatchedCtor,
  type NativeMasker,
  type NativeSourceFactory,
} from "../native/constructor-wiring";

import { createDateMethodDescs } from "./date-prototype-methods";
import { createFxDateMethods } from "./firefox-date-prototype-methods";
import {
  constructZonedDate,
  createNativeDateReaders,
  parseZonedDateValue,
} from "./zoned-date-semantics";

type FxDateCtorOptions = {
  NativeDate: typeof Date;
  NativeIntlDateTimeFormat: typeof Intl.DateTimeFormat;
  syncBootstrapState: () => void;
  getTimeLocaleState: () => FirefoxTimeLocaleState | null;
  maskAsNative: NativeMasker;
  createNativeSource: NativeSourceFactory;
};

export const createPatchedFirefoxDate = ({
  NativeDate,
  NativeIntlDateTimeFormat,
  syncBootstrapState,
  getTimeLocaleState,
  maskAsNative,
  createNativeSource,
}: FxDateCtorOptions): DateConstructor => {
  const nativeReaders = createNativeDateReaders(NativeDate);
  const nativeGetTime = NativeDate.prototype.getTime;

  class SpoofedDate extends NativeDate {
    constructor(...args: ConstructorParameters<typeof Date>) {
      syncBootstrapState();
      const timeLocaleState = getTimeLocaleState();
      const date = timeLocaleState
        ? constructZonedDate(
            args,
            {
              NativeDate,
              DateTimeFormat: NativeIntlDateTimeFormat,
              timeZone: timeLocaleState.timeZone,
            },
            nativeReaders,
          )
        : (Reflect.construct(NativeDate, args) as Date);
      super(Reflect.apply(nativeGetTime, date, []));
    }
  }

  Object.defineProperties(
    SpoofedDate.prototype,
    createDateMethodDescs(
      createFxDateMethods({
        NativeDate,
        NativeIntlDateTimeFormat,
        syncBootstrapState,
        getTimeLocaleState,
      }),
      maskAsNative,
      createNativeSource,
    ),
  );

  const patchedDate = maskAsNative(
    function SpoofedDateConstructor(...args: unknown[]): string | Date {
      if (new.target === undefined) {
        return Reflect.construct(SpoofedDate, []).toString();
      }

      return Reflect.construct(SpoofedDate, args, new.target) as Date;
    } as unknown as DateConstructor,
    createNativeSource("Date"),
    7,
  );

  Object.defineProperty(patchedDate, "parse", {
    configurable: true,
    enumerable: false,
    writable: true,
    value: maskAsNative(
      ((value: string): number => {
        syncBootstrapState();
        const timeLocaleState = getTimeLocaleState();
        if (timeLocaleState) {
          return parseZonedDateValue(
            value,
            {
              NativeDate,
              DateTimeFormat: NativeIntlDateTimeFormat,
              timeZone: timeLocaleState.timeZone,
            },
            nativeReaders,
          );
        }
        return NativeDate.parse(value);
      }) as DateConstructor["parse"],
      createNativeSource("parse"),
    ),
  });

  finalizePatchedCtor({
    patchedConstructor: patchedDate,
    patchedPrototype: SpoofedDate.prototype,
    nativeConstructor: NativeDate,
  });

  return patchedDate;
};
