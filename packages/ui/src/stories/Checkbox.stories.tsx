import type { Meta, StoryObj } from "@storybook/react";

import { Checkbox } from "../ui/checkbox";

const meta: Meta<typeof Checkbox> = {
  title: "Components/Checkbox",
  component: Checkbox,
  tags: ["autodocs"],
  args: {
    "aria-label": "Example checkbox",
    onChange: () => undefined,
  },
  argTypes: {
    checked: {
      control: "radio",
      options: [true, false, "indeterminate"],
    },
    disabled: {
      control: "boolean",
    },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    checked: false,
  },
};

export const Checked: Story = {
  args: {
    checked: true,
  },
};

export const Indeterminate: Story = {
  args: {
    checked: "indeterminate",
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
    checked: false,
  },
};
