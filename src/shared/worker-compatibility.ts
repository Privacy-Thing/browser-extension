export const WORKER_CSP_BLOCKED_EVENT = "Worker.compatibility-csp-blocked" as const;

export const SW_STRICT_BLOCKED_EVENT = "Worker.shared-worker-strict-blocked" as const;

export const SW_STRICT_REASONS = [
  "strict-blocked",
  "csp-wrapper-blocked",
  "module-unsupported",
  "rewrite-unavailable",
  "identity-conflict",
  "cache-sensitive",
] as const;

export type WorkerStrictReason = (typeof SW_STRICT_REASONS)[number];

// Dedicated Worker attempt outcomes (GitHub #110 / PT-7). Every Worker
// construction reaches exactly one of these — never a silent native
// construction with no recorded outcome. `bootstrap-confirmed` and
// `bootstrap-failed` are intentionally not modeled yet: they require a
// verified in-worker installation acknowledgement (tracked as follow-up
// work on #110), and reporting "confirmed" without that proof would recreate
// the exact "absence of an error is not proof of protection" anti-pattern
// #110 and #111 call out. Until that lands, a successfully wrapped worker is
// not assigned a terminal outcome here at all — only the explicit
// native/degraded/blocked paths are.
export const WORKER_ATTEMPT_OUTCOMES = [
  "native-by-policy",
  "native-fallback",
  "blocked-strict",
] as const;

export type WorkerAttemptOutcome = (typeof WORKER_ATTEMPT_OUTCOMES)[number];

export const WORKER_ATTEMPT_REASONS = [
  "cross-origin-frame",
  "data-url",
  "csp-wrapper-blocked",
  "csp-import-blocked",
] as const;

export type WorkerAttemptReason = (typeof WORKER_ATTEMPT_REASONS)[number];

export const WORKER_ATTEMPT_EVENT = "Worker.dedicated-worker-attempt" as const;

export const WORKER_STRICT_BLOCKED = "Worker.dedicated-worker-strict-blocked" as const;
