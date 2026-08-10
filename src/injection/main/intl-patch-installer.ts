import { createOnceLogger } from "@privacy-brand/refract-browser/common/debug-logger";
import { markSurfaceUsed } from "@privacy-brand/refract-browser/common/surface-usage-emitter";
import {
  createNativeSource,
  maskAsNative,
} from "@privacy-brand/refract-core/native/native-mask";
import { patchDateTimeInstance as applyDateTimeMethods } from "@privacy-brand/refract-core/time/date-time-format-instance-patch";
import { createIntlHooks } from "@privacy-brand/refract-core/time/intl-constructor-hooks";
import { patchIntlConstructor } from "@privacy-brand/refract-core/time/intl-constructor-patch";
import {
  createIntlDefaults,
  withDefaultTimeZone,
} from "@privacy-brand/refract-core/time/intl-defaults";
import { createResolvedTransform } from "@privacy-brand/refract-core/time/intl-resolved-options";

import {
  registerDescriptor,
  type RuntimeIntegrityContext,
} from "@/injection/main/surface-integrity";
import { hasRuntimeLocationData } from "@/shared/runtime-snapshot";
import type { RuntimeSnapshot, SpoofingSurfaceMethodId } from "@/shared/types";

const NativeDateTimeFormat = Intl.DateTimeFormat;
const nativeFormatDescriptor = Object.getOwnPropertyDescriptor(
  NativeDateTimeFormat.prototype,
  "format",
);

type IntlPatchContext = {
  dateTimeWrappers: WeakMap<object, (value?: Date | number) => string>;
  debugMode: boolean;
  formattingLanguage: string;
  integrity: RuntimeIntegrityContext | undefined;
  intlDefaults: ReturnType<typeof createIntlDefaults>;
  intlInstanceDefaults: WeakMap<object, { locale: boolean; timeZone: boolean }>;
  logger: ReturnType<typeof createOnceLogger>;
  markUsed(methodId?: SpoofingSurfaceMethodId): void;
  resolvedTransform: ReturnType<typeof createResolvedTransform>;
};

const createPatchContext = (
  snapshot: RuntimeSnapshot,
  integrity: RuntimeIntegrityContext | undefined,
): IntlPatchContext => {
  const baseLogger = createOnceLogger(snapshot, "Intl");
  const formattingLanguage =
    snapshot.locale.formattingLanguage ?? snapshot.locale.language;
  const formattingLanguages =
    snapshot.locale.formattingLanguages ?? snapshot.locale.languages;
  return {
    dateTimeWrappers: new WeakMap(),
    debugMode: snapshot.debugMode,
    formattingLanguage,
    integrity,
    intlDefaults: createIntlDefaults(formattingLanguages, snapshot.locale.timeZone),
    intlInstanceDefaults: new WeakMap(),
    logger: (method, args, result) => {
      baseLogger(method, args, result, { consoleOutput: false });
    },
    markUsed: (methodId) => markSurfaceUsed("timeLocale", methodId),
    resolvedTransform: createResolvedTransform({
      language: formattingLanguage,
      timeZone: snapshot.locale.timeZone,
    }),
  };
};

const registerIntlIntegrity = (
  context: IntlPatchContext,
  key: keyof typeof Intl,
): void => {
  const installedConstructor = Intl[key] as unknown as { prototype?: object };
  registerDescriptor({
    integrity: context.integrity,
    target: Intl,
    key,
    anchor: { surfaceId: "timeLocale", methodId: "intl.constructor" },
  });
  if (!installedConstructor?.prototype) return;
  registerDescriptor({
    integrity: context.integrity,
    target: installedConstructor.prototype,
    key: "resolvedOptions",
    anchor: {
      surfaceId: "timeLocale",
      methodId: "intl.resolvedOptions",
    },
  });
};

const createHookOptions = (context: IntlPatchContext) => ({
  debugMode: context.debugMode,
  consoleOutput: false,
  logger: context.logger,
  onAccess: (kind: "constructor" | "resolvedOptions") => {
    context.markUsed(
      kind === "constructor" ? "intl.constructor" : "intl.resolvedOptions",
    );
  },
});

const patchDateTimeMethods = (
  context: IntlPatchContext,
  instance: Intl.DateTimeFormat,
): void => {
  const nativeFormat = nativeFormatDescriptor?.get?.call(instance) as
    ((value?: Date | number) => string) | undefined;
  const nativeFormatToParts = instance.formatToParts.bind(instance);
  const nativeFormatRange = instance.formatRange?.bind(instance);
  const nativeFormatRangeToParts = instance.formatRangeToParts?.bind(instance);

  applyDateTimeMethods({
    instance,
    nativeFormat: nativeFormat
      ? (value) => {
          context.markUsed("intl.DateTimeFormat.format");
          return nativeFormat(value);
        }
      : undefined,
    nativeFormatToParts: (value) => {
      context.markUsed("intl.DateTimeFormat.formatToParts");
      return nativeFormatToParts(value);
    },
    nativeFormatRange: nativeFormatRange
      ? (startDate, endDate) => {
          context.markUsed();
          return nativeFormatRange(startDate, endDate);
        }
      : undefined,
    nativeFormatRangeToParts: nativeFormatRangeToParts
      ? (startDate, endDate) => {
          context.markUsed();
          return nativeFormatRangeToParts(startDate, endDate);
        }
      : undefined,
    normalizeValue: (value) => value,
    maskAsNative,
  });
};

