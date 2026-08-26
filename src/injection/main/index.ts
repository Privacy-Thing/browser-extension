// Hello.
// ───────────────────────────────────────
// ───▐▀▄───────▄▀▌───▄▄▄▄▄▄▄─────────────
// ───▌▒▒▀▄▄▄▄▄▀▒▒▐▄▀▀▒██▒██▒▀▀▄──────────
// ──▐▒▒▒▒▀▒▀▒▀▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▀▄────────
// ──▌▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▄▒▒▒▒▒▒▒▒▒▒▒▒▀▄──────
// ▀█▒▒▒█▌▒▒█▒▒▐█▒▒▒▀▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▌─────
// ▀▌▒▒▒▒▒▒▀▒▀▒▒▒▒▒▒▀▀▒▒▒▒▒▒▒▒▒▒▒▒▒▒▐───▄▄
// ▐▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▌▄█▒█
// ▐▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒█▒█▀─
// ▐▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒█▀───
// ▐▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▌────
// ─▌▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▐─────
// ─▐▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▌─────
// ──▌▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▐──────
// ──▐▄▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▄▌──────
// ────▀▄▄▀▀▀▀▀▄▄▀▀▀▀▀▀▀▄▄▀▀▀▀▀▄▄▀────────

import "@privacy-brand/refract-core/runtime/primordials";

import {
  getFxHandoffReadyEvent,
  getFxStateEvent,
  parseFxStateEvent,
  takeFxMainHandoff,
  toSnapshotFromFxState,
} from "@privacy-brand/refract-browser/common/firefox-shim-state";
import {
  cleanupRuntimeWindowSeed,
  getRuntimeReadyEvent,
  finalizeRuntimeEnabled,
  installPostInitCleanup,
  isRuntimeDisabled,
  observeConfigInsertion,
  readInitialSnapshot,
  removeConfigElement,
  writeRuntimeWindowSeed,
} from "@privacy-brand/refract-browser/common/runtime-config";
import { setSurfaceUsageSourceId } from "@privacy-brand/refract-browser/common/surface-usage-emitter";
import {
  getRefractRuntimeState,
  installRuntimeOnce,
  updateRefractSnapshot,
} from "@privacy-brand/refract-core/runtime/install";
import type { RefractRuntimeState } from "@privacy-brand/refract-core/runtime/state";

import { createFxRevisionGate } from "@/injection/firefox/state-revision-gate";
import { installCanvasPatch } from "@/injection/main/canvas-patch";
import { isParentOwnedRealm } from "@/injection/main/iframe-realm-ownership";
import { createRuntimeModules } from "@/injection/main/runtime-module-installers";
import { installWebGLPatch } from "@/injection/main/webgl-patch";
import { BUILD_BROWSER_TARGET } from "@/shared/build-flags";
import { applySnapshotFencing } from "@/shared/domain-fencing";
import type { RuntimeSnapshot } from "@/shared/types";

setSurfaceUsageSourceId("main");

let stopSeedCleanup: (() => void) | null = null;
let seedPersistenceInstalled = false;

const installSeedPersistence = (
  snapshot: RuntimeSnapshot,
  stopLateSeedCleanup: () => void,
): void => {
  if (seedPersistenceInstalled) {
    return;
  }
  seedPersistenceInstalled = true;

  const persistSeed = (): void => {
    stopLateSeedCleanup();
    writeRuntimeWindowSeed(snapshot, window, {
      preserveExistingSeed: true,
      sourceHostname: window.location.hostname,
    });
  };

  globalThis.addEventListener("pagehide", persistSeed, { capture: true });
  globalThis.addEventListener("beforeunload", persistSeed, { capture: true });
};

let runtimeInstalled = false;

const markRuntimeApplied = (): void => {
  const apply = (): void => {
    document.documentElement?.setAttribute(`data-${__PT_RUNTIME_APPLIED_ATTR__}`, "");
  };

  if (document.documentElement) {
    apply();
    return;
  }

  document.addEventListener("DOMContentLoaded", apply, { once: true });
};

/** Installs the MAIN-world runtime once and returns its shared state. */
const install = (snapshot: RuntimeSnapshot | null): RefractRuntimeState | null => {
  if (runtimeInstalled) {
    return getRefractRuntimeState(globalThis, __PT_SHIM_GUARD_KEY__) ?? null;
  }
  runtimeInstalled = true;
  return installRuntimeOnce(
    globalThis,
    snapshot,
    {
      installedBy: "runtime",
      symbolKey: __PT_SHIM_GUARD_KEY__,
      version: "1.0.0",
    },
    createRuntimeModules(BUILD_BROWSER_TARGET === "chromium"),
  );
};

