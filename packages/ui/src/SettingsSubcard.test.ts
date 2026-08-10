import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SettingsSubcard } from "./SettingsSubcard";

describe("SettingsSubcard", () => {
  it("renders nested anchor metadata and description without copy affordance", () => {
    const markup = renderToStaticMarkup(
      createElement(SettingsSubcard, {
        anchorId: "subcard-test",
        copyLabel: "Copy link to subcard",
        title: createElement("h4", null, "Subcard title"),
        description: createElement("p", null, "Subcard description"),
        action: createElement("button", { type: "button" }, "Switch"),
        highlighted: true,
      }),
    );

    expect(markup).toContain('id="subcard-test"');
    expect(markup).toContain('id="subcard-test__title"');
    expect(markup).toContain('id="subcard-test__description"');
    expect(markup).toContain("gw-anchor-target scroll-mt-7");
    expect(markup).toContain("gw-anchor-highlighted");
    expect(markup).not.toContain('data-anchor-copy="subcard-test"');
    expect(markup).toContain("Subcard description");
    expect(markup).toContain("Switch");
  });

  it("marks the nested title as a focus proxy when enabled", () => {
    const markup = renderToStaticMarkup(
      createElement(SettingsSubcard, {
        title: createElement("h4", null, "Nested focus title"),
        focusControlOnTitleClick: true,
        action: createElement("button", { type: "button" }, "Switch"),
      }),
    );

    expect(markup).toContain('data-settings-focus-title="true"');
    expect(markup).toContain('type="button"');
    expect(markup).toContain("cursor-pointer");
  });
});
