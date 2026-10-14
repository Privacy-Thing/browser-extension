import type { ControlDDiff, ControlDMapping, ControlDProxyLocation } from "./contracts";

export type ControlDAdoptionKind = "new" | "owned" | "foreign";
export type ControlDReviewReason =
  | "approximate-routes"
  | "removals"
  | "foreign-setup"
  | "unsupported-pattern"
  | "missing-location"
  | NonNullable<ControlDDiff["serviceErrors"]>[number]["code"];

export const controlDAutoApply = (
  diff: ControlDDiff,
  mappings: readonly ControlDMapping[],
  adoption: ControlDAdoptionKind,
): { kind: "auto" } | { kind: "needs-screen"; reasons: ControlDReviewReason[] } => {
  const reasons = new Set<ControlDReviewReason>();
  if (
    diff.requiresApproximationConfirmation ||
    mappings.some((mapping) => mapping.status === "approximate" && !mapping.confirmed)
  )
    reasons.add("approximate-routes");
  if (diff.deleteRules > 0 || (diff.deleteServices ?? 0) > 0) reasons.add("removals");
  if (adoption === "foreign") reasons.add("foreign-setup");
  for (const conflict of diff.serviceErrors ?? []) reasons.add(conflict.code);
  for (const warning of diff.warnings) {
    if (warning.code === "unsupported-pattern" || warning.code === "missing-location")
      reasons.add(warning.code);
  }
  return reasons.size === 0
    ? { kind: "auto" }
    : { kind: "needs-screen", reasons: [...reasons] };
};

export const controlDNeedsReview = (
  diff: ControlDDiff,
  adoption: ControlDAdoptionKind | undefined,
): boolean =>
  controlDAutoApply(diff, diff.mappings, adoption ?? "owned").kind === "needs-screen";

// A saved consent survives only while the resolved exit still means the same thing.
export const controlDMappingConsent = (
  mapping: ControlDMapping,
  previous: ControlDMapping | undefined,
  proxy: ControlDProxyLocation | undefined,
): ControlDMapping => {
  const routeFingerprint = proxy
    ? JSON.stringify([proxy.pk, proxy.city, proxy.countryCode, proxy.countryName])
    : undefined;
  const unchanged =
    previous?.status === "approximate" &&
    previous.proxyPk === mapping.proxyPk &&
    (previous.routeFingerprint === undefined ||
      previous.routeFingerprint === routeFingerprint);
  return {
    ...mapping,
    ...(routeFingerprint ? { routeFingerprint } : {}),
    confirmed:
      mapping.status === "approximate"
        ? mapping.confirmed && unchanged
        : mapping.confirmed,
  };
};
