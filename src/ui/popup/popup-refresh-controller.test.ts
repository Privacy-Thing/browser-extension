import { describe, expect, it } from "vitest";

import { createRefreshController } from "@/ui/popup/popup-refresh-controller";

const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
};

describe("createRefreshController", () => {
  it("queues overlapping refreshes and prevents stale apply from the first request", async () => {
    const first = deferred<string>();
    const second = deferred<string>();
    const applied: string[] = [];
    const responses = [first.promise, second.promise];
    const controller = createRefreshController(async ({ shouldApply }) => {
      const response = await responses.shift();
      if (response && shouldApply()) {
        applied.push(response);
      }
    });

    const firstRefresh = controller.refresh();
    const queuedRefresh = controller.refresh();

    await queuedRefresh;
    first.resolve("first");
    await Promise.resolve();
    second.resolve("second");
    await firstRefresh;

    expect(applied).toEqual(["second"]);
  });
});
