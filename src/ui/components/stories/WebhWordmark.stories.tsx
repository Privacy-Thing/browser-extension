import type { Meta, StoryObj } from "@storybook/react";

import { WebhWordmark } from "@/ui/branding/WebhWordmark";

const meta = {
  title: "Brand/WebhWordmark",
  component: WebhWordmark,
  tags: ["autodocs"],
} satisfies Meta<typeof WebhWordmark>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    className: "w-[280px] max-w-full",
  },
};

export const CustomLetters: Story = {
  args: {
    className: "w-[280px] max-w-full",
    colorOverrides: {
      letters: "#0f766e",
    },
  },
};
