import type { Meta, StoryObj } from "@storybook/react";

import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";

const meta = {
  title: "Components/Textarea",
  component: Textarea,
  tags: ["autodocs"],
} satisfies Meta<typeof Textarea>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    placeholder: "Write a short description...",
    className: "max-w-md",
  },
};

export const WithLabel: Story = {
  render: () => (
    <div className="grid w-full max-w-md gap-1.5">
      <Label variant="field" htmlFor="profile-notes">
        Description
      </Label>
      <Textarea
        id="profile-notes"
        placeholder="Summarize cadence, accuracy, or any special notes."
      />
    </div>
  ),
};
