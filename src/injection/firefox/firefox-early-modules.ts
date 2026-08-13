import {
  type FirefoxShimState,
  type FirefoxTimeLocaleState,
  toSnapshotFromFxState,
} from "@privacy-brand/refract-browser/common/firefox-shim-state";
import {
  markSurfaceEvidence,
  markSurfaceFailed,
} from "@privacy-brand/refract-browser/common/surface-error-emitter";
import {
  installUsageListener,
  markSurfaceUsed,
} from "@privacy-brand/refract-browser/common/surface-usage-emitter";
import { attachWorkerUsageRelay } from "@privacy-brand/refract-browser/common/worker-surface-usage-relay";
import {
  createNavigatorReaders,
  installNavigatorGetters,
} from "@privacy-brand/refract-core/fingerprint/navigator-fingerprint-readers";
import {
  type GeoPermissionPatchState,
  installGeoPermPatch,
} from "@privacy-brand/refract-core/geolocation/geolocation-permissions";
import { requireNewTarget } from "@privacy-brand/refract-core/native/constructor-wiring";
import { defineNativeGetter } from "@privacy-brand/refract-core/native/native-getter";
import {
  createNativeSource,
  maskAsNative,
} from "@privacy-brand/refract-core/native/native-mask";
import { installFxWorkers } from "@privacy-brand/refract-core/runtime/firefox-worker-interceptors";
import { installModuleOnce } from "@privacy-brand/refract-core/runtime/install";
import {
  inspectPatchAnchors,
  markPatchAnchor,
} from "@privacy-brand/refract-core/runtime/patch-marker";
import {
  privateDefineProperty,
  privateGetPrototype,
  privateOwnDescriptor,
  privateReflectApply,
} from "@privacy-brand/refract-core/runtime/primordials";
import type {
  RefractModuleName,
  RefractRuntimeState,
} from "@privacy-brand/refract-core/runtime/state";
import { installFxDateIntl } from "@privacy-brand/refract-core/time/firefox-date-intl-patch";
import { installLocaleGetters } from "@privacy-brand/refract-core/time/locale-getters";
import { installTemporalApiPatch as installCoreTemporalApiPatch } from "@privacy-brand/refract-core/time/temporal-api-patch";

import { installFxClientHints } from "@/injection/firefox/client-hints-patch";
import { registerFxDateIntegrity } from "@/injection/firefox/date-integrity";
import {
  getFxWorkerMode,
  prepareFxWorkerOptions,
} from "@/injection/firefox/firefox-worker-options";
import {
  shouldReportFxFp,
  shouldReportFxGeo,
  shouldReportFxTimeLocale,
} from "@/injection/firefox/xray-surface-reporting";
import {
  DOCUMENT_REALM_ID,
  registerDescriptor,
  registerGeoIntegrity,
  registerPermIntegrity,
  type RuntimeIntegrityContext,
} from "@/injection/main/surface-integrity";
import { registerTemporalAnchors } from "@/injection/temporal-api-patch";
import type { XRaySurfaceCategory, SpoofingSurfaceMethodId } from "@/shared/types";

type FxEarlyModuleDeps = {
  emitLog(component: string, method: string, args: unknown[], result?: unknown): void;
  geoBridge: { install(): void };
  getState(): FirefoxShimState | null;
  getTimeLocale(): FirefoxTimeLocaleState | null;
  permissionsState: GeoPermissionPatchState;
  runtimeState: RefractRuntimeState;
  syncBootstrap(): void;
};

class FxEarlyModuleInstaller {
  readonly #deps: FxEarlyModuleDeps;
  #sharedWorkerCounter = 0;

  constructor(deps: FxEarlyModuleDeps) {
    this.#deps = deps;
  }

