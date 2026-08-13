import { emitSurfaceUsageSnapshot } from "./surface-usage-emitter";
import type { WorkerMessageTarget } from "./worker-runtime-log-relay";

import { isWorkerUsageMessage } from "@/shared/worker-bootstrap-ack";

export const attachWorkerUsageRelay = (
  target: WorkerMessageTarget | null | undefined,
  options: { guard: string; sourceId: string },
): void => {
  if (!target || typeof target.addEventListener !== "function") return;
  if ("start" in target && typeof target.start === "function") {
    target.start();
  }

  target.addEventListener("message", (event: Event) => {
    const messageEvent = event as MessageEvent<unknown>;
    if (
      !isWorkerUsageMessage(messageEvent.data, options.guard, __PT_WORKER_ACK_TYPE__)
    ) {
      return;
    }

    messageEvent.stopImmediatePropagation();
    emitSurfaceUsageSnapshot({
      sourceId: options.sourceId,
      categories: messageEvent.data.categories,
      counts: messageEvent.data.counts,
      methodCounts: messageEvent.data.methodCounts,
    });
  });
};
