export type ChromiumSnapshotChannel =
  "hash" | "dom-handoff" | "runtime-message" | "miss";

export type ChromiumResolution<S> = {
  snapshot: S | null;
  channel: ChromiumSnapshotChannel;
};

export type ChromiumEarlyReaders<S> = {
  readHashSnapshot: () => S | null;
  readDomHandoffSnapshot: () => S | null;
};

export type ChromiumAdapterDeps<S> = ChromiumEarlyReaders<S> & {
  cleanupDomHandoff: () => void;
  resolveBgSnapshot: (hostname: string) => Promise<S | null>;
  runtimeMessageTimeoutMs?: number;
};

export const readEarlySnapshot = <S>(
  _readers: ChromiumEarlyReaders<S>,
): ChromiumResolution<S> => {
  return { snapshot: null, channel: "miss" };
};

export const resolveChromiumSnapshot = async <S>(
  _hostname: string,
  _deps: ChromiumAdapterDeps<S>,
): Promise<ChromiumResolution<S>> => {
  return { snapshot: null, channel: "miss" };
};
