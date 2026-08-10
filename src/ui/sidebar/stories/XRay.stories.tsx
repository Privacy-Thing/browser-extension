import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within } from "storybook/test";

import "@fortawesome/fontawesome-free/css/fontawesome.css";
import "@fortawesome/fontawesome-free/css/solid.css";

import "../sidebar.css";

import {
  createXRayStoryState,
  XRAY_STORY_SCENARIOS,
  type XRayStoryScenario,
} from "./xray-story-fixtures";
import { XRayStoryShell } from "./XRayStoryShell";

import { t } from "@/ui/i18n";

type XRayStoryHarnessProps = {
  scenario: XRayStoryScenario;
};

const XRayStoryHarness = ({ scenario }: XRayStoryHarnessProps) => (
  <XRayStoryShell
    state={createXRayStoryState(scenario)}
    surfaceSyncPending={scenario === "syncing"}
  />
);

const meta = {
  title: "Sidebar/XRay",
  component: XRayStoryHarness,
  parameters: {
    privacyThing: { surface: "sidebar" },
  },
  args: { scenario: "active" },
  argTypes: {
    scenario: { control: "select", options: XRAY_STORY_SCENARIOS },
  },
} satisfies Meta<typeof XRayStoryHarness>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Interactive: Story = {};

export const InteractionTest: Story = {
  ...Interactive,
  tags: ["!dev", "!autodocs"],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole("button", { name: t.sidebar.openSettings }));
    await expect(canvas.getByRole("status")).toHaveTextContent(t.sidebar.openSettings);
  },
};
export const Active: Story = {
  args: { scenario: "active" },
  play: async ({ canvasElement }) => {
    const sections = Array.from(
      canvasElement.querySelectorAll<HTMLElement>("[data-xray-section]"),
    ).map((section) => section.dataset.xraySection);

    await expect(sections).toEqual([
      "page-activity",
      "spoofing-snapshot",
      "rule-explanation",
    ]);
  },
};
export const Syncing: Story = { args: { scenario: "syncing" } };
export const PartiallyDisabled: Story = { args: { scenario: "partially-disabled" } };
export const Error: Story = { args: { scenario: "error" } };
export const TrustedSite: Story = { args: { scenario: "trusted-site" } };
