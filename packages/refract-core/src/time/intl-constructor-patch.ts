import { withDefaultLocales, type IntlDefaults } from "./intl-defaults";
import type { ResolvedOptionsDefaults } from "./intl-resolved-options";

export type IntlConstructor<TInstance, TOptions> = {
  new (locales?: string | string[], options?: TOptions): TInstance;
  (locales?: string | string[], options?: TOptions): TInstance;
  prototype: TInstance;
  supportedLocalesOf(
    locales?: string | readonly string[],
    options?: Intl.LocaleOptions,
  ): string[];
};

export type IntlPatchDetails<TOptions> = {
  locales: string | string[] | undefined;
  options: TOptions | undefined;
  effectiveLocales: Intl.LocalesArgument | undefined;
  effectiveOptions: TOptions | undefined;
  defaults: ResolvedOptionsDefaults;
};

export type IntlPatchHooks<TInstance, TOptions> = {
  onPreparing?: (key: keyof typeof Intl, details: IntlPatchDetails<TOptions>) => void;
  onConstructed?: (
    key: keyof typeof Intl,
    details: IntlPatchDetails<TOptions>,
    instance: TInstance,
  ) => void;
  onResolvedOptions?: (
    key: keyof typeof Intl,
    defaults: ResolvedOptionsDefaults | undefined,
    result: object,
  ) => void;
};

export type IntlPatchOptions<TInstance, TOptions> = {
  intlObject: typeof Intl;
  key: keyof typeof Intl;
  intlDefaults: IntlDefaults | null;
  resolveIntlDefaults?: (() => IntlDefaults | null) | undefined;
  intlInstanceDefaults: WeakMap<object, ResolvedOptionsDefaults>;
  optionsTransform: (options: TOptions | undefined) => TOptions | undefined;
  resultTransform: (
    options: object,
    defaults: ResolvedOptionsDefaults | undefined,
  ) => object;
  maskAsNative: <TFunction extends Function>(
    fn: TFunction,
    source?: string,
    length?: number,
  ) => TFunction;
  createNativeSource: (name: string) => string;
  hooks?: IntlPatchHooks<TInstance, TOptions>;
};

export const patchIntlConstructor = <
  TInstance extends { resolvedOptions(): object },
  TOptions,
>({
  intlObject,
  key,
  intlDefaults,
  resolveIntlDefaults,
  intlInstanceDefaults,
  optionsTransform,
  resultTransform,
  maskAsNative,
  createNativeSource,
  hooks,
}: IntlPatchOptions<TInstance, TOptions>): void => {
  const NativeConstructor = intlObject[key] as unknown as
    IntlConstructor<TInstance, TOptions> | undefined;
  if (!NativeConstructor) {
    return;
  }

  const nativeResolvedOptions = NativeConstructor.prototype.resolvedOptions;
  const patchedResolvedOptions = maskAsNative(
    {
      resolvedOptions(this: TInstance): object {
        const options = nativeResolvedOptions.call(this);
        const defaults = intlInstanceDefaults.get(this);
        const result = resultTransform(options, defaults);
        hooks?.onResolvedOptions?.(key, defaults, result);
        return result;
      },
    }.resolvedOptions,
    createNativeSource("resolvedOptions"),
  );

  Object.defineProperty(NativeConstructor.prototype, "resolvedOptions", {
    configurable: true,
    value: patchedResolvedOptions,
  });

  const PatchedConstructor = maskAsNative(
    function IntlConstructorWrapper(
      locales?: string | string[],
      options?: TOptions,
    ): TInstance {
      const activeIntlDefaults = resolveIntlDefaults?.() ?? intlDefaults;
      const effectiveLocales = withDefaultLocales(locales, activeIntlDefaults);
      const effectiveOptions = optionsTransform(options);
      const details = {
        locales,
        options,
        effectiveLocales,
        effectiveOptions,
        defaults: {
          locale: locales === undefined && activeIntlDefaults !== null,
          timeZone:
            key === "DateTimeFormat" &&
            (options as Intl.DateTimeFormatOptions | undefined)?.timeZone ===
              undefined &&
            activeIntlDefaults !== null,
        },
      } satisfies IntlPatchDetails<TOptions>;

      hooks?.onPreparing?.(key, details);

      const instance = Reflect.construct(
        NativeConstructor,
        [effectiveLocales, effectiveOptions],
        new.target ?? NativeConstructor,
      ) as TInstance;

      intlInstanceDefaults.set(instance, details.defaults);
      hooks?.onConstructed?.(key, details, instance);

      return instance;
    },
    createNativeSource(String(key)),
    NativeConstructor.length,
  );

  Object.defineProperty(PatchedConstructor, "prototype", {
    configurable: false,
    enumerable: false,
    writable: false,
    value: NativeConstructor.prototype,
  });

  Object.defineProperty(PatchedConstructor, "supportedLocalesOf", {
    configurable: true,
    enumerable: false,
    writable: true,
    value: maskAsNative(
      NativeConstructor.supportedLocalesOf.bind(NativeConstructor),
      createNativeSource("supportedLocalesOf"),
    ),
  });

  Object.defineProperty(intlObject, key, {
    configurable: true,
    value: PatchedConstructor,
  });
};

