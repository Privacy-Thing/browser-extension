import type { ValidatedSettingsCommand } from "@/background/settings";

export const shouldSyncPreload = (command: ValidatedSettingsCommand): boolean =>
  command.debugMode !== undefined ||
  command.watchPositionDelay !== undefined ||
  command.browserFingerprintSpoofingEnabled !== undefined ||
  command.featureFlags !== undefined ||
  command.sharedWorkerHandlingMode !== undefined ||
  command.sharedWorkerCompatibilityMode !== undefined ||
  Object.hasOwn(command, "sharedSpoofing") ||
  Object.hasOwn(command, "globalFallbackRule") ||
  Object.hasOwn(command, "trustedSites");

export const shouldSyncHeaderRules = (command: ValidatedSettingsCommand): boolean =>
  command.browserFingerprintSpoofingEnabled !== undefined ||
  command.sharedWorkerHandlingMode !== undefined ||
  Object.hasOwn(command, "sharedSpoofing") ||
  Object.hasOwn(command, "globalFallbackRule") ||
  Object.hasOwn(command, "trustedSites");

export const shouldReloadRuntimeTabs = (command: ValidatedSettingsCommand): boolean =>
  command.featureFlags !== undefined ||
  command.sharedWorkerHandlingMode !== undefined ||
  command.sharedWorkerCompatibilityMode !== undefined;
