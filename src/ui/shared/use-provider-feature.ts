import { useCallback, useEffect, useRef, useState } from "react";

import { fireAndForget } from "@/shared/async";
import {
  FEATURE_COMMANDS,
  FEATURE_EVENTS,
  type ProviderFeatureCommand,
  type ProviderFeatureReply,
  type ProviderFeatureState,
} from "@/shared/provider-feature";
import type { FeatureSyncStatus } from "@/ui/components/provider-feature";
import { sendMessageOrThrow, sendRuntimeMessage } from "@/ui/shared/runtime-messaging";

type MutationType = Exclude<
  ProviderFeatureCommand["type"],
  typeof FEATURE_COMMANDS.getState
>;

export type ProviderFeatureHandle = {
  /** Last state the background confirmed; failed replies never replace it. */
  state: ProviderFeatureState | null;
  busy: boolean;
  error: string | null;
  send: (type: MutationType, featureId?: string) => void;
};

const isReply = (value: unknown): value is ProviderFeatureReply =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as { ok?: unknown }).ok === "boolean";

const errorMessage = (failure: unknown): string =>
  failure instanceof Error ? failure.message : String(failure);

/** Provider sync states outside the panel's four are failures the user must see. */
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

/**
 * Reads provider feature state for a saved rule source. Only `getState` runs on
 * render; recognition and every mutation wait for an explicit `send`.
 */
export const useProviderFeature = (
  rulePattern: string,
  hostname: string,
): ProviderFeatureHandle => {
  const key = JSON.stringify([rulePattern, hostname]);
  const [snapshot, setSnapshot] = useState<{
    key: string;
    value: ProviderFeatureState;
  } | null>(null);
  let state = snapshot?.value ?? null;
  if (state && snapshot?.key !== key)
    state = { ...state, match: null, dismissed: false };
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sequenceRef = useRef(0);
  const actionRef = useRef<Promise<unknown> | null>(null);
  const target = useRef({ rulePattern, hostname });
  target.current = { rulePattern, hostname };

  const apply = useCallback(
    (sequence: number, reply: unknown) => {
      if (sequence !== sequenceRef.current) return;
      setBusy(false);
      if (!isReply(reply)) return;
      if (reply.ok) {
        setSnapshot({ key, value: reply.state });
        setError(null);
        return;
      }
      setSnapshot((previous) => {
        if (previous?.key === key) return previous;
        return reply.state ? { key, value: reply.state } : null;
      });
      setError(reply.error);
    },
    [key],
  );

  useEffect(() => {
    let active = true;
    const refresh = () => {
      if (!active) return;
      const sequence = ++sequenceRef.current;
      const command: ProviderFeatureCommand = {
        type: FEATURE_COMMANDS.getState,
        rulePattern,
        hostname,
      };
      fireAndForget(
        sendRuntimeMessage<ProviderFeatureReply>(command).then((reply) =>
          apply(sequence, reply),
        ),
      );
    };
    const changed = (message: unknown) => {
      if (
        typeof message !== "object" ||
        message === null ||
        Reflect.get(message, "type") !== FEATURE_EVENTS.stateChanged
      )
        return;
      // A provider update converges after the user's in-flight operation, so it cannot discard its result.
      fireAndForget((actionRef.current ?? Promise.resolve()).then(refresh));
    };
    setBusy(false);
    refresh();
    chrome.runtime.onMessage?.addListener(changed);
    return () => {
      active = false;
      sequenceRef.current += 1;
      chrome.runtime.onMessage?.removeListener(changed);
    };
  }, [apply, hostname, rulePattern]);

  const send = useCallback(
    (type: MutationType, featureId?: string) => {
      const sequence = ++sequenceRef.current;
      const command: ProviderFeatureCommand = {
        type,
        ...target.current,
        ...(state?.providerId ? { providerId: state.providerId } : {}),
        ...(featureId === undefined ? {} : { featureId }),
      };
      setBusy(true);
      setError(null);
      const action = sendMessageOrThrow<ProviderFeatureReply>(command).then(
        (reply) => apply(sequence, reply),
        (failure) => apply(sequence, { ok: false, error: errorMessage(failure) }),
      );
      actionRef.current = action;
      fireAndForget(
        action.finally(() => {
          if (actionRef.current === action) actionRef.current = null;
        }),
      );
    },
    [apply, state?.providerId],
  );

  return { state, busy, error, send };
};
