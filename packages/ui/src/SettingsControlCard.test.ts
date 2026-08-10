import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SettingsControlCard } from "./SettingsControlCard";

describe("SettingsControlCard", () => {
  it("renders hint, action, and nested content", () => {
    const markup = renderToStaticMarkup(
      createElement(
        SettingsControlCard,
        {
          anchorId: "setting-test",
          title: createElement("h3", null, "Setting title"),
          description: "Setting description",
          hint: "Extra hint",
          action: createElement("button", { type: "button" }, "Toggle"),
          highlighted: true,
        },
        createElement("div", null, "Nested details"),
      ),
    );

    expect(markup).toContain('id="setting-test"');
    expect(markup).toContain('id="setting-test__title"');
    expect(markup).toContain('id="setting-test__description"');
    expect(markup).toContain('id="setting-test__hint"');
    expect(markup).toContain("border-dashed");
    expect(markup).toContain("gw-anchor-target");
    expect(markup).toContain("scroll-mt-7");
    expect(markup).toContain("gw-anchor-highlighted");
    expect(markup).toContain("Setting description");
    expect(markup).toContain("Extra hint");
    expect(markup).toContain("Toggle");
    expect(markup).toContain("Nested details");
  });

  it("marks the title as a focus proxy when enabled", () => {
    const markup = renderToStaticMarkup(
      createElement(SettingsControlCard, {
        title: createElement("h3", null, "Focusable title"),
        focusControlOnTitleClick: true,
        action: createElement("button", { type: "button" }, "Toggle"),
      }),
    );

    expect(markup).toContain('data-settings-focus-title="true"');
    expect(markup).toContain('type="button"');
    expect(markup).toContain("cursor-pointer");
  });
});
