import { describe, expect, it, vi } from "vitest";

import { createIframeScheduler } from "@/injection/main/iframe-patch-scheduler";

type TestNode = {
  kind: "frame" | "container";
  frames?: TestNode[];
};

describe("createIframeScheduler", () => {
  it("patches directly inserted iframes synchronously", () => {
    const patchFrames = vi.fn();
    const queuedCallbacks: Array<() => void> = [];
    const frame: TestNode = { kind: "frame" };
    const scheduler = createIframeScheduler<TestNode, TestNode>({
      isNode: (value): value is TestNode => Boolean(value),
      isFrame: (value): value is TestNode => value.kind === "frame",
      patchFrames,
      querySubtreeFrames: (node) => node.frames ?? [],
      queueMicrotask: (callback) => queuedCallbacks.push(callback),
    });

    scheduler.patchInsertedNode(frame);

    expect(patchFrames).toHaveBeenCalledWith([frame]);
    expect(queuedCallbacks).toEqual([]);
  });

  // DocumentFragment children are moved to the parent during DOM insertion,
  // leaving the fragment empty. The scheduler queues frame discovery in a
  // microtask, so by the time it runs the fragment is empty and the iframe
  // is missed. This test documents that callers must pre-collect frames from
  // a fragment BEFORE calling the native insertion method rather than relying
  // on the scheduler's delayed subtree query.
  it("misses iframes inside a node whose children are removed before the microtask runs", () => {
    const patchFrames = vi.fn();
    const queuedCallbacks: Array<() => void> = [];
    const frame: TestNode = { kind: "frame" };
    const fragment: TestNode = { kind: "container", frames: [frame] };
    const scheduler = createIframeScheduler<TestNode, TestNode>({
      isNode: (value): value is TestNode => Boolean(value),
      isFrame: (value): value is TestNode => value.kind === "frame",
      patchFrames,
      querySubtreeFrames: (node) => node.frames ?? [],
      queueMicrotask: (callback) => queuedCallbacks.push(callback),
    });

    // Simulate fragment being consumed: children are gone by microtask time.
    scheduler.patchInsertedNode(fragment);
    fragment.frames = []; // fragment is now empty, as if children were moved to DOM

    queuedCallbacks[0]?.();

    // Scheduler missed the iframe — demonstrates why callers must pre-collect.
    expect(patchFrames).toHaveBeenCalledWith([]);
  });

  it("batches subtree iframe discovery into one microtask", () => {
    const patchFrames = vi.fn();
    const queuedCallbacks: Array<() => void> = [];
    const firstFrame: TestNode = { kind: "frame" };
    const secondFrame: TestNode = { kind: "frame" };
    const firstContainer: TestNode = { kind: "container", frames: [firstFrame] };
    const secondContainer: TestNode = { kind: "container", frames: [secondFrame] };
    const scheduler = createIframeScheduler<TestNode, TestNode>({
      isNode: (value): value is TestNode => Boolean(value),
      isFrame: (value): value is TestNode => value.kind === "frame",
      patchFrames,
      querySubtreeFrames: (node) => node.frames ?? [],
      queueMicrotask: (callback) => queuedCallbacks.push(callback),
    });

    scheduler.patchInsertedNode(firstContainer);
    scheduler.patchInsertedNode(secondContainer);

    expect(patchFrames).not.toHaveBeenCalled();
    expect(queuedCallbacks).toHaveLength(1);

    queuedCallbacks[0]?.();

    expect(patchFrames).toHaveBeenCalledTimes(2);
    expect(patchFrames).toHaveBeenNthCalledWith(1, [firstFrame]);
    expect(patchFrames).toHaveBeenNthCalledWith(2, [secondFrame]);
  });
});
