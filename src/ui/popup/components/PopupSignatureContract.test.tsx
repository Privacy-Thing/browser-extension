import { readFileSync } from "node:fs";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PopupPowerButton } from "@/ui/popup/components/PopupPowerButton";
import { PopupRuleCard } from "@/ui/popup/components/PopupRuleCard";

const layoutCss = readFileSync(
  new URL("../styles/layout.css", import.meta.url),
  "utf8",
);
const shellCss = readFileSync(new URL("../styles/shell.css", import.meta.url), "utf8");
const tokensCss = readFileSync(
  new URL("../styles/tokens.css", import.meta.url),
  "utf8",
);
const popupCss = [
  "tokens.css",
  "layout.css",
  "primitives.css",
  "shell.css",
  "workspace.css",
  "motion.css",
]
  .map((file) => readFileSync(new URL(`../styles/${file}`, import.meta.url), "utf8"))
  .join("\n");
const popupShellViewSource = readFileSync(
  new URL("../popup-shell-view.tsx", import.meta.url),
  "utf8",
);
const popupSheetViewSource = readFileSync(
  new URL("../popup-sheet-view.tsx", import.meta.url),
  "utf8",
);
const popupNavigationSource = readFileSync(
  new URL("../popup-navigation.ts", import.meta.url),
  "utf8",
);
const globalCss = readFileSync(
  new URL("../../styles/globals.css", import.meta.url),
  "utf8",
);
const powerButtonStorySource = readFileSync(
  new URL("../stories/PopupPowerButton.stories.tsx", import.meta.url),
  "utf8",
);
const popupRuleSheetSource = readFileSync(
  new URL("PopupRuleSheet.tsx", import.meta.url),
  "utf8",
);
const popupRuleFormSource = readFileSync(
  new URL("popup-rule-form.tsx", import.meta.url),
  "utf8",
);

