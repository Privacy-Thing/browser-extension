import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SettingsEmptyState } from "./SettingsEmptyState";

describe("SettingsEmptyState", () => {
  it("renders the muted variant with centered actions", () => {
    const markup = renderToStaticMarkup(
      createElement(SettingsEmptyState, {
        title: "Nothing here",
        description: "Create an item to get started.",
        hint: "This is only a demo hint.",
        actions: createElement("button", { type: "button" }, "Create"),
        variant: "muted",
        centered: true,
      }),
    );

    expect(markup).toContain("Nothing here");
    expect(markup).toContain("Create an item to get started.");
    expect(markup).toContain("This is only a demo hint.");
    expect(markup).toContain("rounded-xl border border-dashed bg-muted/30 p-6");
    expect(markup).toContain("text-center");
    expect(markup).toContain("justify-center");
  });
});
