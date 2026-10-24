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
  const { width, minWidth, maxWidth } = dialog.style;
  try {
    for (const pinned of DIALOG_WIDTHS_PX) {
      dialog.style.width = `${pinned}px`;
      dialog.style.minWidth = `${pinned}px`;
      dialog.style.maxWidth = `${pinned}px`;
      expect(dialog.scrollWidth, `scrollWidth at ${pinned}px`).toBeLessThanOrEqual(
        dialog.clientWidth,
      );
    }
  } finally {
    // The story keeps rendering afterwards, so it goes back to its real size.
    Object.assign(dialog.style, { width, minWidth, maxWidth });
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

/** X-Ray side panel sizes: popup width, the default panel and the 720 px sidecar. */
export const SIDEBAR_SURFACES_PX = [
  [360, 560],
  [400, 640],
  [720, 560],
] as const;

/** Runs a check with a transformed body standing in for a surface of the given size. */
const onSurface = (
  element: HTMLElement,
  width: number,
  height: number,
  check: () => void,
) => {
  const body = element.ownerDocument.body;
  try {
    body.style.transform = "translateZ(0)";
    body.style.width = `${width}px`;
    body.style.height = `${height}px`;
    // sidebar.css gives the body a 100vh minimum height.
    body.style.minHeight = "0";
    check();
  } finally {
    body.style.removeProperty("transform");
    body.style.removeProperty("width");
    body.style.removeProperty("height");
    body.style.removeProperty("min-height");
  }
};

/**
 * Asserts a dialog in the X-Ray sidebar covers the whole panel, whatever its own max
 * width and height: no outer margin on any side.
 */
export const expectDialogCoversPanel = (dialog: HTMLElement) => {
  expect(dialog).toHaveAttribute("data-layout", "fill");
  // The panel's extra height stays below the content instead of spreading it out.
  expect(getComputedStyle(dialog).alignContent, "row packing").toBe("flex-start");
  for (const [width, height] of SIDEBAR_SURFACES_PX) {
    onSurface(dialog, width, height, () => {
      expect(dialog.offsetWidth, `dialog width on a ${width}px panel`).toBe(width);
      expect(dialog.offsetHeight, `dialog height on a ${height}px panel`).toBe(height);
    });
  }
};

/**
 * Asserts no line of the dialog header runs under the close button, on a narrow and a
 * wide surface. Header and button share the dialog's open animation, so comparing
 * their rendered boxes is independent of its scale.
 */
export const expectHeaderClearsClose = (dialog: HTMLElement) => {
  const close = dialog.querySelector<HTMLElement>(":scope > [data-dialog-close]");
  const header = dialog.querySelector<HTMLElement>(":scope > [data-dialog-header]");
  expect(close, "close button").not.toBeNull();
  expect(header, "dialog header").not.toBeNull();
  const lines = dialog.ownerDocument.createRange();
  lines.selectNodeContents(header!);
  for (const width of [360, 720]) {
    onSurface(dialog, width, 560, () => {
      const button = close!.getBoundingClientRect();
      for (const line of lines.getClientRects()) {
        if (
          line.width === 0 ||
          line.bottom <= button.top ||
          line.top >= button.bottom
        ) {
          continue;
        }
        expect(
          line.right,
          `header line end beside the close button at ${width}px`,
        ).toBeLessThanOrEqual(button.left);
      }
    });
  }
};

/** Short windows a centred dialog must fit, with the shared gap above and below. */
const SHORT_SURFACES_PX = [
  [360, 420],
  [720, 360],
] as const;

/** Asserts a centred dialog stays inside short windows without its content spilling out. */
export const expectDialogFitsHeight = (dialog: HTMLElement) => {
  for (const [width, height] of SHORT_SURFACES_PX) {
    onSurface(dialog, width, height, () => {
      expect(
        dialog.offsetHeight,
        `dialog height in a ${width}x${height} window`,
      ).toBeLessThanOrEqual(height - DIALOG_VIEWPORT_GAP_PX * 2);
      expect(
        dialog.scrollHeight,
        `dialog overflow in a ${width}x${height} window`,
      ).toBe(dialog.clientHeight);
    });
  }
};

/**
 * Asserts a dialog that fills a short X-Ray panel scrolls only its body: the dialog box
 * itself gains no scroll range, so its header, close button and frame stay in view while
 * the body scrolls to its end.
 */
export const expectBodyScrollsInPanel = (dialog: HTMLElement, body: HTMLElement) => {
  expect(dialog).toHaveAttribute("data-layout", "fill");
  const fixed = [
    ["close button", dialog.querySelector<HTMLElement>(":scope > [data-dialog-close]")],
    [
      "dialog header",
      dialog.querySelector<HTMLElement>(":scope > [data-dialog-header]"),
    ],
  ] as const;
  for (const [width, height] of SHORT_SURFACES_PX) {
    onSurface(dialog, width, height, () => {
      const panel = `on a ${width}x${height} panel`;
      expect(dialog.scrollHeight, `dialog scroll range ${panel}`).toBe(
        dialog.clientHeight,
      );
      expect(body.scrollHeight, `body overflow ${panel}`).toBeGreaterThan(
        body.clientHeight,
      );
      try {
        body.scrollTop = body.scrollHeight;
        expect(dialog.scrollTop, `dialog scroll offset ${panel}`).toBe(0);
        const frame = dialog.getBoundingClientRect();
        const content = body.getBoundingClientRect();
        for (const [name, element] of fixed) {
          expect(element, name).not.toBeNull();
          const box = element!.getBoundingClientRect();
          expect(box.top, `${name} top ${panel}`).toBeGreaterThanOrEqual(frame.top);
          expect(box.bottom, `${name} above the body ${panel}`).toBeLessThanOrEqual(
            content.top,
          );
        }
        expect(
          content.bottom,
          `body end inside the frame ${panel}`,
        ).toBeLessThanOrEqual(frame.bottom);
      } finally {
        body.scrollTop = 0;
      }
    });
  }
};

/** The shared footer gap: Tailwind gap-2. */
const FOOTER_GAP_PX = 8;

/**
 * Asserts a dialog footer keeps the shared gap between its actions, whether they are
 * stacked (narrow windows) or side by side. Rendered boxes are divided by the footer's
 * open-animation scale, so the check reads layout pixels without integer rounding.
 */
export const expectFooterGap = (footer: HTMLElement) => {
  expect(footer).toHaveAttribute("data-dialog-footer");
  const style = getComputedStyle(footer);
  expect(style.rowGap, "footer row gap").toBe(`${FOOTER_GAP_PX}px`);
  expect(style.columnGap, "footer column gap").toBe(`${FOOTER_GAP_PX}px`);
  const stacked = style.flexDirection.startsWith("column");
  const bounds = footer.getBoundingClientRect();
  const scale = stacked
    ? bounds.height / footer.offsetHeight
    : bounds.width / footer.offsetWidth;
  const actions = Array.from(footer.children)
    .map((action) => action.getBoundingClientRect())
    .filter((box) => box.width > 0)
    .sort((a, b) => (stacked ? a.top - b.top : a.left - b.left));
  for (let index = 1; index < actions.length; index += 1) {
    const before = actions[index - 1]!;
    const after = actions[index]!;
    const space =
      (stacked ? after.top - before.bottom : after.left - before.right) / scale;
    expect(
      space,
      `space between footer actions ${index} and ${index + 1}`,
    ).toBeGreaterThan(FOOTER_GAP_PX - 0.5);
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
