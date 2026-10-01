import {
  withConfigurationLock,
  withConfigMutation,
} from "@/background/settings-import-transaction";
import { EXTENSION_COMMAND_TYPES } from "@/shared/extension-contract";

export const coordinatedCommands = new Set<string>([
  EXTENSION_COMMAND_TYPES.getSettings,
  EXTENSION_COMMAND_TYPES.getPopupState,
  EXTENSION_COMMAND_TYPES.exportSettings,
  EXTENSION_COMMAND_TYPES.previewSettingsImport,
  EXTENSION_COMMAND_TYPES.importSettings,
  EXTENSION_COMMAND_TYPES.undoSettingsImport,
  EXTENSION_COMMAND_TYPES.getImportUndoStatus,
  EXTENSION_COMMAND_TYPES.saveSimpleSettings,
  EXTENSION_COMMAND_TYPES.saveLocationModel,
  EXTENSION_COMMAND_TYPES.resetSettings,
  EXTENSION_COMMAND_TYPES.loadSampleData,
  EXTENSION_COMMAND_TYPES.importPresetLocations,
  EXTENSION_COMMAND_TYPES.upsertTrustedSite,
  EXTENSION_COMMAND_TYPES.setTrustedSiteEnabled,
  EXTENSION_COMMAND_TYPES.assignDomainLocation,
  EXTENSION_COMMAND_TYPES.updateCurrentRule,
  EXTENSION_COMMAND_TYPES.toggleCurrentRule,
  EXTENSION_COMMAND_TYPES.deleteCurrentRule,
  EXTENSION_COMMAND_TYPES.acceptPopupSuggestion,
  EXTENSION_COMMAND_TYPES.applyPopupPolicyAction,
  EXTENSION_COMMAND_TYPES.rotateIdentityTarget,
]);
const importReadCommands = new Set<string>([
  EXTENSION_COMMAND_TYPES.getSettings,
  EXTENSION_COMMAND_TYPES.getPopupState,
  EXTENSION_COMMAND_TYPES.exportSettings,
  EXTENSION_COMMAND_TYPES.previewSettingsImport,
  EXTENSION_COMMAND_TYPES.importSettings,
  EXTENSION_COMMAND_TYPES.undoSettingsImport,
  EXTENSION_COMMAND_TYPES.getImportUndoStatus,
]);

export const coordinateMessage = (
  type: string,
  dispatch: (respond: (response?: unknown) => void) => boolean,
): Promise<unknown> => {
  const coordinate = importReadCommands.has(type)
    ? withConfigurationLock
    : withConfigMutation;
  return coordinate(
    () =>
      new Promise<unknown>((resolve) => {
        if (!dispatch(resolve)) resolve(undefined);
      }),
  );
};
