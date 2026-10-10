import type { MouseEvent } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { openInBackground } from "./navigation";

const linkEvent = (modifiers: Partial<MouseEvent<HTMLAnchorElement>> = {}) =>
  ({
    button: 0,
    metaKey: false,
    ctrlKey: false,
    shiftKey: false,
    altKey: false,
    currentTarget: { href: "chrome-extension://test/src/ui/options/index.html#plugin" },
    preventDefault: vi.fn(),
    ...modifiers,
  }) as unknown as MouseEvent<HTMLAnchorElement>;

afterEach(() => vi.unstubAllGlobals());
describe("plugin settings navigation from a popup", () => {
  it("opens a background tab without moving focus away from the unsaved popup", () => {
    const create = vi.fn(async () => undefined);
    vi.stubGlobal("chrome", { tabs: { create } });
    const event = linkEvent();
    openInBackground(event);
    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(create).toHaveBeenCalledExactlyOnceWith({
      url: event.currentTarget.href,
      active: false,
    });
  });
  it("preserves modified link navigation", () => {
    const create = vi.fn();
    vi.stubGlobal("chrome", { tabs: { create } });
    const event = linkEvent({ ctrlKey: true });
    openInBackground(event);
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });
  it("falls back to the link outside the extension", () => {
    vi.stubGlobal("chrome", undefined);
    const event = linkEvent();
    openInBackground(event);
    expect(event.preventDefault).not.toHaveBeenCalled();
  });
});
