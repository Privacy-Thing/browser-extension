import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { fireAndForget } from "@/shared/async";
import {
  FEATURE_COMMANDS,
  FEATURE_EVENTS,
  type ProviderFeatureCommand,
  type ProviderFeatureReply,
  type ProviderFeatureState,
} from "@/shared/provider-feature";
import {
  recognitionHost,
  type FeatureSyncStatus,
} from "@/ui/components/provider-feature/model";
import { sendMessageOrThrow, sendRuntimeMessage } from "@/ui/shared/runtime-messaging";

export type ProviderFeatureQuery = {
  /** Current draft pattern. Recognition must be covered by this pattern. */
  rulePattern: string;
  /** Saved pattern, so editing the draft still reads the existing group. */
  savedRulePattern?: string;
  hostname: string;
  /** Recognize a host that has no cached match. Never set from injected worlds. */
  recognize: boolean;
};

export type ProviderFeaturePending = "status" | "lookup";

export type ProviderFeatureHandle = {
  state: ProviderFeatureState | null;
  busy: boolean;
  pending: ProviderFeaturePending | null;
  failed: boolean;
  errorCode: string | null;
};

const isReply = (value: unknown): value is ProviderFeatureReply =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as { ok?: unknown }).ok === "boolean";

const errorMessage = (failure: unknown): string =>
  failure instanceof Error ? failure.message : String(failure);

/**
 * Extension UI pages have a runtime id. Injected page and worker worlds do not,
 * so this hook never messages the provider from those paths.
 */
const messagingReady = (): boolean =>
  typeof chrome !== "undefined" &&
  typeof chrome.runtime?.id === "string" &&
  chrome.runtime.id.length > 0;

export const toFeatureSyncStatus = (status: string): FeatureSyncStatus => {
  switch (status) {
    case "queued":
    case "syncing":
    case "synced":
      return status;
    case "ready":
      return "synced";
    default:
      return "error";
  }
};

export const patternForRead = (query: ProviderFeatureQuery): string => {
  const saved = query.savedRulePattern?.trim();
  return saved ? saved : query.rulePattern;
};

type RecognizeGate = {
  query: ProviderFeatureQuery;
  key: string;
  state: ProviderFeatureState | null;
  confirmedKey: string;
  attemptedKey: string;
};

const isFeatureStateChanged = (message: unknown): boolean =>
  typeof message === "object" &&
  message !== null &&
  Reflect.get(message, "type") === FEATURE_EVENTS.stateChanged;

/**
 * A saved group can render from cache while the draft still names the same host.
 * A new draft host must be queried. Callers that omit the saved pattern have not
 * shown a hostname edit, so an existing binding stays on the cached group.
 */
const stableBinding = (
  query: ProviderFeatureQuery,
  state: ProviderFeatureState,
): boolean => {
  if (!state.binding) return false;
  const saved = query.savedRulePattern?.trim();
  if (!saved) return true;
  return recognitionHost(query.rulePattern) === recognitionHost(saved);
};

const recognitionBlocksLookup = (state: ProviderFeatureState): boolean =>
  state.recognitionStatus === "preparing" ||
  state.recognitionStatus === "unavailable" ||
  state.recognitionStatus === "blocked";

/** One recognize per editor host. Background applies its own TTL to cached matches. */
const shouldRecognize = ({
  query,
  key,
  state,
  confirmedKey,
  attemptedKey,
}: RecognizeGate): boolean => {
  if (!query.recognize || query.hostname === "" || !messagingReady()) return false;
  if (confirmedKey !== key || !state?.available || attemptedKey === key) return false;
  if (!state || recognitionBlocksLookup(state)) return false;
  if (state.dismissed || stableBinding(query, state)) return false;
  return true;
};

const failedWhilePreparing = (reply: ProviderFeatureReply): boolean => {
  if (reply.ok) return false;
  return (
    reply.errorCode === "recognition-preparing" ||
    reply.state?.recognitionStatus === "preparing"
  );
};

type FailureState = { key: string; code: string | null };

type LookupArgs = {
  query: ProviderFeatureQuery;
  key: string;
  state: ProviderFeatureState | null;
  apply: (sequence: number, reply: unknown) => void;
  sequenceRef: { current: number };
  actionRef: { current: Promise<unknown> | null };
  target: { current: ProviderFeatureQuery };
  confirmed: { current: string };
  attempted: { current: string };
  setBusy: (busy: boolean) => void;
  setPending: (pending: ProviderFeaturePending | null) => void;
};

