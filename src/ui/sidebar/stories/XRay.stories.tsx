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
import {
  expectDialogCoversPanel,
  expectHeaderClearsClose,
  expectNoSideScroll,
  expectVisibleDialogFrame,
} from "@/ui/shared/dialog-overflow-assertion";
import { expectNoClippedText, withUiLocale } from "@/ui/shared/story-locale";

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

export const DiagnosticReport: Story = {
  args: { scenario: "evidence-states" },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole("button", { name: t.sidebar.report.prepare }),
    );
    const dialog = within(canvasElement.ownerDocument.body);
    await expect(dialog.getByRole("dialog")).toHaveAttribute(
      "data-report-site",
      "excluded",
    );
    const preview = dialog.getByRole("textbox", {
      name: t.sidebar.report.preview,
    }) as HTMLTextAreaElement;
    await expect(preview.value).not.toContain("maps.example.test");
    await userEvent.click(dialog.getByRole("checkbox"));
    await expect(dialog.getByRole("dialog")).toHaveAttribute(
      "data-report-site",
      "included",
    );
    await expect(preview.value).toContain("maps.example.test");
  },
};

export const ReportNoSideScroll: Story = {
  args: { scenario: "evidence-states" },
  tags: ["!dev", "!autodocs"],
  play: async ({ canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole("button", { name: t.sidebar.report.prepare }),
    );
    expectNoSideScroll(within(canvasElement.ownerDocument.body).getByRole("dialog"));
  },
};

/** Short panels the report must fit without covering or hiding its actions. */
const SHORT_PANELS_PX = [
  [360, 520],
  [720, 480],
] as const;

export const ReportFillsPanel: Story = {
  args: { scenario: "evidence-states" },
  tags: ["!dev", "!autodocs"],
  play: async ({ canvasElement }) => {
    await userEvent.click(
      within(canvasElement).getByRole("button", { name: t.sidebar.report.prepare }),
    );
    const dialog = within(canvasElement.ownerDocument.body).getByRole("dialog");
    expectVisibleDialogFrame(dialog);
    expectDialogCoversPanel(dialog);
    expectHeaderClearsClose(dialog);

    // The preview shrinks first: it never runs into the actions, which stay in view.
    const body = canvasElement.ownerDocument.body;
    const preview = dialog.querySelector<HTMLElement>("[data-report-preview]")!;
    const actions = dialog.querySelector<HTMLElement>("[data-report-cancel]")!;
    try {
      body.style.transform = "translateZ(0)";
      for (const [width, height] of SHORT_PANELS_PX) {
        body.style.width = `${width}px`;
        body.style.height = `${height}px`;
        body.style.minHeight = "0";
        await expect(
          preview.offsetTop + preview.offsetHeight,
          `preview end on a ${width}x${height} panel`,
        ).toBeLessThan(actions.offsetTop);
        await expect(dialog.scrollHeight, `report scroll on ${width}x${height}`).toBe(
          dialog.clientHeight,
        );
      }
    } finally {
      body.style.removeProperty("transform");
      body.style.removeProperty("width");
      body.style.removeProperty("height");
      body.style.removeProperty("min-height");
    }
  },
};

const expectChineseFits: Story["play"] = ({ canvasElement }) => {
  const shell = canvasElement.querySelector<HTMLElement>("main");
  if (!shell) throw new globalThis.Error("Missing story shell.");
  expectNoClippedText(shell);
};

/** Sidebar at its 360 px design width with the Chinese catalogs. */
export const ZhHansDark: Story = {
  args: { scenario: "evidence-states" },
  globals: { theme: "dark" },
  decorators: [withUiLocale("zh-CN")],
  play: expectChineseFits,
};
export const ZhHantDark: Story = {
  args: { scenario: "evidence-states" },
  globals: { theme: "dark" },
  decorators: [withUiLocale("zh-TW")],
  play: expectChineseFits,
};
