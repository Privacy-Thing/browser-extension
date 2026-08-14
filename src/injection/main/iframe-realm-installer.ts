import { markSurfaceFailed } from "@privacy-brand/refract-browser/common/surface-error-emitter";
import { markSurfaceUsed } from "@privacy-brand/refract-browser/common/surface-usage-emitter";
import { installBatteryPatch } from "@privacy-brand/refract-core/fingerprint/battery-status";
import { installGeoErrorPrototype } from "@privacy-brand/refract-core/geolocation/geolocation-error-factory";
import type { SurfaceIntegrityRegistry } from "@privacy-brand/refract-core/integrity/surface-integrity-registry";
import {
  createNativeSource,
  mirrorNativeToStringInto,
  registerNativeSource,
} from "@privacy-brand/refract-core/native/native-mask";

import { installCanvasPatch } from "@/injection/main/canvas-patch";
import { installClientHintsPatch } from "@/injection/main/client-hints-patch";
import { installChildGeoPatch } from "@/injection/main/geo-surface-patch";
import {
  isParentOwnedRealm,
  shouldParentOwnFrame,
} from "@/injection/main/iframe-realm-ownership";
import {
  installLocalePatch,
  installNavigatorPatch,
} from "@/injection/main/locale-patch";
import { installScreenPatch } from "@/injection/main/screen-patch";
import {
  captureFpReceivers,
  registerBatteryIntegrity,
  registerFpIntegrity,
  type RuntimeIntegrityContext,
} from "@/injection/main/surface-integrity";
import { installWebGLPatch } from "@/injection/main/webgl-patch";
import { installTemporalApiPatch } from "@/injection/temporal-api-patch";
import { BUILD_BROWSER_TARGET } from "@/shared/build-flags";
import type { XRaySurfaceCategory, RuntimeSnapshot } from "@/shared/types";

export type IframeDomHooks = {
  installContentWindow(win: Window): void;
  installDocument(win: Window): void;
  installMutation(doc: Document): void;
  installRange(win: Window): void;
};

export class IframeRealmInstaller {
  readonly #geoEnabled: boolean;
  readonly #hooks: IframeDomHooks;
  readonly #lastWindowByFrame = new WeakMap<HTMLIFrameElement, Window>();
  readonly #patchedNavProtos = new WeakSet<object>();
  readonly #realmIdsByWindow = new WeakMap<Window, string>();
  readonly #registrar: SurfaceIntegrityRegistry;
  #realmSequence = 0;
  readonly #snapshot: RuntimeSnapshot;

  constructor(
    snapshot: RuntimeSnapshot,
    registrar: SurfaceIntegrityRegistry,
    hooks: IframeDomHooks,
  ) {
    this.#snapshot = snapshot;
    this.#registrar = registrar;
    this.#hooks = hooks;
    this.#geoEnabled = snapshot.geolocationEnabled !== false;
  }

  patch(frame: HTMLIFrameElement, win: Window, synchronousAccess = false): void {
    const iframeGlobal = win as Window & typeof globalThis;
    const topologyOwns = shouldParentOwnFrame(frame, iframeGlobal, {
      parentOwnsSrcdoc: BUILD_BROWSER_TARGET === "firefox",
    });
    const parentOwns = synchronousAccess
      ? isParentOwnedRealm(iframeGlobal) || topologyOwns
      : topologyOwns;
    mirrorNativeToStringInto(iframeGlobal);
    this.#registerSources(win);
    if (this.#geoEnabled) installGeoErrorPrototype(iframeGlobal, globalThis);
    if (!parentOwns) return;

    this.#installBasicHooks(win);
    if (!win.navigator) return;
    this.#installDocumentHooks(win);
    const navPrototype = Object.getPrototypeOf(win.navigator) as object | null;
    if (navPrototype && this.#patchedNavProtos.has(navPrototype)) return;
    if (navPrototype) this.#patchedNavProtos.add(navPrototype);
    const integrity = this.#createIntegrity(frame, win);
    this.#installSurfaces(iframeGlobal, win, navPrototype, integrity);
    this.#installDateIntl(iframeGlobal, integrity);
  }

  #createIntegrity(frame: HTMLIFrameElement, win: Window): RuntimeIntegrityContext {
    const previousWin = this.#lastWindowByFrame.get(frame);
    if (previousWin && previousWin !== win) {
      const previousRealmId = this.#realmIdsByWindow.get(previousWin);
      if (previousRealmId) {
        try {
          this.#registrar.unregisterRealm(previousRealmId);
        } catch {
          // The old Window will release its anchors when it becomes unreachable.
        }
      }
    }
    this.#lastWindowByFrame.set(frame, win);
    let realmId = this.#realmIdsByWindow.get(win);
    if (!realmId) {
      realmId = `iframe-${++this.#realmSequence}`;
      this.#realmIdsByWindow.set(win, realmId);
    }
    return { registrar: this.#registrar, realmId };
  }

  #installBasicHooks(win: Window): void {
    this.#hooks.installContentWindow(win);
    this.#hooks.installDocument(win);
  }

  #installDocumentHooks(win: Window): void {
    this.#hooks.installRange(win);
    try {
      if (win.document) this.#hooks.installMutation(win.document);
    } catch {
      // Cross-origin document access is outside this runtime's ownership.
    }
  }

