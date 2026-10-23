import { expect } from "storybook/test";

/** Dialog widths that cover the 320 px popup minimum up to the widest sidecar dialog. */
export const DIALOG_WIDTHS_PX = [320, 360, 400, 480, 560] as const;

/** Space the shared dialog keeps between its frame and the viewport edge. */
const DIALOG_VIEWPORT_GAP_PX = 4;

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

/** Popup, X-Ray side panel and sidecar widths. */
export const NARROW_SURFACE_WIDTHS_PX = [360, 400, 720] as const;

/**
 * Asserts the dialog spends no more than the shared gap beside its frame on each narrow
 * surface: it fills the surface up to its own max width. A transformed body becomes the
 * containing block of the fixed dialog, which stands in for a narrow viewport. Layout
 * widths ignore the open animation's scale.
 */
export const expectDialogFillsSurface = (dialog: HTMLElement) => {
  const body = dialog.ownerDocument.body;
  const maxWidth = Number.parseFloat(getComputedStyle(dialog).maxWidth);
  try {
    body.style.transform = "translateZ(0)";
    for (const width of NARROW_SURFACE_WIDTHS_PX) {
      body.style.width = `${width}px`;
      const expected = Math.min(maxWidth, width - DIALOG_VIEWPORT_GAP_PX * 2);
      expect(dialog.offsetWidth, `dialog width on a ${width}px surface`).toBe(expected);
    }
  } finally {
    body.style.removeProperty("transform");
    body.style.removeProperty("width");
  }
};

const readRgb = (color: string): [number, number, number] => {
  const srgb = /^color\(srgb ([\d.e-]+) ([\d.e-]+) ([\d.e-]+)/.exec(color);
  if (srgb)
    return [Number(srgb[1]) * 255, Number(srgb[2]) * 255, Number(srgb[3]) * 255];
  const rgb = /^rgba?\((\d+(?:\.\d+)?), (\d+(?:\.\d+)?), (\d+(?:\.\d+)?)/.exec(color);
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
  throw new Error(`Unexpected colour ${color}`);
};

const chroma = ([r, g, b]: [number, number, number]) =>
  Math.max(r, g, b) - Math.min(r, g, b);

const resolveColor = (dialog: HTMLElement, value: string) => {
  const probe = dialog.ownerDocument.createElement("span");
  probe.style.color = value;
  dialog.append(probe);
  const color = getComputedStyle(probe).color;
  probe.remove();
  return readRgb(color);
};

/**
 * Asserts the dialog keeps a visible 2 px frame that carries the accent, painted by
 * the dialog box itself so it can neither scroll away nor extend the scroll range.
 */
export const expectVisibleDialogFrame = (dialog: HTMLElement) => {
  const style = getComputedStyle(dialog);
  for (const side of ["Top", "Right", "Bottom", "Left"] as const) {
    expect(style[`border${side}Width`], `${side} frame width`).toBe("2px");
  }
  expect(style.backgroundImage).toContain("conic-gradient");
  expect(style.backgroundClip).toBe("padding-box, border-box");
  expect(getComputedStyle(dialog, "::before").content).toBe("none");
  expect(getComputedStyle(dialog, "::after").content).toBe("none");

  const frame = resolveColor(dialog, "var(--gw-dialog-border-color)");
  const neutral = resolveColor(dialog, "var(--gw-form-border-color)");
  const surface = resolveColor(dialog, "hsl(var(--background))");
  // The resting frame is visibly tinted by the accent, not a neutral hairline.
  expect(chroma(frame) - chroma(neutral), "frame accent tint").toBeGreaterThan(40);
  const distance = Math.hypot(
    ...frame.map((channel, index) => channel - surface[index]!),
  );
  expect(distance, "frame distance from the dialog surface").toBeGreaterThan(80);
};
