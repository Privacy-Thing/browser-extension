/** Exact top-host policy exceptions, independent of regional identity. */
export type WorkerPolicyException = {
  serviceWorker?: false;
  sharedWorker?: "native";
};
export type WorkerPolicyExceptions = Record<string, WorkerPolicyException>;

const isHost = (host: string): boolean => {
  try {
    return (
      host.length > 0 &&
      new URL(`https://${host}`).hostname === host &&
      !/[*/?#@]/.test(host) &&
      !["__proto__", "constructor", "prototype"].includes(host)
    );
  } catch {
    return false;
  }
};
export const isWorkerPolicyExceptions = (
  value: unknown,
): value is WorkerPolicyExceptions => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.entries(value).every(
    ([host, policy]) =>
      isHost(host) &&
      policy &&
      typeof policy === "object" &&
      !Array.isArray(policy) &&
      Object.keys(policy).length > 0 &&
      Object.entries(policy).every(
        ([key, setting]) =>
          (key === "serviceWorker" && setting === false) ||
          (key === "sharedWorker" && setting === "native"),
      ),
  );
};
export const normalizeWorkerPolicies = (value: unknown): WorkerPolicyExceptions =>
  isWorkerPolicyExceptions(value) ? value : {};

export const applyWorkerPolicy = <T extends object | null>(
  baseline: T,
  policy: WorkerPolicyException | undefined,
): T => {
  if (!baseline || !policy) return baseline;
  return {
    ...baseline,
    ...(policy.serviceWorker === false
      ? { blockServiceWorkerRegistration: false }
      : {}),
    ...(policy.sharedWorker === "native"
      ? {
          sharedWorkerHandlingMode: "native",
          sharedWorkerCompatibilityMode: true,
        }
      : {}),
  };
};

/** Applied once after identity resolution; never activates an unprotected site. */
export const applyWorkerException = <T extends object>(
  baseline: T | null,
  hostname: string,
  exceptions: WorkerPolicyExceptions | undefined,
): T | null =>
  applyWorkerPolicy(
    baseline,
    exceptions && Object.hasOwn(exceptions, hostname)
      ? exceptions[hostname]
      : undefined,
  );
