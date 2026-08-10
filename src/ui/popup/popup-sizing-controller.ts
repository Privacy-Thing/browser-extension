export type PopupSizingState =
  "compact" | "requesting-sidecar" | "sidecar" | "drill-in";

export type PopupSizingScheduler = (callback: () => void) => number;

const SIDECAR_ACCEPTED_WIDTH = 716;
const REFLOW_FRAMES = 4;

export const requestPopupSizingState = (
  workspaceOpen: boolean,
  apply: (state: PopupSizingState) => void,
  measureViewport: () => number = () => window.innerWidth,
  scheduleFrame: PopupSizingScheduler = requestAnimationFrame,
): (() => void) => {
  if (!workspaceOpen) {
    apply("compact");
    return () => undefined;
  }

  let cancelled = false;
  let frameId = 0;
  let remainingFrames = REFLOW_FRAMES;
  apply("requesting-sidecar");

  const measureAfterReflow = () => {
    if (cancelled) return;
    remainingFrames -= 1;
    if (remainingFrames > 0) {
      frameId = scheduleFrame(measureAfterReflow);
      return;
    }

    apply(resolvePopupSizingState(measureViewport()));
  };

  frameId = scheduleFrame(measureAfterReflow);

  return () => {
    cancelled = true;
    cancelAnimationFrame(frameId);
  };
};
export const resolvePopupSizingState = (viewportWidth: number): PopupSizingState =>
  viewportWidth >= SIDECAR_ACCEPTED_WIDTH ? "sidecar" : "drill-in";