const patchDateTimePrototype = (context: IntlPatchContext): void => {
  if (!nativeFormatDescriptor?.get) return;
  const nativeFormatGetter = nativeFormatDescriptor.get;
  const formatGetter = Object.getOwnPropertyDescriptor(
    {
      get format() {
        const instance = this as Intl.DateTimeFormat;
        const cachedWrapper = context.dateTimeWrappers.get(instance);
        if (cachedWrapper) return cachedWrapper;
        const nativeFormat = Reflect.apply(nativeFormatGetter, instance, []) as (
          value?: Date | number,
        ) => string;
        const wrappedFormat = maskAsNative((value?: Date | number) => {
          context.markUsed("intl.DateTimeFormat.format");
          return nativeFormat(value);
        });
        context.dateTimeWrappers.set(instance, wrappedFormat);
        return wrappedFormat;
      },
    },
    "format",
  )?.get;
  if (!formatGetter) return;
  Object.defineProperty(NativeDateTimeFormat.prototype, "format", {
    configurable: true,
    get: maskAsNative(formatGetter, "function get format() { [native code] }"),
  });
};

const patchDateTimeConstructor = (context: IntlPatchContext): void => {
  patchIntlConstructor<Intl.DateTimeFormat, Intl.DateTimeFormatOptions>({
    intlObject: Intl,
    key: "DateTimeFormat",
    intlDefaults: context.intlDefaults,
    intlInstanceDefaults: context.intlInstanceDefaults,
    optionsTransform: (options) => withDefaultTimeZone(options, context.intlDefaults),
    resultTransform: context.resolvedTransform,
    maskAsNative,
    createNativeSource,
    hooks: createIntlHooks<Intl.DateTimeFormatOptions, Intl.DateTimeFormat>(
      createHookOptions(context),
      (_key, _details, instance) => {
        patchDateTimeMethods(context, instance);
      },
    ),
  });
  patchDateTimePrototype(context);
  registerIntlIntegrity(context, "DateTimeFormat");
  registerDescriptor({
    integrity: context.integrity,
    target: NativeDateTimeFormat.prototype,
    key: "format",
    anchor: {
      surfaceId: "timeLocale",
      methodId: "intl.DateTimeFormat.format",
    },
  });
};

const patchPlainConstructor = <
  TInstance extends { resolvedOptions(): object },
  TOptions,
>(
  context: IntlPatchContext,
  key: keyof typeof Intl,
): void => {
  patchIntlConstructor<TInstance, TOptions>({
    intlObject: Intl,
    key,
    intlDefaults: context.intlDefaults,
    intlInstanceDefaults: context.intlInstanceDefaults,
    optionsTransform: (options) => options,
    resultTransform: context.resolvedTransform,
    maskAsNative,
    createNativeSource,
    hooks: createIntlHooks<TOptions, TInstance>(createHookOptions(context)),
  });
  registerIntlIntegrity(context, key);
};

const patchCoreConstructors = (context: IntlPatchContext): void => {
  patchPlainConstructor<Intl.NumberFormat, Intl.NumberFormatOptions>(
    context,
    "NumberFormat",
  );
  patchPlainConstructor<Intl.Collator, Intl.CollatorOptions>(context, "Collator");
  patchPlainConstructor<Intl.RelativeTimeFormat, Intl.RelativeTimeFormatOptions>(
    context,
    "RelativeTimeFormat",
  );
};

const patchOptionalCtors = (context: IntlPatchContext): void => {
  if ("ListFormat" in Intl) {
    patchPlainConstructor<Intl.ListFormat, Intl.ListFormatOptions>(
      context,
      "ListFormat",
    );
  }
  if ("DisplayNames" in Intl) {
    patchPlainConstructor<Intl.DisplayNames, Intl.DisplayNamesOptions>(
      context,
      "DisplayNames",
    );
  }
  if ("PluralRules" in Intl) {
    patchPlainConstructor<Intl.PluralRules, Intl.PluralRulesOptions>(
      context,
      "PluralRules",
    );
  }
  if ("Segmenter" in Intl) {
    patchPlainConstructor<Intl.Segmenter, Intl.SegmenterOptions>(context, "Segmenter");
  }
};

export const installIntlPatch = (
  snapshot: RuntimeSnapshot,
  integrity?: RuntimeIntegrityContext,
): void => {
  if (!hasRuntimeLocationData(snapshot) || snapshot.timeLocaleEnabled === false) {
    return;
  }
  const context = createPatchContext(snapshot, integrity);
  patchDateTimeConstructor(context);
  patchCoreConstructors(context);
  patchOptionalCtors(context);
};
