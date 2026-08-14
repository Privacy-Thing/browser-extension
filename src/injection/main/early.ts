import { readEarlySnapshot } from "@privacy-brand/refract-browser/chromium";
import "@privacy-brand/refract-core/runtime/primordials";
import {
  cleanupRuntimeWindowSeed,
  markEarlyTemporalOwner,
  readWindowSeedSnapshot,
  readRuntimeConfigElement,
  finalizeRuntimeEnabled,
  writeConfigElement,
  getRuntimeReadyEvent,
} from "@privacy-brand/refract-browser/common/runtime-config";
import {
  markSurfaceUsed,
  setSurfaceUsageSourceId,
} from "@privacy-brand/refract-browser/common/surface-usage-emitter";
import { installGeoErrorPrototype } from "@privacy-brand/refract-core/geolocation/geolocation-error-factory";
import {
  getTemporalApiAnchors,
  installTemporalApiPatch,
} from "@privacy-brand/refract-core/time/temporal-api-patch";

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

  if (
    parentGlobal === globalThis &&
    snapshot.timeLocaleEnabled !== false &&
    snapshot.temporalApiEnabled === true &&
    snapshot.locale
  ) {
    setSurfaceUsageSourceId("runtime:temporal-early");
    const anchors = installTemporalApiPatch({
      targetGlobal: globalThis,
      defaults: {
        languages: snapshot.locale.formattingLanguages ?? snapshot.locale.languages,
        timeZone: snapshot.locale.timeZone,
      },
      onAccess: (methodId) => markSurfaceUsed("timeLocale", methodId),
    });
    if (
      anchors.length > 0 &&
      anchors.length === getTemporalApiAnchors(globalThis).length
    ) {
      markEarlyTemporalOwner(document);
    }
  }

  globalThis.dispatchEvent(new CustomEvent(getRuntimeReadyEvent()));
};

bootload();
