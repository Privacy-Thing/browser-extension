import { createWorkerSource } from "@privacy-brand/refract-browser/common/worker-bootstrap";
import type { SharedWorkerStatus } from "@privacy-brand/xray-protocol";

import type { RuntimeSnapshot } from "@/shared/types";

export type SharedWorkerType = "classic" | "module";

export type RewriteCandidateInput = {
  tabId: number;
  frameId: number;
  cookieStoreId?: string;
  url: string;
  name: string;
  workerType: SharedWorkerType;
  origin: string;
};

export type RewriteCandidate = RewriteCandidateInput & {
  registeredAt: number;
};

export type RewriteSuccessStatus =
  "response-rewrite-preserved-identity" | "response-rewrite-cache-sensitive";

export type RewriteRequestPhase = "before-request" | "before-send-headers";

export type RewriteCandidateQuery = {
  tabId: number;
  frameId: number;
  cookieStoreId?: string;
  url: string;
};

export type RewriteDecision =
  | { type: "ignore" }
  | { type: "set-status"; status: SharedWorkerStatus }
  | { type: "cancel"; status: SharedWorkerStatus }
  | { type: "install-filter"; successStatus: RewriteSuccessStatus };

const CANDIDATE_TTL_MS = 10_000;

const normalizeHeaderName = (name: string): string => name.toLowerCase();

export const getRequestHeaderValue = (
  headers: chrome.webRequest.HttpHeader[] | undefined,
  name: string,
): string | null => {
  const target = normalizeHeaderName(name);
  const header = headers?.find((entry) => normalizeHeaderName(entry.name) === target);
  return header?.value ?? null;
};

export const isSharedWorkerRequest = (
  headers: chrome.webRequest.HttpHeader[] | undefined,
): boolean => getRequestHeaderValue(headers, "sec-fetch-dest") === "sharedworker";

export const createRewriteSource = (
  snapshot: RuntimeSnapshot,
  workerUrl: string,
  originalSource: string,
  sharedWorkerName: string,
): string =>
  createWorkerSource({
    snapshot: snapshot,
    workerUrl: workerUrl,
    workerType: "classic",
    inlineSource: originalSource,
    sharedWorkerName: sharedWorkerName,
  });

const getWorkerMode = (
  snapshot: RuntimeSnapshot,
): NonNullable<RuntimeSnapshot["sharedWorkerHandlingMode"]> =>
  snapshot.sharedWorkerHandlingMode ??
  (snapshot.sharedWorkerCompatibilityMode === false ? "spoof" : "native");

export const forceNoStoreHeaders = (
  headers: chrome.webRequest.HttpHeader[] | undefined,
): chrome.webRequest.HttpHeader[] => {
  const filtered = (headers ?? []).filter((header) => {
    const name = normalizeHeaderName(header.name);
    return name !== "cache-control" && name !== "pragma" && name !== "expires";
  });

  return [
    ...filtered,
    { name: "Cache-Control", value: "no-store" },
    { name: "Pragma", value: "no-cache" },
    { name: "Expires", value: "0" },
  ];
};

export const getRewriteDecision = ({
  candidate,
  hasFetchMetadata,
  phase,
  requestAlreadyFiltered,
  snapshot,
  canActivateIdentity,
}: {
  candidate: RewriteCandidate | undefined;
  hasFetchMetadata: boolean;
  phase: RewriteRequestPhase;
  requestAlreadyFiltered: boolean;
  snapshot: RuntimeSnapshot | null | undefined;
  canActivateIdentity: (candidate: RewriteCandidate | undefined) => boolean;
}): RewriteDecision => {
  if (requestAlreadyFiltered) {
    return { type: "ignore" };
  }

  if (!candidate && (phase === "before-request" || !hasFetchMetadata)) {
    return { type: "ignore" };
  }

  if (!snapshot) {
    return { type: "ignore" };
  }

  const sharedWorkerHandlingMode = getWorkerMode(snapshot);
  if (sharedWorkerHandlingMode === "native") {
    return { type: "ignore" };
  }

  const strictMode = sharedWorkerHandlingMode === "strict";

  if (candidate?.workerType === "module") {
    return strictMode
      ? { type: "cancel", status: "blocked-strict" }
      : { type: "set-status", status: "module-rewrite-unsupported" };
  }

  if (strictMode && phase === "before-send-headers") {
    return { type: "cancel", status: "strict-blocked-cache-sensitive" };
  }

  if (!canActivateIdentity(candidate)) {
    return strictMode
      ? { type: "cancel", status: "blocked-strict" }
      : { type: "ignore" };
  }

  return {
    type: "install-filter",
    successStatus:
      phase === "before-request"
        ? "response-rewrite-preserved-identity"
        : "response-rewrite-cache-sensitive",
  };
};

