import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SettingsSectionCard } from "./SettingsSectionCard";

describe("SettingsSectionCard", () => {
  it("renders anchor classes, description, and header actions", () => {
    const markup = renderToStaticMarkup(
      createElement(
        SettingsSectionCard,
        {
          anchorId: "section-test",
          title: createElement("h3", null, "Section title"),
          description: "Section description",
          headerActions: createElement("button", { type: "button" }, "Action"),
          highlighted: true,
        },
        createElement("p", null, "Section body"),
      ),
    );

    expect(markup).toContain('id="section-test"');
    expect(markup).toContain('data-anchor-id="section-test"');
    expect(markup).toContain('id="section-test__title"');
    expect(markup).toContain('id="section-test__description"');
    expect(markup).toContain("gw-anchor-target scroll-mt-7");
    expect(markup).toContain("gw-anchor-highlighted");
    expect(markup).toContain("Section description");
    expect(markup).toContain("Action");
    expect(markup).toContain("Section body");
  });

  it("marks the section title as a focus proxy when enabled", () => {
    const markup = renderToStaticMarkup(
      createElement(SettingsSectionCard, {
        title: createElement("h3", null, "Section title"),
        focusControlOnTitleClick: true,
        headerActions: createElement("button", { type: "button" }, "Toggle"),
      }),
    );

    expect(markup).toContain('data-settings-focus-title="true"');
    expect(markup).toContain('type="button"');
    expect(markup).toContain("cursor-pointer");
  });
});
