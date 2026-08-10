import { readEarlySnapshot } from "@privacy-brand/refract-browser/chromium";
import "@privacy-brand/refract-core/runtime/primordials";
import {
  cleanupRuntimeWindowSeed,
  readWindowSeedSnapshot,
  readRuntimeConfigElement,
  finalizeRuntimeEnabled,
  writeConfigElement,
  getRuntimeReadyEvent,
} from "@privacy-brand/refract-browser/common/runtime-config";
import { installGeoErrorPrototype } from "@privacy-brand/refract-core/geolocation/geolocation-error-factory";

const bootload = (): void => {
  const { snapshot, channel } = readEarlySnapshot({
    readHashSnapshot: readWindowSeedSnapshot,
    readDomHandoffSnapshot: readRuntimeConfigElement,
  });

  if (!snapshot) return;
  finalizeRuntimeEnabled();
  // A late background write may have arrived between the transport read and
  // this entrypoint. The full runtime owns the bounded follow-up cleanup.
  cleanupRuntimeWindowSeed(window);
  const parentGlobal = globalThis.parent as unknown as typeof globalThis;

  if (snapshot.geolocationEnabled !== false && parentGlobal !== globalThis) {
    installGeoErrorPrototype(globalThis, parentGlobal);
  }

  // Write a DOM element so main-world-runtime.js can read it synchronously.
  // Skip when the snapshot already came from the DOM handoff element.
  if (channel !== "dom-handoff") {
    writeConfigElement(document, snapshot);
  }

  globalThis.dispatchEvent(new CustomEvent(getRuntimeReadyEvent()));
};

bootload();