const snapshotIdentity = (snapshot: RuntimeSnapshot): string =>
  snapshot.authKey ??
  JSON.stringify({
    geo: snapshot.geo,
    locale: snapshot.locale,
    date: snapshot.date,
    fingerprint: snapshot.fingerprint ?? null,
  });

const createIdentityKey = (candidate: RewriteCandidate): string =>
  [
    candidate.origin,
    candidate.cookieStoreId ?? "",
    candidate.url,
    candidate.name,
    candidate.workerType,
  ].join("\n");

const sameCandidateIdentity = (
  candidate: RewriteCandidate,
  input: RewriteCandidateInput,
): boolean =>
  candidate.frameId === input.frameId &&
  candidate.cookieStoreId === input.cookieStoreId &&
  candidate.url === input.url &&
  candidate.name === input.name &&
  candidate.workerType === input.workerType &&
  candidate.origin === input.origin;

export const createRewriteTracker = (now: () => number = () => Date.now()) => {
  const candidatesByTab = new Map<number, RewriteCandidate[]>();
  const activeWorkerSnapshots = new Map<string, string>();
  const statusesByTab = new Map<number, SharedWorkerStatus>();

  const prune = (tabId: number): void => {
    const cutoff = now() - CANDIDATE_TTL_MS;
    const candidates = candidatesByTab.get(tabId);
    if (!candidates) {
      return;
    }

    const fresh = candidates.filter((candidate) => candidate.registeredAt >= cutoff);
    if (fresh.length > 0) {
      candidatesByTab.set(tabId, fresh);
    } else {
      candidatesByTab.delete(tabId);
    }
  };

  const setStatus = (tabId: number, status: SharedWorkerStatus): void => {
    statusesByTab.set(tabId, status);
  };

  const recordCandidate = (
    input: RewriteCandidateInput,
    _snapshot: RuntimeSnapshot | null | undefined,
  ): RewriteCandidate => {
    prune(input.tabId);
    const candidate = {
      ...input,
      registeredAt: now(),
    };
    const candidates = (candidatesByTab.get(input.tabId) ?? []).filter(
      (entry) => !sameCandidateIdentity(entry, input),
    );
    candidates.push(candidate);
    candidatesByTab.set(input.tabId, candidates);

    return candidate;
  };

  const findCandidate = ({
    tabId,
    frameId,
    cookieStoreId,
    url,
  }: RewriteCandidateQuery): RewriteCandidate | undefined => {
    prune(tabId);
    const candidates = candidatesByTab.get(tabId);
    if (!candidates) {
      return undefined;
    }

    for (let index = candidates.length - 1; index >= 0; index -= 1) {
      const candidate = candidates[index];
      if (
        candidate?.frameId === frameId &&
        candidate.cookieStoreId === cookieStoreId &&
        candidate.url === url
      ) {
        return candidate;
      }
    }

    return undefined;
  };

  const canActivateIdentity = (
    tabId: number,
    candidate: RewriteCandidate | undefined,
    snapshot: RuntimeSnapshot,
  ): boolean => {
    if (!candidate) {
      return true;
    }

    const key = createIdentityKey(candidate);
    const nextSnapshot = snapshotIdentity(snapshot);
    const activeSnapshot = activeWorkerSnapshots.get(key);
    if (activeSnapshot && activeSnapshot !== nextSnapshot) {
      setStatus(tabId, "identity-conflict");
      return false;
    }

    activeWorkerSnapshots.set(key, nextSnapshot);
    return true;
  };

  return {
    recordCandidate,
    findCandidate,
    canActivateIdentity,
    setStatus,
    getStatus: (tabId: number): SharedWorkerStatus | undefined =>
      statusesByTab.get(tabId),
    clearTab: (tabId: number): void => {
      candidatesByTab.delete(tabId);
      statusesByTab.delete(tabId);
    },
  };
};
