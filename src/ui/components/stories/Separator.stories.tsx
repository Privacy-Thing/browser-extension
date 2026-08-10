import type { Meta, StoryObj } from "@storybook/react";

import { BRAND_DISPLAY_NAME } from "@/shared/brand";
import { Separator } from "@/ui/components/ui/separator";

const meta = {
  title: "Components/Separator",
  component: Separator,
  tags: ["autodocs"],
} satisfies Meta<typeof Separator>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Horizontal: Story = {
  render: () => (
    <div className="w-[300px]">
      <div className="space-y-1">
        <h4 className="text-sm font-medium leading-none">
          {BRAND_DISPLAY_NAME} Settings
        </h4>
        <p className="text-sm text-muted-foreground">
          Manage your extension configuration.
        </p>
      </div>
      <Separator className="my-4" />
      <div className="text-sm text-muted-foreground">Advanced options below</div>
    </div>
  ),
};

export const Vertical: Story = {
  render: () => (
    <div className="flex h-5 items-center space-x-4 text-sm">
      <div>Locations</div>
      <Separator orientation="vertical" />
      <div>Rules</div>
      <Separator orientation="vertical" />
      <div>Profiles</div>
    </div>
  ),
};
