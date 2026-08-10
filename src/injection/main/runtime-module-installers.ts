import { createLogger } from "@privacy-brand/refract-browser/common/debug-logger";
import {
  markSurfaceEvidence,
  markSurfaceFailed,
} from "@privacy-brand/refract-browser/common/surface-error-emitter";
import {
  installUsageListener,
  markSurfaceUsed,
} from "@privacy-brand/refract-browser/common/surface-usage-emitter";
import { installBatteryPatch } from "@privacy-brand/refract-core/fingerprint/battery-status";
import { installGeolocationPatch as installGeoPatch } from "@privacy-brand/refract-core/geolocation/geo-patch";
import type { IntegrityResult } from "@privacy-brand/refract-core/integrity/surface-integrity-registry";
import type { ModuleInstaller } from "@privacy-brand/refract-core/runtime/install";
import type {
  RefractModuleName,
  RefractRuntimeState,
} from "@privacy-brand/refract-core/runtime/state";

import { installAudioPatch } from "@/injection/main/audio-patch";
import { installCanvasPatch } from "@/injection/main/canvas-patch";
import { installClientHintsPatch } from "@/injection/main/client-hints-patch";
import { installDatePatch, installIntlPatch } from "@/injection/main/date-intl-patch";
import {
  getGeoMethodId,
  installPermissionsPatch,
} from "@/injection/main/geo-surface-patch";
import { installIframePatch } from "@/injection/main/iframe-patch";
import {
  installLocalePatch,
  installNavigatorPatch,
} from "@/injection/main/locale-patch";
import { installScreenPatch } from "@/injection/main/screen-patch";
import { installServiceWorker } from "@/injection/main/service-worker-patch";
import {
  DOCUMENT_REALM_ID,
  captureFpReceivers,
  registerBatteryIntegrity,
  registerFpIntegrity,
  registerGeoIntegrity,
  registerPermIntegrity,
  registerServiceIntegrity,
  registerWorkerIntegrity,
} from "@/injection/main/surface-integrity";
import { installWebGLPatch } from "@/injection/main/webgl-patch";
import { installWebRTCPatch } from "@/injection/main/webrtc-patch";
import { installWorkerPatch } from "@/injection/main/worker-patch";
import type { XRaySurfaceCategory } from "@/shared/types";

type RuntimeModules = Partial<Record<RefractModuleName, ModuleInstaller>>;

const integrityContext = (state: RefractRuntimeState) => ({
  registrar: state.integrity,
  realmId: DOCUMENT_REALM_ID,
});

const wrapInstaller =
  (
    category: XRaySurfaceCategory | null,
    step: (state: RefractRuntimeState) => void,
  ): ModuleInstaller =>
  (state) => {
    try {
      step(state);
    } catch (error) {
      if (category) markSurfaceFailed(category);
      throw error;
    }
  };

const createEarlyModules = (): RuntimeModules => {
  if (__PT_BROWSER_TARGET__ === "firefox") return {};
  return {
    geolocation: wrapInstaller("geolocation", (state) => {
      const snapshot = state.snapshot!;
      const baseLogger = createLogger(snapshot, "Geolocation");
      const installed = installGeoPatch(
        snapshot,
        globalThis,
        (method, args, result) => {
          markSurfaceUsed("geolocation", getGeoMethodId(method));
          baseLogger(method, args, result);
        },
        { markerKey: `${__PT_SHIM_GUARD_KEY__}:geolocation` },
      );
      if (installed) registerGeoIntegrity(integrityContext(state), globalThis);
    }),
    permissions: wrapInstaller(null, (state) => {
      const installed = installPermissionsPatch(
        state.snapshot!,
        globalThis,
        integrityContext(state),
      );
      if (installed) registerPermIntegrity(integrityContext(state), globalThis);
    }),
    date: wrapInstaller("timeLocale", (state) => {
      if (state.snapshot!.timeLocaleEnabled !== false) {
        installDatePatch(state.snapshot!, integrityContext(state));
      }
    }),
    intl: wrapInstaller("timeLocale", (state) => {
      if (state.snapshot!.timeLocaleEnabled !== false) {
        installIntlPatch(state.snapshot!, integrityContext(state));
      }
    }),
    navigator: wrapInstaller("timeLocale", (state) => {
      if (state.snapshot!.timeLocaleEnabled !== false) {
        installLocalePatch(state.snapshot!, Navigator.prototype, {
          ...integrityContext(state),
          receiver: navigator,
        });
      }
    }),
    "navigator-fingerprint": wrapInstaller("navigator", (state) => {
      installNavigatorPatch(state.snapshot!, Navigator.prototype, {
        ...integrityContext(state),
        receiver: navigator,
      });
    }),
    "client-hints": wrapInstaller("clientHints", (state) => {
      installClientHintsPatch(state.snapshot!, globalThis, integrityContext(state));
    }),
    battery: wrapInstaller("battery", (state) => {
      const installation = installBatteryPatch(state.snapshot!, globalThis, {
        onAccess: () => markSurfaceUsed("battery", "battery.getBattery"),
      });
      if (installation.status === "installed") {
        registerBatteryIntegrity(
          integrityContext(state),
          installation,
          globalThis.navigator,
        );
      }
    }),
  };
};

