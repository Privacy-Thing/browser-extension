import { describe, expect, it, vi } from "vitest";

import {
  requestPopupSizingState,
  type PopupSizingScheduler,
  type PopupSizingState,
} from "./popup-sizing-controller";

const createFrameScheduler = () => {
  const frames: Array<() => void> = [];
  const schedule: PopupSizingScheduler = (callback) => {
    frames.push(callback);
    return frames.length;
  };
  const flush = () => {
    while (frames.length > 0) frames.shift()?.();
  };
  return { flush, schedule };
};

describe("requestPopupSizingState", () => {
  it("keeps compact mode when the workspace is closed", () => {
    const apply = vi.fn<(state: PopupSizingState) => void>();
    requestPopupSizingState(false, apply, () => 360, vi.fn());
    expect(apply).toHaveBeenCalledWith("compact");
  });

  it("requests intrinsic width before accepting a sidecar", () => {
    const states: PopupSizingState[] = [];
    const frames = createFrameScheduler();
    requestPopupSizingState(
      true,
      (state) => states.push(state),
      () => 720,
      frames.schedule,
    );
    expect(states).toEqual(["requesting-sidecar"]);
    frames.flush();
    expect(states).toEqual(["requesting-sidecar", "sidecar"]);
  });

  it("falls back to drill-in only after the expansion attempt", () => {
    const states: PopupSizingState[] = [];
    const frames = createFrameScheduler();
    requestPopupSizingState(
      true,
      (state) => states.push(state),
      () => 360,
      frames.schedule,
    );
    frames.flush();
    expect(states).toEqual(["requesting-sidecar", "drill-in"]);
  });
});
