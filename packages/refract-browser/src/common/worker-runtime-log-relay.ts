import type { RuntimeSnapshot } from "@/shared/types";

export type WorkerMessageTarget =
  Pick<Worker, "addEventListener"> | Pick<MessagePort, "addEventListener" | "start">;

type WorkerRelaySnapshot = Pick<RuntimeSnapshot, "debugMode" | "logEventName">;
type PostMessageTarget = {
  postMessage: (message: unknown, targetOrigin?: string) => void;
};

export const attachWorkerLogRelay = (
  snapshot: WorkerRelaySnapshot,
  target: WorkerMessageTarget,
  postMessageTarget: PostMessageTarget = globalThis as unknown as PostMessageTarget,
): void => {
  if (!snapshot.debugMode || !snapshot.logEventName) {
    return;
  }

  if ("start" in target && typeof target.start === "function") {
    target.start();
  }

  target.addEventListener("message", (event: Event) => {
    const messageEvent = event as MessageEvent<unknown>;
    const payload = messageEvent.data as {
      type?: unknown;
      eventName?: unknown;
      detail?: unknown;
    } | null;
    if (
      payload?.type !== __PT_LOG_EVENT_TYPE__ ||
      payload.eventName !== snapshot.logEventName ||
      typeof payload.detail !== "string"
    ) {
      return;
    }

    messageEvent.stopImmediatePropagation();
    try {
      postMessageTarget.postMessage(payload);
    } catch {
      // Ignore dispatch errors.
    }
  });
};
