import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";

import { BRAND_DISPLAY_NAME } from "@/shared/brand";
import { FieldLabel } from "@/ui/components/ui/field-label";
import { NumberInput } from "@/ui/components/ui/number-input";

const meta = {
  title: "Components/NumberInput",
  component: NumberInput,
  tags: ["autodocs"],
} satisfies Meta<typeof NumberInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { placeholder: "Enter number..." },
};

export const WithStepper: Story = {
  args: { placeholder: "0", stepper: true, step: 1 },
};

function LatitudeExample() {
  const [value, setValue] = useState<number | "">(48.8566);
  return (
    <div className="grid w-full max-w-sm items-center gap-1.5">
      <FieldLabel htmlFor="latitude-input">Latitude</FieldLabel>
      <NumberInput
        id="latitude-input"
        aria-label="Latitude"
        value={value}
        onChange={setValue}
        decimalScale={6}
        min={-90}
        max={90}
        step={0.001}
        stepper
        placeholder="0.000000"
      />
      <p className="text-xs text-muted-foreground">Value: {String(value)}</p>
    </div>
  );
}

export const Latitude: Story = {
  render: () => <LatitudeExample />,
};

function AccuracyExample() {
  const [value, setValue] = useState<number | "">(25);
  return (
    <div className="grid w-full max-w-sm items-center gap-1.5">
      <FieldLabel
        htmlFor="accuracy-input"
        info={
          <>
            <p>Controls the accuracy value websites see in geolocation results.</p>
            <p>
              In the simple engine, {BRAND_DISPLAY_NAME} gently randomizes the reported
              value around this baseline so it looks less static. It does not control
              how far the spoofed point can move.
            </p>
          </>
        }
        infoLabel="What accuracy means"
      >
        Accuracy (m)
      </FieldLabel>
      <NumberInput
        id="accuracy-input"
        aria-label="Accuracy"
        value={value}
        onChange={setValue}
        min={0}
        max={10000}
        step={5}
        stepper
      />
    </div>
  );
}

export const Accuracy: Story = {
  render: () => <AccuracyExample />,
};

export const Disabled: Story = {
  args: { value: 42, stepper: true, disabled: true, "aria-label": "Value" },
};
