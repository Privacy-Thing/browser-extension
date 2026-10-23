import { expect } from "storybook/test";

/** Dialog widths that cover the 320 px popup minimum up to the widest sidecar dialog. */
export const DIALOG_WIDTHS_PX = [320, 360, 400, 480, 560] as const;

/**
 * Pins the dialog to each width and asserts it never gains a horizontal scroll range.
 * Geometry belongs in Storybook, not E2E: the check reads the real layout engine.
 */
export const expectNoSideScroll = (dialog: HTMLElement) => {
  for (const width of DIALOG_WIDTHS_PX) {
    dialog.style.width = `${width}px`;
    dialog.style.minWidth = `${width}px`;
    dialog.style.maxWidth = `${width}px`;
    expect(dialog.scrollWidth, `scrollWidth at ${width}px`).toBeLessThanOrEqual(
      dialog.clientWidth,
    );
  }
};
