import type { Meta, StoryObj } from "@storybook/react";

import { Label } from "../ui/label";
import { Switch } from "../ui/switch";

const meta = {
  title: "Components/Switch",
  component: Switch,
  tags: ["autodocs"],
  args: { "aria-label": "Example setting" },
} satisfies Meta<typeof Switch>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Checked: Story = {
  args: { defaultChecked: true },
};

export const WithLabel: Story = {
  render: () => (
    <div className="flex items-center space-x-2">
      <Switch id="debug" />
      <Label htmlFor="debug">Debug Mode</Label>
    </div>
  ),
};

export const Disabled: Story = {
  args: { disabled: true },
};
