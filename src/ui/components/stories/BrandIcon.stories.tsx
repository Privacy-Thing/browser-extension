import type { Meta, StoryObj } from "@storybook/react";

import { BRAND_DISPLAY_NAME } from "@/shared/brand";
import { BrandIcon } from "@/ui/branding/BrandIcon";

const meta = {
  title: "Brand/BrandIcon",
  component: BrandIcon,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="rounded-[2rem] bg-background p-8">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof BrandIcon>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    className: "w-32",
  },
};

export const Accent: Story = {
  args: {
    className: "w-32",
    title: `${BRAND_DISPLAY_NAME} icon`,
    tone: "accent",
  },
};
