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

import type {
  SnapshotBuilderOptions,
  SnapshotBuildOptions,
} from "@/shared/runtime-snapshot-builder";
export type { SnapshotBuildOptions } from "@/shared/runtime-snapshot-builder";
import type {
  ContainerAssignment,
  DomainRule,
  GlobalFallbackRule,
  Location,
  TrustedSite,
} from "@/shared/types";

/**
 * Instruction to build a domain-fenced snapshot for a fallback/container
 * identity (domain rules never fence — they are explicit per-domain config).
 *
 * With `hostname` set, the snapshot is rebuilt from the fenced seed in the
 * background (noise, hardware, version rotation). Without `hostname` (shared
 * multi-domain templates, empty hosts) the unfenced Default Rule / container
 * fingerprint is kept so first-inline never falls through to native device
 * values.
 */
export type DomainFencingRequest = {
  hostname?: string | undefined;
};

export type ToRuntimeSnapshotOptions = SnapshotBuilderOptions & {
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
