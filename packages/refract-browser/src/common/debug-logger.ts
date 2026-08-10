import { ExtensionLogLevel } from "@/shared/logging-types";
import type { RuntimeSnapshot } from "@/shared/types";

export type RuntimeDebugSnapshot = Pick<
  RuntimeSnapshot,
  "debugMode" | "logEventName"
> | null;
type DebugSnapshotSource = RuntimeDebugSnapshot | (() => RuntimeDebugSnapshot);

export type RuntimeDebugLogger = (
  method: string,
  args: unknown[],
  result?: unknown,
  options?: RuntimeDebugLogOptions,
) => void;

export type RuntimeDebugLogOptions = {
  kind?: "intercept" | "install";
  level?: ExtensionLogLevel;
  argsLabel?: string;
  resultLabel?: string;
  consoleOutput?: boolean;
};

type ConsoleDiagMeta = {
  headline: string;
  component: string;
  method: string;
  kind: NonNullable<RuntimeDebugLogOptions["kind"]>;
  level: ExtensionLogLevel;
  args: unknown[];
  result: unknown;
};

export const createConsoleDiagError = <TMetadata extends Record<string, unknown>>(
  headline: string,
  metadata: TMetadata,
): Error & TMetadata => {
  const diagnostic = new Error(headline) as Error & TMetadata;
  diagnostic.name = "Refract";

  for (const [key, value] of Object.entries(metadata)) {
    Object.defineProperty(diagnostic, key, {
      value,
      writable: true,
      configurable: true,
      enumerable: true,
    });
  }

  return diagnostic;
};

const getConsoleMethod = (
  level:
    | ExtensionLogLevel.Verbose
    | ExtensionLogLevel.Info
    | ExtensionLogLevel.Warn
    | ExtensionLogLevel.Error,
): ((...data: unknown[]) => void) => {
  if (level === ExtensionLogLevel.Verbose) {
    return console.debug;
  }

  if (level === ExtensionLogLevel.Info) {
    return console.info;
  }

  if (level === ExtensionLogLevel.Warn) {
    return console.warn;
  }

  return console.error;
};

const resolveRuntimeLogLevel = (
  method: string,
  options?: RuntimeDebugLogOptions,
): ExtensionLogLevel => {
  if (options?.level) {
    return options.level;
  }

  const kind = options?.kind ?? (method === "install" ? "install" : "intercept");
  return kind === "install" ? ExtensionLogLevel.Verbose : ExtensionLogLevel.Info;
};

const getConsoleHeadline = (
  component: string,
  method: string,
  kind: NonNullable<RuntimeDebugLogOptions["kind"]>,
): string =>
  kind === "install"
    ? `[Refract] ${component} patch installed`
    : `[Refract] ${component}.${method} intercepted`;

type RuntimeDiagInput = {
  component: string;
  method: string;
  args: unknown[];
  result: unknown;
  options?: RuntimeDebugLogOptions;
};

const createRuntimeDiagError = ({
  component,
  method,
  args,
  result,
  options,
}: RuntimeDiagInput): Error & ConsoleDiagMeta => {
  const kind = options?.kind ?? (method === "install" ? "install" : "intercept");
  const level = resolveRuntimeLogLevel(method, options);
  const headline = getConsoleHeadline(component, method, kind);

  return createConsoleDiagError(headline, {
    headline,
    component,
    method,
    kind,
    level,
    args,
    result,
  });
};

/**
 * Reduce an `Error.stack` to its frame lines, dropping the leading
 * `<name>: <message>` header that V8 prepends. Firefox/Safari stacks omit that
 * header entirely, so filtering by the headline text is a safe no-op there:
 * real frame lines never contain the human-readable headline.
 */
export const toStackFrames = (
  stack: string | undefined,
  headline: string,
): string[] => {
  if (!stack) {
    return [];
  }

  return stack
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.includes(headline));
};

type ConsoleDiagInput = {
  level: ExtensionLogLevel;
  headline: string;
  args: unknown;
  result: unknown;
  stack: string | undefined;
  argsLabel: string;
  resultLabel: string;
};

