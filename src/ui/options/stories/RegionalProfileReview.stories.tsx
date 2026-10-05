import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, within } from "storybook/test";

import { RegionalProfileReview } from "@/ui/options/components/modals/RegionalProfileReview";

const meta = {
  title: "Options/Regional profile review",
  component: RegionalProfileReview,
  args: {
    profile: {
      latitude: 48.85,
      longitude: 2.35,
      timeZone: "Asia/Tokyo",
      language: "fr-FR",
      languages: ["fr-FR", "fr", "en-US"],
      preferEnglishContent: true,
    },
    disabled: false,
    applyTimeZone: fn(),
  },
  decorators: [
    (Story) => (
      <div className="max-w-md p-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof RegionalProfileReview>;
export default meta;
type Story = StoryObj<typeof meta>;

export const GeographicWarning: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole("status")).toBeVisible();
    await expect(args.applyTimeZone).not.toHaveBeenCalled();
    await userEvent.click(canvasElement.querySelector("summary")!);
    await expect(canvasElement.querySelector("[data-regional-preview]")).toBeVisible();
    await userEvent.click(
      canvasElement.querySelector("[data-regional-apply-timezone]")!,
    );
    await expect(args.applyTimeZone).toHaveBeenCalledWith("Europe/Paris");
  },
};
export const EnglishPreference: Story = {
  args: { profile: { ...meta.args.profile, timeZone: "Europe/Paris" } },
  play: async ({ canvasElement }) => {
    await userEvent.click(canvasElement.querySelector("summary")!);
    await expect(canvasElement.querySelector("[data-regional-preview]")).toBeVisible();
    await expect(canvasElement.querySelector("[data-regional-warning]")).toBeNull();
  },
};
export const Busy: Story = {
  args: { disabled: true },
  play: async ({ canvasElement }) => {
    await expect(
      canvasElement.querySelector("[data-regional-apply-timezone]"),
    ).toBeDisabled();
  },
};
