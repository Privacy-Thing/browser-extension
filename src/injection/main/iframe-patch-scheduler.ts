export type IframeSchedulerOptions<TNode, TFrame extends TNode> = {
  isNode: (value: TNode | null | undefined) => value is TNode;
  isFrame: (value: TNode) => value is TFrame;
  patchFrames: (frames: readonly TFrame[]) => void;
  querySubtreeFrames: (node: TNode) => TFrame[];
  queueMicrotask: (callback: () => void) => void;
};

export const createIframeScheduler = <TNode, TFrame extends TNode>({
  isNode,
  isFrame,
  patchFrames,
  querySubtreeFrames,
  queueMicrotask,
}: IframeSchedulerOptions<TNode, TFrame>) => {
  const pendingSubtreeNodes = new Set<TNode>();
  let subtreePatchScheduled = false;

  const scheduleSubtreePatch = (node: TNode): void => {
    pendingSubtreeNodes.add(node);
    if (subtreePatchScheduled) {
      return;
    }

    subtreePatchScheduled = true;
    queueMicrotask(() => {
      subtreePatchScheduled = false;
      const nodes = [...pendingSubtreeNodes];
      pendingSubtreeNodes.clear();
      for (const pendingNode of nodes) {
        patchFrames(querySubtreeFrames(pendingNode));
      }
    });
  };

  const patchInsertedNode = (node: TNode | null | undefined): void => {
    if (!isNode(node)) {
      return;
    }

    if (isFrame(node)) {
      patchFrames([node]);
      return;
    }

    scheduleSubtreePatch(node);
  };

  return {
    patchInsertedNode,
  };
};
