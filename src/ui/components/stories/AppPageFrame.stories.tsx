import type { Meta, StoryObj } from "@storybook/react";

import { Button } from "@/ui/components/ui/button";
import { AppPageFrame } from "@/ui/shared/AppPageFrame";

const meta = {
  title: "Layout/AppPageFrame",
  component: AppPageFrame,
  tags: ["autodocs"],
} satisfies Meta<typeof AppPageFrame>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    title: "Settings",
    children: <></>,
  },
  render: () => (
    <AppPageFrame
      title="Settings"
      lead="Preview of the shared page frame after the rebrand."
      headerAside={<Button size="sm">Action</Button>}
    >
      <div className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground">
        Example page content.
      </div>
    </AppPageFrame>
  ),
};
