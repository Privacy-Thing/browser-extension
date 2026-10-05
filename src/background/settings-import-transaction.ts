import {
  needsImportRecovery,
  setImportProgress,
} from "@/background/settings-import-progress";
export { isSettingsImportActive } from "@/background/settings-import-progress";
import {
  configurationFingerprint,
  CONFIG_REVISION_KEY,
  IMPORT_JOURNAL_KEY,
  IMPORT_RETENTION_MS,
  readConfiguration,
  readImportJournal,
  writeConfiguration,
  type ConfigurationSnapshot,
  type ImportJournal,
} from "@/background/settings-import-storage";
import { fireAndForget } from "@/shared/async";

export const IMPORT_EXPIRY_ALARM = "pt.settings-import-expiry";
let configurationQueue: Promise<unknown> = Promise.resolve();

/** UI mutations, container reconciliation and import confirmation share this queue. */
export const withConfigurationLock = <T>(operation: () => Promise<T>): Promise<T> => {
  const result = configurationQueue.catch(() => undefined).then(operation);
  configurationQueue = result;
  return result;
};

export const applySettingsImport = async (input: {
  before: ConfigurationSnapshot;
  after: ConfigurationSnapshot;
  rebuildRuntime: () => Promise<void>;
}): Promise<void> => {
  const journal: ImportJournal = {
    version: 1,
    phase: "pending",
    before: input.before,
    afterFingerprint: await configurationFingerprint(input.after),
    expiresAt: Date.now() + IMPORT_RETENTION_MS,
  };
  // Await durable recovery data before the first configuration write.
  await chrome.storage.local.set({ [IMPORT_JOURNAL_KEY]: journal });
  setImportProgress({ active: true, recoveryNeeded: true });
  try {
    await writeConfiguration(input.after);
    await input.rebuildRuntime();
    await chrome.storage.local.set({
      [IMPORT_JOURNAL_KEY]: { ...journal, phase: "committed" },
    });
    setImportProgress({ active: true, recoveryNeeded: false });
  } catch (error) {
    // Keep a pending record until both storage and runtime are restored. A restart
    // retries recovery if either restoration failed (including storage outages).
    await chrome.storage.local.set({ [IMPORT_JOURNAL_KEY]: journal });
    await writeConfiguration(input.before);
    await input.rebuildRuntime();
    await chrome.storage.local.remove(IMPORT_JOURNAL_KEY);
    setImportProgress({ active: true, recoveryNeeded: false });
    throw error;
  } finally {
    setImportProgress({ active: false, recoveryNeeded: needsImportRecovery() });
  }
};

export const getImportUndoStatus = async () => {
  const journal = await readImportJournal();
  const available =
    journal?.phase === "committed" &&
    journal.expiresAt > Date.now() &&
    journal.afterFingerprint ===
      (await configurationFingerprint(await readConfiguration()));
  return {
    ok: true as const,
    available,
    expiresAt: available ? journal.expiresAt : null,
  };
};

export const undoSettingsImport = async (
  rebuildRuntime: () => Promise<void>,
): Promise<void> => {
  const journal = await readImportJournal();
  if (!journal || !(await getImportUndoStatus()).available) {
    throw new Error("Undo is unavailable after another edit or after 7 days.");
  }
  // Interruption during undo converges to the pre-import snapshot on restart.
  await chrome.storage.local.set({
    [IMPORT_JOURNAL_KEY]: { ...journal, phase: "pending" },
  });
  setImportProgress({ active: true, recoveryNeeded: true });
  try {
    await writeConfiguration(journal.before);
    await rebuildRuntime();
    await chrome.storage.local.remove(IMPORT_JOURNAL_KEY);
    setImportProgress({ active: true, recoveryNeeded: false });
  } finally {
    setImportProgress({ active: false, recoveryNeeded: needsImportRecovery() });
  }
};

export const expireSettingsImportCopy = async (): Promise<void> => {
  const journal = await readImportJournal();
  if (journal?.phase === "committed" && !(await getImportUndoStatus()).available)
    await chrome.storage.local.remove(IMPORT_JOURNAL_KEY);
};

export const withConfigMutation = <T>(operation: () => Promise<T>): Promise<T> =>
  withConfigurationLock(async () => {
    const before = await configurationFingerprint(await readConfiguration());
    try {
      return await operation();
    } finally {
      const after = await configurationFingerprint(await readConfiguration());
      if (before !== after) {
        await chrome.storage.local.set({
          [CONFIG_REVISION_KEY]: crypto.randomUUID(),
        });
        const journal = await readImportJournal();
        if (journal?.phase === "committed")
          await chrome.storage.local.remove(IMPORT_JOURNAL_KEY);
      }
    }
  });

export const registerImportExpiry = (): void => {
  fireAndForget(
    chrome.alarms.get(IMPORT_EXPIRY_ALARM).then((alarm) => {
      if (!alarm)
        return chrome.alarms.create(IMPORT_EXPIRY_ALARM, { periodInMinutes: 60 });
    }),
  );
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === IMPORT_EXPIRY_ALARM)
      fireAndForget(withConfigurationLock(expireSettingsImportCopy));
  });
};
