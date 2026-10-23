import { expect } from "storybook/test";

const HIDDEN = "rgba(0, 0, 0, 0) rgba(0, 0, 0, 0)";

/** Content width of a scroll container; the document root measures its body. */
const contentWidth = (element: HTMLElement) =>
  element === element.ownerDocument.documentElement
    ? element.ownerDocument.body.getBoundingClientRect().width
    : element.clientWidth;

/**
 * Measures how much the content width changes when the container starts to overflow.
 * It catches a missing gutter wherever scrollbars take space (interactive Storybook on
 * Windows or Linux). The headless test runner hides scrollbars while still reserving a
 * stable gutter, so there the computed gutter and colour assertions below carry the check.
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
 * Asserts a scroll container draws no scrollbar and keeps its content width when
 * content starts or stops overflowing. Containers with a gutter reserve it; a
 * container with `scrollbar-width: none` has no scrollbar width to shift by. High
 * contrast is chosen for maximum visibility, so every container shows its scrollbar
 * there.
 */
export const expectHiddenScrollbar = (element: HTMLElement) => {
  const style = getComputedStyle(element);
  expect(overflowWidthShift(element), "content width change on overflow").toBe(0);
  if (style.scrollbarWidth !== "none") {
    expect(style.scrollbarColor, "scrollbar colours").toBe(HIDDEN);
    expect(style.scrollbarGutter, "scrollbar gutter").toBe("stable");
  }

  withHighContrast(element, () => {
    const contrast = getComputedStyle(element);
    expect(contrast.scrollbarWidth, "high contrast scrollbar width").not.toBe("none");
    expect(contrast.scrollbarColor, "high contrast scrollbar colours").not.toBe(HIDDEN);
    expect(overflowWidthShift(element), "high contrast width change").toBe(0);
  });
};
