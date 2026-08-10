import { patchIntlConstructor } from "./intl-constructor-patch";
import type { IntlDefaults } from "./intl-defaults";
import type { ResolvedOptionsDefaults } from "./intl-resolved-options";

type FxDefaultIntlOptions = {
  resolveIntlDefaults: () => IntlDefaults | null;
  intlInstanceDefaults: WeakMap<object, ResolvedOptionsDefaults>;
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
};

const patchDefaultIntlCtor = <
  TInstance extends { resolvedOptions(): object },
  TOptions,
>(
  key: keyof typeof Intl,
  {
    resolveIntlDefaults,
    intlInstanceDefaults,
    resultTransform,
    maskAsNative,
    createNativeSource,
  }: FxDefaultIntlOptions,
): void => {
  patchIntlConstructor<TInstance, TOptions>({
    intlObject: Intl,
    key,
    intlDefaults: null,
    resolveIntlDefaults,
    intlInstanceDefaults,
    optionsTransform: (options) => options,
    resultTransform,
    maskAsNative,
    createNativeSource,
  });
};

export const patchFxDefaultIntlCtors = (options: FxDefaultIntlOptions): void => {
  patchDefaultIntlCtor<Intl.NumberFormat, Intl.NumberFormatOptions>(
    "NumberFormat",
    options,
  );
  patchDefaultIntlCtor<Intl.Collator, Intl.CollatorOptions>("Collator", options);
  patchDefaultIntlCtor<Intl.RelativeTimeFormat, Intl.RelativeTimeFormatOptions>(
    "RelativeTimeFormat",
    options,
  );

  if ("ListFormat" in Intl) {
    patchDefaultIntlCtor<Intl.ListFormat, Intl.ListFormatOptions>(
      "ListFormat",
      options,
    );
  }
  if ("DisplayNames" in Intl) {
    patchDefaultIntlCtor<Intl.DisplayNames, Intl.DisplayNamesOptions>(
      "DisplayNames",
      options,
    );
  }
  if ("PluralRules" in Intl) {
    patchDefaultIntlCtor<Intl.PluralRules, Intl.PluralRulesOptions>(
      "PluralRules",
      options,
    );
  }
  if ("Segmenter" in Intl) {
    patchDefaultIntlCtor<Intl.Segmenter, Intl.SegmenterOptions>("Segmenter", options);
  }
};
