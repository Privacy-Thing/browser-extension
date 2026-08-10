import type { Meta, StoryObj } from "@storybook/react";
import type { CSSProperties } from "react";

import { BrandHorizontalLogo } from "@/ui/branding/BrandHorizontalLogo";

const meta = {
  title: "Brand/BrandHorizontalLogo",
  component: BrandHorizontalLogo,
  tags: ["autodocs"],
} satisfies Meta<typeof BrandHorizontalLogo>;

export default meta;
type Story = StoryObj<typeof meta>;

const previewStyle = ({
  background,
  foreground,
}: {
  background: string;
  foreground: string;
}): CSSProperties =>
  ({
    "--background": background,
    "--foreground": foreground,
  }) as CSSProperties;

export const LightAndDark: Story = {
  args: {
    className: "w-[360px] max-w-full",
    animateCursor: true,
  },
  render: (args) => (
    <div className="grid gap-4 lg:grid-cols-2">
      <div
        data-theme="light"
        className="rounded-xl bg-background p-8"
        style={previewStyle({ background: "0 0% 100%", foreground: "240 10% 5%" })}
      >
        <BrandHorizontalLogo {...args} />
      </div>
      <div
        data-theme="dark"
        className="rounded-xl bg-background p-8"
        style={previewStyle({ background: "220 14% 7%", foreground: "0 0% 96%" })}
      >
        <BrandHorizontalLogo {...args} />
      </div>
    </div>
  ),
};

export const PopupSize: Story = {
  render: () => (
    <div className="rounded-xl bg-background p-8 text-foreground">
      <p className="mb-2 text-xs text-muted-foreground">Popup · 112 px</p>
      <BrandHorizontalLogo width={112} animateCursor />
    </div>
  ),
};

export const AnimatedAccent: Story = {
  args: {
    className: "w-[360px] max-w-full",
    tone: "accent",
    animateCursor: true,
    animateIcon: true,
  },
  render: (args) => (
    <div className="rounded-xl bg-background p-8 text-foreground">
      <BrandHorizontalLogo {...args} />
    </div>
  ),
};

export const Zz: Story = {
  args: {
    className: "w-[360px] max-w-full",
    animateCursor: true,
    animateIcon: true,
    thingPose: "zz",
  },
};
