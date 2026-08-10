/**
 * Earliest main-world runtime used to cover the first-inline execution window
 * before the full runtime can attach in the regular injection path.
 */

import "@privacy-brand/refract-core/runtime/primordials";

import { createLogger } from "@privacy-brand/refract-browser/common/debug-logger";
import {
  cleanupRuntimeWindowSeed,
  consumeRuntimeWindowSeed,
  getWindowSeedPrefix,
  installPostInitCleanup,
  isRuntimeDisabled,
  finalizeRuntimeEnabled,
  markRuntimeDisabled,
  observeConfigInsertion,
  readConfigElement,
  writeConfigElement,
  writeRuntimeWindowSeed,
} from "@privacy-brand/refract-browser/common/runtime-config";
import { markSurfaceEvidence } from "@privacy-brand/refract-browser/common/surface-error-emitter";
import {
  installUsageListener,
  markSurfaceUsed,
  setSurfaceUsageSourceId,
} from "@privacy-brand/refract-browser/common/surface-usage-emitter";
import { installGeolocationPatch as installGeolocationPatchShared } from "@privacy-brand/refract-core/geolocation/geo-patch";
import {
  getOrCreateGeoPermState,
  installGeoPermPatch,
} from "@privacy-brand/refract-core/geolocation/geolocation-permissions";
import {
  createIntegrityRegistry,
  registerInstalledDesc,
} from "@privacy-brand/refract-core/integrity/surface-integrity-registry";
import type { NativeGetterIntegrity } from "@privacy-brand/refract-core/native/native-getter";
import {
  createNativeSource,
  maskAsNative,
} from "@privacy-brand/refract-core/native/native-mask";
import {
  inspectPatchAnchors,
  markPatchAnchor,
} from "@privacy-brand/refract-core/runtime/patch-marker";
import { installLocaleGetters } from "@privacy-brand/refract-core/time/locale-getters";
import { getNativeDate } from "@privacy-brand/refract-core/time/native-date";

import { installEarlySurfaces } from "@/injection/main/early-surface-installer";
import { installNavigatorPatch as installNavigatorSurfaces } from "@/injection/main/locale-patch";
import {
  DOCUMENT_REALM_ID,
  registerGeoIntegrity,
  registerPermIntegrity,
} from "@/injection/main/surface-integrity";
import { BUILD_BROWSER_TARGET } from "@/shared/build-flags";
import type { SpoofingSurfaceKey } from "@/shared/spoofing-surfaces";
import type { RuntimeSnapshot, SpoofingSurfaceMethodId } from "@/shared/types";

setSurfaceUsageSourceId("early");

const WINDOW_NAME_PREFIX = getWindowSeedPrefix();
const earlyIntegrityRegistry = createIntegrityRegistry<
  SpoofingSurfaceKey,
  SpoofingSurfaceMethodId
>();
// Forwards the integrity registry's per-realm result to X-Ray/popup (#111/#112):
// `unrecoverable` degrades the surface, `repaired`/`unconfirmed` are surfaced as
// their own distinct presentation states, and `intact`/`not-applicable` need no
// report (they are the truthful default when nothing tampered).
earlyIntegrityRegistry.setResultSink({
  record: (result) => {
    if (
      result.status === "repaired" ||
      result.status === "unrecoverable" ||
      result.status === "unconfirmed"
    ) {
      markSurfaceEvidence(result.surfaceId, {
        realmId: result.realmId,
        integrity: result.status,
        ...(result.reason ? { reasonCode: result.reason } : {}),
      });
    }
  },
});

type BootstrapSource = "windowName" | "domHandoff";

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

// Eagerly capture and clear the window.name seed at module evaluation time.
// This runs before installEarlyRuntime() is called, minimizing the window
// during which page scripts could observe the runtime seed prefix.
let _earlyWindowSeed: { previousName: string; snapshot: RuntimeSnapshot } | null = null;
let _earlyRuntimeDisabled = false;
if (
  typeof window !== "undefined" &&
  typeof window.name === "string" &&
  window.name.startsWith(WINDOW_NAME_PREFIX)
) {
  const payload = consumeRuntimeWindowSeed(window);
  if (payload?.kind === "disabled") {
    _earlyRuntimeDisabled = true;
    markRuntimeDisabled(document);
  } else if (payload?.kind === "snapshot") {
    _earlyWindowSeed = payload;
  }
}

