import {
  createIntegrityRegistry,
  type SurfaceIntegrityRegistry,
} from "../integrity/surface-integrity-registry";
import type { RuntimeSnapshot } from "../types/snapshot";

import {
  createPrivateMap,
  createPrivateSet,
  createPrivateWeakMap,
  privateMapDelete,
  privateDateNow,
  privateMapGet,
  privateMapSet,
  privateWeakMapGet,
  privateWeakMapSet,
} from "./primordials";

export type PendingInstaller = {
  name: RefractModuleName;
  installer: (state: RefractRuntimeState) => (() => void) | void;
};

export type PrivateQueue<T> = {
  entries: Map<number, T>;
  head: number;
  tail: number;
  length: number;
};

export const createPrivateQueue = <T>(): PrivateQueue<T> => ({
  entries: createPrivateMap<number, T>(),
  head: 0,
  tail: 0,
  length: 0,
});

export const enqueuePrivateQueue = <T>(queue: PrivateQueue<T>, value: T): void => {
  privateMapSet(queue.entries, queue.tail, value);
  queue.tail += 1;
  queue.length += 1;
};

export const drainPrivateQueue = <T>(
  queue: PrivateQueue<T>,
  consume: (value: T) => void,
): void => {
  while (queue.head < queue.tail) {
    const index = queue.head;
    queue.head += 1;
    const value = privateMapGet(queue.entries, index);
    privateMapDelete(queue.entries, index);
    queue.length -= 1;
    if (value !== undefined) consume(value);
  }
  queue.head = 0;
  queue.tail = 0;
  queue.length = 0;
};

export const isPrivateQueueEmpty = <T>(queue: PrivateQueue<T>): boolean =>
  queue.head === queue.tail;

export type RefractModuleName =
  | "native-mask"
  | "logger"
  | "surface-usage"
  | "navigator"
  | "navigator-fingerprint"
  | "client-hints"
  | "battery"
  | "date"
  | "date-intl"
  | "intl"
  | "geolocation"
  | "permissions"
  | "screen"
  | "canvas"
  | "audio"
  | "webgl"
  | "webrtc"
  | "worker-runtime"
  | "dedicated-workers"
  | "shared-workers"
  | "service-worker-register"
  | "iframes"
  | "xray-bridge";

export interface GeolocationRuntimeState {
  lastPosition: GeolocationPosition | null;
  lastPositionTime: number | null;
  nextWatchId: number;
  watchers: Map<
    number,
    {
      successCallback: PositionCallback;
      errorCallback: PositionErrorCallback | null;
      options: PositionOptions | null;
      timerId: any;
    }
  >;
}

export interface WorkerRuntimeState {
  patched: boolean;
}

export interface LoggerRuntimeState {
  level: string;
}

export interface RefractRuntimeState {
  version: string;
  installed: boolean;
  installedBy?: "early" | "runtime" | "iframe" | "worker" | "test";
  installedAt: number;

  snapshot?: RuntimeSnapshot;
  snapshotHash?: string;

  modules: Set<RefractModuleName>;
  integrity: SurfaceIntegrityRegistry;

  geolocation?: GeolocationRuntimeState;
  workers?: WorkerRuntimeState;
  logger?: LoggerRuntimeState;

  teardown: PrivateQueue<() => void>;
  pendingInstallers: PrivateQueue<PendingInstaller>;
}

export type RefractRuntimeStateStore = {
  getOrCreate(
    targetGlobal: typeof globalThis,
    namespace: string,
    version: string,
  ): RefractRuntimeState;
  get(
    targetGlobal: typeof globalThis,
    namespace: string,
  ): RefractRuntimeState | undefined;
};

/** Creates a bundle-private runtime store without publishing state on the page global. */
export const createRuntimeStateStore = (): RefractRuntimeStateStore => {
  const statesByGlobal = createPrivateWeakMap<
    object,
    Map<string, RefractRuntimeState>
  >();

  const getNamespaceStates = (
    targetGlobal: typeof globalThis,
  ): Map<string, RefractRuntimeState> | undefined =>
    privateWeakMapGet(statesByGlobal, targetGlobal);

  return {
    getOrCreate(targetGlobal, namespace, version) {
      let namespaceStates = getNamespaceStates(targetGlobal);
      if (!namespaceStates) {
        namespaceStates = createPrivateMap<string, RefractRuntimeState>();
        privateWeakMapSet(statesByGlobal, targetGlobal, namespaceStates);
      }

      const existing = privateMapGet(namespaceStates, namespace);
      if (existing) {
        return existing;
      }

      const state: RefractRuntimeState = {
        version,
        installed: false,
        installedAt: 0,
        modules: createPrivateSet<RefractModuleName>(),
        integrity: createIntegrityRegistry(),
        teardown: createPrivateQueue<() => void>(),
        pendingInstallers: createPrivateQueue<PendingInstaller>(),
      };
      privateMapSet(namespaceStates, namespace, state);
      return state;
    },
    get(targetGlobal, namespace) {
      const namespaceStates = getNamespaceStates(targetGlobal);
      return namespaceStates ? privateMapGet(namespaceStates, namespace) : undefined;
    },
  };
};

const defaultRuntimeStateStore = createRuntimeStateStore();

export const getOrCreateRefractState = (
  targetGlobal: typeof globalThis,
  namespace: string,
  version: string,
): RefractRuntimeState =>
  defaultRuntimeStateStore.getOrCreate(targetGlobal, namespace, version);

export const installRefractStateOnce = (
  targetGlobal: typeof globalThis,
  namespace: string,
  version: string,
  installedBy?: RefractRuntimeState["installedBy"],
): RefractRuntimeState | null => {
  const state = getOrCreateRefractState(targetGlobal, namespace, version);
  if (state.installed) return null;
  state.installed = true;
  state.installedAt = privateDateNow();
  if (installedBy !== undefined) state.installedBy = installedBy;
  return state;
};

export const getRefractState = (
  targetGlobal: typeof globalThis,
  namespace: string,
): RefractRuntimeState | undefined =>
  defaultRuntimeStateStore.get(targetGlobal, namespace);
