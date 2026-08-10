import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { PopupProtectionDetails } from "@/ui/popup/components/PopupProtectionDetails";
import { createPopupStoryState } from "@/ui/popup/stories/popup-story-fixtures";

describe("PopupProtectionDetails in Firefox", () => {
  it("ignores inapplicable surfaces when resolving the Browser identity category", () => {
    const popupState = createPopupStoryState("rule-active", "baseline");
    if (!popupState) throw new Error("Expected a popup state fixture");

    const markup = renderToStaticMarkup(
      createElement(PopupProtectionDetails, {
        popupState,
        onNotificationOpen: vi.fn(),
        onOpenXRay: vi.fn(),
      }),
    );

    expect(markup).toContain("Browser identity");
    expect(markup).toMatch(/Browser identity<\/h3><span[^>]+>Protected<\/span>/);
    expect(markup).toMatch(/Client Hints.*Not applicable/);
    expect(markup).toMatch(/Battery.*Not applicable/);
    expect(markup.match(/Not applicable/g)).toHaveLength(2);
  });
});
