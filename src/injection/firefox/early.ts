// Firefox MAIN-world geolocation/permissions/time/locale shim.
// Registered via chrome.scripting.registerContentScripts at document_start.
// Patches APIs immediately, owns revisioned state in this bundle, and publishes
// disposable snapshots for the later Firefox MAIN-world runtime.

import "@privacy-brand/refract-core/runtime/primordials";

import {
  clearFirefoxStaticState,
  getFxStateEvent,
  parseFirefoxHashSeed,
  type FxBootstrapInfo,
  parseFxStateEvent,
  publishFxMainHandoff,
  takeFxStaticState,
  takeFxEphemeralState,
  resolveFxSeedForHost,
  type FirefoxShimDebugState,
  type FirefoxShimState,
  type FirefoxTimeLocaleState,
} from "@privacy-brand/refract-browser/common/firefox-shim-state";
import { markSurfaceEvidence } from "@privacy-brand/refract-browser/common/surface-error-emitter";
import {
  markSurfaceUsed,
  setSurfaceUsageSourceId,
} from "@privacy-brand/refract-browser/common/surface-usage-emitter";
import { createFxGeoBridge } from "@privacy-brand/refract-core/geolocation/firefox-geolocation-bridge";
import { getOrCreateGeoPermState } from "@privacy-brand/refract-core/geolocation/geolocation-permissions";
import {
  createPrivateSet,
  privateSetAdd,
  privateSetHas,
} from "@privacy-brand/refract-core/runtime/primordials";
import { installRefractStateOnce } from "@privacy-brand/refract-core/runtime/state";

setSurfaceUsageSourceId("firefox-early");

import {
  type FirefoxBootstrapConsumer,
  consumeFxStateSources,
} from "@/injection/firefox/bootstrap-state-order";
import {
  FX_SOURCE_ORDER,
  getFxTransportInfo,
} from "@/injection/firefox/bootstrap-transport-manifest";
import { installFxEarlyModules } from "@/injection/firefox/firefox-early-modules";
import { createFxRevisionGate } from "@/injection/firefox/state-revision-gate";
import {
  canPersistFxWindowSeed,
  parseFirefoxWindowSeed,
  writeFxWindowSeed,
  type FirefoxWindowSeedPayload,
} from "@/injection/firefox/window-name-seed";
import { shouldReportFxGeo } from "@/injection/firefox/xray-surface-reporting";
import { getGeoMethodId } from "@/injection/main/geo-surface-patch";
import {
  isPageBufferReady,
  queuePagePayload,
} from "@/shared/firefox-page-world-buffer";
import { ExtensionLogLevel } from "@/shared/logging-types";
import type { XRaySurfaceCategory } from "@/shared/types";