const useFeatureLookup = ({
  query,
  key,
  state,
  apply,
  sequenceRef,
  actionRef,
  target,
  confirmed,
  attempted,
  setBusy,
  setPending,
}: LookupArgs): void => {
  const { rulePattern, hostname, recognize } = query;
  useEffect(() => {
    const current = target.current;
    if (
      !shouldRecognize({
        query: current,
        key,
        state,
        confirmedKey: confirmed.current,
        attemptedKey: attempted.current,
      })
    ) {
      return;
    }
    attempted.current = key;
    const sequence = ++sequenceRef.current;
    const command: ProviderFeatureCommand = {
      type: FEATURE_COMMANDS.recognize,
      rulePattern: current.rulePattern,
      hostname: current.hostname,
      ...(state?.providerId ? { providerId: state.providerId } : {}),
    };
    setBusy(true);
    setPending("lookup");
    const action = sendMessageOrThrow<ProviderFeatureReply>(command).then(
      (reply) => apply(sequence, reply),
      (error: unknown) => apply(sequence, { ok: false, error: errorMessage(error) }),
    );
    actionRef.current = action;
    fireAndForget(
      action.finally(() => {
        if (actionRef.current === action) actionRef.current = null;
      }),
    );
  }, [
    actionRef,
    apply,
    attempted,
    confirmed,
    hostname,
    key,
    recognize,
    rulePattern,
    sequenceRef,
    setBusy,
    setPending,
    state,
    target,
  ]);
};

export const useProviderFeature = (
  query: ProviderFeatureQuery,
): ProviderFeatureHandle => {
  const readPattern = patternForRead(query);
  const key = JSON.stringify([readPattern, query.hostname]);
  const [snapshot, setSnapshot] = useState<{
    key: string;
    value: ProviderFeatureState;
  } | null>(null);
  const state = useMemo(() => {
    if (!snapshot) return null;
    if (snapshot.key === key) return snapshot.value;
    return { ...snapshot.value, match: null, dismissed: false };
  }, [key, snapshot]);
  const live = messagingReady();
  const [busy, setBusy] = useState(live);
  const [pending, setPending] = useState<ProviderFeaturePending | null>(
    live ? "status" : null,
  );
  const [failure, setFailure] = useState<FailureState | null>(null);
  const sequenceRef = useRef(0);
  const actionRef = useRef<Promise<unknown> | null>(null);
  const confirmed = useRef("");
  const attempted = useRef("");
  const preparingKey = useRef("");
  const target = useRef(query);
  target.current = query;

  const apply = useCallback(
    (sequence: number, reply: unknown) => {
      if (sequence !== sequenceRef.current) return;
      setBusy(false);
      setPending(null);
      if (!isReply(reply)) {
        setFailure({ key, code: null });
        return;
      }
      if (reply.ok) {
        setSnapshot({ key, value: reply.state });
        confirmed.current = key;
        if (preparingKey.current === key && reply.state.recognitionStatus === "ready") {
          preparingKey.current = "";
          attempted.current = "";
        }
        setFailure(null);
        return;
      }
      if (reply.state) {
        setSnapshot({ key, value: reply.state });
        confirmed.current = key;
      }
      preparingKey.current = failedWhilePreparing(reply) ? key : "";
      setFailure({ key, code: reply.errorCode ?? null });
    },
    [key],
  );

  useEffect(() => {
    if (!messagingReady()) {
      setBusy(false);
      setPending(null);
      return;
    }
    let active = true;
    const refresh = () => {
      if (!active) return;
      const sequence = ++sequenceRef.current;
      const current = target.current;
      const command: ProviderFeatureCommand = {
        type: FEATURE_COMMANDS.getState,
        rulePattern: patternForRead(current),
        hostname: current.hostname,
      };
      setBusy(true);
      setPending("status");
      fireAndForget(
        sendRuntimeMessage<ProviderFeatureReply>(command).then(
          (reply) => apply(sequence, reply),
          (error: unknown) =>
            apply(sequence, { ok: false, error: errorMessage(error) }),
        ),
      );
    };
    const changed = (message: unknown) => {
      if (!isFeatureStateChanged(message)) return;
      fireAndForget((actionRef.current ?? Promise.resolve()).then(() => refresh()));
    };
    refresh();
    chrome.runtime.onMessage?.addListener(changed);
    return () => {
      active = false;
      sequenceRef.current += 1;
      chrome.runtime.onMessage?.removeListener(changed);
    };
  }, [apply, key]);

  useFeatureLookup({
    query,
    key,
    state,
    apply,
    sequenceRef,
    actionRef,
    target,
    confirmed,
    attempted,
    setBusy,
    setPending,
  });

  const currentFailure = failure?.key === key ? failure : null;
  return {
    state,
    busy,
    pending: busy ? pending : null,
    failed: currentFailure !== null,
    errorCode: currentFailure?.code ?? null,
  };
};
