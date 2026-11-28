import { markSurfaceUsed } from "@privacy-brand/refract-browser/common/surface-usage-emitter";
import {
  adoptTemporalApiPatch as adoptCoreTemporalApiPatch,
  installTemporalApiPatch as installCoreTemporalApiPatch,
  type TemporalApiAnchor,
  type TemporalApiGlobal,
  type TemporalApiMethodId,
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
  verifyEarlyOwnership = false,
): TemporalApiAnchor[] => {
  const locale = snapshot.locale;
  const defaults =
    snapshot.timeLocaleEnabled !== false &&
    snapshot.temporalApiEnabled === true &&
    locale
      ? {
          languages: locale.formattingLanguages ?? locale.languages,
          timeZone: locale.timeZone,
        }
      : null;
  const onAccess = (methodId: TemporalApiMethodId): void =>
    markSurfaceUsed("timeLocale", methodId);
  // Adopted early wrappers report through this bundle from now on, so the
  // Inspector selection settled after commit also covers Temporal.
  const adoptedAnchors =
    __PT_BROWSER_TARGET__ === "chromium" && verifyEarlyOwnership
      ? adoptCoreTemporalApiPatch(
          targetGlobal,
          defaults,
          __PT_TEMPORAL_HANDOFF_KEY__,
          onAccess,
        )
      : [];
  if (adoptedAnchors.length > 0) {
    if (!defaults) return [];
    registerTemporalAnchors(integrity, adoptedAnchors);
    return adoptedAnchors;
  }
  if (!defaults) return [];
  const anchors = installCoreTemporalApiPatch({
    targetGlobal,
    defaults,
    onAccess,
  });
  registerTemporalAnchors(integrity, anchors);
  return anchors;
};
