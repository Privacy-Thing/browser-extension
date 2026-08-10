import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";
import "@fortawesome/fontawesome-free/css/fontawesome.css";
import "@fortawesome/fontawesome-free/css/solid.css";
import "../popup.css";

import { PopupContainerBadge } from "../components/PopupContainerBadge";
import { PopupFooter } from "../components/PopupFooter";
import { PopupRuleCard } from "../components/PopupRuleCard";
import { PopupRuleSheet } from "../components/PopupRuleSheet";

import { icon } from "@/ui/options/utils";

const meta = {
  title: "Popup/Sections",
  component: PopupRuleCard,
  tags: ["autodocs"],
} satisfies Meta<typeof PopupRuleCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ActiveRuleCard: Story = {
  args: {
    title: "Active Rule",
    tone: "active",
    summarySource: "Domain Rule",
  },
  render: () => (
    <div className="w-full">
      <PopupRuleCard
        title="Protected"
        tone="active"
        summarySource="Domain Rule"
        summarySourcePattern="browserleaks.com"
        summaryCounts="10 protected · 2 not modified"
        detailsLabel="View details"
      />
    </div>
  ),
};

export const WarningRuleCard: Story = {
  args: {
    title: "Active Rule",
    tone: "warning",
    summarySource: "Domain Rule",
  },
  render: () => (
    <div className="w-full">
      <PopupRuleCard
        title="Needs attention"
        tone="warning"
        summarySource="Domain Rule"
        summarySourcePattern="browserleaks.com"
        summaryCounts="9 protected · 3 not modified"
      />
    </div>
  ),
};

export const ContainerDerivedRuleCard: Story = {
  args: {
    title: "Routing Source",
    tone: "active",
    summarySource: "Firefox Container",
  },
  render: () => (
    <div className="w-full">
      <PopupRuleCard
        title="Protected"
        tone="active"
        accentColor="#f97316"
        summarySource="Firefox Container"
        summaryProfile="New York"
        summaryLanguage="English (United States)"
        summaryLanguageTitle={
          "Language priority:\n1. English (United States)\n2. English"
        }
        summaryCounts="10 protected · 2 not modified"
      />
    </div>
  ),
};

export const ContainerBadge: Story = {
  args: {
    title: "Active Rule",
    tone: "active",
    summarySource: "Domain Rule",
  },
  render: () => <PopupContainerBadge name="Work" colorCode="#c2410c" />,
};

export const Footer: Story = {
  args: {
    title: "Active Rule",
    tone: "active",
    summarySource: "Domain Rule",
  },
  render: () => (
    <div className="w-full rounded-[2rem] border border-border bg-card text-card-foreground">
      <PopupFooter
        actions={[
          {
            label: "X-Ray",
            icon: icon("fa-stethoscope"),
          },
          {
            label: "New identity",
            icon: icon("fa-user-secret"),
          },
          {
            label: "Settings",
            icon: icon("fa-gear"),
          },
        ]}
      />
    </div>
  ),
};

