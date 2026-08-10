import type { SharedWorkerStatus } from "@privacy-brand/xray-protocol";

import type { ResolutionDecision } from "@/background/effective-snapshot-cache";
import {
  createRewriteSource,
  forceNoStoreHeaders,
  getRewriteDecision,
  isSharedWorkerRequest,
  type RewriteCandidate,
  type RewriteCandidateInput,
  type RewriteSuccessStatus,
  type createRewriteTracker,
} from "@/background/shared-worker-rewrite";
import { recordSuggestion } from "@/background/storage/site-suggestions";
import { fireAndForget } from "@/shared/async";
import { BUILD_BROWSER_TARGET } from "@/shared/build-flags";
import type { EffectiveTabContext, RuntimeSnapshot } from "@/shared/types";

type FirefoxStreamFilter = {
  ondata: ((event: { data: ArrayBuffer }) => void) | null;
  onstop: (() => void) | null;
  onerror: (() => void) | null;
  error?: string;
  write: (data: ArrayBuffer | Uint8Array) => void;
  close: () => void;
  disconnect: () => void;
};

type FirefoxWebRequestApi = {
  filterResponseData?: (requestId: string) => FirefoxStreamFilter;
  onBeforeRequest?: {
    addListener: (
      listener: (
        details: chrome.webRequest.OnBeforeRequestDetails,
      ) =>
        | chrome.webRequest.BlockingResponse
        | Promise<chrome.webRequest.BlockingResponse | undefined>
        | void,
      filter: chrome.webRequest.RequestFilter,
      extraInfoSpec?: string[],
    ) => void;
  };
  onBeforeSendHeaders?: {
    addListener: (
      listener: (
        details: chrome.webRequest.OnBeforeSendHeadersDetails,
      ) => chrome.webRequest.BlockingResponse | void,
      filter: chrome.webRequest.RequestFilter,
      extraInfoSpec?: string[],
    ) => void;
  };
  onHeadersReceived?: {
    addListener: (
      listener: (
        details: chrome.webRequest.OnHeadersReceivedDetails,
      ) => chrome.webRequest.BlockingResponse | void,
      filter: chrome.webRequest.RequestFilter,
      extraInfoSpec?: string[],
    ) => void;
  };
};

type DecisionReader = {
  resolveDecision: (hostname: string, cookieStoreId?: string) => ResolutionDecision;
};

type RewriteTracker = ReturnType<typeof createRewriteTracker>;

type FxWorkerRewriteDeps = {
  getActiveTabContexts: () => EffectiveTabContext[];
  getPreparedDecisions: () => DecisionReader | null;
  getRewriteRequestIds: () => Set<string>;
  getRewriteTracker: () => RewriteTracker;
  readDecisionCache: (
    tabId: number,
    frameId: number,
    hostname: string,
    cookieStoreId?: string,
  ) => ResolutionDecision | undefined;
};

const firefoxWebRequestApi = (
  globalThis as typeof globalThis & {
    browser?: { webRequest?: FirefoxWebRequestApi };
  }
).browser?.webRequest;

const getExactHostname = (url: string): string => new URL(url).hostname;

const recordRewriteCandidate = (
  deps: FxWorkerRewriteDeps,
  input: RewriteCandidateInput,
): void => {
  const snapshot = deps.readDecisionCache(
    input.tabId,
    input.frameId,
    getExactHostname(input.origin),
    input.cookieStoreId,
  )?.snapshot;
  deps.getRewriteTracker().recordCandidate(input, snapshot);
};

const getRequestCookieStoreId = (details: object): string | undefined => {
  const cookieStoreId = (details as { cookieStoreId?: unknown }).cookieStoreId;
  return typeof cookieStoreId === "string" ? cookieStoreId : undefined;
};

const INJECTION_RELAX_STATUSES = new Set<SharedWorkerStatus>([
  "blocked-strict",
  "identity-conflict",
  "module-rewrite-unsupported",
  "response-rewrite-unavailable",
  "strict-blocked-cache-sensitive",
  "strict-rewrite-required",
]);

const recordRewriteSuggestion = (
  deps: FxWorkerRewriteDeps,
  candidate: RewriteCandidate | undefined,
  snapshot: RuntimeSnapshot | null | undefined,
  status: SharedWorkerStatus,
): void => {
  if (
    !candidate ||
    candidate.frameId !== 0 ||
    !snapshot ||
    snapshot.sharedWorkerHandlingMode !== "strict" ||
    !INJECTION_RELAX_STATUSES.has(status)
  ) {
    return;
  }

  const context = deps
    .getActiveTabContexts()
    .find((activeContext) => activeContext.tabId === candidate.tabId);
  let hostname: string;
  try {
    hostname = new URL(candidate.origin).hostname;
  } catch {
    return;
  }

  if (
    context?.hostname !== hostname ||
    context.cookieStoreId !== candidate.cookieStoreId
  ) {
    return;
  }

  fireAndForget(
    recordSuggestion(
      hostname,
      "shared-worker-injection-relaxation",
      candidate.cookieStoreId,
    ),
  );
};

