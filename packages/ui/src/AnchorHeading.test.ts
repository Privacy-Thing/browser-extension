import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AnchorHeading } from "./AnchorHeading";

describe("AnchorHeading", () => {
  it("applies the anchor id to a heading child that does not already have one", () => {
    const markup = renderToStaticMarkup(
      createElement(AnchorHeading, {
        anchorId: "section-about-overview",
        label: "Copy link to about",
        children: createElement("h3", null, "About"),
      }),
    );

    expect(markup).toContain('id="section-about-overview"');
    expect(markup).toContain("About");
    expect(markup).toContain("gw-anchor-heading");
  });

  it("keeps an existing heading id unchanged", () => {
    const markup = renderToStaticMarkup(
      createElement(AnchorHeading, {
        anchorId: "section-about-overview",
        label: "Copy link to about",
        children: createElement("h3", { id: "existing-title-id" }, "About"),
      }),
    );

    expect(markup).toContain('id="existing-title-id"');
    expect(markup).not.toContain('id="section-about-overview"');
  });
});
