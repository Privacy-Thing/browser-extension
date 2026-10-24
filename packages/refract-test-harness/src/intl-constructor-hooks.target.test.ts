import { createIntlHooks, toIntlHookDecision } from "@privacy-brand/refract-core";
import type { IntlPatchDetails } from "@privacy-brand/refract-core";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("intl-constructor-hooks", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const details = {
    locales: undefined,
    options: { hour: "2-digit" } satisfies Intl.DateTimeFormatOptions,
    effectiveLocales: ["pl-PL", "pl"],
    effectiveOptions: {
      hour: "2-digit",
      timeZone: "Europe/Warsaw",
    } satisfies Intl.DateTimeFormatOptions,
    defaults: {
      locale: true,
      timeZone: true,
    },
  } satisfies IntlPatchDetails<Intl.DateTimeFormatOptions>;

  it("summarizes constructor helper decisions for logging", () => {
    expect(toIntlHookDecision(details)).toEqual({
      effectiveLocales: ["pl-PL", "pl"],
      effectiveOptions: {
        hour: "2-digit",
        timeZone: "Europe/Warsaw",
      },
      localeWasDefaulted: true,
      timeZoneWasDefaulted: true,
    });
  });

  it("emits debug console output only when debug mode is enabled", () => {
    const hooks = createIntlHooks<Intl.DateTimeFormatOptions, Intl.DateTimeFormat>({
      debugMode: true,
      logger: vi.fn(),
    });
    const debug = vi.spyOn(console, "debug").mockImplementation(() => {});

    hooks.onPreparing?.("DateTimeFormat", details);
    hooks.onPreparing?.("DateTimeFormat", details);

    expect(debug).toHaveBeenCalledTimes(1);
    const [
      format,
      headline,
      argsLabel,
      argsValue,
      resultLabel,
      resultValue,
      traceLabel,
      traceValue,
    ] = debug.mock.calls[0] ?? [];
    // A single level-aware call with newline separators keeps DevTools filters working.
    expect(format).toBe("%s\n%s %o\n%s %o\n%s %o");
    expect(headline).toBe("[Refract] Intl.DateTimeFormat constructor intercepted");
    expect(argsLabel).toBe("Arguments:");
    expect(argsValue).toEqual({
      locales: undefined,
      options: { hour: "2-digit" },
    });
    expect(resultLabel).toBe("Result:");
    expect(resultValue).toEqual({
      effectiveArguments: {
        locales: ["pl-PL", "pl"],
        options: {
          hour: "2-digit",
          timeZone: "Europe/Warsaw",
        },
      },
      helperDecisions: {
        effectiveLocales: ["pl-PL", "pl"],
        effectiveOptions: {
          hour: "2-digit",
          timeZone: "Europe/Warsaw",
        },
        localeWasDefaulted: true,
        timeZoneWasDefaulted: true,
      },
    });
    expect(traceLabel).toBe("Trace:");
    // The trace is wrapped so DevTools shows a compact `{frames: Array(n)}` preview,
    // and it carries the structured frames without the duplicated headline.
    const traceFrames = (traceValue as { frames: string[] }).frames;
    expect(Array.isArray(traceFrames)).toBe(true);
    expect(traceFrames.join("\n")).not.toContain(
      "[Refract] Intl.DateTimeFormat constructor intercepted",
    );
  });

  it("skips debug console output when debug mode is disabled", () => {
    const hooks = createIntlHooks<Intl.DateTimeFormatOptions, Intl.DateTimeFormat>({
      debugMode: false,
      logger: vi.fn(),
    });
    const debug = vi.spyOn(console, "debug").mockImplementation(() => {});

    hooks.onPreparing?.("DateTimeFormat", details);

    expect(debug).not.toHaveBeenCalled();
  });

  it("skips constructor console formatting when the caller disables it", () => {
    const hooks = createIntlHooks<Intl.DateTimeFormatOptions, Intl.DateTimeFormat>({
      consoleOutput: false,
      debugMode: true,
      logger: vi.fn(),
    });
    const debug = vi.spyOn(console, "debug").mockImplementation(() => {});

    hooks.onPreparing?.("DateTimeFormat", details);

    expect(debug).not.toHaveBeenCalled();
  });

  it("logs constructor defaults and resolvedOptions through the provided logger", () => {
    const logger = vi.fn();
    const hooks = createIntlHooks<Intl.DateTimeFormatOptions, Intl.DateTimeFormat>({
      debugMode: false,
      logger,
    });
    const instance = new Intl.DateTimeFormat("pl-PL", { timeZone: "Europe/Warsaw" });
    const resolvedOptions = { locale: "pl-PL", timeZone: "Europe/Warsaw" };

    hooks.onConstructed?.("DateTimeFormat", details, instance);
    hooks.onResolvedOptions?.("DateTimeFormat", details.defaults, resolvedOptions);

    expect(logger).toHaveBeenNthCalledWith(
      1,
      "DateTimeFormat",
      [
        {
          locales: ["pl-PL", "pl"],
          options: {
            hour: "2-digit",
            timeZone: "Europe/Warsaw",
          },
        },
      ],
      "Constructor Init",
    );
    expect(logger).toHaveBeenNthCalledWith(
      2,
      "DateTimeFormat.defaults",
      [{ locales: undefined, options: { hour: "2-digit" } }],
      {
        effectiveLocales: ["pl-PL", "pl"],
        effectiveOptions: {
          hour: "2-digit",
          timeZone: "Europe/Warsaw",
        },
        localeWasDefaulted: true,
        timeZoneWasDefaulted: true,
      },
    );
    expect(logger).toHaveBeenNthCalledWith(
      3,
      "DateTimeFormat.resolvedOptions",
      [{ defaults: details.defaults }],
      resolvedOptions,
    );
  });

  it("runs the optional afterConstruct callback after logging", () => {
    const logger = vi.fn();
    const afterConstruct = vi.fn();
    const hooks = createIntlHooks<Intl.DateTimeFormatOptions, Intl.DateTimeFormat>(
      {
        debugMode: false,
        logger,
      },
      afterConstruct,
    );
    const instance = new Intl.DateTimeFormat("pl-PL", { timeZone: "Europe/Warsaw" });

    hooks.onConstructed?.("DateTimeFormat", details, instance);

    expect(afterConstruct).toHaveBeenCalledWith("DateTimeFormat", details, instance);
    expect(logger).toHaveBeenCalledTimes(2);
  });
});
