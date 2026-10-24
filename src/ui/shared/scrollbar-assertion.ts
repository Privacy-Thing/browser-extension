import { expect } from "storybook/test";

/** Content width of a scroll container; the document root measures its body. */
const contentWidth = (element: HTMLElement) =>
  element === element.ownerDocument.documentElement
    ? element.ownerDocument.body.getBoundingClientRect().width
    : element.clientWidth;

/**
 * Measures how much the content width changes when the container starts to overflow.
 * It catches a missing gutter wherever scrollbars take space (interactive Storybook on
 * Windows or Linux). The headless test runner hides scrollbars while still reserving a
 * stable gutter, so there the computed gutter and token assertions below carry the check.
 */
const overflowWidthShift = (element: HTMLElement) => {
  const root = element === element.ownerDocument.documentElement;
  const spacer = element.ownerDocument.createElement("div");
  const maxHeight = element.style.maxHeight;
  (root ? element.ownerDocument.body : element).append(spacer);
  try {
    if (!root) element.style.maxHeight = "none";
    const fitting = contentWidth(element);
    if (!root) element.style.maxHeight = "120px";
    spacer.style.height = "4000px";
    return fitting - contentWidth(element);
  } finally {
    spacer.remove();
    element.style.maxHeight = maxHeight;
  }
};

/** A CSS colour as the element resolves it, as computed `color` text. */
const resolvedColor = (element: HTMLElement, color: string) => {
  const root = element === element.ownerDocument.documentElement;
  const probe = element.ownerDocument.createElement("span");
  probe.style.color = color;
  (root ? element.ownerDocument.body : element).append(probe);
  try {
    return getComputedStyle(probe).color;
  } finally {
    probe.remove();
  }
};

/** Alpha of a colour token as the element resolves it (0 transparent, 1 opaque). */
const tokenAlpha = (element: HTMLElement, token: string) => {
  const channels =
    resolvedColor(element, `var(${token})`)
      .match(/[\d.]+/g)
      ?.map(Number) ?? [];
  expect(channels.length, `${token} resolves to a colour`).toBeGreaterThanOrEqual(3);
  return channels[3] ?? 1;
};

/** Runs a measurement with the high-contrast skin applied to the document root. */
export const withHighContrast = <T>(element: Element, measure: () => T): T => {
  const root = element.ownerDocument.documentElement;
  const hadHighContrast = root.classList.contains("high-contrast");
  root.classList.add("high-contrast");
  try {
    return measure();
  } finally {
    root.classList.toggle("high-contrast", hadHighContrast);
  }
};

/**
 * Asserts a scroll container shows the quiet scroll handle in a reserved gutter: the
 * content width does not change when content starts or stops overflowing, the
 * scrollbar is not removed, and the handle is drawn in the accent colour, faint at
 * rest, stronger while the area is in use and full on the handle, without a visible
 * track. High contrast draws the handle at full strength.
 */
export const expectScrollHandle = (element: HTMLElement) => {
  const style = getComputedStyle(element);
  expect(overflowWidthShift(element), "content width change on overflow").toBe(0);
  expect(style.scrollbarGutter, "scrollbar gutter").toBe("stable");
  if (CSS.supports("selector(::-webkit-scrollbar)")) {
    // Chromium drops the ::-webkit-scrollbar handle for its arrowed standard scrollbar
    // (or none) as soon as an element sets scrollbar-width or scrollbar-color.
    expect(style.scrollbarWidth, "standard scrollbar width in Chromium").toBe("auto");
    expect(style.scrollbarColor, "standard scrollbar colours in Chromium").toBe("auto");
  } else {
    expect(style.scrollbarWidth, "scrollbar width").toBe("thin");
  }

  const rest = tokenAlpha(element, "--scrollbar-thumb-rest");
  const inUse = tokenAlpha(element, "--scrollbar-thumb");
  const onHandle = tokenAlpha(element, "--scrollbar-thumb-hover");
  expect(rest, "handle at rest is drawn").toBeGreaterThan(0);
  expect(rest, "handle at rest is fainter than in use").toBeLessThan(inUse);
  expect(inUse, "handle in use is fainter than on hover or drag").toBeLessThan(
    onHandle,
  );
  expect(tokenAlpha(element, "--scrollbar-track"), "track").toBe(0);
  expect(
    resolvedColor(element, "var(--scrollbar-thumb-hover)"),
    "handle on hover or drag is the accent colour",
  ).toBe(resolvedColor(element.ownerDocument.documentElement, "hsl(var(--primary))"));

  withHighContrast(element, () => {
    expect(tokenAlpha(element, "--scrollbar-thumb-rest"), "high contrast handle").toBe(
      1,
    );
    expect(overflowWidthShift(element), "high contrast width change").toBe(0);
  });
};
