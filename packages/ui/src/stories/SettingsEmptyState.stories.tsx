import type { Meta, StoryObj } from "@storybook/react";

import { SettingsEmptyState } from "../SettingsEmptyState";
import { Button } from "../ui/button";

const meta = {
  title: "Components/SettingsEmptyState",
  component: SettingsEmptyState,
  tags: ["autodocs"],
} satisfies Meta<typeof SettingsEmptyState>;

export default meta;
type Story = StoryObj<typeof meta>;

export const PlainCentered: Story = {
  args: {
    centered: true,
    description: "No matching rules found for the current filters.",
  },
};

export const MutedWithActions: Story = {
  args: {
    variant: "muted",
    title: "Containers are unavailable",
    description:
      "Firefox container APIs are only exposed when the browser target supports contextual identities.",
    hint: "Refresh after enabling the relevant runtime support.",
    actions: (
      <Button variant="outline" size="sm">
        Refresh
      </Button>
    ),
  },
};