let earlyRuntimeInstalled = false;
let latestRuntimeSnapshot: RuntimeSnapshot | null = _earlyWindowSeed?.snapshot ?? null;
let observerInstalled = false;
const _NativeDate = getNativeDate();

const syncSnapshotToDom = (snapshot: RuntimeSnapshot): void => {
  if (writeConfigElement(document, snapshot)) {
    return;
  }

  // If the DOM root is not ready yet, the caller will schedule a retry.
};

const writeWindowSeed = (snapshot: RuntimeSnapshot): void => {
  writeRuntimeWindowSeed(
    snapshot,
    globalThis as typeof globalThis & { name?: string },
    {
      preserveExistingSeed: true,
    },
  );
};

const readWindowNameSnapshot = (): RuntimeSnapshot | null => {
  if (typeof window.name !== "string" || !window.name.startsWith(WINDOW_NAME_PREFIX)) {
    return null;
  }

  const payload = consumeRuntimeWindowSeed(window);
  if (payload?.kind === "disabled") {
    _earlyRuntimeDisabled = true;
    latestRuntimeSnapshot = null;
    markRuntimeDisabled(document);
    return null;
  }

  if (payload?.kind === "snapshot") {
    latestRuntimeSnapshot = payload.snapshot;
    return payload.snapshot;
  }

  return null;
};

const readParentHandoff = (): RuntimeSnapshot | null => {
  const parentCandidates = [window.parent, window.top];

  for (const candidate of parentCandidates) {
    if (!candidate || candidate === window) {
      continue;
    }

    try {
      const snapshot = readConfigElement(candidate.document);
      if (snapshot) {
        latestRuntimeSnapshot = snapshot;
        return snapshot;
      }
    } catch {
      // Ignore cross-origin parents.
    }
  }

  return null;
};

const readSnapshot = (): {
  snapshot: RuntimeSnapshot | null;
  source: BootstrapSource | null;
} => {
  if (_earlyRuntimeDisabled || isRuntimeDisabled()) {
    latestRuntimeSnapshot = null;
    return { snapshot: null, source: null };
  }

  // Prefer the eagerly captured seed (cleared at module evaluation time).
  if (_earlyWindowSeed) {
    const snapshot = _earlyWindowSeed.snapshot;
    _earlyWindowSeed = null;
    latestRuntimeSnapshot = snapshot;
    return { snapshot, source: "windowName" };
  }

  // Fallback: check window.name in case it was seeded after module evaluation.
  const windowNameSnapshot = readWindowNameSnapshot();
  if (windowNameSnapshot) {
    return { snapshot: windowNameSnapshot, source: "windowName" };
  }

  const localSnapshot = readConfigElement(document);
  if (localSnapshot) {
    latestRuntimeSnapshot = localSnapshot;
    return { snapshot: localSnapshot, source: "domHandoff" };
  }

  const parentSnapshot = readParentHandoff();
  if (parentSnapshot) {
    return { snapshot: parentSnapshot, source: "domHandoff" };
  }

  return { snapshot: latestRuntimeSnapshot, source: null };
};

const installSnapshot = (snapshot: RuntimeSnapshot): void => {
  finalizeRuntimeEnabled();
  latestRuntimeSnapshot = snapshot;
  syncSnapshotToDom(snapshot);
  globalThis.dispatchEvent(new CustomEvent(__PT_RUNTIME_READY_EVENT_NAME__));
};

