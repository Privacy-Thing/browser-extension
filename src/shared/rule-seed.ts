import type {
  ContainerAssignment,
  DomainRule,
  GlobalFallbackRule,
  SpoofingTargetFields,
} from "@/shared/types";

const RULE_SEED_LENGTH = 6;
const RULE_SEED_SPACE = 36 ** RULE_SEED_LENGTH;
const RULE_SEED_PATTERN = /^[a-z0-9]{6}$/;

const AUTH_KEY_LENGTH = 8;
const AUTH_KEY_SPACE = 36 ** AUTH_KEY_LENGTH;
const AUTH_KEY_PATTERN = /^[a-z0-9]{8}$/;

const toSeedNumber = (value: number): number => {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.abs(Math.floor(value)) % RULE_SEED_SPACE;
};

const getRandomSeedNumber = (space = RULE_SEED_SPACE): number => {
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const buffer = new Uint32Array(1);
    crypto.getRandomValues(buffer);
    return toSeedNumber(buffer[0] ?? 0) % space;
  }

  // eslint-disable-next-line sonarjs/pseudo-random
  return toSeedNumber(Math.random() * space);
};

export const createRuleSeedKey = (): string =>
  getRandomSeedNumber(RULE_SEED_SPACE)
    .toString(36)
    .padStart(RULE_SEED_LENGTH, "0")
    .slice(-RULE_SEED_LENGTH);

/**
 * Mints a fresh random `authKey`: a once-per-rule opaque nonce that binds the
 * diagnostic surface-usage channel to a specific runtime snapshot. Together with
 * the build-time guard key it lets the page-world runtime and the XRay sidebar
 * authenticate each other's events.
 *
 * authKey contract — preserve this whenever you touch authKey logic:
 * - **Random, minted once** at rule creation and **persisted unchanged** for the
 *   rule's lifetime (until the rule is deleted). Domain rules, container
 *   assignments and the global fallback rule all follow this.
 * - **Never rotated.** Unlike `ruleSeedKey`, there is intentionally no
 *   rotate/refresh counterpart.
 * - **Independent of `ruleSeedKey`.** Do NOT derive it from the seed (or anything
 *   else). `ruleSeedKey` is rotatable, so a derived authKey would silently change
 *   on rotation and break the "stable for the rule's lifetime" guarantee. A past
 *   refactor made this exact mistake; keep them decoupled.
 * - **Created at the storage boundary only** ({@link withAuthKey}); snapshot
 *   resolution must *preserve* it, never create one — minting per resolve would
 *   hand different keys to the runtime and the XRay for the same page.
 *
 * @see withAuthKey
 * @see withFallbackSeed
 */
export const createAuthKey = (): string =>
  getRandomSeedNumber(AUTH_KEY_SPACE)
    .toString(36)
    .padStart(AUTH_KEY_LENGTH, "0")
    .slice(-AUTH_KEY_LENGTH);

export const isValidAuthKey = (value: string | undefined): value is string => {
  const normalized = value?.trim().toLowerCase();
  return typeof normalized === "string" && AUTH_KEY_PATTERN.test(normalized);
};

/**
 * Returns a copy of `target` with `authKey` populated — minted if absent,
 * preserved if already valid. This is the single creation/persistence boundary
 * for authKeys; code that only reads or resolves a rule must preserve the
 * existing value rather than calling this (which would mint a new one). No
 * rotation counterpart exists by design.
 *
 * @see createAuthKey for the full authKey contract (random, once-per-rule,
 * persisted, never derived from `ruleSeedKey`).
 */
export const withAuthKey = <T extends Pick<SpoofingTargetFields, "authKey">>(
  target: T,
): T & { authKey: string } => ({
  ...target,
  authKey: isValidAuthKey(target.authKey) ? target.authKey : createAuthKey(),
});

export const normalizeRuleSeedKey = (value: string | undefined): string => {
  const normalizedValue = value?.trim().toLowerCase();
  return normalizedValue && RULE_SEED_PATTERN.test(normalizedValue)
    ? normalizedValue
    : createRuleSeedKey();
};

export const readRuleSeedKey = (value: string | undefined): string | null => {
  const normalizedValue = value?.trim().toLowerCase();
  return normalizedValue && RULE_SEED_PATTERN.test(normalizedValue)
    ? normalizedValue
    : null;
};

export const withRuleSeedKey = (
  rule: Omit<DomainRule, "ruleSeedKey"> & { ruleSeedKey?: string },
): DomainRule => ({
  ...rule,
  ruleSeedKey: normalizeRuleSeedKey(rule.ruleSeedKey),
});

export const withContainerSeed = (
  assignment: Omit<ContainerAssignment, "ruleSeedKey"> & { ruleSeedKey?: string },
): ContainerAssignment =>
  withAuthKey({
    ...assignment,
    ruleSeedKey: normalizeRuleSeedKey(assignment.ruleSeedKey),
  });

/**
 * Storage-boundary normalizer for the global fallback ("Default") rule:
 * normalizes the (rotatable) `ruleSeedKey` and mints/preserves the random
 * `authKey` nonce — the same contract as domain rules and container assignments.
 *
 * ⚠️ Do NOT make `authKey` a function of `ruleSeedKey` (or otherwise
 * deterministic) here: the seed can rotate, which must not disturb the nonce.
 * Snapshot resolution preserves this value; it must never be (re)generated
 * outside this storage boundary.
 *
 * @see createAuthKey for the full authKey contract.
 */
export const withFallbackSeed = (
  rule: Omit<GlobalFallbackRule, "ruleSeedKey"> & { ruleSeedKey?: string },
): GlobalFallbackRule =>
  withAuthKey({
    ...rule,
    ruleSeedKey: normalizeRuleSeedKey(rule.ruleSeedKey),
  });

export const rotateRuleSeedKey = (
  rules: readonly DomainRule[],
  pattern: string,
): DomainRule[] =>
  rules.map((rule) =>
    rule.pattern === pattern
      ? {
          ...rule,
          ruleSeedKey: createRuleSeedKey(),
        }
      : rule,
  );

export const rotateContainerSeed = (
  assignments: readonly ContainerAssignment[],
  cookieStoreId: string,
): ContainerAssignment[] =>
  assignments.map((assignment) =>
    assignment.cookieStoreId === cookieStoreId
      ? {
          ...assignment,
          ruleSeedKey: createRuleSeedKey(),
        }
      : assignment,
  );

export const reconcileContainerSeed = (
  assignment: ContainerAssignment,
  previousAssignment: ContainerAssignment | null | undefined,
): ContainerAssignment => {
  const resolvedSeed = assignment.ruleSeedKey ?? previousAssignment?.ruleSeedKey;

  return withContainerSeed({
    ...assignment,
    ...(resolvedSeed ? { ruleSeedKey: resolvedSeed } : {}),
  });
};

export const stripRuleSeedKey = (rule: DomainRule): Omit<DomainRule, "ruleSeedKey"> => {
  const ruleWithoutSeed = { ...rule };
  delete ruleWithoutSeed.ruleSeedKey;
  return ruleWithoutSeed;
};
