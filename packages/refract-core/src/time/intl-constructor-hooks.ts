import {
  createConsoleDiagError,
  logConsoleDiagnostic,
} from "@privacy-brand/refract-browser/common/debug-logger";

import type { IntlPatchDetails, IntlPatchHooks } from "./intl-constructor-patch";

import { ExtensionLogLevel } from "@/shared/logging-types";

export type IntlHookDecision<TOptions> = {
  effectiveLocales: Intl.LocalesArgument | undefined;
  effectiveOptions: TOptions | undefined;
  localeWasDefaulted: boolean;
  timeZoneWasDefaulted: boolean;
};

export type IntlConstructorLogger = (
  method: string,
  args: unknown[],
  result: unknown,
) => void;

export type IntlHookOptions = {
  debugMode: boolean;
  logger: IntlConstructorLogger;
  consoleOutput?: boolean;
  onAccess?:
    | ((kind: "constructor" | "resolvedOptions", key: keyof typeof Intl) => void)
    | undefined;
};

export type IntlAfterConstruct<TInstance, TOptions> = (
  key: keyof typeof Intl,
  details: IntlPatchDetails<TOptions>,
  instance: TInstance,
) => void;

/**
 * Keeps the debug payload shape stable while exposing only the constructor
 * helper decisions that matter to runtime diagnostics.
 */
export const toIntlHookDecision = <TOptions>(
  details: IntlPatchDetails<TOptions>,
): IntlHookDecision<TOptions> => ({
  effectiveLocales: details.effectiveLocales,
  effectiveOptions: details.effectiveOptions,
  localeWasDefaulted: details.defaults.locale === true,
  timeZoneWasDefaulted: details.defaults.timeZone === true,
});

/**
 * Reuses the main-runtime Intl constructor debug hooks so Date/Intl patch setup
 * does not keep duplicating the same logging and helper-decision plumbing.
 */
export const createIntlHooks = <TOptions, TInstance>(
  options: IntlHookOptions,
  afterConstruct?: IntlAfterConstruct<TInstance, TOptions>,
): IntlPatchHooks<TInstance, TOptions> => {
  let preparationLogged = false;

  return {
    onPreparing: (key, details) => {
      options.onAccess?.("constructor", key);
      const helperDecisionResult = toIntlHookDecision(details);
      if (options.debugMode && options.consoleOutput !== false && !preparationLogged) {
        preparationLogged = true;
        const headline = `[Refract] Intl.${String(key)} constructor intercepted`;
        const diagnostic = createConsoleDiagError(headline, {
          headline,
          component: "Intl",
          method: `${String(key)} constructor`,
          kind: "intercept",
          level: ExtensionLogLevel.Verbose,
          args: {
            locales: details.locales,
            options: details.options,
          },
          result: {
            effectiveArguments: {
              locales: details.effectiveLocales,
              options: details.effectiveOptions,
            },
            helperDecisions: helperDecisionResult,
          },
        });
        logConsoleDiagnostic({
          level: ExtensionLogLevel.Verbose,
          headline: diagnostic.headline,
          args: diagnostic.args,
          result: diagnostic.result,
          stack: diagnostic.stack,
          argsLabel: "Arguments:",
          resultLabel: "Result:",
        });
      }
    },
    onConstructed: (key, details, instance) => {
      options.logger(
        String(key),
        [{ locales: details.effectiveLocales, options: details.effectiveOptions }],
        "Constructor Init",
      );
      options.logger(
        `${String(key)}.defaults`,
        [{ locales: details.locales, options: details.options }],
        toIntlHookDecision(details),
      );
      afterConstruct?.(key, details, instance);
    },
    onResolvedOptions: (key, defaults, result) => {
      options.onAccess?.("resolvedOptions", key);
      options.logger(`${String(key)}.resolvedOptions`, [{ defaults }], result);
    },
  };
};