const syncRuntimePatchState = (snapshot: RuntimeSnapshot): void => {
  try {
    installCanvasPatch(snapshot);
  } catch {
    // Keep later surfaces alive if the patch was already partially installed.
  }

  try {
    installWebGLPatch(snapshot);
  } catch {
    // Keep later surfaces alive if the patch was already partially installed.
  }
};

const installFxRuntime = (): void => {
  const runtimeState = install(null);
  if (!runtimeState) return;
  const revisionGate = createFxRevisionGate<
    Parameters<typeof toSnapshotFromFxState>[0]
  >((state) => {
    const nextSnapshot = toSnapshotFromFxState(state);
    if (!nextSnapshot) return false;
    const realmSnapshot = applySnapshotFencing(
      nextSnapshot,
      globalThis.location?.hostname ?? "",
    );
    updateRefractSnapshot(runtimeState, realmSnapshot);
    syncRuntimePatchState(realmSnapshot);
    return true;
  });
  const applyState = (state: Parameters<typeof toSnapshotFromFxState>[0]): void => {
    revisionGate.apply(state);
  };
  const drainHandoff = (): void => {
    const handoff = takeFxMainHandoff(document);
    if (handoff) applyState(handoff.state);
  };
  const applyEventState = (event: Event): void => {
    const state = parseFxStateEvent(event);
    if (state) applyState(state);
  };
  document.addEventListener(getFxHandoffReadyEvent(), drainHandoff);
  document.addEventListener(getFxStateEvent(), applyEventState);
  drainHandoff();
};

const installWhenReady = (): void => {
  if (isRuntimeDisabled()) {
    removeConfigElement();
    return;
  }

  if (BUILD_BROWSER_TARGET === "firefox") {
    installFxRuntime();
    return;
  }

  const tryInstall = (snapshot = readInitialSnapshot()): void => {
    if (isRuntimeDisabled()) {
      removeConfigElement();
      return;
    }

    if (!snapshot) {
      return;
    }

    const realmSnapshot = applySnapshotFencing(
      snapshot,
      globalThis.location?.hostname ?? "",
    );

    if (__PT_BROWSER_TARGET__ === "chromium" && isParentOwnedRealm(globalThis)) {
      removeConfigElement();
      return;
    }

    finalizeRuntimeEnabled();

    if (runtimeInstalled) {
      syncRuntimePatchState(realmSnapshot);
    } else {
      install(realmSnapshot);
    }
    removeConfigElement();
    markRuntimeApplied();
    if (BUILD_BROWSER_TARGET === "chromium" && !stopSeedCleanup) {
      const cleanup = installPostInitCleanup(
        () => cleanupRuntimeWindowSeed(window),
        window,
      );
      stopSeedCleanup = cleanup.stop;
      installSeedPersistence(realmSnapshot, cleanup.stop);
    }
  };
  const waitController = new AbortController();
  let stopConfigObserver = (): void => undefined;
  const stopWaiting = (): void => {
    waitController.abort();
    stopConfigObserver();
  };
  const handleRuntimeReady = (): void => {
    if (isRuntimeDisabled()) {
      stopWaiting();
      removeConfigElement();
      return;
    }

    stopWaiting();
    tryInstall();
  };

  const consumeNextConfig = (): void => {
    if (runtimeInstalled) {
      removeConfigElement();
      return;
    }

    const nextSnapshot = readInitialSnapshot();
    if (!nextSnapshot || isRuntimeDisabled()) {
      removeConfigElement();
      return;
    }
    tryInstall(nextSnapshot);
  };
  globalThis.addEventListener(getRuntimeReadyEvent(), consumeNextConfig);

  const initialSnapshot = readInitialSnapshot();
  if (isRuntimeDisabled()) {
    removeConfigElement();
    return;
  }

  if (initialSnapshot) {
    tryInstall(initialSnapshot);
    return;
  }

  globalThis.addEventListener(getRuntimeReadyEvent(), handleRuntimeReady, {
    once: true,
    signal: waitController.signal,
  });

  if (typeof document === "undefined") {
    return;
  }

  stopConfigObserver = observeConfigInsertion(handleRuntimeReady, {
    onTimeout: () => {
      waitController.abort();
    },
  });

  tryInstall();
};

installWhenReady();
