import type { Meta, StoryObj } from "@storybook/react";

import { Progress } from "../ui/progress";

const meta = {
  title: "Components/Progress",
  component: Progress,
  tags: ["autodocs"],
  args: { "aria-label": "Progress" },
} satisfies Meta<typeof Progress>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { value: 60, className: "w-[300px]" },
};

export const Empty: Story = {
  args: { value: 0, className: "w-[300px]" },
};

export const Full: Story = {
  args: { value: 100, className: "w-[300px]" },
};
