export const isUserScriptReady = ({
  hasPermission,
  registrationCount,
  lastSyncSucceeded,
}: {
  hasPermission: boolean;
  registrationCount: number;
  lastSyncSucceeded: boolean;
}): boolean => hasPermission && lastSyncSucceeded && registrationCount > 0;
