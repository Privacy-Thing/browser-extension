export enum LogCategory {
  Geo = "Geo",
  Locale = "Locale",
  Date = "Date",
  System = "System",
}

export enum ExtensionLogLevel {
  Verbose = "verbose",
  Info = "info",
  Warn = "warn",
  Error = "error",
}

const LOG_LEVEL_PRIORITY = [
  ExtensionLogLevel.Verbose,
  ExtensionLogLevel.Info,
  ExtensionLogLevel.Warn,
  ExtensionLogLevel.Error,
] as const;

export const normalizeLogLevel = (value: unknown): ExtensionLogLevel => {
  if (value === "debug") {
    return ExtensionLogLevel.Verbose;
  }

  if (
    typeof value === "string" &&
    LOG_LEVEL_PRIORITY.includes(value as ExtensionLogLevel)
  ) {
    return value as ExtensionLogLevel;
  }

  return ExtensionLogLevel.Info;
};

export const getLogLevelsAtOrAbove = (
  minimumLevel: ExtensionLogLevel,
): ExtensionLogLevel[] => {
  const minimumIndex = LOG_LEVEL_PRIORITY.indexOf(minimumLevel);
  return minimumIndex === -1
    ? [...LOG_LEVEL_PRIORITY]
    : [...LOG_LEVEL_PRIORITY.slice(minimumIndex)];
};

export type ExtensionLogEntry = {
  id: string;
  time: string;
  category: LogCategory;
  level: ExtensionLogLevel;
  event: string;
  hostname?: string;
  tabId?: number;
  details?: Record<string, unknown> | unknown[];
};

export type GetLogsResponse = {
  ok: true;
  logs: ExtensionLogEntry[];
};

export type ClearLogsResponse = {
  ok: true;
};
