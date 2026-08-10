import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PopupShell } from "@/ui/popup/components/PopupShell";

const baseProps: React.ComponentProps<typeof PopupShell> = {
  title: "Privacy Thing",
  domain: "example.com",
  powerState: "active",
  powerTitle: "Turn off this Domain Rule",
  powerTarget: "Turns this Domain Rule on or off.",
  powerLabel: "Domain Rule",
  powerAriaLabel: "Turn off this Domain Rule",
  ruleTitle: "Protected",
  ruleTone: "active",
  protectionSource: "Domain Rule",
  footerActions: [],
};

describe("PopupShell", () => {
  it("uses the real shell structure for a quiet loading phase", () => {
    const markup = renderToStaticMarkup(
      createElement(PopupShell, {
        ...baseProps,
        phase: "loading",
        loadingLabel: "Loading…",
        powerState: "disabled",
        powerDisabled: true,
      }),
    );

    expect(markup).toContain('data-phase="loading"');
    expect(markup).toContain('aria-busy="true"');
    expect(markup).toContain('role="status"');
    expect(markup).toContain('class="gw-popup-action-strip"');
    expect(markup).toContain('data-empty="true"');
    expect(markup).not.toContain("gw-popup-boot");
  });

  it("keeps load errors inside the same stable shell", () => {
    const markup = renderToStaticMarkup(
      createElement(PopupShell, {
        ...baseProps,
        phase: "error",
        powerState: "disabled",
        powerDisabled: true,
        alertTitle: "Couldn’t load this site’s status.",
        alertActionLabel: "Retry",
        onAlertAction: () => undefined,
      }),
    );

    expect(markup).toContain('data-phase="error"');
    expect(markup).not.toContain('aria-busy="true"');
    expect(markup).toContain('role="alert"');
    expect(markup).toContain('class="gw-popup-alert-row"');
    expect(markup).toContain("Couldn’t load this site’s status.");
    expect(markup).toContain(">Retry</button>");
  });

  it("labels the power control with its entity instead of a protection status", () => {
    const markup = renderToStaticMarkup(
      createElement(PopupShell, {
        ...baseProps,
        powerState: "warning",
        powerLabel: "Default Rule",
        ruleTone: "warning",
      }),
    );

    expect(markup).toContain('aria-label="Turn off this Domain Rule"');
    expect(markup).toContain("Default Rule");
    expect(markup).not.toContain("Protections on");
    expect(markup).not.toContain("Current state:");
  });

  it("leaves the host slot empty when the active page has no hostname", () => {
    const { domain: _domain, ...propsWithoutDomain } = baseProps;
    const markup = renderToStaticMarkup(
      createElement(PopupShell, {
        ...propsWithoutDomain,
        domainTitle: "chrome://extensions",
        powerLabel: "Restricted page",
        powerTarget: "Privacy Thing can’t access this page.",
      }),
    );

    expect(markup).not.toContain("gw-popup-header-domain");
    expect(markup).not.toContain("chrome://extensions");
    expect(markup).toContain("Restricted page");
  });

  it("passes semantic animation timing to the rule card", () => {
    const markup = renderToStaticMarkup(
      createElement(PopupShell, {
        ...baseProps,
        ruleTone: "warning",
        ruleAnimationTiming: "boosted",
      }),
    );

    expect(markup).toContain('data-tone="warning"');
    expect(markup).toContain('data-animation-timing="boosted"');
  });

  it("renders the rule card after the power control in document order", () => {
    const markup = renderToStaticMarkup(
      createElement(PopupShell, {
        ...baseProps,
        powerState: "disabled",
        powerTitle: "Turn on Privacy Thing for this site",
        powerTarget: "Privacy Thing is off because this site matches Trusted Sites.",
        powerLabel: "Trusted Site",
        powerAriaLabel: "Turn on Privacy Thing for this site",
        ruleTitle: "Protections off",
        ruleTone: "disabled",
        protectionSource: "Trusted Site",
      }),
    );

    expect(markup).toContain('class="gw-popup-rule-slot"');
    expect(markup.indexOf("gw-popup-power-stack")).toBeLessThan(
      markup.indexOf("gw-popup-rule-slot"),
    );
  });

  it("renders the active hostname and exposes the full URL as context", () => {
    const markup = renderToStaticMarkup(
      createElement(PopupShell, {
        ...baseProps,
        domainTitle: "https://example.com/path?query=1",
      }),
    );

    expect(markup).toContain("example.com");
    expect(markup).toContain("https://example.com/path?query=1");
  });

  it("places specific site actions before the broader source action", () => {
    const markup = renderToStaticMarkup(
      createElement(PopupShell, {
        ...baseProps,
        ruleActionLabel: "Edit Container",
        ruleFooterActionLabel: "Add Domain Rule",
        secondaryActionLabel: "Add to Trusted Sites",
      }),
    );

    expect(markup).toContain('data-row-count="2"');
    expect(markup.indexOf("Add Domain Rule")).toBeLessThan(
      markup.indexOf("Add to Trusted Sites"),
    );
    expect(markup.indexOf("Add to Trusted Sites")).toBeLessThan(
      markup.indexOf("Edit Container"),
    );
    expect(markup).toContain('data-wide="true">Edit Container</button>');
    expect(markup.match(/gw-popup-context-action/g)).toHaveLength(3);
  });

  it("shares the rule accent with popup-level actions", () => {
    const markup = renderToStaticMarkup(
      createElement(PopupShell, {
        ...baseProps,
        ruleAnimatedBorderColor: "#7adf83",
        ruleFooterActionLabel: "Add Domain Rule",
      }),
    );

    expect(markup).toContain("--gw-popup-context-accent:#7adf83");
  });

  it("gives the notification counter its semantic tone instead of the rule accent", () => {
    const warningMarkup = renderToStaticMarkup(
      createElement(PopupShell, {
        ...baseProps,
        notificationsIcon: createElement("span", null, "bell"),
        notificationsCount: 2,
        notificationsTone: "warning",
      }),
    );
    const infoMarkup = renderToStaticMarkup(
      createElement(PopupShell, {
        ...baseProps,
        notificationsIcon: createElement("span", null, "bell"),
        notificationsCount: 1,
        notificationsTone: "info",
      }),
    );

    expect(warningMarkup).toContain(
      'class="gw-popup-notification-badge" data-tone="warning"',
    );
    expect(infoMarkup).toContain(
      'class="gw-popup-notification-badge" data-tone="info"',
    );
  });
});
