import type { Meta, StoryObj } from "@storybook/react";

import { AnimatedBarcode, type AnimatedBarcodeBar } from "../ui/animated-barcode";

const wideBars = [
  {
    x: 6,
    width: 2,
    shift: 6,
    duration: 5.4,
    delay: -1.8,
    easing: "ease",
    direction: "alternate",
  },
  {
    x: 17,
    width: 5,
    shift: 9,
    duration: 7.2,
    delay: -5.9,
    easing: "ease-in-out",
    direction: "alternate-reverse",
  },
  {
    x: 31,
    width: 2,
    shift: 8,
    duration: 5.9,
    delay: -3.4,
    easing: "ease-in",
    direction: "alternate",
  },
  {
    x: 42,
    width: 10,
    shift: 12,
    duration: 9.1,
    delay: -7.5,
    easing: "cubic-bezier(.22,.61,.36,1)",
    direction: "alternate-reverse",
  },
  {
    x: 68,
    width: 3,
    shift: 10,
    duration: 6.6,
    delay: -2.6,
    easing: "ease-out",
    direction: "alternate",
  },
  {
    x: 82,
    width: 14,
    shift: 16,
    duration: 11.3,
    delay: -9.7,
    easing: "cubic-bezier(.4,0,.2,1)",
    direction: "alternate-reverse",
  },
  {
    x: 113,
    width: 2,
    shift: 11,
    duration: 5.1,
    delay: -4.8,
    easing: "linear",
    direction: "alternate",
  },
  {
    x: 127,
    width: 7,
    shift: 14,
    duration: 8.4,
    delay: -6.9,
    easing: "ease-in-out",
    direction: "alternate",
  },
  {
    x: 151,
    width: 4,
    shift: 12,
    duration: 7.0,
    delay: -6.1,
    easing: "cubic-bezier(.16,1,.3,1)",
    direction: "alternate-reverse",
  },
  {
    x: 165,
    width: 16,
    shift: 18,
    duration: 12.0,
    delay: -10.5,
    easing: "ease",
    direction: "alternate",
  },
  {
    x: 204,
    width: 2,
    shift: 9,
    duration: 5.7,
    delay: -3.2,
    easing: "ease-in",
    direction: "alternate-reverse",
  },
  {
    x: 218,
    width: 8,
    shift: 15,
    duration: 9.4,
    delay: -8.1,
    easing: "cubic-bezier(.65,0,.35,1)",
    direction: "alternate",
  },
  {
    x: 249,
    width: 3,
    shift: 10,
    duration: 7.5,
    delay: -4.7,
    easing: "ease-out",
    direction: "alternate-reverse",
  },
  {
    x: 266,
    width: 2,
    shift: 7,
    duration: 6.2,
    delay: -5.3,
    easing: "cubic-bezier(.3,0,.1,1)",
    direction: "alternate",
  },
  {
    x: 282,
    width: 9,
    shift: 9,
    duration: 8.1,
    delay: -6.8,
    easing: "ease-in-out",
    direction: "alternate-reverse",
  },
] as const satisfies readonly AnimatedBarcodeBar[];

const meta = {
  title: "Components/AnimatedBarcode",
  component: AnimatedBarcode,
  argTypes: {
    width: { control: { type: "number", min: 48, max: 360, step: 1 } },
    height: { control: { type: "number", min: 32, max: 160, step: 1 } },
    barColor: { control: "color" },
    backgroundColor: { control: "color" },
    borderColor: { control: "color" },
    bars: { control: false },
  },
  tags: ["autodocs"],
} satisfies Meta<typeof AnimatedBarcode>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Compact: Story = {
  args: {
    width: 100,
    height: 70,
    barColor: "#000000",
    backgroundColor: "#ffffff",
    borderColor: "#000000",
  },
};

export const TokenColor: Story = {
  args: {
    width: 100,
    height: 70,
    barColor: "hsl(var(--foreground))",
    backgroundColor: "hsl(var(--background))",
    borderColor: "hsl(var(--border))",
  },
};

export const Wide: Story = {
  args: {
    width: 300,
    height: 88,
    bars: wideBars,
    barColor: "#000000",
    backgroundColor: "#ffffff",
    borderColor: "#000000",
  },
};
