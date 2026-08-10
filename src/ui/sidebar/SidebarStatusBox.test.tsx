import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SidebarStatusBox } from "@/ui/sidebar/SidebarStatusBox";

describe("SidebarStatusBox", () => {
  it("uses steady motion for ordinary XRay messages", () => {
    const markup = renderToStaticMarkup(
      createElement(SidebarStatusBox, null, "Waiting for page activity"),
    );

    expect(markup).toContain('data-animation-timing="steady"');
  });

  it("uses urgent motion for XRay errors", () => {
    const markup = renderToStaticMarkup(
      createElement(SidebarStatusBox, {
        tone: "error",
        children: "Could not inspect this page",
      }),
    );

    expect(markup).toContain('data-tone="error"');
    expect(markup).toContain('data-animation-timing="urgent"');
  });
});