(function () {
  const WINDOW_NAME_PREFIX = "\u001f\u001e";

  let activeDebugState: FirefoxShimDebugState | null = null;
  const emittedBootDiagnostics = createPrivateSet<string>();
  const emittedBootHeartbeats = createPrivateSet<string>();
  const emitFirefoxRuntimeLog = (
    component: string,
    method: string,
    args: unknown[],
    result?: unknown,
  ): void => {
    if (!activeDebugState?.enabled || !activeDebugState.logEventName) {
      return;
    }

    try {
      let safeArgs: unknown;
      try {
        safeArgs = JSON.parse(JSON.stringify(args));
      } catch {
        safeArgs = ["<Unserializable Arguments>"];
      }

      let safeResult: unknown;
      try {
        safeResult = JSON.parse(JSON.stringify(result));
      } catch {
        safeResult = "<Unserializable Result>";
      }

      globalThis.postMessage(
        {
          type: __PT_LOG_EVENT_TYPE__,
          eventName: activeDebugState.logEventName,
          detail: JSON.stringify({
            component,
            method,
            level:
              method === "install" ? ExtensionLogLevel.Verbose : ExtensionLogLevel.Info,
            args: safeArgs,
            result: safeResult,
          }),
        },
        "*",
      );
    } catch {
      // Ignore dispatch errors.
    }
  };
  const emitFxBootstrapEvent = (
    debugState: FirefoxShimDebugState | null,
    method: string,
    result: Record<string, unknown> | null = null,
  ): void => {
    if (!debugState?.enabled || !debugState.logEventName) {
      return;
    }

    const payload = {
      type: __PT_LOG_EVENT_TYPE__,
      eventName: debugState.logEventName,
      detail: JSON.stringify({
        component: "FirefoxBootstrap",
        method,
        level: ExtensionLogLevel.Info,
        args: [],
        result,
      }),
    };

    try {
      if (!isPageBufferReady("bootstrap-log")) {
        queuePagePayload("bootstrap-log", payload);
      }

      globalThis.postMessage(payload, "*");
    } catch {
      // Ignore dispatch errors.
    }
  };
  const emitFxBootDiagnostic = (
    key: string,
    method: string,
    result: Record<string, unknown> | null = null,
  ): void => {
    if (privateSetHas(emittedBootDiagnostics, key)) {
      return;
    }

    privateSetAdd(emittedBootDiagnostics, key);
    emitFxBootstrapEvent(activeDebugState, method, result);
  };

  const emitFxBootHeartbeat = (
    key: string,
    method: string,
    result: Record<string, unknown> | null = null,
  ): void => {
    if (privateSetHas(emittedBootHeartbeats, key)) {
      return;
    }

    privateSetAdd(emittedBootHeartbeats, key);

    const payload = {
      type: __PT_LOG_EVENT_TYPE__,
      heartbeat: true as const,
      detail: JSON.stringify({
        component: "FirefoxBootstrap",
        method,
        args: [],
        result,
      }),
    };

    try {
      queuePagePayload("bootstrap-heartbeat", payload);
      globalThis.postMessage(payload, "*");
    } catch {
      // Ignore dispatch errors.
    }
  };

  const hasSeededHash = (): boolean =>
    parseFirefoxHashSeed(globalThis.location.hash) !== null;

  const tryRestoreOriginalHash = (originalHash: string): boolean => {
    if (!hasSeededHash()) {
      return true;
    }

    const restoredUrl = `${globalThis.location.pathname}${globalThis.location.search}${originalHash}`;

    try {
      globalThis.history.replaceState(globalThis.history.state, "", restoredUrl);
      return !hasSeededHash();
    } catch {
      // Some earliest-bootstrap documents reject cloning the current history
      // state even though the same-URL hash replacement itself is valid.
    }

    try {
      globalThis.history.replaceState(null, "", restoredUrl);
      return !hasSeededHash();
    } catch {
      return false;
    }
  };

  const restoreOriginalHash = (
    originalHash: string,
    debugState: FirefoxShimDebugState | null,
  ): void => {
    const emitHashRestoreEvent = (
      key: string,
      method: string,
      result: Record<string, unknown>,
    ): void => {
      if (privateSetHas(emittedBootDiagnostics, key)) {
        return;
      }

      privateSetAdd(emittedBootDiagnostics, key);
      emitFxBootstrapEvent(debugState, method, result);
    };
    const emitHashRestored = (stage: string): void => {
      emitHashRestoreEvent("hash-restored", "hash-restored", {
        stage,
        originalHash,
        currentHash: globalThis.location.hash,
      });
    };

    if (tryRestoreOriginalHash(originalHash)) {
      emitHashRestored("immediate");
      return;
    }

    const timerIds: Array<ReturnType<typeof globalThis.setTimeout>> = [];
    const cleanupCallbacks: Array<() => void> = [];
    let settled = false;

    const cleanup = (): void => {
      for (const timerId of timerIds) {
        globalThis.clearTimeout(timerId);
      }

      for (const callback of cleanupCallbacks) {
        callback();
      }
    };

    const attemptRestore = (stage: string): void => {
      if (settled) {
        return;
      }

      settled = tryRestoreOriginalHash(originalHash);
      if (settled) {
        emitHashRestored(stage);
        cleanup();
      }
    };

    for (const delayMs of [0, 16, 50, 250, 1_000, 3_000]) {
      timerIds.push(
        globalThis.setTimeout(() => {
          attemptRestore(`timeout:${delayMs}`);
        }, delayMs),
      );
    }

    if (typeof document !== "undefined") {
      const handleDocumentReady = (): void => {
        attemptRestore("event:readystatechange");
      };
      document.addEventListener("readystatechange", handleDocumentReady);
      cleanupCallbacks.push(() => {
        document.removeEventListener("readystatechange", handleDocumentReady);
      });
    }

    for (const eventName of ["pageshow", "load", "hashchange"] as const) {
      const handleEvent = (): void => {
        attemptRestore(`event:${eventName}`);
      };
      globalThis.addEventListener(eventName, handleEvent);
      cleanupCallbacks.push(() => {
        globalThis.removeEventListener(eventName, handleEvent);
      });
    }

    if (typeof globalThis.requestAnimationFrame === "function") {
      let remainingFrames = 6;
      const retryOnNextFrame = (): void => {
        attemptRestore(`animation-frame:${6 - remainingFrames}`);
        if (!settled && remainingFrames > 0) {
          remainingFrames -= 1;
          globalThis.requestAnimationFrame(retryOnNextFrame);
        }
      };
      globalThis.requestAnimationFrame(retryOnNextFrame);
    }

    timerIds.push(
      globalThis.setTimeout(() => {
        if (settled || !hasSeededHash()) {
          return;
        }

        emitHashRestoreEvent("hash-restore-timeout", "hash-restore-timeout", {
          originalHash,
          currentHash: globalThis.location.hash,
        });
      }, 3_500),
    );
  };

  let preloadedSeedState: FirefoxWindowSeedPayload["seedState"] | null = null;
  let preloadedSeedSource: "hash" | "windowName" | null = null;
  let persistSeedToWindowName = false;
  const consumeWindowSeed = (): FirefoxWindowSeedPayload["seedState"] | null => {
    if (
      typeof window === "undefined" ||
      typeof window.name !== "string" ||
      !window.name.startsWith(WINDOW_NAME_PREFIX)
    ) {
      return null;
    }

    const payload = parseFirefoxWindowSeed(window.name, WINDOW_NAME_PREFIX);
    if (!payload) {
      window.name = "";
      return null;
    }

    window.name = payload.previousName;
    return payload.seedState;
  };

  const hashSeedPayload = parseFirefoxHashSeed(globalThis.location.hash);
  if (hashSeedPayload) {
    preloadedSeedState = {
      entries: [],
      containerState: hashSeedPayload.state,
    };
    preloadedSeedSource = "hash";
    restoreOriginalHash(hashSeedPayload.originalHash, hashSeedPayload.state.debug);
  }

  const windowNameSeedState = consumeWindowSeed();
  if (preloadedSeedState === null && windowNameSeedState) {
    preloadedSeedState = windowNameSeedState;
    preloadedSeedSource = "windowName";
    persistSeedToWindowName = true;
  }

  // Phase 3: the early bundle owns a closure-local refract-core state store.
  const shimState = installRefractStateOnce(
    globalThis,
    __PT_SHIM_GUARD_KEY__,
    "1.0.0",
    "runtime",
  );
  if (!shimState) {
    return;
  }
  // Forwards the integrity registry's per-realm result to X-Ray/popup
  // (#111/#112): `unrecoverable` degrades the surface, `repaired`/`unconfirmed`
  // surface as their own distinct presentation states, and `intact`/
  // `not-applicable` need no report.
  shimState.integrity.setResultSink({
    record: (result) => {
      if (
        result.status === "repaired" ||
        result.status === "unrecoverable" ||
        result.status === "unconfirmed"
      ) {
        // Registry surfaceIds are always SpoofingSurfaceKey/XRaySurfaceCategory
        // values at the call sites that register anchors (surface-integrity.ts);
        // the registry itself is generic over plain `string`.
        markSurfaceEvidence(result.surfaceId as XRaySurfaceCategory, {
          realmId: result.realmId,
          integrity: result.status,
          ...(result.reason ? { reasonCode: result.reason } : {}),
        });
      }
    },
  });
  const permissionsPatchState = getOrCreateGeoPermState(globalThis);
  emitFxBootHeartbeat("shim-installed", "shim-installed");

  let timeLocaleData: TimeLocaleData | null = null;
  type TimeLocaleData = FirefoxTimeLocaleState;
  let latestShimState: FirefoxShimState | null = null;
  let timeLocaleStateReceived = false;
  const geolocationBridge = createFxGeoBridge({
    markerKey: `${__PT_SHIM_GUARD_KEY__}:geolocation`,
    permissionsPatchState,
    syncBootstrapState: () => syncBootstrapState(),
    logGeolocation: (method, args, result) => {
      if (shouldReportFxGeo(latestShimState)) {
        markSurfaceUsed("geolocation", getGeoMethodId(method));
      }
      emitFirefoxRuntimeLog("Geolocation", method, args, result);
    },
    logPermissions: (method, args, result) => {
      if (method === "query [geolocation]" && shouldReportFxGeo(latestShimState)) {
        markSurfaceUsed("geolocation", "geolocation.permissionsQuery");
      }
      emitFirefoxRuntimeLog("Permissions", method, args, result);
    },
  });

  const handleTimeLocaleData = (payload: TimeLocaleData): void => {
    timeLocaleStateReceived = true;
    timeLocaleData = payload;
  };

  const stateRevisionGate = createFxRevisionGate<FirefoxShimState>((state) => {
    latestShimState = state;
    activeDebugState = state.debug;

    if (!geolocationBridge.isResolved() && state.geoStatus === "absent") {
      geolocationBridge.resolveGeoState(null);
    } else if (
      !geolocationBridge.isResolved() &&
      state.geoStatus === "ready" &&
      state.geo
    ) {
      geolocationBridge.resolveGeoState(state.geo);
    }

    if (state.timeLocaleStatus === "ready" && state.timeLocale) {
      handleTimeLocaleData(state.timeLocale);
    } else if (state.timeLocaleStatus === "absent") {
      timeLocaleStateReceived = true;
      timeLocaleData = null;
    }

    publishFxMainHandoff(document, state);

    emitFxBootHeartbeat("state-applied", "state-applied", {
      geoStatus: state.geoStatus,
      timeLocaleStatus: state.timeLocaleStatus,
      fingerprintStatus: state.fingerprintStatus,
    });
    shimState.integrity.ensureAll();
    return true;
  });
  const applyState = (state: FirefoxShimState): boolean =>
    stateRevisionGate.apply(state);

  // --- Hybrid bootstrap: static state seed + ephemeral DOM + CustomEvent ---

  const consumeStaticState = (): boolean => {
    const state = takeFxStaticState(globalThis, globalThis.location.hostname);
    if (!state) {
      return false;
    }

    return applyState(state);
  };

  const consumeEphemeralState = (): boolean => {
    const ephemeralState = takeFxEphemeralState(document);
    if (!ephemeralState) {
      return false;
    }

    return applyState(ephemeralState);
  };

  const applyResolvedSeedState = (
    seedState: FirefoxWindowSeedPayload["seedState"] | null,
  ): boolean => {
    if (!seedState) {
      return false;
    }

    const state = resolveFxSeedForHost(globalThis.location.hostname, seedState);
    if (!state) {
      return false;
    }

    return applyState(state);
  };

  const consumeHashSeedState = (): boolean => {
    if (preloadedSeedSource !== "hash") {
      return false;
    }

    return applyResolvedSeedState(preloadedSeedState);
  };

  const consumeWindowNameState = (): boolean => {
    if (preloadedSeedSource === "hash") {
      return false;
    }

    if (!preloadedSeedState) {
      const windowNameSeedState = consumeWindowSeed();
      if (!windowNameSeedState) {
        return false;
      }

      preloadedSeedState = windowNameSeedState;
      preloadedSeedSource = "windowName";
      persistSeedToWindowName = true;
    }

    return applyResolvedSeedState(preloadedSeedState);
  };

  const noteBootstrapSource = (
    sourceInfo: FxBootstrapInfo,
    phase: "initial" | "sync",
  ): void => {
    if (sourceInfo.source !== "static") {
      clearFirefoxStaticState(globalThis);
    }

    const transportInfo = getFxTransportInfo(sourceInfo.source);
    emitFxBootDiagnostic(
      `bootstrap-source:${phase}:${sourceInfo.source}`,
      "source-selected",
      {
        phase,
        source: sourceInfo.source,
        role: sourceInfo.role,
        status: sourceInfo.status,
        precedence: transportInfo.precedence,
        selectionScope: transportInfo.selectionScope,
        visibility: sourceInfo.visibility,
        needsOptionalPermission: sourceInfo.needsOptionalPermission,
        currentHash: globalThis.location.hash,
        persistSeedToWindowName,
      },
    );
  };

  const createBootstrapConsumer = (
    source: FxBootstrapInfo["source"],
    consume: () => boolean,
  ): FirefoxBootstrapConsumer => ({
    ...getFxTransportInfo(source),
    consume,
  });

  const getBootstrapConsumers = (): ReadonlyArray<FirefoxBootstrapConsumer> =>
    FX_SOURCE_ORDER.map((source) => {
      switch (source) {
        case "hash":
          return createBootstrapConsumer(source, consumeHashSeedState);
        case "windowName":
          return createBootstrapConsumer(source, consumeWindowNameState);
        case "static":
          return createBootstrapConsumer(source, consumeStaticState);
        case "ephemeral":
          return createBootstrapConsumer(source, consumeEphemeralState);
        case "userScript":
          return createBootstrapConsumer(source, () => false);
      }
    });

  const syncBootstrapState = (): void => {
    if (geolocationBridge.isResolved() && timeLocaleStateReceived) {
      return;
    }

    const source = consumeFxStateSources(getBootstrapConsumers());
    if (source !== null) {
      noteBootstrapSource(source, "sync");
    }
  };

  let bootstrapObserver: MutationObserver | null = null;
  const stopBootstrapObserver = (): void => {
    bootstrapObserver?.disconnect();
    bootstrapObserver = null;
  };

  const startBootstrapObserver = (): void => {
    const target = document.documentElement;
    if (!target) {
      return;
    }

    bootstrapObserver = new MutationObserver(() => {
      if (!consumeEphemeralState()) {
        return;
      }

      noteBootstrapSource(getFxTransportInfo("ephemeral"), "sync");
      stopBootstrapObserver();
    });

    bootstrapObserver.observe(target, {
      childList: true,
      subtree: true,
    });
  };

  // 1. Prefer per-navigation seeds first (`hash`, then `window.name`).
  // 2. Fall back to the static state carrier only when no navigation seed is
  //    available. The optional userScript registration transports that state,
  //    but is not itself a standalone selected source in page-world diagnostics.
  // 3. If no early source is available yet, watch for the late DOM bootstrap
  //    element and event delivery.
  const initialBootstrapSource = consumeFxStateSources(getBootstrapConsumers());
  if (initialBootstrapSource !== null) {
    emitFxBootHeartbeat("early-source-present", "early-source-present", {
      source: initialBootstrapSource.source,
      status: initialBootstrapSource.status,
    });
    noteBootstrapSource(initialBootstrapSource, "initial");
    stopBootstrapObserver();
  } else {
    emitFxBootHeartbeat("no-early-source", "no-early-source");
    startBootstrapObserver();
    const lateBootstrapSource = consumeFxStateSources(getBootstrapConsumers());
    if (lateBootstrapSource !== null) {
      noteBootstrapSource(lateBootstrapSource, "sync");
    }
  }

  if (persistSeedToWindowName && preloadedSeedState) {
    const persistWindowSeed = (event: Event): void => {
      if (!preloadedSeedState) {
        return;
      }
      const currentWindowName =
        (globalThis as typeof globalThis & { name?: string }).name ?? "";
      if (
        !canPersistFxWindowSeed(
          currentWindowName,
          preloadedSeedState,
          WINDOW_NAME_PREFIX,
        )
      ) {
        return;
      }
      writeFxWindowSeed(preloadedSeedState, WINDOW_NAME_PREFIX);

      if ((event as PageTransitionEvent).persisted === true) {
        const restoreWindowName = (): void => {
          (globalThis as typeof globalThis & { name?: string }).name =
            currentWindowName;
        };

        globalThis.addEventListener("pageshow", restoreWindowName, {
          capture: true,
          once: true,
        });
      }
    };

    globalThis.addEventListener("pagehide", persistWindowSeed, { capture: true });
  }

  // 2. Listen for CustomEvent updates from the content script for late or
  //    subsequent state deliveries.
  const applyStateFromEvent = (event: Event): void => {
    const state = parseFxStateEvent(event);
    if (state) {
      if (!applyState(state)) {
        return;
      }

      stopBootstrapObserver();
      clearFirefoxStaticState(globalThis);
      emitFxBootDiagnostic("bootstrap-source:event:ephemeral", "source-selected", {
        phase: "event",
        ...getFxTransportInfo("ephemeral"),
        currentHash: globalThis.location.hash,
        persistSeedToWindowName,
      });
    }
  };

  document.addEventListener(getFxStateEvent(), applyStateFromEvent);

  // --- Fallback timeout: if data never arrives, error out ---

  const DATA_TIMEOUT_MS = 5000;
  setTimeout(() => {
    if (!geolocationBridge.isResolved()) {
      stopBootstrapObserver();
      geolocationBridge.resolveGeoState(null);
    }
  }, DATA_TIMEOUT_MS);

  // Consume available bootstrap sources synchronously so that main-world's deferred
  // module installers (queued with null snapshot) can flush before page scripts run.
  // Lazy hooks on Date/Intl/geo APIs serve as a safety net for late-arriving state.
  syncBootstrapState();

  installFxEarlyModules({
    emitLog: emitFirefoxRuntimeLog,
    geoBridge: geolocationBridge,
    getState: () => latestShimState,
    getTimeLocale: () => timeLocaleData,
    permissionsState: permissionsPatchState,
    runtimeState: shimState,
    syncBootstrap: syncBootstrapState,
  });
})();
