import type { Meta, StoryObj } from "@storybook/react";

import { FieldLabel } from "../ui/field-label";
import { Input } from "../ui/input";
import { NumberInput } from "../ui/number-input";

const meta = {
  title: "Components/FieldLabel",
  component: FieldLabel,
  tags: ["autodocs"],
} satisfies Meta<typeof FieldLabel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: "Name",
  },
  render: () => (
    <div className="w-full max-w-sm rounded-xl border border-border/60 bg-background p-4">
      <FieldLabel htmlFor="field-label-name">Name</FieldLabel>
      <Input id="field-label-name" defaultValue="Warsaw" />
    </div>
  ),
};

export const WithInfo: Story = {
  args: {
    children: "Radius (m)",
  },
  render: () => (
    <div className="w-full max-w-sm rounded-xl border border-border/60 bg-background p-4">
      <FieldLabel
        htmlFor="field-label-radius"
        infoLabel="What max coordinate radius means"
        info={
          <>
            <p>Sets how far spoofed coordinates may drift from this saved location.</p>
            <p>
              Websites can observe cadence and reported accuracy, but these values still
              stay inside this radius.
            </p>
          </>
        }
      >
        Radius (m)
      </FieldLabel>
      <NumberInput id="field-label-radius" value={50} step={10} stepper />
    </div>
  ),
};
