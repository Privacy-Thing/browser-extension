import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Button } from "./button";

describe("Button", () => {
  it("renders the default variant as a neutral high-contrast CTA", () => {
    const markup = renderToStaticMarkup(createElement(Button, null, "Save"));

    expect(markup).toContain("bg-foreground");
    expect(markup).toContain("text-background");
    expect(markup).not.toContain("bg-primary");
  });

  it("renders the shared destructive outline styling", () => {
    const markup = renderToStaticMarkup(
      createElement(Button, { variant: "destructive-outline" }, "Delete"),
    );

    expect(markup).toContain("border-destructive");
    expect(markup).toContain("bg-transparent");
    expect(markup).toContain("text-destructive");
    expect(markup).toContain("hover:bg-destructive");
  });

  it("renders the compact icon size", () => {
    const markup = renderToStaticMarkup(
      createElement(Button, { size: "icon-sm", "aria-label": "More actions" }, "+"),
    );

    expect(markup).toContain("h-7");
    expect(markup).toContain("w-7");
    expect(markup).toContain("[&amp;_svg]:size-3");
  });
});
