import type { FxBootstrapInfo } from "@privacy-brand/refract-browser/common/firefox-shim-state";

import { getFxTransportInfo } from "@/injection/firefox/bootstrap-transport-manifest";

export type FirefoxBootstrapConsumer = FxBootstrapInfo & {
  consume: () => boolean;
};

const findRoleViolation = (
  consumer: Pick<
    FirefoxBootstrapConsumer,
    "source" | "role" | "needsOptionalPermission"
  >,
  seenLateConvergence: boolean,
  seenOptionalInEarlySeed: boolean,
): string | null => {
  if (consumer.role === "late-convergence") {
    return null;
  }

  if (seenLateConvergence) {
    return `source "${consumer.source}" (authoritative-early-seed) must not follow a late-convergence source`;
  }

  if (!consumer.needsOptionalPermission || !seenOptionalInEarlySeed) {
    return null;
  }

  return `source "${consumer.source}" (needsOptionalPermission: false) must not follow a needsOptionalPermission: true source in the same role`;
};

export const consumeFxStateSources = (
  consumers: readonly FirefoxBootstrapConsumer[],
): FxBootstrapInfo | null => {
  for (const consumer of consumers) {
    if (consumer.consume()) {
      return {
        source: consumer.source,
        role: consumer.role,
        status: consumer.status,
        visibility: consumer.visibility,
        needsOptionalPermission: consumer.needsOptionalPermission,
      };
    }
  }

  return null;
};

/**
 * Validates that a bootstrap consumer list respects the required channel priority ordering:
 * 1. Only transports marked as runtime bootstrap sources may participate.
 * 2. All `authoritative-early-seed` sources must precede all `late-convergence` sources.
 * 3. Within `authoritative-early-seed`, sources with `needsOptionalPermission: false`
 *    must precede sources with `needsOptionalPermission: true`.
 * 4. Bootstrap sources must follow the canonical precedence declared in the
 *    Firefox bootstrap transport manifest.
 *
 * Returns a human-readable violation description, or `null` when the ordering is valid.
 * Intended for use in tests and dev-time assertions — not on the hot spoofing path.
 */
export const findFxSourceOrderIssue = (
  consumers: readonly Pick<
    FirefoxBootstrapConsumer,
    "source" | "role" | "needsOptionalPermission"
  >[],
): string | null => {
  let seenLateConvergence = false;
  let seenOptionalInEarlySeed = false;
  let lastPrecedence = Number.NEGATIVE_INFINITY;
  let lastOrderedSource: string | null = null;

  for (const consumer of consumers) {
    const transportInfo = getFxTransportInfo(consumer.source);
    if (transportInfo.selectionScope === "carrier-only") {
      return `source "${consumer.source}" is carrier-only and must not participate in bootstrap source selection`;
    }

    const roleViolation = findRoleViolation(
      consumer,
      seenLateConvergence,
      seenOptionalInEarlySeed,
    );
    if (roleViolation) {
      return roleViolation;
    }

    if (consumer.role === "late-convergence") {
      seenLateConvergence = true;
    } else {
      if (consumer.needsOptionalPermission) {
        seenOptionalInEarlySeed = true;
      }
    }

    if (transportInfo.precedence === null) {
      return `source "${consumer.source}" is missing bootstrap precedence metadata`;
    }

    if (transportInfo.precedence < lastPrecedence) {
      return `source "${consumer.source}" must not follow higher-priority bootstrap source "${lastOrderedSource}"`;
    }

    lastPrecedence = transportInfo.precedence;
    lastOrderedSource = consumer.source;
  }

  return null;
};
