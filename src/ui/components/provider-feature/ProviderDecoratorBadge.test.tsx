import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ProviderDecoratorBadge } from "./ProviderDecoratorBadge";

import type { ProviderDecorator } from "@/shared/provider-feature";

const decorator: ProviderDecorator = {
  providerId: "provider",
  providerName: "Control D",
  initials: "CD",
  featureId: "youtube",
  label: "YouTube",
  type: "service",
};

const colored: ProviderDecorator = {
  ...decorator,
  badgeColors: { background: "#1BE3AD", foreground: "#010818" },
};

describe("ProviderDecoratorBadge", () => {
  it("defaults to the initials circle", () => {
    const markup = renderToStaticMarkup(
      createElement(ProviderDecoratorBadge, { decorator: colored }),
    );
    expect(markup).toContain('data-provider-label="initials"');
    expect(markup).toContain('data-provider-initials="CD"');
    expect(markup).toContain("size-[24px]");
    expect(markup).toContain("YouTube");
    expect(markup).not.toContain("data-provider-name");
  });

  it("renders the provider name as a padded brand pill", () => {
    const markup = renderToStaticMarkup(
      createElement(ProviderDecoratorBadge, {
        decorator: colored,
        providerLabel: "name",
      }),
    );
    expect(markup).toContain('data-provider-label="name"');
    expect(markup).toContain('data-provider-name="Control D"');
    expect(markup).toContain("Control D");
    expect(markup).toContain("h-6");
    expect(markup).toContain("px-2.5");
    expect(markup).toContain("text-xs");
    expect(markup).toContain("background-color:#1BE3AD");
    expect(markup).toContain("color:#010818");
    expect(markup).toContain("YouTube");
    expect(markup).not.toContain("data-provider-initials");
    expect(markup).not.toContain("bg-secondary");
  });

  it("uses secondary tokens when the plugin supplies no brand colors", () => {
    const markup = renderToStaticMarkup(
      createElement(ProviderDecoratorBadge, {
        decorator,
        providerLabel: "name",
      }),
    );
    expect(markup).toContain("border-border");
    expect(markup).toContain("bg-secondary");
    expect(markup).toContain("text-secondary-foreground");
    expect(markup).not.toContain("background-color");
  });
});