const installSnapshotObserver = (): void => {
  if (observerInstalled) {
    return;
  }
  observerInstalled = true;

  const waitController = new AbortController();
  let stopConfigObserver = (): void => undefined;
  const stopWaiting = (): void => {
    waitController.abort();
    stopConfigObserver();
  };
  const handleReady = (): void => {
    if (_earlyRuntimeDisabled || isRuntimeDisabled()) {
      latestRuntimeSnapshot = null;
      stopWaiting();
      return;
    }

    const { snapshot } = readSnapshot();
    if (!snapshot) {
      return;
    }

    latestRuntimeSnapshot = snapshot;
    earlyIntegrityRegistry.ensureAll();
    stopWaiting();
  };

  globalThis.addEventListener(__PT_RUNTIME_READY_EVENT_NAME__, handleReady, {
    signal: waitController.signal,
  });

  if (typeof document !== "undefined") {
    stopConfigObserver = observeConfigInsertion(handleReady, {
      onTimeout: () => {
        // DOM observer timed out — leave RUNTIME_READY_EVENT listener alive.
        // Background scripting.executeScript may fire the event late on SW cold start.
      },
    });
  }

  handleReady();
};

const waitForRuntimeSnapshot = (timeoutMs = 500): Promise<RuntimeSnapshot | null> => {
  if (_earlyRuntimeDisabled || isRuntimeDisabled()) {
    return Promise.resolve(null);
  }

  const { snapshot: currentSnapshot } = readSnapshot();
  if (currentSnapshot) {
    return Promise.resolve(currentSnapshot);
  }

  return new Promise((resolve) => {
    let settled = false;
    const waitController = new AbortController();
    let stopConfigObserver = (): void => undefined;

    const finish = (snapshot: RuntimeSnapshot | null): void => {
      if (settled) {
        return;
      }
      settled = true;
      waitController.abort();
      stopConfigObserver();
      resolve(snapshot);
    };

    const handleReady = (): void => {
      if (_earlyRuntimeDisabled || isRuntimeDisabled()) {
        finish(null);
        return;
      }

      finish(readSnapshot().snapshot);
    };

    stopConfigObserver = observeConfigInsertion(
      () => {
        finish(readConfigElement(document));
      },
      {
        timeoutMs,
        onTimeout: () => {
          finish(readSnapshot().snapshot);
        },
      },
    );

    globalThis.addEventListener(__PT_RUNTIME_READY_EVENT_NAME__, handleReady, {
      once: true,
      signal: waitController.signal,
    });
  });
};

const installSeedPersistence = (
  snapshot: RuntimeSnapshot,
  stopLateSeedCleanup: () => void,
): void => {
  const persistSeed = (): void => {
    stopLateSeedCleanup();
    writeWindowSeed(snapshot);
  };

  globalThis.addEventListener("pagehide", persistSeed, { capture: true });
  globalThis.addEventListener("beforeunload", persistSeed, { capture: true });
};

const defineGetter = <T extends object, TValue>(
  target: T,
  property: PropertyKey,
  getter: () => TValue,
  integrity?: NativeGetterIntegrity<SpoofingSurfaceKey, SpoofingSurfaceMethodId>,
): void => {
  const originalDescriptor = Object.getOwnPropertyDescriptor(target, property);
  const nativeGetter = originalDescriptor?.get;
  const shouldEnforceReceiver =
    typeof target === "object" &&
    target !== null &&
    "constructor" in target &&
    (target as { constructor?: { prototype?: unknown } }).constructor?.prototype ===
      target;

  const get = Object.getOwnPropertyDescriptor(
    {
      get [property](): TValue {
        if (nativeGetter) {
          Reflect.apply(nativeGetter, this, []);
        } else if (
          shouldEnforceReceiver &&
          (this === target ||
            !Object.prototype.isPrototypeOf.call(target, Object(this)))
        ) {
          throw new TypeError("Illegal invocation");
        }

        return getter.call(this);
      },
    },
    property,
  )?.get;

  if (!get) {
    return;
  }

  const descriptor: PropertyDescriptor = {
    configurable: true,
    get: maskAsNative(get, createNativeSource(String(property), "get")),
  };
  Object.defineProperty(target, property, descriptor);
  if (integrity) {
    registerInstalledDesc({
      ...integrity,
      target,
      key: property,
      descriptor,
    });
  }
};