  #installSurfaces(
    iframeGlobal: Window & typeof globalThis,
    win: Window,
    navPrototype: object | null,
    integrity: RuntimeIntegrityContext,
  ): void {
    if (this.#geoEnabled) {
      this.#installSurface("geolocation", () =>
        installChildGeoPatch(this.#snapshot, iframeGlobal, integrity),
      );
    }
    if (navPrototype) {
      this.#installNavSurfaces(iframeGlobal, win, navPrototype, integrity);
    }
    this.#installSurface("clientHints", () =>
      installClientHintsPatch(this.#snapshot, iframeGlobal, integrity),
    );
    this.#installSurface("screen", () =>
      installScreenPatch(this.#snapshot, iframeGlobal, integrity),
    );
    this.#installFpSurfaces(iframeGlobal, integrity);
  }

  #installNavSurfaces(
    iframeGlobal: Window & typeof globalThis,
    win: Window,
    navPrototype: object,
    integrity: RuntimeIntegrityContext,
  ): void {
    const navIntegrity = { ...integrity, receiver: win.navigator };
    this.#installSurface("timeLocale", () =>
      installLocalePatch(this.#snapshot, navPrototype, navIntegrity),
    );
    this.#installSurface("navigator", () =>
      installNavigatorPatch(this.#snapshot, navPrototype, navIntegrity),
    );
    if (BUILD_BROWSER_TARGET === "chromium") {
      this.#installSurface("battery", () => {
        const installation = installBatteryPatch(this.#snapshot, iframeGlobal, {
          onAccess: () => markSurfaceUsed("battery", "battery.getBattery"),
        });
        if (installation.status === "installed") {
          registerBatteryIntegrity(integrity, installation, iframeGlobal.navigator);
        }
      });
    }
  }

  #installFpSurfaces(
    iframeGlobal: Window & typeof globalThis,
    integrity: RuntimeIntegrityContext,
  ): void {
    this.#installSurface("canvas", () => {
      const receivers = captureFpReceivers(iframeGlobal, "canvas");
      const ownership = installCanvasPatch(this.#snapshot, iframeGlobal);
      registerFpIntegrity(
        integrity,
        iframeGlobal,
        { surfaceId: "canvas", ownership },
        receivers,
      );
    });
    this.#installSurface("webGL", () => {
      const receivers = captureFpReceivers(iframeGlobal, "webGL");
      const ownership = installWebGLPatch(this.#snapshot, iframeGlobal);
      registerFpIntegrity(
        integrity,
        iframeGlobal,
        { surfaceId: "webGL", ownership },
        receivers,
      );
    });
  }

  #installDateIntl(
    win: Window & typeof globalThis,
    integrity: RuntimeIntegrityContext,
  ): void {
    this.#registerSources(win);
    this.#installSurface("timeLocale", () =>
      installTemporalApiPatch(this.#snapshot, win, integrity),
    );
    registerNativeSource(Date, createNativeSource("Date"));
    registerNativeSource(Date.prototype.toString, createNativeSource("toString"));
    Object.defineProperty(win, "Date", {
      configurable: true,
      value: Date,
      writable: true,
    });
    Object.defineProperty(win, "Intl", {
      configurable: true,
      value: Intl,
      writable: true,
    });
  }

  #installSurface(category: XRaySurfaceCategory, installer: () => void): void {
    try {
      installer();
    } catch {
      markSurfaceFailed(category);
    }
  }

  #registerSources(win: Window): void {
    try {
      const iframeGlobal = win as Window & typeof globalThis;
      registerNativeSource(
        iframeGlobal.Function.prototype.toString,
        createNativeSource("toString"),
      );
      registerNativeSource(iframeGlobal.Date, createNativeSource("Date"));
      registerNativeSource(
        iframeGlobal.Date.prototype.toString,
        createNativeSource("toString"),
      );
      const getPosition = win.navigator?.geolocation?.getCurrentPosition;
      if (typeof getPosition === "function") {
        registerNativeSource(getPosition, createNativeSource("getCurrentPosition"));
      }
    } catch {
      // Page-replaced and cross-origin frame surfaces are not parent-owned.
    }
  }
}