describe("popup signature UI contract", () => {
  it("preserves the nested power geometry and its popup token", () => {
    const markup = renderToStaticMarkup(
      createElement(PopupPowerButton, {
        state: "warning",
        ariaLabel: "Turn off this Domain Rule",
      }),
    );

    expect(markup.indexOf("gw-popup-power-gap")).toBeLessThan(
      markup.indexOf("gw-popup-power-inner-ring"),
    );
    expect(markup.indexOf("gw-popup-power-inner-ring")).toBeLessThan(
      markup.indexOf("gw-popup-power-surface"),
    );
    expect(popupCss).toContain("inset: 1.5%");
    expect(popupCss).toContain("inset: 12.6%");
    expect(popupCss).toContain("inset: 19.3%");
    expect(popupCss).toContain("--gw-popup-power-size: 100px");
    expect(popupCss).toContain(
      "width: var(--gw-power-size, var(--gw-popup-power-size))",
    );
    expect(popupCss).toContain(
      "height: var(--gw-power-size, var(--gw-popup-power-size))",
    );
    expect(powerButtonStorySource).not.toContain("data-theme=");
    expect(powerButtonStorySource).toContain('privacyThing: { surface: "component" }');
    expect(powerButtonStorySource).toContain(
      '"--gw-power-size": "var(--gw-popup-power-size)"',
    );
    expect(
      popupCss.match(
        /\.gw-popup-power-button \{\n {2}background-color: currentColor;/g,
      ),
    ).toHaveLength(4);
    expect(
      popupCss.match(
        /\.gw-popup-power-inner-ring \{\n {2}background-color: currentColor;/g,
      ),
    ).toHaveLength(4);
    expect(
      popupCss.match(/\.gw-popup-power-icon \{\n {2}color: currentColor;/g),
    ).toHaveLength(4);
    expect(popupCss).not.toContain("background-color: color-mix(in srgb, currentColor");
    expect(popupCss).not.toContain("--gw-popup-power-light");
    expect(popupCss).toContain("--gw-popup-success-accent: #48a65d");
    expect(popupCss).toContain("--gw-popup-warning-accent: #c98318");
    expect(popupCss).toContain("--gw-popup-disabled-accent: #878a95");
    expect(popupCss).toContain("color: var(--gw-popup-warning-accent)");
    expect(popupCss).toContain("transform: scale(0.985)");
    expect(popupCss).toContain(".gw-popup-power-button::after");
    expect(popupCss).not.toContain("100dvh");
  });

  it("keeps the animated ring hosted by PopupRuleCard with its paint area", () => {
    const markup = renderToStaticMarkup(
      createElement(PopupRuleCard, {
        title: "Needs attention",
        tone: "warning",
        animatedBorderColor: "#fbbf24",
        summarySource: "Domain Rule",
      }),
    );

    expect(markup).toContain("gw-popup-rule-card--animated-border");
    expect(markup).toContain("gw-animated-accent-surface");
    expect(markup).toContain('data-animation-timing="urgent"');
    expect(popupCss).toContain("--gw-animated-border-boost-duration: 14s");
    expect(popupCss).toContain("--gw-animated-border-animation-duration: 14s");
    expect(globalCss).toContain(
      '.gw-animated-accent-border[data-animation-timing="steady"]',
    );
    expect(globalCss).toContain(
      '.gw-animated-accent-border[data-animation-timing="boosted"]',
    );
    expect(globalCss).toContain(
      '.gw-animated-accent-border[data-animation-timing="urgent"]',
    );
    expect(globalCss).toContain("--gw-animated-border-animation-duration: 8s");
    expect(globalCss).toContain(
      "animation: var(--gw-animated-border-animation,\n    gw-animated-border-rotate",
    );
    expect(globalCss).toContain(".gw-animated-accent-border::before");
    expect(globalCss).toContain("inset: -1px");
    expect(globalCss).toContain(":root[data-reduce-motion] .gw-animated-accent-border");
    expect(globalCss).toContain(".gw-animated-accent-halo::after");
    expect(globalCss).toContain(".gw-animated-accent-halo-surface");
    expect(globalCss).toContain(
      ":root[data-reduce-motion] .gw-animated-accent-halo::after",
    );
    expect(globalCss).toContain("@keyframes gw-animated-accent-halo-breathe");
    expect(globalCss).toContain("--gw-animated-accent-halo-source");
    expect(globalCss).toContain("--gw-animated-accent-halo-depth-shadow");
    expect(globalCss).not.toContain("body[data-reduce-motion]");
    expect(globalCss).not.toContain("animation: none !important");
    expect(globalCss).toContain("--gw-animated-border-static-accent");
    expect(globalCss).toContain(
      "--gw-animated-border-background: var(--gw-animated-border-static-accent)",
    );
    expect(popupCss).toContain(
      "--gw-animated-border-static-accent: var(--gw-popup-rule-accent-source)",
    );
    expect(popupCss).toContain(
      "--gw-animated-accent-halo-depth-shadow: var(--gw-popup-rule-shadow)",
    );
    expect(popupCss).toContain("--gw-animated-accent-halo-gap: 5px");
  });

  it("shares one warning accent across popup state surfaces", () => {
    expect(popupShellViewSource).toContain("var(--gw-popup-warning-accent)");
    expect(popupCss).toContain(
      "--gw-popup-notification-badge-accent: var(--gw-popup-warning-accent)",
    );
    expect(popupCss).toContain("border-left: 4px solid var(--gw-popup-warning-accent)");
    expect(popupCss).not.toContain("--gw-popup-power-warning");
  });

  it("shares one success accent across popup state surfaces", () => {
    expect(popupShellViewSource).toContain("var(--gw-popup-success-accent)");
    expect(popupCss).toContain("color: var(--gw-popup-success-accent)");
    expect(popupCss).not.toContain("--gw-popup-power-active");
  });

  it("shares one disabled accent across popup state surfaces", () => {
    expect(popupShellViewSource).toContain("var(--gw-popup-disabled-accent)");
    expect(popupCss).toContain("color: var(--gw-popup-disabled-accent)");
    expect(popupCss).not.toContain("--gw-popup-power-disabled");
    expect(popupCss).not.toContain("--gw-popup-power-dark");
    expect(popupCss).not.toContain("--gw-popup-power-hc-dark");
  });

  it("keeps light-theme context actions neutral", () => {
    expect(tokensCss).toContain("--gw-popup-context-action-border: hsl(var(--border))");
    expect(tokensCss).toContain("--gw-popup-context-action-success-border: var(");
    expect(shellCss).toMatch(/background: var\(\s+--gw-popup-context-action-surface,/);
    expect(shellCss).not.toContain('[data-theme="light"]');
  });

  it("keeps context tint as the dark-theme fallback", () => {
    const rootTokens = tokensCss.slice(0, tokensCss.indexOf('[data-theme="light"]'));

    expect(rootTokens).not.toContain("--gw-popup-context-action-surface");
    expect(shellCss).toMatch(
      /--gw-popup-context-action-surface,\s+color-mix\(\s*in srgb,\s*hsl\(var\(--card\)\) 94%,\s*var\(--gw-popup-context-accent\) 6%/,
    );
    expect(shellCss).toMatch(
      /--gw-popup-context-action-success-surface,\s+color-mix\(\s*in srgb,\s*hsl\(var\(--card\)\) 88%,\s*var\(--gw-popup-context-accent\) 12%/,
    );
  });

  it("keeps scroll cues bound to the workspace scrollport", () => {
    expect(popupCss).toContain(".gw-popup-sheet-header::after");
    expect(popupCss).toContain(
      '.gw-popup-workspace-scroll[data-scroll-at-bottom="false"]',
    );
    expect(popupCss).toContain("--gw-popup-scroll-cue-surface");
    expect(popupCss).toContain("--gw-popup-scroll-cue-shadow");
    expect(popupRuleFormSource).toContain('data-popup-scrollport="true"');
    expect(popupRuleSheetSource).toContain("dataset.scrollAtTop");
    expect(popupRuleSheetSource).toContain("dataset.scrollAtBottom");
    expect(popupCss).toContain("padding-inline: 4px");
    expect(popupCss).not.toContain("padding-right: 4px");
  });

  it("uses Notifications as the only warning workspace", () => {
    expect(popupSheetViewSource).not.toContain('sheetView === "suggestions-list"');
    expect(popupSheetViewSource).not.toContain('sheetView === "suggestion-detail"');
    expect(popupSheetViewSource).toContain('sheetView === "notification-list"');
    expect(popupSheetViewSource).toContain('sheetView === "notification-detail"');
  });

  it("keeps sidecar actions fixed and uses row-aware actionbar spacing", () => {
    expect(popupCss).toContain(
      'html.gw-popup-document[data-popup-workspace-open="true"]',
    );
    expect(popupCss).toContain("overflow: hidden");
    expect(popupCss).toContain("margin-top: 15px");
    expect(popupCss).toContain("margin-bottom: 25px");
    expect(popupCss).toContain('.gw-popup-action-strip[data-row-count="2"]');
    expect(popupCss).toContain("margin-bottom: 15px");
    expect(popupCss).toContain("height: var(--gw-popup-footer-height)");
    expect(popupCss).toContain(
      ".gw-popup-protection-details > .gw-popup-workspace-actions",
    );
    expect(popupNavigationSource).toContain("shouldCloseSheet");
  });

  it("lets the compact shell follow its content and keeps the main header transparent", () => {
    const shellRule = shellCss.match(/\.gw-popup-shell \{[^}]+\}/)?.[0] ?? "";
    const headerRule = shellCss.match(/\.gw-popup-header \{[^}]+\}/)?.[0] ?? "";
    const notificationAnchorRule =
      shellCss.match(/\.gw-popup-notification-anchor \{[^}]+\}/)?.[0] ?? "";
    const notificationBadgeRule =
      shellCss.match(/\.gw-popup-notification-badge \{[^}]+\}/)?.[0] ?? "";

    expect(popupCss).toContain("--gw-popup-min-height: 450px");
    expect(popupCss).not.toContain("--gw-popup-compact-height");
    expect(shellRule).not.toContain("height: var(--gw-popup-compact-height)");
    expect(shellRule).toContain("min-height: var(--gw-popup-min-height)");
    expect(shellRule).toContain("max-height: var(--gw-popup-max-height)");
    expect(headerRule).not.toContain("background");
    expect(notificationAnchorRule).toContain("margin-right: -6px");
    expect(notificationBadgeRule).toContain("right: 0");
    expect(
      shellCss.match(/\.gw-popup-main-section \{[^}]+\}/)?.[0] ?? "",
    ).not.toContain("overflow");
    expect(layoutCss).toContain(
      '.gw-popup-layout[data-workspace-open="true"] .gw-popup-shell',
    );
    expect(layoutCss).toContain("height: var(--gw-popup-max-height)");
  });

  it("keeps the power glow clear of the protection card", () => {
    const glowRule =
      shellCss.match(/\.gw-popup-power-button::after \{[^}]+\}/)?.[0] ?? "";

    expect(glowRule).toContain("clip-path: inset(-84px -84px -36px -84px)");
  });

  it("collapses the contextual action slot when no actions are available", () => {
    const emptyActionRule =
      shellCss.match(/\.gw-popup-action-strip\[data-empty="true"\] \{[^}]+\}/)?.[0] ??
      "";

    expect(emptyActionRule).toContain("display: none");
  });

  it("makes every contextual action background lighter on hover", () => {
    expect(shellCss).toMatch(
      /hsl\(var\(--card\)\) 94%,\s+var\(--gw-popup-context-accent\) 6%/,
    );
    expect(shellCss).toMatch(
      /hsl\(var\(--card\)\) 88%,\s+var\(--gw-popup-context-accent\) 12%/,
    );
    expect(shellCss).toContain('[data-tone="success"]:hover:not(:disabled)');
    expect(shellCss).toMatch(
      /hsl\(var\(--card\)\) 84%,\s+var\(--gw-popup-context-accent\) 16%/,
    );
    expect(shellCss).toContain('[data-tone="danger"]:hover:not(:disabled)');
    expect(shellCss).toMatch(
      /hsl\(var\(--card\)\) 86%,\s+hsl\(var\(--tone-error-text\)\) 14%/,
    );
  });
});
