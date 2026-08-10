import { markSurfaceFailed } from "@privacy-brand/refract-browser/common/surface-error-emitter";

import { installAudioPatch } from "@/injection/main/audio-patch";
import { installCanvasPatch } from "@/injection/main/canvas-patch";
import { installClientHintsPatch } from "@/injection/main/client-hints-patch";
import { installDatePatch, installIntlPatch } from "@/injection/main/date-intl-patch";
import { installScreenPatch } from "@/injection/main/screen-patch";
import {
  captureFpReceivers,
  registerFpIntegrity,
  registerServiceIntegrity,
  registerWorkerIntegrity,
  type RuntimeIntegrityContext,
} from "@/injection/main/surface-integrity";
import { installWebGLPatch } from "@/injection/main/webgl-patch";
import { installWebRTCPatch } from "@/injection/main/webrtc-patch";
import { installWorkerPatch } from "@/injection/main/worker-patch";
import type { XRaySurfaceCategory, RuntimeSnapshot } from "@/shared/types";

type SafeInstall = (category: XRaySurfaceCategory | null, step: () => void) => void;

type EarlySurfaceOptions = {
  geolocation(): void;
  integrity: RuntimeIntegrityContext;
  locale(): void;
  navigator(): void;
  permissions(): void;
  serviceWorker(): void;
};

const createSafeInstall = (): SafeInstall => (category, step) => {
  try {
    step();
  } catch {
    if (category) markSurfaceFailed(category);
  }
};

const installFpSurfaces = (
  snapshot: RuntimeSnapshot,
  options: EarlySurfaceOptions,
  safeInstall: SafeInstall,
): void => {
  safeInstall("canvas", () => {
    const receivers = captureFpReceivers(globalThis, "canvas");
    const ownership = installCanvasPatch(snapshot);
    registerFpIntegrity(
      options.integrity,
      globalThis,
      { surfaceId: "canvas", ownership },
      receivers,
    );
  });
  safeInstall("webGL", () => {
    const receivers = captureFpReceivers(globalThis, "webGL");
    const ownership = installWebGLPatch(snapshot);
    registerFpIntegrity(
      options.integrity,
      globalThis,
      { surfaceId: "webGL", ownership },
      receivers,
    );
  });
  safeInstall("audio", () => {
    const receivers = captureFpReceivers(globalThis, "audio");
    const ownership = installAudioPatch(snapshot);
    registerFpIntegrity(
      options.integrity,
      globalThis,
      { surfaceId: "audio", ownership },
      receivers,
    );
  });
  safeInstall("screen", () =>
    installScreenPatch(snapshot, globalThis, options.integrity),
  );
  safeInstall("webRTC", () => {
    const ownership = installWebRTCPatch(snapshot);
    registerFpIntegrity(options.integrity, globalThis, {
      surfaceId: "webRTC",
      ownership,
    });
  });
};

const installWorkers = (
  snapshot: RuntimeSnapshot,
  options: EarlySurfaceOptions,
  safeInstall: SafeInstall,
): void => {
  safeInstall("worker", () => {
    const ownership = installWorkerPatch(snapshot);
    registerWorkerIntegrity(options.integrity, globalThis, ownership);
  });
  safeInstall(null, () => {
    options.serviceWorker();
    registerServiceIntegrity(options.integrity, globalThis);
  });
};

export const installEarlySurfaces = (
  snapshot: RuntimeSnapshot,
  options: EarlySurfaceOptions,
): void => {
  const safeInstall = createSafeInstall();
  if (snapshot.timeLocaleEnabled !== false) {
    safeInstall("timeLocale", () => installDatePatch(snapshot, options.integrity));
    safeInstall("timeLocale", options.locale);
  }
  safeInstall("navigator", options.navigator);
  safeInstall("clientHints", () =>
    installClientHintsPatch(snapshot, globalThis, options.integrity),
  );
  installFpSurfaces(snapshot, options, safeInstall);
  if (snapshot.timeLocaleEnabled !== false) {
    safeInstall("timeLocale", () => installIntlPatch(snapshot, options.integrity));
  }
  installWorkers(snapshot, options, safeInstall);
  safeInstall(null, options.permissions);
  safeInstall("geolocation", options.geolocation);
};
