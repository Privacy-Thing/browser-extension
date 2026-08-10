import type { Meta, StoryObj } from "@storybook/react";
import type { CSSProperties } from "react";

import { BrandWordmark } from "@/ui/branding/BrandWordmark";

const meta = {
  title: "Brand/BrandWordmark",
  component: BrandWordmark,
  tags: ["autodocs"],
} satisfies Meta<typeof BrandWordmark>;

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
    className: "w-[320px] max-w-full",
  },
  render: (args) => (
    <div className="grid gap-4 lg:grid-cols-2">
      <div
        data-theme="light"
        className="rounded-xl bg-background p-8"
        style={previewStyle({ background: "0 0% 100%", foreground: "240 10% 5%" })}
      >
        <BrandWordmark {...args} />
      </div>
      <div
        data-theme="dark"
        className="rounded-xl bg-background p-8"
        style={previewStyle({ background: "220 14% 7%", foreground: "0 0% 96%" })}
      >
        <BrandWordmark {...args} />
      </div>
    </div>
  ),
};

export const SmallSurfaces: Story = {
  render: () => (
    <div className="flex flex-col items-start gap-8 rounded-xl bg-background p-8 text-foreground">
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">Popup · 112 px</p>
        <BrandWordmark width={112} />
      </div>
    </div>
  ),
};
