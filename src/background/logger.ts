import {
  ExtensionLogLevel,
  normalizeLogLevel,
  type ClearLogsResponse,
  type ExtensionLogEntry,
  type LogCategory,
  type GetLogsResponse,
} from "@/shared/types";

const MAX_LOG_ENTRIES = 250;
let logBuffer: ExtensionLogEntry[] | null = null;
let logQueue: Promise<void> = Promise.resolve();

export type ExtensionLogInput = {
  enabled: boolean;
  category: LogCategory;
  event: string;
  payload?: Omit<ExtensionLogEntry, "id" | "time" | "category" | "level" | "event">;
  level?: ExtensionLogLevel;
};

const normalizeLogEntry = (entry: unknown): ExtensionLogEntry | null => {
  if (!entry || typeof entry !== "object") {
    return null;
  }

  const candidate = entry as Partial<ExtensionLogEntry>;
  if (
    typeof candidate.id !== "string" ||
    typeof candidate.time !== "string" ||
    typeof candidate.category !== "string" ||
    typeof candidate.event !== "string"
  ) {
    return null;
  }

  return {
    id: candidate.id,
    time: candidate.time,
    category: candidate.category as LogCategory,
    level: normalizeLogLevel(candidate.level),
    event: candidate.event,
    ...(typeof candidate.hostname === "string" ? { hostname: candidate.hostname } : {}),
    ...(typeof candidate.tabId === "number" ? { tabId: candidate.tabId } : {}),
    ...(candidate.details !== undefined ? { details: candidate.details } : {}),
  };
};

const ensureLogsLoaded = async () => {
  if (logBuffer !== null) return;
  const { logs } = await chrome.storage.session.get("logs");
  logBuffer = Array.isArray(logs)
    ? logs
        .map((entry) => normalizeLogEntry(entry))
        .filter((entry): entry is ExtensionLogEntry => entry !== null)
    : [];
};

const enqueueLogOperation = async <T>(operation: () => Promise<T>): Promise<T> => {
  const queuedOperation = logQueue.catch(() => undefined).then(operation);
  logQueue = queuedOperation.then(
    () => undefined,
    () => undefined,
  );
  return queuedOperation;
};

export const logExtensionEvent = ({
  enabled,
  category,
  event,
  payload = {},
  level = ExtensionLogLevel.Info,
}: ExtensionLogInput): void => {
  if (!enabled) {
    return;
  }

  void enqueueLogOperation(async () => {
    await ensureLogsLoaded();

    logBuffer!.unshift({
      id: `${Date.now()}-${crypto.randomUUID()}`,
      time: new Date().toISOString(),
      category,
      level,
      event,
      ...payload,
    });

    if (logBuffer!.length > MAX_LOG_ENTRIES) {
      logBuffer!.length = MAX_LOG_ENTRIES;
    }

    await chrome.storage.session.set({ logs: logBuffer });
  });
};

export const waitForExtensionLogQueue = async (): Promise<void> => {
  await logQueue;
};

export const getExtensionLogs = async (): Promise<GetLogsResponse> => {
  await waitForExtensionLogQueue();
  await ensureLogsLoaded();
  return {
    ok: true,
    logs: [...logBuffer!],
  };
};

export const clearExtensionLogs = async (): Promise<ClearLogsResponse> => {
  await enqueueLogOperation(async () => {
    logBuffer = [];
    await chrome.storage.session.remove("logs");
  });
  return { ok: true };
};
