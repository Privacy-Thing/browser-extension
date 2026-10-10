import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { RuleHostList } from "./RuleHosts";

import { applyUiLocalePreference } from "@/ui/i18n";

describe("RuleHostList", () => {
  it("names every host in a product rule without a provider badge", () => {
    const markup = renderToStaticMarkup(
      createElement(RuleHostList, {
        patterns: ["*example.com", "api.example.net", "third.example.org"],
      }),
    );
    for (const host of ["*example.com", "api.example.net", "third.example.org"])
      expect(markup).toContain(`data-rule-host="${host}"`);
    expect(markup).toContain("Sites in this rule");
    expect(markup).toContain("same settings and identity");
    expect(markup).not.toContain("data-provider");
  });
  it("omits a redundant list for a single site", () => {
    expect(
      renderToStaticMarkup(createElement(RuleHostList, { patterns: ["example.com"] })),
    ).toBe("");
  });
  it("localizes the product scope independently of an adapter", () => {
    applyUiLocalePreference("es");
    try {
      const markup = renderToStaticMarkup(
        createElement(RuleHostList, { patterns: ["first.example", "second.example"] }),
      );
      expect(markup).toContain("Sitios de esta regla");
      expect(markup).toContain("misma configuración");
    } finally {
      applyUiLocalePreference("en");
    }
  });
});
