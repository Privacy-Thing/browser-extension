import { markSurfaceUsed } from "@privacy-brand/refract-browser/common/surface-usage-emitter";
import {
  getTemporalApiAnchors,
  installTemporalApiPatch as installCoreTemporalApiPatch,
  type TemporalApiAnchor,
  type TemporalApiGlobal,
} from "@privacy-brand/refract-core/time/temporal-api-patch";

import {
  registerDescriptor,
  type RuntimeIntegrityContext,
} from "@/injection/main/surface-integrity";
import type { RuntimeSnapshot, SpoofingSurfaceMethodId } from "@/shared/types";

export const registerTemporalAnchors = (
  integrity: RuntimeIntegrityContext | undefined,
  anchors: readonly TemporalApiAnchor[],
): void => {
  for (const anchor of anchors) {
    registerDescriptor({
      integrity,
      target: anchor.target,
      key: anchor.key,
      anchor: {
        surfaceId: "timeLocale",
        methodId: anchor.methodId as SpoofingSurfaceMethodId,
      },
    });
  }
};

export const installTemporalApiPatch = (
  snapshot: RuntimeSnapshot,
  targetGlobal: TemporalApiGlobal = globalThis,
  integrity?: RuntimeIntegrityContext,
  adoptCurrent = false,
): TemporalApiAnchor[] => {
  if (
    snapshot.timeLocaleEnabled === false ||
    snapshot.temporalApiEnabled !== true ||
    !snapshot.locale
  ) {
    return [];
  }
  const anchors = adoptCurrent
    ? getTemporalApiAnchors(targetGlobal)
    : installCoreTemporalApiPatch({
        targetGlobal,
        defaults: {
          languages: snapshot.locale.formattingLanguages ?? snapshot.locale.languages,
          timeZone: snapshot.locale.timeZone,
        },
        onAccess: (methodId) => markSurfaceUsed("timeLocale", methodId),
      });
  registerTemporalAnchors(integrity, anchors);
  return anchors;
};
