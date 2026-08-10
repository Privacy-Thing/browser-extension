import type { FirefoxShimState } from "@privacy-brand/refract-browser/common/firefox-shim-state";

import type { WorkerStrictReason } from "@/shared/worker-compatibility";

type SharedWorkerMode = NonNullable<FirefoxShimState["sharedWorkerHandlingMode"]>;

type RewriteCandidate = {
  name: string;
  url: URL;
  workerType: "classic" | "module";
};

type StateReader = () => FirefoxShimState | null;

export const getFxWorkerMode = (state: FirefoxShimState | null): SharedWorkerMode =>
  state?.sharedWorkerHandlingMode ??
  (state?.sharedWorkerCompatibilityMode === false ? "spoof" : "native");

const createCandidate = (
  scriptURL: string | URL,
  options?: string | WorkerOptions,
): RewriteCandidate => {
  const normalized = typeof options === "string" ? { name: options } : options;
  return {
    name: normalized?.name ?? "",
    url: new URL(scriptURL, globalThis.location.href),
    workerType: normalized?.type === "module" ? "module" : "classic",
  };
};

const shouldBlockShared = (
  mode: SharedWorkerMode,
  candidate: RewriteCandidate,
): boolean =>
  mode === "strict" &&
  (candidate.workerType === "module" ||
    (candidate.url.protocol !== "http:" && candidate.url.protocol !== "https:"));

const dispatchRewrite = (candidate: RewriteCandidate, getState: StateReader): void => {
  const authKey = getState()?.authKey;
  if (!authKey) return;
  document.dispatchEvent(
    new CustomEvent(__PT_SW_REWRITE_TYPE__, {
      detail: JSON.stringify({
        attemptId: crypto.randomUUID(),
        authKey,
        guard: __PT_SHIM_GUARD_KEY__,
        name: candidate.name,
        origin: globalThis.location.origin,
        url: candidate.url.toString(),
        workerType: candidate.workerType,
      }),
    }),
  );
};

const emitSharedIssue = (
  reason: WorkerStrictReason,
  candidate: RewriteCandidate,
  phase: string,
  getState: StateReader,
): void => {
  const authKey = getState()?.authKey;
  if (!authKey) return;
  document.dispatchEvent(
    new CustomEvent(__PT_SW_STRICT_ISSUE_TYPE__, {
      detail: JSON.stringify({
        attemptId: crypto.randomUUID(),
        authKey,
        guard: __PT_SHIM_GUARD_KEY__,
        name: candidate.name,
        phase,
        reason,
        type: candidate.workerType,
        url: candidate.url.toString(),
        workerKind: "SharedWorker",
      }),
    }),
  );
};

const createBlockedError = (scriptURL: string | URL): Error => {
  const message = `SharedWorker script ${String(scriptURL)} was blocked by Privacy Thing strict mode because spoofing could not be confirmed.`;
  if (typeof DOMException !== "undefined") {
    return new DOMException(message, "SecurityError");
  }
  const error = new Error(message);
  error.name = "SecurityError";
  return error;
};

export const prepareFxWorkerOptions = (
  scriptURL: string | URL,
  options: string | WorkerOptions | undefined,
  getState: StateReader,
): string | WorkerOptions | undefined => {
  const handlingMode = getFxWorkerMode(getState());
  if (handlingMode === "native") return options;
  try {
    const candidate = createCandidate(scriptURL, options);
    if (shouldBlockShared(handlingMode, candidate)) {
      emitSharedIssue(
        candidate.workerType === "module"
          ? "module-unsupported"
          : "rewrite-unavailable",
        candidate,
        "firefox-early",
        getState,
      );
      throw createBlockedError(scriptURL);
    }
    dispatchRewrite(candidate, getState);
    const authKey = getState()?.authKey;
    if (handlingMode !== "strict" || !authKey) return options;
    const name = `${__PT_STRICT_WORKER_PREFIX__}${authKey}${candidate.name}`;
    return typeof options === "string" ? name : { ...(options ?? {}), name };
  } catch (error) {
    if (
      handlingMode === "strict" &&
      error instanceof Error &&
      error.name === "SecurityError"
    ) {
      throw error;
    }
    return options;
  }
};
