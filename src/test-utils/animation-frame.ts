type FrameCallback = (timestamp: number) => void;

export const createRafController = () => {
  let nextId = 1;
  const callbacks = new Map<number, FrameCallback>();

  const request = (callback: FrameCallback): number => {
    const id = nextId;
    nextId += 1;
    callbacks.set(id, callback);
    return id;
  };

  const cancel = (id: number): void => {
    callbacks.delete(id);
  };

  const flush = (timestamp = 0): void => {
    const pending = [...callbacks.entries()];
    callbacks.clear();
    for (const [, callback] of pending) callback(timestamp);
  };

  const flushAll = (timestamp = 0, maximumFrames = 10): void => {
    for (let frame = 0; callbacks.size > 0 && frame < maximumFrames; frame += 1) {
      flush(timestamp);
    }
    if (callbacks.size > 0) throw new Error("Animation frame queue did not settle.");
  };

  return { request, cancel, flush, flushAll };
};
