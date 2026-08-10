import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";

import { Slider } from "../ui/slider";

const meta = {
  title: "Components/Slider",
  component: Slider,
  tags: ["autodocs"],
} satisfies Meta<typeof Slider>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    "aria-label": "Value",
    defaultValue: [50],
    max: 100,
    step: 1,
    className: "w-[300px]",
  },
};

export const Range: Story = {
  args: {
    "aria-label": "Range",
    defaultValue: [103, 501],
    min: 10,
    max: 1000,
    step: 1,
    className: "w-[300px]",
  },
};

export const WithLabel: Story = {
  render: () => (
    <Slider
      className="w-full max-w-sm"
      label="Watch Position Delay (s)"
      valueLabel="103s – 501s"
      minLabel="10s"
      maxLabel="1000s"
      defaultValue={[103, 501]}
      min={10}
      max={1000}
      step={1}
      aria-label="Watch position delay"
    />
  ),
};

export const Controlled: Story = {
  render: () => {
    const [value, setValue] = useState<[number, number]>([103, 501]);

    return (
      <Slider
        className="w-full max-w-sm"
        label="Watch Position Delay (s)"
        valueLabel={`${value[0]}s – ${value[1]}s`}
        minLabel="10s"
        maxLabel="1000s"
        value={value}
        min={10}
        max={1000}
        step={1}
        aria-label="Delay range"
        onValueChange={(next) => {
          setValue((current) => {
            const nextMin = next[0];
            const nextMax = next[1];
            return [
              nextMin === undefined ? current[0] : nextMin,
              nextMax === undefined ? current[1] : nextMax,
            ];
          });
        }}
      />
    );
  },
};

export const SettingsRange: Story = {
  render: () => {
    const [value, setValue] = useState<[number, number]>([103, 478]);

    return (
      <div className="w-full max-w-2xl rounded-xl border border-dashed p-6">
        <Slider
          aria-label="Delay range"
          valueLabel={`${value[0]}s – ${value[1]}s`}
          minLabel="1s"
          maxLabel="600s"
          value={value}
          min={1}
          max={600}
          step={1}
          onValueChange={(next) => {
            setValue((current) => {
              const nextMin = next[0];
              const nextMax = next[1];
              return [
                nextMin === undefined ? current[0] : nextMin,
                nextMax === undefined ? current[1] : nextMax,
              ];
            });
          }}
        />
      </div>
    );
  },
};