  install(): void {
    installModuleOnce(this.#deps.runtimeState, "surface-usage", () => {
      installUsageListener(() => this.#deps.getState()?.authKey);
    });
    this.#installModule("geolocation", "geolocation", () => {
      this.#deps.geoBridge.install();
      const integrity = this.#integrity();
      registerGeoIntegrity(integrity, globalThis);
      registerPermIntegrity(integrity, globalThis);
    });
    this.#installDateIntl();
    this.#installTemporal();
    this.#installLocale();
    this.#installNavigator();
    this.#installPermissions();
    this.#installClientHints();
    this.#installDedicatedWorkers();
    this.#installSharedWorker();
    this.#installServiceWorker();
  }

  syncTemporal(): void {
    this.#installTemporal();
  }

  #integrity() {
    return {
      registrar: this.#deps.runtimeState.integrity,
      realmId: DOCUMENT_REALM_ID,
    };
  }

  #installModule(
    category: XRaySurfaceCategory,
    name: RefractModuleName,
    step: () => void,
  ): void {
    installModuleOnce(this.#deps.runtimeState, name, () => {
      try {
        step();
      } catch (error) {
        markSurfaceFailed(category);
        throw error;
      }
    });
  }

  #installDateIntl(): void {
    this.#installModule("timeLocale", "date-intl", () => {
      installFxDateIntl({
        syncBootstrapState: this.#deps.syncBootstrap,
        getTimeLocaleState: this.#deps.getTimeLocale,
        onFirstAccess: () => {
          if (shouldReportFxTimeLocale(this.#deps.getState())) {
            markSurfaceUsed("timeLocale");
          }
        },
      });
      const integrity = this.#integrity();
      registerDescriptor({
        integrity,
        target: globalThis,
        key: "Date",
        anchor: { surfaceId: "timeLocale", methodId: "date.constructor" },
      });
      registerDescriptor({
        integrity,
        target: Date,
        key: "parse",
        anchor: { surfaceId: "timeLocale", methodId: "date.parse" },
      });
      registerFxDateIntegrity(integrity, Date);
      this.#registerIntlIntegrity(integrity);
    });
  }

  #installTemporal(): void {
    this.#deps.syncBootstrap();
    if (this.#deps.getTimeLocale()?.temporalApiEnabled !== true) return;
    this.#installModule("timeLocale", "temporal", () => {
      const anchors = installCoreTemporalApiPatch({
        targetGlobal: globalThis,
        defaults: () => {
          const state = this.#deps.getTimeLocale();
          return state?.temporalApiEnabled === true
            ? {
                languages: state.formattingLanguages ?? state.languages,
                timeZone: state.timeZone,
              }
            : null;
        },
        onAccess: (methodId) => {
          this.#deps.syncBootstrap();
          if (shouldReportFxTimeLocale(this.#deps.getState())) {
            markSurfaceUsed("timeLocale", methodId);
          }
        },
      });
      registerTemporalAnchors(this.#integrity(), anchors);
    });
  }

  #registerIntlIntegrity(integrity: RuntimeIntegrityContext): void {
    for (const key of [
      "DateTimeFormat",
      "NumberFormat",
      "Collator",
      "RelativeTimeFormat",
      "ListFormat",
      "DisplayNames",
      "PluralRules",
      "Segmenter",
    ] as const) {
      const constructor = Intl[key] as unknown as { prototype?: object } | undefined;
      if (!constructor) continue;
      registerDescriptor({
        integrity,
        target: Intl,
        key,
        anchor: { surfaceId: "timeLocale", methodId: "intl.constructor" },
      });
      if (constructor.prototype) {
        registerDescriptor({
          integrity,
          target: constructor.prototype,
          key: "resolvedOptions",
          anchor: { surfaceId: "timeLocale", methodId: "intl.resolvedOptions" },
        });
      }
    }
    registerDescriptor({
      integrity,
      target: Intl.DateTimeFormat.prototype,
      key: "format",
      anchor: {
        surfaceId: "timeLocale",
        methodId: "intl.DateTimeFormat.format",
      },
    });
  }

  #installLocale(): void {
    this.#installModule("timeLocale", "navigator", () => {
      const target =
        typeof Navigator !== "undefined"
          ? Navigator.prototype
          : privateGetPrototype(navigator);
      if (!target) return;
      const languageGetter = privateOwnDescriptor(target, "language")?.get;
      const languagesGetter = privateOwnDescriptor(target, "languages")?.get;
      installLocaleGetters(
        (property, getter) => {
          const nativeGetter =
            property === "language" ? languageGetter : languagesGetter;
          defineNativeGetter(
            target,
            property,
            () => this.#readLocale(property, getter, nativeGetter),
            {
              integrity: {
                registrar: this.#deps.runtimeState.integrity,
                anchor: {
                  surfaceId: "timeLocale",
                  realmId: DOCUMENT_REALM_ID,
                  repairPolicy: "repair",
                  criticality: "preview-critical",
                  resolveReceiver: () => navigator,
                },
              },
            },
          );
        },
        {
          language: () => this.#deps.getTimeLocale()?.language ?? "en-US",
          languages: () => this.#deps.getTimeLocale()?.languages ?? ["en-US"],
        },
      );
    });
  }

  #readLocale<TValue>(
    property: "language" | "languages",
    getter: () => TValue,
    nativeGetter: (() => unknown) | undefined,
  ): TValue | unknown {
    this.#deps.syncBootstrap();
    if (shouldReportFxTimeLocale(this.#deps.getState())) {
      markSurfaceUsed("timeLocale");
    }
    if (this.#deps.getTimeLocale()) return getter();
    if (nativeGetter) return privateReflectApply(nativeGetter, navigator, []);
    return property === "language" ? "en-US" : ["en-US"];
  }

  #installNavigator(): void {
    this.#installModule("navigator", "navigator-fingerprint", () => {
      const target =
        typeof Navigator !== "undefined"
          ? Navigator.prototype
          : privateGetPrototype(navigator);
      if (!target) return;
      const methodIds = this.#navigatorMethodIds();
      defineNativeGetter(
        target,
        "webdriver",
        () => {
          if (shouldReportFxFp(this.#deps.getState())) markSurfaceUsed("navigator");
          this.#deps.emitLog("Navigator", "get webdriver", [], false);
          return false;
        },
        { integrity: this.#navigatorIntegrity(methodIds.webdriver) },
      );
      const readers = createNavigatorReaders(() => {
        this.#deps.syncBootstrap();
        return this.#deps.getState()?.fingerprint ?? null;
      });
      installNavigatorGetters({
        readers,
        defineGetter: (property, getter) =>
          defineNativeGetter(
            target,
            property,
            () => {
              if (shouldReportFxFp(this.#deps.getState())) {
                markSurfaceUsed("navigator");
              }
              const value = getter();
              if (value !== undefined) {
                this.#deps.emitLog("Navigator", `get ${property}`, [], value);
              }
              return value;
            },
            { integrity: this.#navigatorIntegrity(methodIds[property]) },
          ),
        hasProperty: (property) => property in target,
      });
    });
  }

  #navigatorMethodIds() {
    return {
      appVersion: "navigator.appVersion",
      deviceMemory: "navigator.deviceMemory",
      hardwareConcurrency: "navigator.hardwareConcurrency",
      maxTouchPoints: "navigator.maxTouchPoints",
      platform: "navigator.platform",
      userAgent: "navigator.userAgent",
      vendor: "navigator.vendor",
      webdriver: "navigator.webdriver",
    } as const satisfies Record<string, SpoofingSurfaceMethodId>;
  }

  #navigatorIntegrity(methodId: SpoofingSurfaceMethodId) {
    return {
      registrar: this.#deps.runtimeState.integrity,
      anchor: {
        surfaceId: "navigator" as const,
        methodId,
        realmId: DOCUMENT_REALM_ID,
        repairPolicy: "repair" as const,
        criticality: "preview-critical" as const,
        resolveReceiver: () => navigator,
      },
    };
  }

  #installPermissions(): void {
    this.#installModule("geolocation", "permissions", () => {
      if (this.#deps.getState()?.geolocationEnabled === false) return;
      if (!("permissions" in navigator)) return;
      const queryTarget =
        typeof Permissions !== "undefined"
          ? Permissions.prototype
          : navigator.permissions;
      installGeoPermPatch({
        integrity: {
          registrar: this.#deps.runtimeState.integrity,
          surfaceId: "geolocation",
          realmId: DOCUMENT_REALM_ID,
        },
        logger: (method, args, result) => {
          if (
            method === "query [geolocation]" &&
            shouldReportFxGeo(this.#deps.getState())
          ) {
            markSurfaceUsed("geolocation", "geolocation.permissionsQuery");
          }
          this.#deps.emitLog("Permissions", method, args, result);
        },
        patchState: this.#deps.permissionsState,
        permissionPrototype:
          typeof PermissionStatus === "undefined" ? null : PermissionStatus.prototype,
        queryTarget,
        resolveGeolocationState: () => "granted",
      });
      registerPermIntegrity(this.#integrity(), globalThis);
    });
  }

  #installClientHints(): void {
    this.#installModule("clientHints", "client-hints", () => {
      installFxClientHints({
        targetGlobal: globalThis,
        integrity: this.#integrity(),
        getClientHints: () => {
          this.#deps.syncBootstrap();
          return this.#deps.getState()?.fingerprint?.clientHints ?? null;
        },
      });
    });
  }

  #installDedicatedWorkers(): void {
    this.#installModule("worker", "dedicated-workers", () => {
      installFxWorkers({
        buildRuntimeSnapshot: () => {
          this.#deps.syncBootstrap();
          const state = this.#deps.getState();
          return state ? toSnapshotFromFxState(state) : null;
        },
        syncBootstrapState: this.#deps.syncBootstrap,
        shouldBlockServiceWorker: () => false,
        emitWorkerCompatSignal: (workerKind, url, phase) => {
          this.#deps.emitLog("Worker", `${workerKind} [fallback]`, [url], phase);
        },
        patchServiceWorker: false,
        resolveWorkerMode: () => getFxWorkerMode(this.#deps.getState()),
        markWorkerSurfaceFailed: () => markSurfaceFailed("worker"),
        markIntegrityEvidence: (evidence) =>
          markSurfaceEvidence(evidence.surfaceId as XRaySurfaceCategory, {
            realmId: evidence.realmId,
            integrity: evidence.status,
            ...(evidence.attemptId ? { attemptId: evidence.attemptId } : {}),
            ...(evidence.reasonCode ? { reasonCode: evidence.reasonCode } : {}),
          }),
      });
    });
  }

  #installSharedWorker(): void {
    if (typeof SharedWorker === "undefined") return;
    this.#installModule("sharedWorker", "shared-workers", () => {
      const NativeSharedWorker = SharedWorker;
      const anchorState = inspectPatchAnchors(__PT_WORKER_PATCH_GUARD_KEY__, [
        { fn: NativeSharedWorker, name: "SharedWorker" },
      ]);
      if (anchorState === "installed") return;
      if (anchorState === "conflict") {
        throw new Error("Conflicting SharedWorker patch anchor");
      }
      const installer = this;
      const PatchedSharedWorker = maskAsNative(
        function (
          this: SharedWorker,
          scriptURL: string | URL,
          options?: string | WorkerOptions,
        ): SharedWorker {
          const target = requireNewTarget(NativeSharedWorker, new.target, [
            scriptURL,
            options,
          ]);
          markSurfaceUsed("sharedWorker", "sharedWorker.constructor");
          const nativeOptions = prepareFxWorkerOptions(
            scriptURL,
            options,
            installer.#deps.getState,
          );
          const worker = Reflect.construct(
            NativeSharedWorker,
            [scriptURL, nativeOptions as string | WorkerOptions],
            target,
          ) as SharedWorker;
          attachWorkerUsageRelay(worker.port, {
            guard: __PT_SHIM_GUARD_KEY__,
            sourceId: `sharedworker:${++installer.#sharedWorkerCounter}`,
          });
          return worker;
        },
        createNativeSource("SharedWorker"),
        1,
      ) as unknown as typeof SharedWorker;
      markPatchAnchor(
        PatchedSharedWorker,
        __PT_WORKER_PATCH_GUARD_KEY__,
        "SharedWorker",
      );
      privateDefineProperty(PatchedSharedWorker, "prototype", {
        configurable: false,
        enumerable: false,
        value: NativeSharedWorker.prototype,
        writable: false,
      });
      privateDefineProperty(globalThis, "SharedWorker", {
        configurable: true,
        value: PatchedSharedWorker,
      });
      registerDescriptor({
        integrity: this.#integrity(),
        target: globalThis,
        key: "SharedWorker",
        anchor: {
          surfaceId: "sharedWorker",
          methodId: "sharedWorker.constructor",
        },
      });
    });
  }

  #installServiceWorker(): void {
    if (
      typeof navigator === "undefined" ||
      !("serviceWorker" in navigator) ||
      typeof ServiceWorkerContainer === "undefined"
    ) {
      return;
    }
    this.#installModule("serviceWorker", "service-worker-register", () => {
      const NativeRegister = ServiceWorkerContainer.prototype.register;
      const anchorState = inspectPatchAnchors(__PT_SW_PATCH_GUARD_KEY__, [
        { fn: NativeRegister, name: "register" },
      ]);
      if (anchorState === "installed") return;
      if (anchorState === "conflict") {
        throw new Error("Conflicting ServiceWorker.register patch anchor");
      }
      const installer = this;
      const PatchedRegister = maskAsNative(function (
        this: ServiceWorkerContainer,
        scriptURL: string | URL,
        ...rest: [RegistrationOptions?]
      ): Promise<ServiceWorkerRegistration> {
        if (installer.#deps.getState()?.blockServiceWorkerRegistration) {
          markSurfaceUsed("serviceWorker", "serviceWorker.register");
          installer.#deps.emitLog("ServiceWorker", "register [blocked]", [
            String(scriptURL),
            ...rest,
          ]);
          return Promise.reject(
            installer.#createBlockedRegError(rest[0]?.scope ?? "/", String(scriptURL)),
          );
        }
        return privateReflectApply(NativeRegister, this, [
          scriptURL,
          ...rest,
        ]) as Promise<ServiceWorkerRegistration>;
      }, createNativeSource("register"));
      markPatchAnchor(PatchedRegister, __PT_SW_PATCH_GUARD_KEY__, "register");
      privateDefineProperty(ServiceWorkerContainer.prototype, "register", {
        configurable: true,
        enumerable: true,
        value: PatchedRegister,
        writable: true,
      });
      registerDescriptor({
        integrity: this.#integrity(),
        target: ServiceWorkerContainer.prototype,
        key: "register",
        anchor: {
          surfaceId: "serviceWorker",
          methodId: "serviceWorker.register",
          receiver: navigator.serviceWorker,
        },
      });
    });
  }

  #createBlockedRegError(scope: string, url: string): DOMException {
    return new DOMException(
      `Failed to register/update a ServiceWorker for scope ('${scope}'): ` +
        `The operation is insecure for script ('${url}').`,
      "SecurityError",
    );
  }
}

export type FxEarlyModuleControl = {
  syncTemporal(): void;
};

export const installFxEarlyModules = (
  deps: FxEarlyModuleDeps,
): FxEarlyModuleControl => {
  const installer = new FxEarlyModuleInstaller(deps);
  installer.install();
  return { syncTemporal: () => installer.syncTemporal() };
};
