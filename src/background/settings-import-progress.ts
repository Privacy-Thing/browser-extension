let active = false;
let recoveryNeeded = false;
export const isSettingsImportActive = (): boolean => active;
export const needsImportRecovery = (): boolean => recoveryNeeded;
export const setImportProgress = (state: {
  active: boolean;
  recoveryNeeded: boolean;
}): void => {
  active = state.active;
  recoveryNeeded = state.recoveryNeeded;
};
