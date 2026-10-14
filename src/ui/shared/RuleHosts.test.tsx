import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { RuleAdditionalHosts, RuleHostList } from "./RuleHosts";

import { applyUiLocalePreference } from "@/ui/i18n";

describe("RuleAdditionalHosts", () => {
  it("requires every additional pattern so a blank row cannot be dropped", () => {
    const markup = renderToStaticMarkup(
      createElement(RuleAdditionalHosts, {
        rules: [
          { pattern: "example.com", enabled: true, groupId: "group" },
          { pattern: "api.example.com", enabled: true, groupId: "group" },
        ],
        sourcePattern: "example.com",
        renderPrimary: () => createElement("input", { id: "primary" }),
      }),
    );
    expect(markup).toContain('name="additionalRulePatterns"');
    expect(markup).toContain('value="api.example.com"');
    expect(markup).toContain("required");
  });
});

describe("RuleHostList", () => {
  it("names every host in a product rule without a provider badge", () => {
    const markup = renderToStaticMarkup(
      createElement(RuleHostList, {
        patterns: ["*example.com", "api.example.net", "third.example.org"],
      }),
    );
    for (const host of ["*example.com", "api.example.net", "third.example.org"])
      expect(markup).toContain(`data-rule-host="${host}"`);
    expect(markup).toContain("Patterns in this rule");
    expect(markup).toContain("same settings and identity");
    expect(markup).not.toContain("data-provider");
  });
  it("omits a redundant list for a single domain", () => {
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
      expect(markup).toContain("Patrones de esta regla");
      expect(markup).toContain("misma configuración");
    } finally {
      applyUiLocalePreference("en");
    }
  });
});
