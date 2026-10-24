import { AnalystTrapsSchema, type AnalystTraps } from "@privacy-brand/xray-protocol";
import { z } from "zod";

import { EXTENSION_STORAGE_KEYS } from "@/shared/extension-contract";
import type { RuntimeSnapshot } from "@/shared/types";

const KEY = EXTENSION_STORAGE_KEYS.inspectorSessions;
const SessionSchema = z.object({
  hostname: z.string().min(1),
  desired: AnalystTrapsSchema.nullable(),
  document: AnalystTrapsSchema.nullable(),
});
export type InspectorSession = z.infer<typeof SessionSchema>;
let sessions: Record<string, InspectorSession> = {};
let initialization: Promise<void> | undefined;
let queue: Promise<unknown> = Promise.resolve();

export const initializeInspectors = (): Promise<void> => {
  initialization ??= chrome.storage.session
    .get(KEY)
    .then((stored) => {
      const parsed = z.record(SessionSchema).safeParse(stored[KEY]);
      sessions = parsed.success ? parsed.data : {};
    })
    .catch((error: unknown) => {
      initialization = undefined;
      throw error;
    });
  return initialization;
};

const mutate = (operation: () => void): Promise<void> => {
  const next = queue.then(async () => {
    await initializeInspectors();
    operation();
    await chrome.storage.session.set({ [KEY]: sessions });
  });
  queue = next.catch(() => undefined);
  return next;
};

export const readInspector = (
  tabId: number,
  hostname: string,
): InspectorSession | undefined => {
  const session = sessions[String(tabId)];
  return session?.hostname === hostname ? session : undefined;
};

export const storeInspector = (
  tabId: number,
  hostname: string,
  desired: AnalystTraps | null,
): Promise<void> =>
  mutate(() => {
    const document = readInspector(tabId, hostname)?.document ?? null;
    if (!desired && !document) delete sessions[String(tabId)];
    else sessions[String(tabId)] = { hostname, desired, document };
  });

export const removeInspector = (tabId: number): Promise<void> =>
  mutate(() => {
    delete sessions[String(tabId)];
  });

export const navigateInspector = (tabId: number, hostname: string): Promise<void> =>
  mutate(() => {
    const session = sessions[String(tabId)];
    if (session && session.hostname !== hostname) delete sessions[String(tabId)];
  });

/** A complete live update gives the current documents the desired selection. */
export const recordLiveInspector = (tabId: number, hostname: string): Promise<void> =>
  mutate(() => {
    const session = readInspector(tabId, hostname);
    if (!session) return;
    session.document = session.desired;
    if (!session.desired) delete sessions[String(tabId)];
  });

export const recordInspectorDocument = (
  tabId: number,
  hostname: string,
  snapshot: RuntimeSnapshot | null,
): Promise<void> =>
  mutate(() => {
    const session = readInspector(tabId, hostname);
    if (!session) return;
    session.document = snapshot?.analystTraps ?? null;
    if (!session.desired && !session.document) delete sessions[String(tabId)];
  });
