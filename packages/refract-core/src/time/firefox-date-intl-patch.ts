import type { FirefoxTimeLocaleState } from "@privacy-brand/refract-browser/common/firefox-shim-state";

import { createNativeSource, maskAsNative } from "../native/native-mask";

import { createPatchedFirefoxDate } from "./firefox-date-constructor";
import { createFxDateTimeFormat } from "./firefox-date-time-format-constructor";
import { patchFxDefaultIntlCtors } from "./firefox-default-locale-intl-constructors";
import { resolveFxDateTimeArgs } from "./firefox-time-locale";
import { createLazyResolved } from "./intl-resolved-options";

type FxDateIntlOptions = {
  syncBootstrapState: () => void;
  getTimeLocaleState: () => FirefoxTimeLocaleState | null;
  /** Called once the first time a patched Date or Intl constructor is invoked. */
  onFirstAccess?: () => void;
};

export const installFxDateIntl = ({
  syncBootstrapState,
  getTimeLocaleState,
  onFirstAccess,
}: FxDateIntlOptions): void => {
  const NativeDate = Date;
  const NativeIntlDateTimeFormat = Intl.DateTimeFormat;
  const defaultIntlDefaults = new WeakMap<
    object,
    {
      locale?: boolean;
      timeZone?: boolean;
    }
  >();
  let firstAccessNotified = false;
  const resolveTimeLocaleState = (): FirefoxTimeLocaleState | null => {
    syncBootstrapState();
    if (!firstAccessNotified) {
      firstAccessNotified = true;
      onFirstAccess?.();
    }
    return getTimeLocaleState();
  };
  const resolvedOptionsTransform = createLazyResolved(() => {
    const timeLocaleState = resolveTimeLocaleState();
    return timeLocaleState
      ? {
          language: timeLocaleState.formattingLanguage ?? timeLocaleState.language,
          timeZone: timeLocaleState.timeZone,
        }
      : null;
  });

  (globalThis as typeof globalThis & { Date: typeof Date }).Date =
    createPatchedFirefoxDate({
      NativeDate,
      NativeIntlDateTimeFormat,
      syncBootstrapState,
      getTimeLocaleState,
      maskAsNative,
      createNativeSource,
    });

  Intl.DateTimeFormat = createFxDateTimeFormat({
    NativeIntlDateTimeFormat,
    resolveDateTimeArgs: (locales, options) => {
      syncBootstrapState();
      return resolveFxDateTimeArgs(locales, options, getTimeLocaleState());
    },
    maskAsNative,
    createNativeSource,
  });

  patchFxDefaultIntlCtors({
    resolveIntlDefaults: () => {
      const timeLocaleState = resolveTimeLocaleState();
      return timeLocaleState
        ? {
            languages: timeLocaleState.formattingLanguages ?? timeLocaleState.languages,
            timeZone: timeLocaleState.timeZone,
          }
        : null;
    },
    intlInstanceDefaults: defaultIntlDefaults,
    resultTransform: resolvedOptionsTransform,
    maskAsNative,
    createNativeSource,
  });
};
