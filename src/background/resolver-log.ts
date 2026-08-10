export type ResolverIdentityKind = "rule" | "container" | null;

export type ResolverLogInput = {
  cookieStoreId?: string | undefined;
  exactOrigin?: string | undefined;
  matchedTrustedSitePattern?: string | null;
  matchedPattern?: string | null;
  activeIdentityKind?: ResolverIdentityKind;
  activeLocationId?: string | null;
  fallbackLocationId?: string | null;
  fallbackConfigured: boolean;
  activeProfileExists: boolean;
  fallbackProfileExists: boolean;
  geolocationEnabled?: boolean;
  blockServiceWorkerRegistration?: boolean;
  resolved: boolean;
};

export type ResolverLogEntry = {
  event: "resolver.snapshot-resolved" | "resolver.snapshot-skipped";
  details: {
    cookieStoreId: string | null;
    exactOrigin: string | null;
    winningSource: "trusted-site" | "rule" | "container" | "fallback" | "none";
    matchedPattern: string | null;
    trustedSitePattern: string | null;
    activeIdentityKind: ResolverIdentityKind;
    activeLocationId: string | null;
    fallbackLocationId: string | null;
    geolocationEnabled: boolean | undefined;
    blockServiceWorkerRegistration: boolean;
    resolved: boolean;
    failureReason:
      | "trusted-site"
      | "missing-active-profile"
      | "fallback-unconfigured"
      | "missing-fallback-profile"
      | "no-match"
      | null;
  };
};

const resolveWinningSource = (
  trustedPattern: string | null,
  activeIdentityKind: ResolverIdentityKind,
  resolved: boolean,
): ResolverLogEntry["details"]["winningSource"] => {
  if (trustedPattern) {
    return "trusted-site";
  }

  if (activeIdentityKind) {
    return activeIdentityKind;
  }

  return resolved ? "fallback" : "none";
};

type FailureReasonInput = Pick<
  ResolverLogInput,
  | "resolved"
  | "activeProfileExists"
  | "fallbackConfigured"
  | "fallbackLocationId"
  | "fallbackProfileExists"
> & {
  trustedPattern: string | null;
  activeIdentityKind: ResolverIdentityKind;
};

const resolveFailureReason = ({
  resolved,
  trustedPattern,
  activeIdentityKind,
  activeProfileExists,
  fallbackConfigured,
  fallbackLocationId,
  fallbackProfileExists,
}: FailureReasonInput): ResolverLogEntry["details"]["failureReason"] => {
  if (resolved) {
    return null;
  }

  if (trustedPattern) {
    return "trusted-site";
  }

  if (activeIdentityKind && !activeProfileExists) {
    return "missing-active-profile";
  }

  if (fallbackConfigured && !fallbackLocationId) {
    return "fallback-unconfigured";
  }

  if (fallbackConfigured && !fallbackProfileExists) {
    return "missing-fallback-profile";
  }

  return "no-match";
};

export const buildResolverLogEntry = ({
  cookieStoreId,
  exactOrigin,
  matchedTrustedSitePattern: trustedPattern = null,
  matchedPattern = null,
  activeIdentityKind = null,
  activeLocationId = null,
  fallbackLocationId = null,
  fallbackConfigured,
  activeProfileExists,
  fallbackProfileExists,
  geolocationEnabled,
  blockServiceWorkerRegistration: blockServiceWorkers = false,
  resolved,
}: ResolverLogInput): ResolverLogEntry => {
  const winningSource = resolveWinningSource(
    trustedPattern,
    activeIdentityKind,
    resolved,
  );
  const failureReason = resolveFailureReason({
    resolved,
    trustedPattern,
    activeIdentityKind,
    activeProfileExists,
    fallbackConfigured,
    fallbackLocationId,
    fallbackProfileExists,
  });

  return {
    event: resolved ? "resolver.snapshot-resolved" : "resolver.snapshot-skipped",
    details: {
      cookieStoreId: cookieStoreId ?? null,
      exactOrigin: exactOrigin ?? null,
      winningSource,
      matchedPattern,
      trustedSitePattern: trustedPattern,
      activeIdentityKind,
      activeLocationId,
      fallbackLocationId,
      geolocationEnabled,
      blockServiceWorkerRegistration: blockServiceWorkers,
      resolved,
      failureReason,
    },
  };
};
