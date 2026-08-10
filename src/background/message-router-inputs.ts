import type { UpdateCurrentRuleInput } from "@/background/popup-command-types";
import type { EXTENSION_COMMAND_TYPES } from "@/shared/extension-contract";
import type { ExtensionCommand } from "@/shared/types";

export type ImportLocationsCommand = Extract<
  ExtensionCommand,
  { type: typeof EXTENSION_COMMAND_TYPES.importPresetLocations }
>;

export const getUpdateRuleInput = (
  command: Extract<
    ExtensionCommand,
    { type: typeof EXTENSION_COMMAND_TYPES.updateCurrentRule }
  >,
): UpdateCurrentRuleInput => ({
  locationId: command.locationId,
  patternMode: command.patternMode,
  replaceExisting: command.replaceExisting,
  blockServiceWorkers: command.blockServiceWorkerRegistration ?? false,
  relaxCspForWorkers: command.relaxCspForWorkers ?? false,
  ...(command.tabId !== undefined ? { tabId: command.tabId } : {}),
  ...(command.hostname ? { hostnameOverride: command.hostname } : {}),
  ...(command.createExactOverride !== undefined
    ? { createExactOverride: command.createExactOverride }
    : {}),
  ...(command.serviceWorkerOverride !== undefined
    ? { serviceWorkerOverride: command.serviceWorkerOverride }
    : {}),
  ...(command.regionalPresetEnabled !== undefined
    ? { regionalPresetEnabled: command.regionalPresetEnabled }
    : {}),
  ...(command.workerHandlingOverride !== undefined
    ? { workerHandlingOverride: command.workerHandlingOverride }
    : {}),
});
