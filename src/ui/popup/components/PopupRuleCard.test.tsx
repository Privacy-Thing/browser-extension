import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  getLanguagePriorityLines,
  PopupRuleCard,
} from "@/ui/popup/components/PopupRuleCard";

describe("PopupRuleCard", () => {
  it.each([
    ["active", "steady"],
    ["disabled", "steady"],
    ["warning", "urgent"],
    ["danger", "urgent"],
  ] as const)("always animates the %s tone with %s timing", (tone, timing) => {
    const markup = renderToStaticMarkup(
      createElement(PopupRuleCard, {
        title: "Status",
        tone,
        summarySource: "Domain Rule",
      }),
    );

    expect(markup).toContain("gw-popup-rule-card--animated-border");
    expect(markup).toContain(`data-animation-timing="${timing}"`);
    expect(markup).toContain("--gw-popup-rule-accent-source:");
  });

  it("lets a compatibility warning use boosted timing independently of its tone", () => {
    const markup = renderToStaticMarkup(
      createElement(PopupRuleCard, {
        title: "Needs attention",
        tone: "warning",
        animationTiming: "boosted",
        summarySource: "Domain Rule",
      }),
    );

    expect(markup).toContain('data-tone="warning"');
    expect(markup).toContain('data-animation-timing="boosted"');
  });

  it("does not rely on the old low-opacity disabled surface utilities", () => {
    const markup = renderToStaticMarkup(
      createElement(PopupRuleCard, {
        title: "Trusted Site",
        tone: "disabled",
        summarySource: "Trusted Site",
      }),
    );

    expect(markup).toContain("gw-popup-rule-card");
    expect(markup).toContain("gw-popup-rule-card--animated-border");
    expect(markup).toContain('data-animation-timing="steady"');
    expect(markup).toContain('data-tone="disabled"');
    expect(markup).not.toContain("bg-white/5");
    expect(markup).not.toContain("data-[tone=disabled]:bg-secondary/35");
  });

  it("shows the primary language and exposes the ordered language priorities", () => {
    const markup = renderToStaticMarkup(
      createElement(PopupRuleCard, {
        title: "Protected",
        tone: "active",
        summarySource: "Domain Rule",
        summaryProfile: "Ottawa",
        summaryLanguage: "English (Canada)",
        summaryLanguageTitle:
          "Language priority:\n1. English (Canada)\n2. English\n3. French",
      }),
    );

    expect(markup).toContain("Domain Rule");
    expect(markup).toContain("Ottawa");
    expect(markup).toContain("English (Canada)");
    expect(markup).toContain(
      "Language priority:\n1. English (Canada)\n2. English\n3. French",
    );
    expect(markup).toContain("gw-popup-language-trigger");
    expect(
      getLanguagePriorityLines(
        "Language priority:\n1. English (Canada)\n2. English\n3. French",
      ),
    ).toEqual(["Language priority:", "1. English (Canada)", "2. English", "3. French"]);
  });

  it("shows the compatibility warning before the protection counts", () => {
    const markup = renderToStaticMarkup(
      createElement(PopupRuleCard, {
        title: "Needs attention",
        tone: "warning",
        summarySource: "Default Rule",
        summaryException: "This page may not work correctly.",
        summaryCounts: "9 protected · 2 need attention",
      }),
    );

    expect(markup.indexOf("This page may not work correctly.")).toBeLessThan(
      markup.indexOf("9 protected · 2 need attention"),
    );
    expect(markup).toContain("gw-popup-rule-footer");
  });
});