function RuleSheetExample() {
  const [serviceWorkerOverride, setServiceWorkerOverride] = useState<
    boolean | undefined
  >();
  const [workerHandlingOverride, setWorkerOverride] = useState<
    "native" | "spoof" | "strict" | undefined
  >();

  return (
    <div
      className="gw-popup-layout flex min-h-[620px] w-[720px] flex-row-reverse overflow-hidden rounded-[2rem] border border-border bg-background"
      data-sizing-state="sidecar"
      data-workspace-open="true"
    >
      <div className="gw-popup-core-pane w-[360px] shrink-0 border-l border-border p-5">
        <PopupRuleCard
          title="Protected"
          tone="active"
          summarySource="Default Rule"
          summaryCounts="10 protected · 2 not modified"
          detailsLabel="View details"
        />
      </div>
      <PopupRuleSheet
        open
        view="rule-form"
        title="browserleaks.com"
        titleTooltip="browserleaks.com"
        description="Choose where this Domain Rule applies and which Regional Preset it uses. Changing the preset reloads the page."
        selectedLocationId={null}
        allowInheritedLocation
        inheritedLocationLabel="Use Default Rule preset"
        noPresetLabel="No preset"
        locations={[
          { id: "new-york", label: "New York" },
          { id: "warsaw", label: "Warsaw" },
        ]}
        ruleMode="suffix"
        relaxCspForWorkers={false}
        serviceWorkerOverride={serviceWorkerOverride}
        onServiceWorkerChange={setServiceWorkerOverride}
        workerHandlingOverride={workerHandlingOverride}
        onWorkerChange={setWorkerOverride}
        locationLabel="Regional preset"
        ruleTypeLabel="Applies to"
        exactLabel="Exact host"
        suffixLabel="Host + subdomains"
        advancedTitle="Advanced"
        serviceWorkerLabel="Service Workers"
        serviceWorkerHint="Block, inherit, or allow Service Worker registration for this rule."
        serviceWorkerBlockLabel="Block"
        serviceWorkerInherit="Inherit"
        serviceWorkerAllowLabel="Allow"
        workerHandlingLabel="Dedicated & Shared Workers"
        workerHandlingHint="Override worker handling for this rule."
        workerInherit="Inherit"
        workerNative="Native"
        workerHandlingSpoofLabel="Spoof"
        workerStrict="Strict"
        relaxCspLabel="Relax CSP for worker spoofing"
        relaxCspHint="This removes Content-Security-Policy response headers so worker spoofing can run. It weakens the site’s protection against injected scripts; enable it only for a site you trust."
        detailsAriaLabel={(label) => `Details about ${label}`}
        fullSettingsLabel="Open in Domain Rules"
        saveLabel="Save"
        deleteLabel="Delete"
        closeAriaLabel="Close Domain Rule"
        closeLabel="Close"
        backLabel="Back"
        cancelLabel="Cancel"
        canDelete
        canSave
        onRequestDelete={() => undefined}
      />
    </div>
  );
}

export const RuleSheet: Story = {
  parameters: { privacyThing: { surface: "component" } },
  args: {
    title: "Active Rule",
    tone: "active",
    summarySource: "Domain Rule",
  },
  render: () => <RuleSheetExample />,
};

export const RuleSheetAdvancedHover: Story = {
  ...RuleSheet,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const advanced = canvas.getByRole("button", { name: "Advanced" });

    await userEvent.hover(advanced);
    await expect(advanced).toHaveAttribute("aria-expanded", "false");
  },
};

export const RuleSheetWorkerTest: Story = {
  ...RuleSheet,
  tags: ["!dev", "!autodocs"],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Advanced" }));

    const workerModes = canvas.getByRole("group", {
      name: "Dedicated & Shared Workers",
    });
    const strict = within(workerModes).getByRole("button", { name: "Strict" });

    await userEvent.click(strict);
    await expect(strict).toHaveAttribute("aria-pressed", "true");
  },
};

export const RuleSheetTooltipTest: Story = {
  ...RuleSheet,
  tags: ["!dev", "!autodocs"],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: "Advanced" }));
    const details = canvas.getByRole("button", {
      name: "Details about Service Workers",
    });
    await userEvent.hover(details);

    const body = within(canvasElement.ownerDocument.body);
    const tooltip = await body.findByRole("tooltip");
    const bounds = tooltip.getBoundingClientRect();
    const ownerWindow = canvasElement.ownerDocument.defaultView;
    if (!ownerWindow) throw new Error("Missing Storybook window.");
    expect(bounds.left).toBeGreaterThanOrEqual(8);
    expect(bounds.top).toBeGreaterThanOrEqual(8);
    expect(bounds.right).toBeLessThanOrEqual(ownerWindow.innerWidth - 8);
    expect(bounds.bottom).toBeLessThanOrEqual(ownerWindow.innerHeight - 8);

    const allow = canvas.getByRole("button", { name: "Allow" });
    await userEvent.click(allow);
    await expect(allow).toHaveAttribute("aria-pressed", "true");
  },
};
