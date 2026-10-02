import {
  isSettingsImportActive,
  needsImportRecovery,
} from "@/background/settings-import-progress";

export const createMigrationGuard = (deps: {
  recover: () => Promise<boolean>;
  migrate: () => Promise<void>;
  rebuildRuntime: () => Promise<void>;
}): (() => Promise<void>) => {
  let pending: Promise<void> | null = null;
  let migrated = false;
  let rebuildNeeded = false;
  return async () => {
    if (pending) return pending;
    const recover = !migrated || (!isSettingsImportActive() && needsImportRecovery());
    if (!recover && !rebuildNeeded) return;
    pending = (async () => {
      if (recover) rebuildNeeded = (await deps.recover()) || rebuildNeeded;
      if (!migrated) {
        await deps.migrate();
        migrated = true;
      }
      // Recovery removes its journal. Retain this obligation independently until
      // cached state, preloads and persistent header rules have all converged.
      if (rebuildNeeded) {
        await deps.rebuildRuntime();
        rebuildNeeded = false;
      }
    })().finally(() => {
      pending = null;
    });
    return pending;
  };
};