const installLocalePatch = (snapshot: RuntimeSnapshot): void => {
  installLocaleGetters(
    <TValue>(property: "language" | "languages", getter: () => TValue): void =>
      defineGetter(
        Navigator.prototype,
        property,
        () => {
          markSurfaceUsed("timeLocale");
          return getter();
        },
        {
          registrar: earlyIntegrityRegistry,
          anchor: {
            surfaceId: "timeLocale",
            realmId: DOCUMENT_REALM_ID,
            repairPolicy: "repair",
            criticality: "preview-critical",
            resolveReceiver: () => navigator,
          },
        },
      ),
    {
      language: () => snapshot.locale.language,
      languages: () => snapshot.locale.languages,
    },
  );
};

const installNavigatorPatch = (snapshot: RuntimeSnapshot): void => {
  installNavigatorSurfaces(snapshot, Navigator.prototype, {
    registrar: earlyIntegrityRegistry,
    realmId: DOCUMENT_REALM_ID,
    receiver: navigator,
  });
};

/**
 * Early-runtime counterpart of the service worker registration intercept.
 * See `installServiceWorker` in `index.ts` for full documentation.
 */
const installServiceWorker = (snapshot: RuntimeSnapshot | null): void => {
  if (
    typeof navigator === "undefined" ||
    !("serviceWorker" in navigator) ||
    typeof ServiceWorkerContainer === "undefined"
  ) {
    return;
  }

  const NativeRegister = ServiceWorkerContainer.prototype.register;
  const registerAnchorState = inspectPatchAnchors(__PT_SW_PATCH_GUARD_KEY__, [
    { fn: NativeRegister, name: "register" },
  ]);
  if (registerAnchorState === "installed") {
    return;
  }
  if (registerAnchorState === "conflict") {
    throw new Error("ServiceWorker register patch anchor conflict");
  }
  const buildBlockedRegError = (scope: string, url: string): DOMException =>
    new DOMException(
      BUILD_BROWSER_TARGET === "firefox"
        ? `Failed to register/update a ServiceWorker for scope ('${scope}'): ` +
            `The operation is insecure for script ('${url}').`
        : `Failed to register a ServiceWorker for scope ('${scope}') ` +
            `with script ('${url}'): An SSL certificate error occurred ` +
            `when fetching the script.`,
      "SecurityError",
    );

  const PatchedRegister = maskAsNative(function (
    this: ServiceWorkerContainer,
    scriptURL: string | URL,
    ...rest: [RegistrationOptions?]
  ): Promise<ServiceWorkerRegistration> {
    const url = String(scriptURL);
    const scope = rest[0]?.scope ?? "/";
    const shouldBlock = (runtimeSnapshot: RuntimeSnapshot | null): boolean =>
      Boolean(
        runtimeSnapshot?.blockServiceWorkerRegistration ??
        snapshot?.blockServiceWorkerRegistration,
      );
    const rejectBlockedReg = (
      decidingSnapshot: RuntimeSnapshot | null,
    ): Promise<ServiceWorkerRegistration> => {
      markSurfaceUsed("serviceWorker", "serviceWorker.register");
      createLogger(decidingSnapshot ?? snapshot, "ServiceWorker")(
        "register [blocked]",
        [url, ...rest],
      );
      return Promise.reject(buildBlockedRegError(scope, url));
    };

    const syncSnapshot = readSnapshot().snapshot;
    if (shouldBlock(syncSnapshot)) {
      return rejectBlockedReg(syncSnapshot);
    }

    return waitForRuntimeSnapshot().then((runtimeSnapshot) => {
      if (shouldBlock(runtimeSnapshot)) {
        return rejectBlockedReg(runtimeSnapshot);
      }

      return Reflect.apply(NativeRegister, this, [
        scriptURL,
        ...rest,
      ]) as Promise<ServiceWorkerRegistration>;
    });
  }, createNativeSource("register"));

  markPatchAnchor(PatchedRegister, __PT_SW_PATCH_GUARD_KEY__, "register");
  Object.defineProperty(ServiceWorkerContainer.prototype, "register", {
    configurable: true,
    enumerable: true,
    writable: true,
    value: PatchedRegister,
  });
};

