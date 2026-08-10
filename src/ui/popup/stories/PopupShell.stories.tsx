import type { Meta, StoryObj } from "@storybook/react";
import type { ComponentProps } from "react";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";
import "@fortawesome/fontawesome-free/css/fontawesome.css";
import "@fortawesome/fontawesome-free/css/solid.css";
import "../popup.css";

import { PopupShell } from "../components/PopupShell";

import { BRAND_DISPLAY_NAME } from "@/shared/brand";
import { BrandHorizontalLogo } from "@/ui/branding/BrandHorizontalLogo";
import { icon } from "@/ui/options/utils";

const footerActions = [
  {
    id: "open-xray",
    label: "X-Ray",
    icon: icon("fa-stethoscope"),
  },
  {
    id: "new-identity-current-domain",
    label: "New identity",
    icon: icon("fa-user-secret"),
  },
  {
    id: "open-options",
    label: "Settings",
    icon: icon("fa-gear"),
  },
] as const;

const meta = {
  title: "Popup/Shell",
  component: PopupShell,
  tags: ["autodocs"],
  parameters: {
    privacyThing: { surface: "popup" },
  },
} satisfies Meta<typeof PopupShell>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Loading: Story = {
  args: {
    phase: "loading",
    loadingLabel: "Loading…",
    title: BRAND_DISPLAY_NAME,
    brand: <BrandHorizontalLogo className="w-full" animateCursor animateIcon />,
    domain: "Loading…",
    notificationsIcon: icon("fa-bell"),
    powerState: "disabled",
    powerDisabled: true,
    powerLabel: BRAND_DISPLAY_NAME,
    powerTitle: "Checking this site’s settings",
    powerTarget: "Checking this site’s settings…",
    powerAriaLabel: "Checking this site’s settings",
    ruleTitle: "Loading…",
    ruleTone: "disabled",
    ruleAnimationTiming: "steady",
    protectionSource: "",
    footerActions: footerActions.map((action) => ({
      ...action,
      disabled: action.id !== "open-options",
    })),
  },
};

export const LoadError: Story = {
  args: {
    ...Loading.args,
    phase: "error",
    ruleTone: "danger",
    ruleAnimationTiming: "urgent",
    alertTitle: "Couldn’t load this site’s status.",
    alertActionLabel: "Retry",
    onAlertAction: () => undefined,
  },
};

type GeometryPhase = "loading" | "error" | "ready";

function PhaseGeometryHarness() {
  const [phase, setPhase] = useState<GeometryPhase>("loading");
  const args =
    phase === "loading"
      ? Loading.args
      : phase === "error"
        ? LoadError.args
        : Active.args;

  return (
    <div className="flex flex-col items-start gap-4 bg-background p-6">
      <div className="flex gap-2" aria-label="Popup phase">
        {(["loading", "error", "ready"] as const).map((option) => (
          <button key={option} type="button" onClick={() => setPhase(option)}>
            {option}
          </button>
        ))}
      </div>
      <div data-testid={`popup-phase-${phase}`}>
        <PopupShell {...(args as ComponentProps<typeof PopupShell>)} />
      </div>
    </div>
  );
}

export const StableGeometryTest: Story = {
  args: Loading.args,
  tags: ["!dev", "!autodocs"],
  parameters: {
    privacyThing: { surface: "component" },
  },
  render: () => <PhaseGeometryHarness />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const read = (phase: GeometryPhase) => {
      const host = canvas.getByTestId(`popup-phase-${phase}`);
      const shell = host.querySelector<HTMLElement>(".gw-popup-shell");
      const header = host.querySelector<HTMLElement>(".gw-popup-header");
      const power = host.querySelector<HTMLElement>(".gw-popup-power-stack");
      const rule = host.querySelector<HTMLElement>(".gw-popup-rule-slot");
      if (!shell || !header || !power || !rule)
        throw new Error(`Incomplete ${phase} shell.`);
      const shellBounds = shell.getBoundingClientRect();
      const relative = (element: HTMLElement) => {
        const bounds = element.getBoundingClientRect();
        return {
          x: bounds.x - shellBounds.x,
          y: bounds.y - shellBounds.y,
          width: bounds.width,
          height: bounds.height,
        };
      };
      return {
        shell: shellBounds,
        header: relative(header),
        power: relative(power),
        rule: relative(rule),
      };
    };

    const loading = read("loading");
    await userEvent.click(canvas.getByRole("button", { name: "error" }));
    const error = read("error");
    await userEvent.click(canvas.getByRole("button", { name: "ready" }));
    const ready = read("ready");
    const expectCloseGeometry = (
      actual: { x: number; y: number; width: number; height: number },
      expected: { x: number; y: number; width: number; height: number },
    ) => {
      for (const key of ["x", "y", "width", "height"] as const) {
        expect(Math.abs(actual[key] - expected[key])).toBeLessThanOrEqual(1);
      }
    };
    for (const phase of [loading, error, ready]) {
      expect(phase.shell.width).toBe(360);
      expect(phase.shell.height).toBeGreaterThanOrEqual(450);
      expect(phase.shell.height).toBeLessThanOrEqual(600);
      expectCloseGeometry(phase.header, ready.header);
      expectCloseGeometry(phase.power, ready.power);
      expectCloseGeometry(phase.rule, ready.rule);
    }
  },
};

