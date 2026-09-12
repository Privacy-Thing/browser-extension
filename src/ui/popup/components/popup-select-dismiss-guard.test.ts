import { describe, expect, it, vi } from "vitest";

import { lockSelectHostDismiss } from "./popup-select-dismiss-guard";

describe("lockSelectHostDismiss", () => {
  it("swallows window resize and blur at capture before later listeners", () => {
    const added: Array<{
      type: string;
      listener: EventListener;
      capture: boolean | AddEventListenerOptions | undefined;
    }> = [];
    const removed: Array<{
      type: string;
      capture: boolean | EventListenerOptions | undefined;
    }> = [];
    const host = {
      addEventListener(
        type: string,
        listener: EventListener,
        capture?: boolean | AddEventListenerOptions,
      ) {
        added.push({ type, listener, capture });
      },
      removeEventListener(
        type: string,
        _listener: EventListener,
        capture?: boolean | EventListenerOptions,
      ) {
        removed.push({ type, capture });
      },
    };

    const unlock = lockSelectHostDismiss(host);
    expect(added.map((entry) => [entry.type, entry.capture])).toEqual([
      ["resize", true],
      ["blur", true],
    ]);

    const resize = new Event("resize");
    const stopResize = vi.spyOn(resize, "stopImmediatePropagation");
    added[0]?.listener(resize);
    expect(stopResize).toHaveBeenCalledOnce();

    const blur = new Event("blur");
    const stopBlur = vi.spyOn(blur, "stopImmediatePropagation");
    added[1]?.listener(blur);
    expect(stopBlur).toHaveBeenCalledOnce();

    unlock();
    expect(removed.map((entry) => [entry.type, entry.capture])).toEqual([
      ["resize", true],
      ["blur", true],
    ]);
  });
});
