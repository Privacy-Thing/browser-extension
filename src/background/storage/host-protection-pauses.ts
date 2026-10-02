import { EXTENSION_STORAGE_KEYS } from "@/shared/extension-contract";
import {
  findHostPause,
  HOST_PAUSE_DURATION_MS,
  isHostPauseActive,
  parseHostPauses,
  type HostProtectionPause,
  type HostPauseStatus,
} from "@/shared/host-protection-pause";

export const HOST_PAUSE_ALARM = "host-protection-pause-expiry";
const PAUSES_KEY = EXTENSION_STORAGE_KEYS.hostProtectionPauses;
const DOCUMENTS_KEY = EXTENSION_STORAGE_KEYS.pausedDocuments;
type PausedDocument = { hostname: string; pauseId: string };
let pauses: HostProtectionPause[] = [];
let documents: Record<string, PausedDocument> = {};
let initialization: Promise<void> | undefined;
let queue: Promise<unknown> = Promise.resolve();

// Session storage survives extension worker suspension, but not browser exit or
// crash. Only deadline-based exceptions are restored from local storage.
export const initializeHostPauses = (): Promise<void> => {
  initialization ??= (async () => {
    const [local, session] = await Promise.all([
      chrome.storage.local.get(PAUSES_KEY),
      chrome.storage.session.get([PAUSES_KEY, DOCUMENTS_KEY]),
    ]);
    pauses = [
      ...parseHostPauses(local[PAUSES_KEY]).filter((pause) => pause.expiresAt !== null),
      ...parseHostPauses(session[PAUSES_KEY]).filter(
        (pause) => pause.expiresAt === null,
      ),
    ];
    const storedDocuments: unknown = session[DOCUMENTS_KEY];
    if (storedDocuments && typeof storedDocuments === "object") {
      documents = Object.fromEntries(
        Object.entries(storedDocuments).filter(
          (entry): entry is [string, PausedDocument] => {
            const value: unknown = entry[1];
            return Boolean(
              value &&
              typeof value === "object" &&
              "hostname" in value &&
              typeof value.hostname === "string" &&
              "pauseId" in value &&
              typeof value.pauseId === "string",
            );
          },
        ),
      );
    }
    await scheduleHostPauseAlarm();
  })().catch((error: unknown) => {
    initialization = undefined;
    throw error;
  });
  return initialization;
};

const serialize = <T>(operation: () => Promise<T>): Promise<T> => {
  const next = queue.then(operation, operation);
  queue = next.catch(() => undefined);
  return next;
};

export const getHostPauses = (): readonly HostProtectionPause[] => pauses;
export const getHostPause = (hostname: string): HostProtectionPause | undefined =>
  findHostPause(hostname, pauses);

const scheduleHostPauseAlarm = async (): Promise<void> => {
  const deadlines = pauses.flatMap((pause) =>
    pause.expiresAt === null ? [] : [pause.expiresAt],
  );
  if (deadlines.length > 0) {
    await chrome.alarms.create(HOST_PAUSE_ALARM, {
      when: Math.max(Date.now(), Math.min(...deadlines)),
    });
  } else {
    await chrome.alarms.clear(HOST_PAUSE_ALARM);
  }
};

const persistPauses = async (): Promise<void> => {
  await Promise.all([
    chrome.storage.local.set({
      [PAUSES_KEY]: pauses.filter((pause) => pause.expiresAt !== null),
    }),
    chrome.storage.session.set({
      [PAUSES_KEY]: pauses.filter((pause) => pause.expiresAt === null),
    }),
  ]);
  await scheduleHostPauseAlarm();
};

export const setHostPause = (
  hostname: string,
  duration: "ten-minutes" | "session" | "resume",
): Promise<void> =>
  serialize(async () => {
    await initializeHostPauses();
    pauses = pauses.filter((pause) => pause.hostname !== hostname);
    if (duration !== "resume") {
      pauses.push({
        hostname,
        id: crypto.randomUUID(),
        expiresAt: duration === "session" ? null : Date.now() + HOST_PAUSE_DURATION_MS,
      });
    }
    await persistPauses();
  });

export const expireHostPauses = (): Promise<string[]> =>
  serialize(async () => {
    await initializeHostPauses();
    const expired = pauses.filter((pause) => !isHostPauseActive(pause));
    if (expired.length === 0) return [];
    pauses = pauses.filter((pause) => isHostPauseActive(pause));
    await persistPauses();
    return expired.map((pause) => pause.hostname);
  });

export const getHostPauseStatus = (
  hostname: string,
  tabId: number | undefined,
): HostPauseStatus => {
  const pause = getHostPause(hostname) ?? null;
  const document = tabId === undefined ? undefined : documents[String(tabId)];
  const documentPauseId =
    document?.hostname === hostname ? document.pauseId : undefined;
  return {
    pause,
    reloadRequired: pause
      ? documentPauseId !== pause.id
      : documentPauseId !== undefined,
  };
};

/** Records the decision for a newly committed document, not a cache refresh. */
export const recordPausedDocument = (
  tabId: number,
  hostname: string,
  pauseId?: string,
): Promise<void> =>
  serialize(async () => {
    await initializeHostPauses();
    if (pauseId) documents[String(tabId)] = { hostname, pauseId };
    else delete documents[String(tabId)];
    await chrome.storage.session.set({ [DOCUMENTS_KEY]: documents });
  });
