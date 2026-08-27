/**
 * Named argument contracts for the exported resolver entry points.
 *
 * These live outside `resolver.ts` for two reasons: the file is close to its
 * `max-lines` budget, and the test suite needs the option types without
 * importing the resolver's implementation.
 *
 * Every member is required on purpose. The positional signatures these replaced
 * defaulted `containerAssignments` and `trustedSites` to `[]`, so forgetting
 * one silently disabled Firefox
 * container assignments, or spoofed on a trusted site — all fail-open in a
 * privacy product. Nullable inputs therefore carry an explicit `| undefined`
 * rather than `?:`, which under `exactOptionalPropertyTypes` forces callers to
 * write the absence instead of omitting it.
 */

import type { BrowserFingerprintSource } from "@/shared/browser-fingerprint";
import type {
  ContainerAssignment,
  DomainRule,
  SurfaceOverrides,
  GlobalFallbackRule,
  Location,
  SharedSpoofingConfig,
  SharedWorkerHandlingMode,
  TrustedSite,
} from "@/shared/types";

/** Inputs shared by every snapshot-building entry point. */
export type SnapshotBuildOptions = {
  browserFingerprintSource: BrowserFingerprintSource | undefined;
  fingerprintEnabled: boolean;
  debugMode: boolean;
  sharedSpoofing: SharedSpoofingConfig | undefined;
  sharedWorkerHandlingMode: SharedWorkerHandlingMode;
  watchPositionDelay: [number, number];
  temporalApiEnabled?: boolean;
};

/**
 * Instruction to build a domain-fenced snapshot for a fallback/container
 * identity (domain rules never fence — they are explicit per-domain config).
 *
 * With `hostname` set, the snapshot is rebuilt from the fenced seed in the
 * background (noise, hardware, version rotation). Without `hostname` (shared
 * multi-domain templates) generated fingerprint fields are omitted so the
 * page never finalizes fencing.
 */
export type DomainFencingRequest = {
  hostname?: string | undefined;
};

export type ToRuntimeSnapshotOptions = SnapshotBuildOptions & {
  /** Persisted per-rule nonce. Never minted here — see `createAuthKey`. */
  authKey: string | undefined;
  profile: Location | null | undefined;
  ruleOverrides: SurfaceOverrides | undefined;
  ruleSeedKey: string | undefined;
  domainFencing?: DomainFencingRequest | undefined;
};

export type RuleSnapshotOptions = SnapshotBuildOptions & {
  profile: Location | null | undefined;
  rule:
    | Pick<DomainRule, "fingerprintSurfaceOverrides" | "ruleSeedKey" | "authKey">
    | null
    | undefined;
  domainFencing?: DomainFencingRequest | undefined;
};

export type ProfileSnapshotOptions = SnapshotBuildOptions & {
  containerAssignments: readonly ContainerAssignment[];
  cookieStoreId: string | undefined;
  /** Feature flag: fence fallback/container identities per eTLD+1. */
  domainFencingEnabled: boolean | undefined;
  globalFallbackRule: GlobalFallbackRule | undefined;
  hostname: string;
  profiles: readonly Location[];
  rules: readonly DomainRule[];
  trustedSites: readonly TrustedSite[];
};
