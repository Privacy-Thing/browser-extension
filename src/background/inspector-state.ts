import type { AnalystTraps, XRayInspectorState } from "@privacy-brand/xray-protocol";

import { FX_TRAP_EXCLUSIONS, hasTrapPayload } from "@/background/inspector-support";
import type { ResolutionDecision } from "@/background/prepared-runtime-decisions";
import { readInspector } from "@/background/storage/inspector-sessions";
import { BUILD_BROWSER_TARGET } from "@/shared/build-flags";
import {
  isSurfaceSupported,
  SPOOFING_SURFACES,
  type SpoofingSurfaceMethodId,
} from "@/shared/spoofing-surfaces";
import type { RuntimeSnapshot } from "@/shared/types";

export const getTrappableMethods = (
  snapshot: RuntimeSnapshot | null,
): SpoofingSurfaceMethodId[] => {
  if (!snapshot) return [];
  return SPOOFING_SURFACES.flatMap((surface) => {
    if (!isSurfaceSupported(surface, BUILD_BROWSER_TARGET)) return [];
    let enabled: boolean;
    switch (surface.key) {
      case "geolocation":
        enabled = snapshot.geolocationEnabled !== false;
        break;
      case "timeLocale":
        enabled = snapshot.timeLocaleEnabled !== false;
        break;
      case "serviceWorker":
        enabled = snapshot.blockServiceWorkerRegistration === true;
        break;
      case "worker":
      case "sharedWorker":
        enabled =
          snapshot.sharedWorkerHandlingMode !== undefined &&
          snapshot.sharedWorkerHandlingMode !== "native";
        break;
      default:
        enabled =
          Boolean(snapshot.fingerprint) &&
          snapshot.fingerprint?.spoofingToggles?.[surface.key] !== false;
    }
    return enabled
      ? surface.methods
          .filter(
            (method) =>
              hasTrapPayload(method.id, snapshot) &&
              (!method.id.startsWith("temporal.") ||
                snapshot.temporalApiEnabled === true) &&
              !(
                BUILD_BROWSER_TARGET === "firefox" &&
                Object.hasOwn(FX_TRAP_EXCLUSIONS, method.id)
              ),
          )
          .map((method) => method.id)
      : [];
  });
};

export const sameTraps = (a: AnalystTraps | null, b: AnalystTraps | null): boolean =>
  a === b ||
  Boolean(
    a &&
    b &&
    a.mode === b.mode &&
    a.methods.length === b.methods.length &&
    a.methods.every((method) => b.methods.includes(method)),
  );

/** Overlay only after host resolution; shared rule/preload snapshots stay tab-neutral. */
export const withInspector = (
  tabId: number,
  hostname: string,
  decision: ResolutionDecision,
): ResolutionDecision => {
  if (!decision.snapshot || decision.trustedSiteMatched || decision.hostPause)
    return decision;
  const desired = readInspector(tabId, hostname)?.desired;
  const trappable = desired ? getTrappableMethods(decision.snapshot) : [];
  const methods = desired?.methods.filter((method) => trappable.includes(method));
  if (!methods?.length) {
    if (!decision.snapshot.analystTraps) return decision;
    const snapshot = { ...decision.snapshot };
    delete snapshot.analystTraps;
    return { ...decision, snapshot };
  }
  return {
    ...decision,
    snapshot: { ...decision.snapshot, analystTraps: { methods, mode: desired!.mode } },
  };
};

export const inspectorState = (
  tabId: number,
  hostname: string,
  decision: ResolutionDecision,
  { paused, appliesLive }: { paused: boolean; appliesLive: boolean },
): XRayInspectorState => {
  let unavailableReason: XRayInspectorState["unavailableReason"];
  if (decision.trustedSiteMatched) unavailableReason = "trusted-site";
  else if (paused || decision.hostPause) unavailableReason = "protection-paused";
  else if (!decision.snapshot) unavailableReason = "no-runtime";
  const session = readInspector(tabId, hostname);
  const desired = session?.desired ?? null;
  return {
    available: unavailableReason === undefined,
    ...(unavailableReason ? { unavailableReason } : {}),
    armed: unavailableReason === undefined && desired !== null,
    methodIds: desired?.methods ?? [],
    mode: desired?.mode ?? "first-call",
    pendingReload: !sameTraps(desired, session?.document ?? null),
    appliesLive: unavailableReason === undefined && appliesLive,
    trappableMethodIds: unavailableReason ? [] : getTrappableMethods(decision.snapshot),
  };
};
