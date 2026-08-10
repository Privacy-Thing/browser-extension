export type FirefoxSnapshotChannel = "preloaded-state" | "background-message" | "miss";

export type FxSnapshotResolution<S> = {
  snapshot: S | null;
  channel: FirefoxSnapshotChannel;
};

export type FxUserScriptsReady = {
  hasPermission: boolean;
  registrationCount: number;
  lastSyncSucceeded: boolean;
  ready: boolean;
};

export type FirefoxAdapterDeps<S> = {
  readPreloadedState: () => Promise<any | null>;
  resolvePreloadedSnapshot: (hostname: string, state: any | null) => S | null;
  resolveBgSnapshot: (hostname: string) => Promise<S | null>;
  runtimeMessageTimeoutMs?: number;
  queryUserScriptsReady: () => Promise<FxUserScriptsReady>;
};

export const resolveFirefoxSnapshot = async <S>(
  _hostname: string,
  _deps: FirefoxAdapterDeps<S>,
): Promise<FxSnapshotResolution<S>> => {
  return { snapshot: null, channel: "miss" };
};

export const checkFxUserScriptsReady = async (
  _deps: Pick<FirefoxAdapterDeps<any>, "queryUserScriptsReady">,
): Promise<FxUserScriptsReady> => {
  return {
    hasPermission: false,
    registrationCount: 0,
    lastSyncSucceeded: false,
    ready: false,
  };
};