const concatenateChunks = (chunks: Uint8Array[]): Uint8Array => {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result;
};

type ResponseFilterInput = {
  deps: FxWorkerRewriteDeps;
  requestId: string;
  tabId: number;
  url: string;
  snapshot: RuntimeSnapshot | null | undefined;
  successStatus: RewriteSuccessStatus;
  candidate: RewriteCandidate | undefined;
};

const installResponseFilter = ({
  deps,
  requestId,
  tabId,
  url,
  snapshot,
  successStatus,
  candidate,
}: ResponseFilterInput): boolean => {
  const tracker = deps.getRewriteTracker();
  if (!snapshot || !firefoxWebRequestApi?.filterResponseData) {
    tracker.setStatus(tabId, "response-rewrite-unavailable");
    recordRewriteSuggestion(deps, candidate, snapshot, "response-rewrite-unavailable");
    return false;
  }

  try {
    const filter = firefoxWebRequestApi.filterResponseData(requestId);
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();
    const chunks: Uint8Array[] = [];

    filter.ondata = (event) => {
      chunks.push(new Uint8Array(event.data));
    };

    filter.onerror = () => {
      tracker.setStatus(tabId, "response-rewrite-unavailable");
      recordRewriteSuggestion(
        deps,
        candidate,
        snapshot,
        "response-rewrite-unavailable",
      );
    };

    filter.onstop = () => {
      try {
        const originalSource = decoder.decode(concatenateChunks(chunks));
        const rewrittenSource = createRewriteSource(
          snapshot,
          url,
          originalSource,
          candidate?.name ?? "",
        );
        const encoded = encoder.encode(rewrittenSource);
        filter.write(
          encoded.buffer.slice(
            encoded.byteOffset,
            encoded.byteOffset + encoded.byteLength,
          ),
        );
        filter.close();
        tracker.setStatus(tabId, successStatus);
      } catch {
        try {
          filter.disconnect();
        } catch {
          // Ignore filter cleanup errors.
        }
        tracker.setStatus(tabId, "response-rewrite-unavailable");
        recordRewriteSuggestion(
          deps,
          candidate,
          snapshot,
          "response-rewrite-unavailable",
        );
      } finally {
        deps.getRewriteRequestIds().delete(requestId);
      }
    };

    deps.getRewriteRequestIds().add(requestId);
    return true;
  } catch {
    tracker.setStatus(tabId, "response-rewrite-unavailable");
    recordRewriteSuggestion(deps, candidate, snapshot, "response-rewrite-unavailable");
    return false;
  }
};

const getSharedWorkerStatus = (
  deps: FxWorkerRewriteDeps,
  tabId: number,
  snapshot: RuntimeSnapshot | null | undefined,
) => {
  if (!snapshot) {
    return undefined;
  }

  const sharedWorkerHandlingMode =
    snapshot.sharedWorkerHandlingMode ??
    (snapshot.sharedWorkerCompatibilityMode === false ? "spoof" : "native");
  if (sharedWorkerHandlingMode === "native") {
    return "native-compatibility" as const;
  }

  const observedStatus = deps.getRewriteTracker().getStatus(tabId);
  if (observedStatus) {
    return observedStatus;
  }

  if (sharedWorkerHandlingMode === "strict") {
    return BUILD_BROWSER_TARGET === "firefox"
      ? "strict-rewrite-required"
      : "blocked-strict";
  }

  return BUILD_BROWSER_TARGET === "firefox"
    ? "response-rewrite-preserved-identity"
    : "blob-wrapper-dedup-disabled";
};

const handleUnknownRequest = (
  deps: FxWorkerRewriteDeps,
  details: chrome.webRequest.OnBeforeSendHeadersDetails,
): chrome.webRequest.BlockingResponse | undefined => {
  if (
    details.tabId >= 0 ||
    (!details.url.startsWith("http://") && !details.url.startsWith("https://"))
  ) {
    return undefined;
  }
  const cookieStoreId = getRequestCookieStoreId(details);
  if (!cookieStoreId) {
    return isSharedWorkerRequest(details.requestHeaders) ? { cancel: true } : undefined;
  }
  const decision = deps
    .getPreparedDecisions()
    ?.resolveDecision(getExactHostname(details.url), cookieStoreId);
  return decision?.snapshot ? { cancel: true } : undefined;
};

type RewriteRequestDetails = chrome.webRequest.OnBeforeRequestDetails & {
  requestHeaders?: chrome.webRequest.HttpHeader[];
};