export const INTL_CTOR_PATCH_SOURCE = `
  const patchIntlConstructor = (key, optionsTransform, resultTransform, resolveIntlDefaults) => {
    const NativeConstructor = Intl[key];
    if (!NativeConstructor) {
      return;
    }

    const nativeResolvedOptions = NativeConstructor.prototype.resolvedOptions;
    const patchedResolvedOptions = {
      resolvedOptions() {
        const options = nativeResolvedOptions.call(this);
        const defaults = intlInstanceDefaults.get(this);
        return resultTransform(options, defaults);
      }
    }.resolvedOptions;
    const PatchedConstructor = maskAsNative(function IntlConstructorWrapper(locales, options) {
      const activeIntlDefaults = resolveIntlDefaults ? resolveIntlDefaults() : intlDefaults;
      const instance = Reflect.construct(NativeConstructor, [
        withDefaultLocales(locales, activeIntlDefaults),
        optionsTransform(options)
      ], new.target ?? NativeConstructor);
      if (key === "DateTimeFormat") {
        const nativeFormatDescriptor = Object.getOwnPropertyDescriptor(
          NativeConstructor.prototype,
          "format"
        );
        const nativeFormat = nativeFormatDescriptor?.get?.call(instance);
        const nativeFormatToParts = instance.formatToParts.bind(instance);
        const nativeFormatRange = instance.formatRange?.bind(instance);
        const nativeFormatRangeToParts = instance.formatRangeToParts?.bind(instance);

        patchDateTimeInstance({
          instance,
          nativeFormat,
          nativeFormatToParts,
          nativeFormatRange,
          nativeFormatRangeToParts,
          normalizeValue: normalizeDateTimeValueForIntl,
          maskAsNative
        });
      }
      intlInstanceDefaults.set(instance, {
        locale: locales === undefined && activeIntlDefaults !== null,
        timeZone:
          key === "DateTimeFormat" &&
          options?.timeZone === undefined &&
          activeIntlDefaults !== null
      });
      return instance;
    }, createNativeSource(String(key)), NativeConstructor.length);

    Object.defineProperty(PatchedConstructor, "prototype", {
      configurable: false,
      enumerable: false,
      writable: false,
      value: NativeConstructor.prototype
    });
    Object.defineProperty(PatchedConstructor, "supportedLocalesOf", {
      configurable: true,
      enumerable: false,
      writable: true,
      value: maskAsNative(
        NativeConstructor.supportedLocalesOf.bind(NativeConstructor),
        createNativeSource("supportedLocalesOf")
      )
    });

    Intl[key] = PatchedConstructor;
    Object.defineProperty(Intl[key].prototype, "resolvedOptions", {
      configurable: true,
      value: maskAsNative(patchedResolvedOptions, createNativeSource("resolvedOptions"))
    });
  };
`;
