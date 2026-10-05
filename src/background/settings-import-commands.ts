import { validateImportedSettings } from "@/background/settings";
import type { SettingsCommandDeps } from "@/background/settings-command-types";
import {
  diffImportedSettings,
  planSettingsImport,
} from "@/background/settings-import-plan";
import {
  configurationFingerprint,
  configurationToExport,
  importedConfiguration,
  readConfiguration,
  readConfigRevision,
  type ConfigurationSnapshot,
} from "@/background/settings-import-storage";
import {
  applySettingsImport,
  getImportUndoStatus,
  undoSettingsImport,
} from "@/background/settings-import-transaction";
import {
  EXTENSION_COMMAND_TYPES,
  EXTENSION_STORAGE_KEYS,
} from "@/shared/extension-contract";
import { withContainerSeed } from "@/shared/rule-seed";
import { normalizePreferences } from "@/shared/settings-defaults";
import type {
  SettingsImportPreview,
  SettingsImportSelection,
  ImportPreviewResponse,
} from "@/shared/settings-import";
import type {
  ExtensionCommand,
  ImportSettingsResponse,
  ExportedSettings,
} from "@/shared/types";
import { getBrowserContainers } from "@/targets/firefox/containers-api";

type PreviewCommand = Extract<
  ExtensionCommand,
  { type: typeof EXTENSION_COMMAND_TYPES.previewSettingsImport }
>;
type ImportCommand = Extract<
  ExtensionCommand,
  { type: typeof EXTENSION_COMMAND_TYPES.importSettings }
>;
type PendingPreview = {
  preview: SettingsImportPreview;
  beforeFingerprint: string;
  revision: string;
  after: ConfigurationSnapshot;
  expiresAt: number;
};

const importError = (error: unknown) => ({
  ok: false as const,
  error: error instanceof Error ? error.message : "Import failed.",
});
const responseFromSettings = (
  settings: ExportedSettings,
): Extract<ImportSettingsResponse, { ok: true }> => ({
  ...settings,
  ...normalizePreferences(settings),
  ok: true,
  trustedSites: settings.trustedSites ?? [],
});

type ImportContext = {
  deps: SettingsCommandDeps;
  previews: Map<string, PendingPreview>;
};
export const rebuildImportRuntime = async (
  deps: Pick<
    SettingsCommandDeps,
    | "setCachedValues"
    | "syncPreloadedState"
    | "resyncActiveHeaderRules"
    | "refreshFxInjectionMode"
    | "reloadTabs"
    | "getActiveTabContexts"
  >,
): Promise<void> => {
  const settings = configurationToExport(await readConfiguration());
  deps.setCachedValues({
    ...normalizePreferences(settings),
    profiles: settings.locations,
    rules: settings.rules,
    trustedSites: settings.trustedSites ?? [],
    containerAssignments: settings.containerAssignments ?? [],
    sharedSpoofing: settings.sharedSpoofing,
    globalFallbackRule: settings.globalFallbackRule,
  });
  await deps.syncPreloadedState();
  await deps.resyncActiveHeaderRules();
  await deps.refreshFxInjectionMode();
  await deps.reloadTabs(deps.getActiveTabContexts().map((context) => context.tabId));
};

