import type { Meta, StoryObj } from "@storybook/react";
import type { CSSProperties } from "react";

import { BRAND_DISPLAY_NAME } from "@/shared/brand";
import { BrandLogo } from "@/ui/branding/BrandLogo";

const meta = {
  title: "Brand/BrandLogo",
  component: BrandLogo,
  tags: ["autodocs"],
} satisfies Meta<typeof BrandLogo>;

export default meta;
type Story = StoryObj<typeof meta>;

const themePreviewStyle = ({
  background,
  foreground,
  primary,
}: {
  background: string;
  foreground: string;
  primary: string;
}): CSSProperties =>
  ({
    "--background": background,
    "--foreground": foreground,
    "--primary": primary,
  }) as CSSProperties;

export const LightAndDark: Story = {
  args: {
    className: "w-[280px] max-w-full",
    title: BRAND_DISPLAY_NAME,
  },
  render: (args) => (
    <div className="grid gap-4 lg:grid-cols-2">
      <div
        data-theme="light"
        className="rounded-xl bg-background p-8"
        style={themePreviewStyle({
          background: "0 0% 100%",
          foreground: "240 10% 5%",
          primary: "165 82% 28%",
        })}
      >
        <BrandLogo {...args} />
      </div>
      <div
        data-theme="dark"
        className="rounded-xl bg-background p-8"
        style={themePreviewStyle({
          background: "220 14% 7%",
          foreground: "0 0% 96%",
          primary: "168 70% 46%",
        })}
      >
        <BrandLogo {...args} />
      </div>
    </div>
  ),
};

export const Accent: Story = {
  args: {
    className: "w-[280px] max-w-full",
    tone: "accent",
  },
};

export const BlinkingAccent: Story = {
  args: {
    className: "w-[280px] max-w-full",
    tone: "accent",
    animateCursor: true,
  },
};

export const AnimatedAccent: Story = {
  args: {
    className: "w-[280px] max-w-full",
    tone: "accent",
    animateCursor: true,
    animateIcon: true,
  },
};

export const PointerTrackingThing: Story = {
  args: {
    className: "w-[280px] max-w-full",
    tone: "accent",
    animateCursor: true,
    animateIcon: true,
    trackThingPointer: true,
  },
};