const handleRewriteRequest = (
  deps: FxWorkerRewriteDeps,
  details: RewriteRequestDetails,
  phase: "before-request" | "before-send-headers",
): chrome.webRequest.BlockingResponse | undefined => {
  if (
    details.tabId < 0 ||
    (!details.url.startsWith("http://") && !details.url.startsWith("https://")) ||
    (phase === "before-send-headers" &&
      deps.getRewriteRequestIds().has(details.requestId))
  ) {
    return undefined;
  }
  const tracker = deps.getRewriteTracker();
  const cookieStoreId = getRequestCookieStoreId(details);
  const candidate = tracker.findCandidate({
    tabId: details.tabId,
    frameId: details.frameId,
    ...(cookieStoreId ? { cookieStoreId } : {}),
    url: details.url,
  });
  const hasFetchMetadata =
    phase === "before-send-headers" && isSharedWorkerRequest(details.requestHeaders);
  if (!candidate && !hasFetchMetadata) return undefined;
  const snapshot = candidate
    ? (deps.readDecisionCache(
        details.tabId,
        candidate.frameId,
        getExactHostname(candidate.origin),
        candidate.cookieStoreId,
      )?.snapshot ?? null)
    : null;
  const decision = getRewriteDecision({
    candidate,
    hasFetchMetadata,
    phase,
    requestAlreadyFiltered: false,
    snapshot,
    canActivateIdentity: (rewriteCandidate) =>
      Boolean(
        snapshot &&
        tracker.canActivateIdentity(details.tabId, rewriteCandidate, snapshot),
      ),
  });
  if (decision.type === "ignore") return undefined;
  if (decision.type === "set-status" || decision.type === "cancel") {
    tracker.setStatus(details.tabId, decision.status);
    recordRewriteSuggestion(deps, candidate, snapshot, decision.status);
    return decision.type === "cancel" ? { cancel: true } : undefined;
  }
  const installed = installResponseFilter({
    deps,
    requestId: details.requestId,
    tabId: details.tabId,
    url: details.url,
    snapshot,
    successStatus: decision.successStatus,
    candidate,
  });
  if (!installed && snapshot?.sharedWorkerHandlingMode === "strict") {
    tracker.setStatus(details.tabId, "strict-rewrite-required");
    recordRewriteSuggestion(deps, candidate, snapshot, "strict-rewrite-required");
    return { cancel: true };
  }
  return undefined;
};

const registerRewriteListeners = (deps: FxWorkerRewriteDeps): void => {
  if (BUILD_BROWSER_TARGET !== "firefox" || !firefoxWebRequestApi) {
    return;
  }

  firefoxWebRequestApi.onBeforeSendHeaders?.addListener(
    (details) => handleUnknownRequest(deps, details),
    {
      // eslint-disable-next-line sonarjs/no-clear-text-protocols
      urls: ["http://*/*", "https://*/*"],
    },
    ["blocking", "requestHeaders"],
  );

  firefoxWebRequestApi.onBeforeSendHeaders?.addListener(
    (details) => handleRewriteRequest(deps, details, "before-send-headers"),
    {
      // Firefox URL match patterns need explicit protocol coverage here.
      // eslint-disable-next-line sonarjs/no-clear-text-protocols
      urls: ["http://*/*", "https://*/*"],
      types: ["script"],
    },
    ["blocking", "requestHeaders"],
  );

  firefoxWebRequestApi.onBeforeRequest?.addListener(
    (details) => handleRewriteRequest(deps, details, "before-request"),
    {
      // Firefox URL match patterns need explicit protocol coverage here.
      // eslint-disable-next-line sonarjs/no-clear-text-protocols
      urls: ["http://*/*", "https://*/*"],
      types: ["script"],
    },
    ["blocking"],
  );

  firefoxWebRequestApi.onHeadersReceived?.addListener(
    (details) => {
      if (!deps.getRewriteRequestIds().has(details.requestId)) {
        return undefined;
      }

      return {
        responseHeaders: forceNoStoreHeaders(details.responseHeaders),
      };
    },
    {
      // Firefox URL match patterns need explicit protocol coverage here.
      // eslint-disable-next-line sonarjs/no-clear-text-protocols
      urls: ["http://*/*", "https://*/*"],
      types: ["script"],
    },
    ["blocking", "responseHeaders"],
  );
};

export const createFxRewriteHandlers = (deps: FxWorkerRewriteDeps) => ({
  recordRewriteCandidate: recordRewriteCandidate.bind(null, deps),
  getSharedWorkerStatus: getSharedWorkerStatus.bind(null, deps),
  registerRewriteListeners: registerRewriteListeners.bind(null, deps),
});