/**
 * Emit a single, level-aware console entry so DevTools level and text filters
 * keep working. The headline is logged as a plain string (readable + matchable),
 * and the trace is passed as a structured array of frames so it renders as an
 * expandable value like `Arguments:`/`Result:` instead of an inline string.
 */
export const logConsoleDiagnostic = (input: ConsoleDiagInput): void => {
  const log = getConsoleMethod(input.level);
  // A single level-aware call keeps DevTools level/text filters working, while
  // the `\n` separators in the format string put each label on its own line and
  // `%o` keeps args/result/trace as expandable (collapsible) values. The trace is
  // wrapped in an object so the collapsed preview stays a compact `{frames: Array(n)}`
  // instead of a top-level array, whose contents DevTools always previews inline.
  log(
    "%s\n%s %o\n%s %o\n%s %o",
    input.headline,
    input.argsLabel,
    input.args,
    input.resultLabel,
    input.result,
    "Trace:",
    { frames: toStackFrames(input.stack, input.headline) },
  );
};

const logRuntimeConsoleEvent = (
  diagnostic: Error & ConsoleDiagMeta,
  options?: RuntimeDebugLogOptions,
): void => {
  const argsLabel = options?.argsLabel ?? "Arguments:";
  const resultLabel =
    options?.resultLabel ??
    (diagnostic.kind === "install" ? "Configuration:" : "Result:");
  logConsoleDiagnostic({
    level: diagnostic.level,
    headline: diagnostic.headline,
    args: diagnostic.args,
    result: diagnostic.result,
    stack: diagnostic.stack,
    argsLabel,
    resultLabel,
  });
};

const toSerializable = (value: unknown, fallback: unknown): unknown => {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return fallback;
  }
};

const resolveSnapshot = (snapshotSource: DebugSnapshotSource): RuntimeDebugSnapshot => {
  if (typeof snapshotSource === "function") {
    return snapshotSource();
  }

  return snapshotSource;
};

let runtimeLogEmissionActive = false;

type RuntimeLogEventInput = RuntimeDiagInput & {
  snapshotSource: DebugSnapshotSource;
};

export const emitRuntimeLogEvent = ({
  snapshotSource,
  component,
  method,
  args,
  result,
  options,
}: RuntimeLogEventInput): void => {
  if (runtimeLogEmissionActive) {
    return;
  }

  runtimeLogEmissionActive = true;
  try {
    const snapshot = resolveSnapshot(snapshotSource);
    if (!snapshot?.debugMode || !snapshot.logEventName) {
      return;
    }

    const diagnostic = createRuntimeDiagError({
      component,
      method,
      args,
      result,
      ...(options ? { options } : {}),
    });
    if (options?.consoleOutput !== false) {
      logRuntimeConsoleEvent(diagnostic, options);
    }

    try {
      globalThis.postMessage(
        {
          type: __PT_LOG_EVENT_TYPE__,
          eventName: snapshot.logEventName,
          detail: JSON.stringify({
            component: diagnostic.component,
            method: diagnostic.method,
            kind: diagnostic.kind,
            level: diagnostic.level,
            message: diagnostic.message,
            stack: toStackFrames(diagnostic.stack, diagnostic.headline).join("\n"),
            args: toSerializable(args, ["<Unserializable Arguments>"]),
            result: toSerializable(result, "<Unserializable Result>"),
          }),
        },
        "*",
      );
    } catch {
      // Ignore dispatch errors
    }
  } finally {
    runtimeLogEmissionActive = false;
  }
};

export const createLogger =
  (snapshotSource: DebugSnapshotSource, component: string): RuntimeDebugLogger =>
  (method, args, result, options) =>
    emitRuntimeLogEvent({
      snapshotSource,
      component,
      method,
      args,
      result,
      ...(options ? { options } : {}),
    });

export const createOnceLogger = (
  snapshotSource: DebugSnapshotSource,
  component: string,
): RuntimeDebugLogger => {
  const emittedMethods = new Set<string>();

  return (method, args, result, options) => {
    if (runtimeLogEmissionActive) {
      return;
    }

    if (emittedMethods.has(method)) {
      return;
    }

    emittedMethods.add(method);
    emitRuntimeLogEvent({
      snapshotSource,
      component,
      method,
      args,
      result,
      ...(options ? { options } : {}),
    });
  };
};
