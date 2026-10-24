import {
  createConsoleDiagError,
  createLogger,
  createOnceLogger,
  toStackFrames,
} from "@privacy-brand/refract-browser/common/debug-logger";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LOG_EVENT_TYPE } from "@/shared/build-id-test-values";
import { ExtensionLogLevel } from "@/shared/logging-types";

const DEBUG_EVENT_NAME = "debug-event";

describe("debug-logger", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("does nothing when debug logging is disabled", () => {
    const postMessage = vi.fn();
    vi.stubGlobal("postMessage", postMessage);
    const info = vi.spyOn(console, "info").mockImplementation(() => {});

    const logger = createLogger(
      { debugMode: false, logEventName: DEBUG_EVENT_NAME },
      "Date",
    );
    logger("now", [], 123);

    expect(postMessage).not.toHaveBeenCalled();
    expect(info).not.toHaveBeenCalled();
  });

  it("logs and serializes payloads when debug logging is enabled", () => {
    const postMessage = vi.fn();
    vi.stubGlobal("postMessage", postMessage);
    const info = vi.spyOn(console, "info").mockImplementation(() => {});

    const logger = createLogger(
      { debugMode: true, logEventName: DEBUG_EVENT_NAME },
      "Date",
    );
    logger("now", [{ locale: "pl-PL" }], { result: 123 });

    expect(info).toHaveBeenCalledTimes(1);
    const [
      format,
      headline,
      argsLabel,
      argsValue,
      resultLabel,
      resultValue,
      traceLabel,
      traceValue,
    ] = info.mock.calls[0] ?? [];
    // A single level-aware call with newline separators keeps DevTools filters working.
    expect(format).toBe("%s\n%s %o\n%s %o\n%s %o");
    expect(headline).toBe("[Refract] Date.now intercepted");
    expect(argsLabel).toBe("Arguments:");
    expect(argsValue).toEqual([{ locale: "pl-PL" }]);
    expect(resultLabel).toBe("Result:");
    expect(resultValue).toEqual({ result: 123 });
    expect(traceLabel).toBe("Trace:");
    // The trace is wrapped so DevTools shows a compact `{frames: Array(n)}` preview,
    // and it carries the structured frames without the duplicated headline.
    const traceFrames = (traceValue as { frames: string[] }).frames;
    expect(Array.isArray(traceFrames)).toBe(true);
    expect(traceFrames.join("\n")).not.toContain("[Refract] Date.now intercepted");
    expect(postMessage).toHaveBeenCalledTimes(1);
    expect(postMessage.mock.calls[0]).toHaveLength(1);
    const payload = postMessage.mock.calls[0]?.[0];
    expect(payload).toMatchObject({
      type: LOG_EVENT_TYPE,
      eventName: DEBUG_EVENT_NAME,
    });
    expect(JSON.parse(payload.detail as string)).toEqual(
      expect.objectContaining({
        component: "Date",
        method: "now",
        kind: "intercept",
        level: ExtensionLogLevel.Info,
        message: "[Refract] Date.now intercepted",
        args: [{ locale: "pl-PL" }],
        result: { result: 123 },
      }),
    );
    const forwardedStack = JSON.parse(payload.detail as string).stack;
    expect(typeof forwardedStack).toBe("string");
    // The forwarded stack is cleaned of the duplicated headline for View Log too.
    expect(forwardedStack).not.toContain("[Refract] Date.now intercepted");
  });

  it("can forward a debug event without formatting it in the page console", () => {
    const postMessage = vi.fn();
    vi.stubGlobal("postMessage", postMessage);
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const logger = createLogger(
      { debugMode: true, logEventName: DEBUG_EVENT_NAME },
      "Intl",
    );

    logger("DateTimeFormat", [], "Constructor Init", { consoleOutput: false });

    expect(info).not.toHaveBeenCalled();
    expect(postMessage).toHaveBeenCalledTimes(1);
  });

  it("falls back for unserializable arguments and results", () => {
    const postMessage = vi.fn();
    vi.stubGlobal("postMessage", postMessage);
    vi.spyOn(console, "info").mockImplementation(() => {});

    const circularArg: { self?: unknown } = {};
    const circularArgs = [circularArg];
    circularArg.self = circularArgs;
    const circularResult: { self?: unknown } = {};
    circularResult.self = circularResult;

    const logger = createLogger(
      { debugMode: true, logEventName: DEBUG_EVENT_NAME },
      "Date",
    );
    logger("parse", circularArgs, circularResult);

    expect(postMessage).toHaveBeenCalledTimes(1);
    const detail = JSON.parse(postMessage.mock.calls[0]?.[0].detail as string);
    expect(detail).toEqual(
      expect.objectContaining({
        component: "Date",
        method: "parse",
        kind: "intercept",
        level: ExtensionLogLevel.Info,
        message: "[Refract] Date.parse intercepted",
        args: ["<Unserializable Arguments>"],
        result: "<Unserializable Result>",
      }),
    );
    expect(typeof detail.stack).toBe("string");
  });

  it("skips recursive emissions triggered by a wrapped console method", () => {
    const postMessage = vi.fn();
    vi.stubGlobal("postMessage", postMessage);

    const logger = createLogger(
      { debugMode: true, logEventName: DEBUG_EVENT_NAME },
      "Date",
    );
    const info = vi.spyOn(console, "info").mockImplementation(() => {
      logger("now", [], 456);
    });

    logger("now", [], 123);

    expect(info).toHaveBeenCalledTimes(1);
    expect(postMessage).toHaveBeenCalledTimes(1);
    const detail = JSON.parse(postMessage.mock.calls[0]?.[0].detail as string);
    expect(detail).toEqual(
      expect.objectContaining({
        component: "Date",
        method: "now",
        result: 123,
      }),
    );
  });

  it("skips recursive emissions across logger components", () => {
    const postMessage = vi.fn();
    vi.stubGlobal("postMessage", postMessage);

    const dateLogger = createLogger(
      { debugMode: true, logEventName: DEBUG_EVENT_NAME },
      "Date",
    );
    const canvasLogger = createOnceLogger(
      { debugMode: true, logEventName: DEBUG_EVENT_NAME },
      "Canvas",
    );
    const info = vi.spyOn(console, "info").mockImplementation(() => {
      canvasLogger("toDataURL", [], "nested");
    });

    dateLogger("now", [], 123);

    expect(info).toHaveBeenCalledTimes(1);
    expect(postMessage).toHaveBeenCalledTimes(1);
    const outerDetail = JSON.parse(postMessage.mock.calls[0]?.[0].detail as string);
    expect(outerDetail).toEqual(
      expect.objectContaining({
        component: "Date",
        method: "now",
        result: 123,
      }),
    );

    info.mockImplementation(() => {});
    canvasLogger("toDataURL", [], "first-real-canvas-log");

    expect(info).toHaveBeenCalledTimes(2);
    expect(postMessage).toHaveBeenCalledTimes(2);
    const canvasDetail = JSON.parse(postMessage.mock.calls[1]?.[0].detail as string);
    expect(canvasDetail).toEqual(
      expect.objectContaining({
        component: "Canvas",
        method: "toDataURL",
        result: "first-real-canvas-log",
      }),
    );
  });

  it("only emits the first event per method when using once loggers", () => {
    const postMessage = vi.fn();
    vi.stubGlobal("postMessage", postMessage);
    vi.spyOn(console, "info").mockImplementation(() => {});

    const logger = createOnceLogger(
      { debugMode: true, logEventName: DEBUG_EVENT_NAME },
      "Canvas",
    );
    logger("toDataURL", [], { width: 100 });
    logger("toDataURL", [], { width: 200 });
    logger("toBlob", [], { width: 300 });

    expect(postMessage).toHaveBeenCalledTimes(2);
    const firstDetail = JSON.parse(postMessage.mock.calls[0]?.[0].detail as string);
    const secondDetail = JSON.parse(postMessage.mock.calls[1]?.[0].detail as string);
    expect(firstDetail).toEqual(
      expect.objectContaining({
        component: "Canvas",
        method: "toDataURL",
        kind: "intercept",
        level: ExtensionLogLevel.Info,
        args: [],
        result: { width: 100 },
      }),
    );
    expect(secondDetail).toEqual(
      expect.objectContaining({
        component: "Canvas",
        method: "toBlob",
        kind: "intercept",
        level: ExtensionLogLevel.Info,
        args: [],
        result: { width: 300 },
      }),
    );
  });

  it("uses an installation-specific headline and console level for install events", () => {
    const postMessage = vi.fn();
    vi.stubGlobal("postMessage", postMessage);
    const debug = vi.spyOn(console, "debug").mockImplementation(() => {});

    const logger = createLogger(
      { debugMode: true, logEventName: DEBUG_EVENT_NAME },
      "WebGL",
    );
    logger("install", [], { suppressDebugInfo: true });

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
    expect(format).toBe("%s\n%s %o\n%s %o\n%s %o");
    expect(headline).toBe("[Refract] WebGL patch installed");
    expect(argsLabel).toBe("Arguments:");
    expect(argsValue).toEqual([]);
    expect(resultLabel).toBe("Configuration:");
    expect(resultValue).toEqual({ suppressDebugInfo: true });
    expect(traceLabel).toBe("Trace:");
    const traceFrames = (traceValue as { frames: string[] }).frames;
    expect(Array.isArray(traceFrames)).toBe(true);
    expect(traceFrames.join("\n")).not.toContain("[Refract] WebGL patch installed");
  });

  it("creates enumerable diagnostic metadata on console errors", () => {
    const diagnostic = createConsoleDiagError("[Refract] Example", {
      component: "Navigator",
      method: "get userAgent",
      kind: "intercept",
      args: [],
      result: "ua",
    });

    expect(diagnostic).toBeInstanceOf(Error);
    expect(diagnostic).toMatchObject({
      message: "[Refract] Example",
      component: "Navigator",
      method: "get userAgent",
      kind: "intercept",
      args: [],
      result: "ua",
    });
    expect(diagnostic.name).toBe("Refract");
    expect(Object.keys(diagnostic)).toEqual(
      expect.arrayContaining(["component", "method", "kind", "args", "result"]),
    );
  });

  it("strips the duplicated headline from V8-style stacks", () => {
    const headline = "[Refract] Date.now intercepted";
    const v8Stack = [
      `Refract: ${headline}`,
      "    at et (chrome-extension://abc/main-world-runtime.js:3:217)",
      "    at get now (chrome-extension://abc/main-world-runtime.js:10:396)",
    ].join("\n");

    expect(toStackFrames(v8Stack, headline)).toEqual([
      "at et (chrome-extension://abc/main-world-runtime.js:3:217)",
      "at get now (chrome-extension://abc/main-world-runtime.js:10:396)",
    ]);
  });

  it("keeps every frame for Firefox-style stacks that omit the headline", () => {
    const headline = "[Refract] Date.now intercepted";
    const firefoxStack = [
      "et@moz-extension://abc/main-world-runtime.js:3:217",
      "get now@moz-extension://abc/main-world-runtime.js:10:396",
    ].join("\n");

    expect(toStackFrames(firefoxStack, headline)).toEqual([
      "et@moz-extension://abc/main-world-runtime.js:3:217",
      "get now@moz-extension://abc/main-world-runtime.js:10:396",
    ]);
  });

  it("returns an empty array when no stack is available", () => {
    expect(toStackFrames(undefined, "[Refract] X")).toEqual([]);
  });
});
