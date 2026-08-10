import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { SettingsHelpCard } from "./SettingsHelpCard";

describe("SettingsHelpCard", () => {
  it("renders the shared help-card treatment with anchor metadata and badge", () => {
    const markup = renderToStaticMarkup(
      createElement(
        SettingsHelpCard,
        {
          anchorId: "help-test",
          copyLabel: "Copy link to help",
          title: "How this works",
          highlighted: true,
        },
        createElement("p", null, "Helpful explanation"),
      ),
    );

    expect(markup).toContain('id="help-test"');
    expect(markup).toContain('data-anchor-id="help-test"');
    expect(markup).toContain("gw-anchor-heading");
    expect(markup).toContain(
      "border-tone-success-border bg-gradient-to-b from-tone-success-bg via-tone-success-bg/45 to-transparent text-tone-success-text",
    );
    expect(markup).toContain("gw-anchor-highlighted");
    expect(markup).not.toContain("data-anchor-copy=");
    expect(markup).toContain('aria-hidden="true"');
    expect(markup).toContain("Helpful explanation");
  });
});
