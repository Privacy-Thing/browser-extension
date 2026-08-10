import type { Meta, StoryObj } from "@storybook/react";

import { FieldLabel } from "../ui/field-label";
import { Input } from "../ui/input";

const meta = {
  title: "Components/Input",
  component: Input,
  tags: ["autodocs"],
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { placeholder: "Enter text..." },
};

export const WithLabel: Story = {
  render: () => (
    <div className="grid w-full max-w-sm items-center gap-1.5">
      <FieldLabel htmlFor="email">Email</FieldLabel>
      <Input type="email" id="email" placeholder="Email" />
    </div>
  ),
};

export const Disabled: Story = {
  args: { placeholder: "Disabled", disabled: true },
};

export const WithValue: Story = {
  args: { defaultValue: "48.8566", "aria-label": "Latitude" },
};

export const File: Story = {
  args: { type: "file", "aria-label": "Import settings" },
};
