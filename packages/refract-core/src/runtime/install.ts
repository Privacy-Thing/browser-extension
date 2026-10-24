import type { RuntimeSnapshot } from "../types/snapshot";

import { privateDateNow, privateSetAdd, privateSetHas } from "./primordials";
import { cloneRuntimeSnapshot } from "./snapshot-clone";
import {
  drainPrivateQueue,
  enqueuePrivateQueue,
  type RefractRuntimeState,
  type RefractModuleName,
  getOrCreateRefractState,
  getRefractState,
  isPrivateQueueEmpty,
} from "./state";

const installationOrder: RefractModuleName[] = [
  "native-mask",
  "logger",
  "surface-usage",
  "date",
  "date-intl",
  "intl",
  "temporal",
  "navigator",
  "navigator-fingerprint",
  "client-hints",
  "battery",
  "screen",
  "canvas",
  "audio",
  "webgl",
  "webrtc",
  "worker-runtime",
  "dedicated-workers",
  "shared-workers",
  "service-worker-register",
  "permissions",
  "geolocation",
  "xray-bridge",
  "iframes",
];

export type InstallOptions = {
  symbolKey: string;
  version: string;
  installedBy?: "early" | "runtime" | "iframe" | "worker" | "test";
};

export type ModuleInstaller = (state: RefractRuntimeState) => (() => void) | void;

/**
 * Gets the Refract runtime state object for the specified global realm.
 */
export const getRefractRuntimeState = (
  global: typeof globalThis,
  symbolKey: string,
): RefractRuntimeState | undefined => {
  return getRefractState(global, symbolKey);
};

/**
 * Checks if Refract is installed in the given global context.
 */
export const isRefractInstalled = (
  global: typeof globalThis,
  symbolKey: string,
): boolean => {
  const state = getRefractState(global, symbolKey);
  return !!state?.installed;
};

/**
 * Installs a single Refract module if it has not been installed yet.
 */
export const installModuleOnce = (
  state: RefractRuntimeState,
  name: RefractModuleName,
  installer: ModuleInstaller,
): boolean => {
  if (privateSetHas(state.modules, name)) {
    state.integrity.ensureAll();
    return false;
  }

  try {
    const teardown = installer(state);
    if (teardown) {
      enqueuePrivateQueue(state.teardown, teardown);
    }
    privateSetAdd(state.modules, name);
    state.integrity.ensureAll();
    return true;
  } catch (error) {
    if (state.snapshot?.debugMode) {
      console.error(`[Refract] Failed to install module: ${name}`, error);
    }
    return false;
  }
};

/**
 * Updates the runtime snapshot and flushes any installers that were deferred
 * because snapshot was null at registration time.
 */
export const updateRefractSnapshot = (
  state: RefractRuntimeState,
  snapshot: RuntimeSnapshot,
): void => {
  state.snapshot = cloneRuntimeSnapshot(snapshot);

  if (!isPrivateQueueEmpty(state.pendingInstallers)) {
    drainPrivateQueue(state.pendingInstallers, ({ name, installer }) => {
      installModuleOnce(state, name, installer);
    });
  }
  state.integrity.ensureAll();
};

/**
 * Installs the entire Refract core runtime once, applying modular installers.
 *
 * Snapshot may be null when the caller does not yet have resolved state (e.g.
 * Firefox bootstrap adapter pattern where state arrives via a separate channel).
 * In that case module installers are queued and flushed by the first
 * updateRefractSnapshot call that delivers a real snapshot.
 *
 * When called a second time (state.installed is already true), any new module
 * installers are applied via installModuleOnce, which handles per-module
 * idempotency. A non-null snapshot updates the stored snapshot and flushes
 * pending queue; a null snapshot is ignored to avoid clobbering real state.
 */
export const installRuntimeOnce = (
  global: typeof globalThis,
  snapshot: RuntimeSnapshot | null,
  options: InstallOptions,
  moduleInstallers: Partial<Record<RefractModuleName, ModuleInstaller>> = {},
): RefractRuntimeState => {
  const state = getOrCreateRefractState(global, options.symbolKey, options.version);

  if (!state.installed) {
    state.installed = true;
    state.installedAt = privateDateNow();
    state.installedBy = options.installedBy ?? "runtime";
  }

  if (snapshot !== null) {
    updateRefractSnapshot(state, snapshot);
  }

  const hasSnapshot = state.snapshot !== undefined && state.snapshot !== null;

  for (const moduleName of installationOrder) {
    const installer = moduleInstallers[moduleName];
    if (!installer || privateSetHas(state.modules, moduleName)) {
      continue;
    }

    if (hasSnapshot) {
      installModuleOnce(state, moduleName, installer);
    } else {
      enqueuePrivateQueue(state.pendingInstallers, { name: moduleName, installer });
    }
  }

  state.integrity.ensureAll();

  return state;
};
