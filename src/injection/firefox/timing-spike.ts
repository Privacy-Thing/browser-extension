import { FX_RUNTIME_TEST_HOST } from "@/shared/build-flags";
import { DIAGNOSTIC_GLOBAL_KEYS } from "@/shared/extension-contract";

export const installTimingSpike = (
  testHost: string = FX_RUNTIME_TEST_HOST,
  diagnosticKey: string = DIAGNOSTIC_GLOBAL_KEYS.firefoxTimingSpike,
): void => {
  if (!testHost || globalThis.location.hostname !== testHost) {
    return;
  }

  Object.defineProperty(globalThis, diagnosticKey, {
    value: Object.freeze({
      href: globalThis.location.href,
      readyState: document.readyState,
    }),
    writable: false,
    enumerable: false,
    configurable: false,
  });
};

installTimingSpike();