const registerFpSurface = (
  state: RefractRuntimeState,
  surfaceId: "audio" | "canvas" | "webGL",
): void => {
  const receivers = captureFpReceivers(globalThis, surfaceId);
  if (surfaceId === "canvas") {
    const ownership = installCanvasPatch(state.snapshot!);
    registerFpIntegrity(
      integrityContext(state),
      globalThis,
      { surfaceId, ownership },
      receivers,
    );
  } else if (surfaceId === "webGL") {
    const ownership = installWebGLPatch(state.snapshot!);
    registerFpIntegrity(
      integrityContext(state),
      globalThis,
      { surfaceId, ownership },
      receivers,
    );
  } else {
    const ownership = installAudioPatch(state.snapshot!);
    registerFpIntegrity(
      integrityContext(state),
      globalThis,
      { surfaceId, ownership },
      receivers,
    );
  }
};

const recordIntegrityResult = (result: IntegrityResult): void => {
  if (
    result.status !== "repaired" &&
    result.status !== "unrecoverable" &&
    result.status !== "unconfirmed"
  ) {
    return;
  }
  markSurfaceEvidence(result.surfaceId as XRaySurfaceCategory, {
    realmId: result.realmId,
    integrity: result.status,
    ...(result.reason ? { reasonCode: result.reason } : {}),
  });
};

const createFpModules = (): RuntimeModules => ({
  canvas: wrapInstaller("canvas", (state) => registerFpSurface(state, "canvas")),
  webgl: wrapInstaller("webGL", (state) => registerFpSurface(state, "webGL")),
  audio: wrapInstaller("audio", (state) => registerFpSurface(state, "audio")),
  screen: wrapInstaller("screen", (state) => {
    installScreenPatch(state.snapshot!, globalThis, integrityContext(state));
  }),
  "xray-bridge": wrapInstaller(null, (state) => {
    state.integrity.setResultSink({ record: recordIntegrityResult });
  }),
  iframes: wrapInstaller(null, (state) => {
    installIframePatch(state.snapshot!, state.integrity);
  }),
  webrtc: wrapInstaller("webRTC", (state) => {
    const ownership = installWebRTCPatch(state.snapshot!);
    registerFpIntegrity(integrityContext(state), globalThis, {
      surfaceId: "webRTC",
      ownership,
    });
  }),
});

const createWorkerModules = (): RuntimeModules =>
  __PT_BROWSER_TARGET__ === "firefox"
    ? {
        "dedicated-workers": wrapInstaller("worker", (state) => {
          const ownership = installWorkerPatch(state.snapshot!, {
            includeSharedWorker: false,
          });
          registerWorkerIntegrity(integrityContext(state), globalThis, ownership);
        }),
      }
    : {
        "worker-runtime": wrapInstaller("worker", (state) => {
          const ownership = installWorkerPatch(state.snapshot!);
          registerWorkerIntegrity(integrityContext(state), globalThis, ownership);
        }),
        "service-worker-register": wrapInstaller(null, (state) => {
          installServiceWorker(state.snapshot!);
          registerServiceIntegrity(integrityContext(state), globalThis);
        }),
      };

export const createRuntimeModules = (): RuntimeModules => ({
  "surface-usage": wrapInstaller(null, (state) => {
    installUsageListener(() => state.snapshot?.authKey);
  }),
  ...createEarlyModules(),
  ...createFpModules(),
  ...createWorkerModules(),
});