export const Active: Story = {
  args: {
    title: BRAND_DISPLAY_NAME,
    brand: <BrandHorizontalLogo className="w-full" animateCursor animateIcon />,
    domain: "browserleaks.com",
    location: "New York",
    notificationsIcon: icon("fa-bell"),
    notificationsCount: 3,
    notificationsCountLabel: "3 unread notifications",
    powerState: "active",
    powerLabel: "Domain Rule",
    powerTitle: "Turn off this Domain Rule",
    powerTarget: "Turns this Domain Rule on or off.",
    powerAriaLabel: "Turn off this Domain Rule",
    ruleTitle: "Protected",
    ruleTone: "active",
    ruleAnimationTiming: "boosted",
    protectionSource: "Domain Rule",
    protectionSourcePattern: "browserleaks.com",
    protectionCounts: "10 protected · 2 not modified",
    protectionDetailsLabel: "View details",
    ruleActionLabel: "Edit Domain Rule",
    footerActions: footerActions.map((action) => ({ ...action })),
  },
};

export const Disabled: Story = {
  args: {
    title: BRAND_DISPLAY_NAME,
    brand: <BrandHorizontalLogo className="w-full" animateCursor animateIcon />,
    domain: "127.0.0.1",
    location: "No location yet",
    powerState: "disabled",
    powerLabel: "Restricted page",
    powerTitle: "Privacy Thing can’t access this page",
    powerTarget: "Privacy Thing can’t access this page.",
    powerDisabled: true,
    powerAriaLabel: "Privacy Thing can’t access this page",
    ruleTitle: "Protection status unavailable",
    ruleTone: "disabled",
    ruleAnimationTiming: "steady",
    protectionSource: "No active rule",
    protectionCounts: "11 unknown",
    footerActions: footerActions.map((action) => ({ ...action })),
  },
};

export const Warning: Story = {
  args: {
    title: BRAND_DISPLAY_NAME,
    brand: <BrandHorizontalLogo className="w-full" animateCursor animateIcon />,
    domain: "browserleaks.com",
    location: "New York",
    powerState: "warning",
    powerLabel: "Default Rule",
    powerTitle: "Turn off the Default Rule",
    powerTarget: "Controls sites without a Domain Rule or Trusted Site.",
    powerAriaLabel: "Turn off the Default Rule",
    ruleTitle: "Needs attention",
    ruleTone: "warning",
    ruleAnimationTiming: "boosted",
    ruleActionLabel: "Edit Default Rule",
    protectionSource: "Default Rule",
    protectionCounts: "10 protected · 2 not modified",
    protectionException: "This page may not work correctly",
    alertTitle: "Worker spoofing was blocked by this site",
    alertActionLabel: "Allow worker spoofing",
    footerActions: footerActions.map((action) => ({ ...action })),
  },
};

export const FirefoxContainer: Story = {
  args: {
    title: BRAND_DISPLAY_NAME,
    brand: <BrandHorizontalLogo className="w-full" animateCursor animateIcon />,
    domain: "browserleaks.com",
    location: "New York",
    powerState: "active",
    powerLabel: "Firefox Container",
    powerTitle: "Turn off this Firefox Container assignment",
    powerTarget: "Turns this Firefox Container assignment on or off.",
    powerDisabled: true,
    powerAriaLabel: "Turn off this Firefox Container assignment",
    ruleTitle: "Protected",
    ruleTone: "active",
    ruleAnimationTiming: "steady",
    ruleActionLabel: "Edit Container",
    ruleAccentColor: "#f97316",
    protectionSource: "Firefox Container",
    protectionCounts: "10 protected · 2 not modified",
    ruleFooterActionLabel: "Add Domain Rule",
    footerActions: footerActions.map((action) => ({ ...action })),
  },
};

export const TrustedSite: Story = {
  args: {
    title: BRAND_DISPLAY_NAME,
    brand: <BrandHorizontalLogo className="w-full" animateCursor animateIcon />,
    domain: "bank.example.com",
    powerState: "disabled",
    powerLabel: "Trusted Site",
    powerTitle: "Turn on Privacy Thing for this site",
    powerTarget: "Privacy Thing is off because this site matches Trusted Sites.",
    powerAriaLabel: "Turn on Privacy Thing for this site",
    ruleTitle: "Protections off",
    ruleTone: "disabled",
    ruleAnimationTiming: "steady",
    protectionSource: "Trusted Site",
    protectionCounts: "11 not modified",
    footerActions: footerActions.map((action) => ({ ...action })),
  },
};
