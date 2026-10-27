import type { Decorator } from "@storybook/react";
import { useLayoutEffect, useState, type ReactNode } from "react";
import { expect } from "storybook/test";

import { applyUiLocalePreference, type UiLocale } from "@/ui/i18n";

const LocaleGate = ({
  locale,
  children,
}: {
  locale: UiLocale;
  children: ReactNode;
}) => {
  const [applied, setApplied] = useState<UiLocale | null>(null);
  useLayoutEffect(() => {
    applyUiLocalePreference(locale);
    setApplied(locale);
    return () => applyUiLocalePreference("en");
  }, [locale]);
  // Messages are read during render, so the story renders only once the locale is active.
  return applied === locale ? children : null;
};

/** Renders a story in one interface language, then restores English. */
export const withUiLocale =
  (locale: UiLocale): Decorator =>
  (Story) => (
    <LocaleGate locale={locale}>
      <Story />
    </LocaleGate>
  );

const isRendered = (element: Element) => {
  const box = element.getBoundingClientRect();
  return box.width > 0 && box.height > 0;
};

/**
 * Asserts that no text overflows the surface sideways: the surface has no horizontal
 * scroll range, clipped elements fit their box unless they truncate with an ellipsis,
 * and no rendered element extends past the surface edges.
 */
export const expectNoClippedText = (surface: HTMLElement) => {
  expect(surface.scrollWidth, "surface scrollWidth").toBeLessThanOrEqual(
    surface.clientWidth,
  );
  const bounds = surface.getBoundingClientRect();
  for (const element of surface.querySelectorAll<HTMLElement>("*")) {
    if (!isRendered(element) || element.closest(".sr-only")) continue;
    const style = getComputedStyle(element);
    const label = `${element.tagName.toLowerCase()}.${element.className}: ${element.textContent?.slice(0, 40) ?? ""}`;
    if (style.overflowX !== "visible" && style.textOverflow !== "ellipsis") {
      expect(element.scrollWidth, `clipped ${label}`).toBeLessThanOrEqual(
        element.clientWidth + 1,
      );
    }
    if (element.childElementCount === 0 && element.textContent?.trim()) {
      const box = element.getBoundingClientRect();
      expect(box.right, `past the end edge ${label}`).toBeLessThanOrEqual(
        bounds.right + 1,
      );
      expect(box.left, `past the start edge ${label}`).toBeGreaterThanOrEqual(
        bounds.left - 1,
      );
    }
  }
};
