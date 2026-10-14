import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";

import type {
  CleanupPlan,
  CleanupReport,
  CleanupResource,
} from "@/experimental/control-d/contracts";
import { CleanupDialogView } from "@/experimental/control-d/ui-cleanup-dialog";

const endpoint: CleanupResource = {
  key: "p/endpoint/e",
  kind: "endpoint",
  id: "e",
  name: "PT Browser ABCDE-FGHJK",
  profileId: "p",
  disposition: "delete",
  reason: null,
  ruleHostnames: [],
  dependsOn: [],
};
const folder: CleanupResource = {
  ...endpoint,
  key: "p/folder/1",
  kind: "folder",
  id: "1",
  name: "PT ABCDE-FGHJK WAW",
  ruleHostnames: ["video.example.test", "shop.example.test"],
};
const skipped: CleanupResource = {
  ...folder,
  key: "p/folder/2",
  id: "2",
  name: "My renamed folder",
  disposition: "skipped",
  reason: "name-changed",
  ruleHostnames: ["keep.example.test"],
};
const plan: CleanupPlan = {
  token: "story-token",
  resources: [folder, skipped, endpoint],
};
const report: CleanupReport = {
  retryAvailable: true,
  results: [
    { resource: folder, status: "deleted", reason: null, message: null },
    { resource: skipped, status: "skipped", reason: "name-changed", message: null },
    {
      resource: endpoint,
      status: "failed",
      reason: null,
      message: "Control D cleanup request failed (HTTP 403).",
    },
  ],
};
const meta = {
  title: "Options/Control D cleanup",
  component: CleanupDialogView,
  args: {
    phase: "choice",
    plan: null,
    report: null,
    busy: false,
    error: null,
    close: fn(),
    disconnect: fn(),
    review: fn(),
    execute: fn(),
  },
  beforeEach: async ({ parameters }) => {
    if (import.meta.env.MODE === "test") {
      const { page } = await import("vitest/browser");
      await page.viewport(parameters.cleanupWidth ?? 1100, 960);
      await expect(window.innerWidth).toBe(parameters.cleanupWidth ?? 1100);
    }
  },
  parameters: { layout: "fullscreen", privacyThing: { surface: "options" } },
} satisfies Meta<typeof CleanupDialogView>;
export default meta;
type Story = StoryObj<typeof meta>;

const width360 = {
  cleanupWidth: 360,
  viewport: { defaultViewport: "mobile1" },
  chromatic: { viewports: [360] },
};
const width1100 = {
  cleanupWidth: 1100,
  viewport: { defaultViewport: "desktop" },
  chromatic: { viewports: [1100] },
};
const body = () => within(document.body);
const checkChoice: Story["play"] = async ({ args }) => {
  const keep = body().getByRole("radio", { name: /^Disconnect$/ });
  await expect(keep).toBeChecked();
  await userEvent.click(body().getByRole("button", { name: /^Disconnect$/ }));
  await expect(args.disconnect).toHaveBeenCalledOnce();
  await expect(args.execute).not.toHaveBeenCalled();
};
const checkPlan: Story["play"] = async () => {
  await waitFor(async () => {
    await expect(body().getByText(/My renamed folder/)).toBeVisible();
    await expect(
      body().getByText("The remote name no longer matches.", { exact: false }),
    ).toBeVisible();
  });
  await expect(document.querySelector("[data-cleanup-confirm]")).toBeDisabled();
};
const checkGate: Story["play"] = async ({ args }) => {
  const button = document.querySelector("[data-cleanup-confirm]");
  const checkbox = body().getByRole("checkbox", {
    name: "I have changed my browser’s DNS",
  });
  await expect(button).toBeDisabled();
  await userEvent.click(checkbox);
  await expect(button).toBeEnabled();
  await userEvent.click(checkbox);
  await expect(button).toBeDisabled();
  await expect(args.execute).not.toHaveBeenCalled();
};
const checkEnabled: Story["play"] = async ({ args }) => {
  await userEvent.click(
    body().getByRole("checkbox", { name: "I have changed my browser’s DNS" }),
  );
  const button = body().getByRole("button", {
    name: "Confirm deletion and disconnect",
  });
  await expect(button).toBeEnabled();
  await userEvent.click(button);
  await expect(args.execute).toHaveBeenCalledOnce();
};
const checkResults: Story["play"] = async ({ args }) => {
  await expect(document.querySelector("[data-cleanup-counts]")).toHaveTextContent(
    "Deleted: 1 · Skipped: 1 · Failed: 1",
  );
  await userEvent.click(
    body().getByRole("button", { name: "Review and retry failures" }),
  );
  await expect(args.review).toHaveBeenCalledOnce();
};

export const Choice360: Story = { parameters: width360, play: checkChoice };
export const Choice1100: Story = { parameters: width1100, play: checkChoice };
export const Plan360: Story = {
  parameters: width360,
  args: { phase: "plan", plan },
  play: checkPlan,
};
export const Plan1100: Story = {
  parameters: width1100,
  args: { phase: "plan", plan },
  play: checkPlan,
};
export const DnsGate360: Story = {
  parameters: width360,
  args: { phase: "plan", plan },
  play: checkGate,
};
export const DnsGate1100: Story = {
  parameters: width1100,
  args: { phase: "plan", plan },
  play: checkGate,
};
export const DnsEnabled360: Story = {
  parameters: width360,
  args: { phase: "plan", plan },
  play: checkEnabled,
};
export const DnsEnabled1100: Story = {
  parameters: width1100,
  args: { phase: "plan", plan },
  play: checkEnabled,
};
export const ResultFailure360: Story = {
  parameters: width360,
  args: { phase: "result", report },
  play: checkResults,
};
export const ResultFailure1100: Story = {
  parameters: width1100,
  args: { phase: "result", report },
  play: checkResults,
};