/**
 * Forces `navigator.permissions.query({ name: "geolocation" })` to converge on
 * the spoofed geolocation state during the early-runtime window.
 */
export const installPermissionsPatch = (snapshot: RuntimeSnapshot): boolean => {
  if (snapshot.geolocationEnabled === false) {
    return false;
  }

  if (!("permissions" in navigator)) {
    return false;
  }

  const queryTarget =
    typeof Permissions !== "undefined" ? Permissions.prototype : navigator.permissions;
  installGeoPermPatch({
    integrity: {
      registrar: earlyIntegrityRegistry,
      surfaceId: "geolocation",
      realmId: DOCUMENT_REALM_ID,
    },
    logger: (method) => {
      if (method === "query [geolocation]") {
        markSurfaceUsed("geolocation", "geolocation.permissionsQuery");
      }
    },
    patchState: getOrCreateGeoPermState(globalThis),
    permissionPrototype:
      typeof PermissionStatus === "undefined" ? null : PermissionStatus.prototype,
    queryTarget,
    resolveGeolocationState: () => "granted",
  });
  registerPermIntegrity(
    { registrar: earlyIntegrityRegistry, realmId: DOCUMENT_REALM_ID },
    globalThis,
  );
  return true;
};

const getGeolocationMethodId = (
  method: string,
): SpoofingSurfaceMethodId | undefined => {
  if (method.startsWith("getCurrentPosition")) return "geolocation.getCurrentPosition";
  if (method.startsWith("watchPosition")) return "geolocation.watchPosition";
  if (method.startsWith("clearWatch")) return "geolocation.clearWatch";
  return undefined;
};

/**
 * Installs the geolocation patch used by the early-runtime path.
 */
export const installGeolocationPatch = (snapshot: RuntimeSnapshot): void => {
  const installed = installGeolocationPatchShared(
    snapshot,
    globalThis,
    (method) => {
      markSurfaceUsed("geolocation", getGeolocationMethodId(method));
    },
    { markerKey: `${__PT_SHIM_GUARD_KEY__}:geolocation` },
  );
  if (installed) {
    registerGeoIntegrity(
      { registrar: earlyIntegrityRegistry, realmId: DOCUMENT_REALM_ID },
      globalThis,
    );
  }
};

/**
 * Installs the early-runtime bundle. This path exists to cover the earliest
 * inline reads before the regular main-world runtime can safely take over.
 */
export const installEarlyRuntime = (): void => {
  if (earlyRuntimeInstalled) {
    return;
  }

  if (_earlyRuntimeDisabled || isRuntimeDisabled()) {
    latestRuntimeSnapshot = null;
    earlyRuntimeInstalled = true;
    return;
  }

  installSnapshotObserver();
  const { snapshot } = readSnapshot();
  if (!snapshot) {
    earlyRuntimeInstalled = true;
    return;
  }

  earlyRuntimeInstalled = true;
  installUsageListener(() => latestRuntimeSnapshot?.authKey);

  installSnapshot(snapshot);
  const lateSeedCleanup = installPostInitCleanup(
    () => cleanupRuntimeWindowSeed(window),
    window,
  );
  installSeedPersistence(snapshot, lateSeedCleanup.stop);
  installEarlySurfaces(snapshot, {
    geolocation: () => installGeolocationPatch(snapshot),
    integrity: {
      registrar: earlyIntegrityRegistry,
      realmId: DOCUMENT_REALM_ID,
    },
    locale: () => installLocalePatch(snapshot),
    navigator: () => installNavigatorPatch(snapshot),
    permissions: () => {
      installPermissionsPatch(snapshot);
    },
    serviceWorker: () => installServiceWorker(snapshot),
  });
  earlyIntegrityRegistry.ensureAll();
  // This marker is the cross-world readiness bridge for tooling. Playwright's
  // init scripts do not reliably observe page-world CustomEvents, so the
  // conformance harness waits on this obfuscated DOM attribute instead of
  // racing the earlier bootstrap-only runtime-ready event.
  markRuntimeApplied();
};
