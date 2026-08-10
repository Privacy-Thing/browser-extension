import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { BrandWordmark } from "./BrandWordmark";

import { BRAND_DISPLAY_NAME } from "@/shared/brand";

describe("BrandWordmark", () => {
  it("renders the horizontal wordmark without the symbol", () => {
    const markup = renderToStaticMarkup(<BrandWordmark />);

    expect(markup).toContain("gw-brand-wordmark");
    expect(markup).toContain(`aria-label="${BRAND_DISPLAY_NAME}"`);
    expect(markup).toContain('id="wordmark_h"');
    expect(markup).not.toContain('id="sygnet"');
  });

  it("renders an accessible accent link", () => {
    const markup = renderToStaticMarkup(
      <BrandWordmark
        href="/src/ui/options/index.html"
        tone="accent"
        ariaLabel="Open Settings"
      />,
    );

    expect(markup).toContain('href="/src/ui/options/index.html"');
    expect(markup).toContain('data-tone="accent"');
    expect(markup).toContain('aria-label="Open Settings"');
    expect(markup).not.toContain('role="img"');
  });
});
