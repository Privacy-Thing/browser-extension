import {
  getRuntimeReadyEvent,
  readRuntimeSnapshot,
} from "@privacy-brand/refract-browser/common/runtime-config";

export const installWorkerHooks = (): void => {
  const snapshot = readRuntimeSnapshot();
  if (!snapshot) {
    return;
  }
};

if (readRuntimeSnapshot()) {
  installWorkerHooks();
} else {
  globalThis.addEventListener(getRuntimeReadyEvent(), installWorkerHooks, {
    once: true,
  });
}