const previewSettingsImport = async (
  { deps, previews }: ImportContext,
  command: PreviewCommand,
): Promise<ImportPreviewResponse> => {
  try {
    // Validate before touching even migration state; normalizing mints missing
    // nonces once and the retained candidate is exactly what confirmation writes.
    validateImportedSettings(command.settings);
    await deps.ensureStorageMigration();
    const before = await readConfiguration();
    const current = configurationToExport(before);
    const source = configurationToExport(
      importedConfiguration({
        ...command.settings,
        onboardingCompleted:
          command.settings.onboardingCompleted ??
          normalizePreferences(current).onboardingCompleted,
      }),
    );
    const localContainers = await getBrowserContainers();
    const selection: SettingsImportSelection = command.selection ?? {
      mode: "replace",
      locations: {},
      rules: {},
      containers: {},
    };
    const planned = planSettingsImport({
      current,
      source,
      selection,
      localContainerIds: new Set(localContainers.map((item) => item.cookieStoreId)),
    });
    if (selection.mode === "replace") {
      const assignments = planned.settings.containerAssignments ?? [];
      const assignedIds = new Set(
        assignments.map((assignment) => assignment.cookieStoreId),
      );
      planned.settings.containerAssignments = [
        ...assignments,
        ...localContainers
          .filter((container) => !assignedIds.has(container.cookieStoreId))
          .map((container) =>
            withContainerSeed({ cookieStoreId: container.cookieStoreId }),
          ),
      ];
    }
    let after: ConfigurationSnapshot;
    if (selection.mode === "merge") {
      after = {
        ...before,
        [EXTENSION_STORAGE_KEYS.locations]: planned.settings.locations,
        [EXTENSION_STORAGE_KEYS.rules]: planned.settings.rules,
        [EXTENSION_STORAGE_KEYS.containerAssignments]:
          planned.settings.containerAssignments ?? [],
      };
    } else after = importedConfiguration(planned.settings);
    const token = crypto.randomUUID();
    const preview: SettingsImportPreview = {
      token,
      source,
      selection,
      localContainers,
      conflicts: {
        locations: source.locations
          .filter((item) => current.locations.some((local) => local.id === item.id))
          .map((item) => item.id),
        rules: source.rules
          .filter((item) =>
            current.rules.some((local) => local.pattern === item.pattern),
          )
          .map((item) => item.pattern),
      },
      changes: diffImportedSettings(current, configurationToExport(after)),
      problems: planned.problems,
    };
    for (const [id, pending] of previews)
      if (pending.expiresAt <= Date.now()) previews.delete(id);
    if (command.previousToken) previews.delete(command.previousToken);
    if (previews.size >= 20) previews.delete(previews.keys().next().value ?? "");
    previews.set(token, {
      preview,
      beforeFingerprint: await configurationFingerprint(before),
      revision: await readConfigRevision(),
      after,
      expiresAt: Date.now() + 15 * 60 * 1000,
    });
    return { ok: true, preview };
  } catch (error) {
    return importError(error);
  }
};

const importSettings = async (
  context: ImportContext,
  command: ImportCommand,
): Promise<ImportSettingsResponse> => {
  const { deps, previews } = context;
  try {
    let token = command.previewToken;
    // Retained for deliberate programmatic imports (SettingsAPI and test setup).
    // File pickers always use preview + explicit confirmation.
    if (!token && command.settings) {
      const response = await previewSettingsImport(context, {
        type: EXTENSION_COMMAND_TYPES.previewSettingsImport,
        settings: command.settings,
      });
      if (!response.ok) return response;
      token = response.preview.token;
    }
    const pending = token ? previews.get(token) : undefined;
    if (!pending || pending.expiresAt <= Date.now())
      throw new Error("Import preview expired. Review the file again.");
    if (pending.preview.problems.length > 0)
      throw new Error(pending.preview.problems.join("\n"));
    await deps.ensureStorageMigration();
    const before = await readConfiguration();
    if (
      (await configurationFingerprint(before)) !== pending.beforeFingerprint ||
      (await readConfigRevision()) !== pending.revision
    )
      throw new Error("Settings changed after the preview. Review the import again.");
    const localIds = new Set(
      (await getBrowserContainers()).map((item) => item.cookieStoreId),
    );
    for (const id of Object.values(pending.preview.selection.containers))
      if (id && !localIds.has(id))
        throw new Error(`Local container is unavailable: ${id}`);
    previews.delete(token ?? "");
    await applySettingsImport({
      before,
      after: pending.after,
      rebuildRuntime: () => rebuildImportRuntime(deps),
    });
    return responseFromSettings(configurationToExport(pending.after));
  } catch (error) {
    return importError(error);
  }
};

const undoImport = async (
  deps: SettingsCommandDeps,
): Promise<ImportSettingsResponse> => {
  try {
    await deps.ensureStorageMigration();
    await undoSettingsImport(() => rebuildImportRuntime(deps));
    return responseFromSettings(configurationToExport(await readConfiguration()));
  } catch (error) {
    return importError(error);
  }
};
export const createImportHandlers = (deps: SettingsCommandDeps) => {
  const context: ImportContext = { deps, previews: new Map() };
  return {
    previewSettingsImport: (command: PreviewCommand) =>
      previewSettingsImport(context, command),
    importSettings: (command: ImportCommand) => importSettings(context, command),
    undoSettingsImport: () => undoImport(deps),
    getImportUndoStatus: async () => {
      await deps.ensureStorageMigration();
      return getImportUndoStatus();
    },
  };
};
