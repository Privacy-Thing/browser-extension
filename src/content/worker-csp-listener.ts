export const isWorkerCspViolation = (event: SecurityPolicyViolationEvent): boolean =>
  (event.effectiveDirective?.toLowerCase() ?? "").includes("worker-src") ||
  (event.violatedDirective?.toLowerCase() ?? "").includes("worker-src");
