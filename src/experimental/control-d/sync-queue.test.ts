import { describe, expect, it, vi } from "vitest";

import { createControlDSyncQueue } from "./sync-queue";

describe("createControlDSyncQueue", () => {
  it("serializes operations and starts the queued operation with its latest input", async () => {
    const queue = createControlDSyncQueue<string>();
    let releaseFirst: (() => void) | undefined;
    let latestSnapshot = "old";
    const first = queue.run(
      () =>
        new Promise<string>((resolve) => {
          releaseFirst = () => resolve("first");
        }),
    );
    const secondOperation = vi.fn(async () => latestSnapshot);
    const second = queue.run(secondOperation);

    expect(queue.isBusy()).toBe(true);
    expect(secondOperation).not.toHaveBeenCalled();
    latestSnapshot = "newest";
    releaseFirst?.();

    await expect(first).resolves.toBe("first");
    await expect(second).resolves.toBe("newest");
    expect(secondOperation).toHaveBeenCalledOnce();
    expect(queue.isBusy()).toBe(false);
  });

  it("continues after a failed operation", async () => {
    const queue = createControlDSyncQueue<string>();

    await expect(
      queue.run(async () => {
        throw new Error("failed");
      }),
    ).rejects.toThrow("failed");
    await expect(queue.run(async () => "recovered")).resolves.toBe("recovered");
  });
});
