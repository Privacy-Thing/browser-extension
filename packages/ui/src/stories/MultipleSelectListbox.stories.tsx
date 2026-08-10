import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";

import {
  MultipleSelectListbox,
  type MultiSelectOption,
} from "../ui/multiple-select-listbox";

const options: MultiSelectOption[] = [
  { value: "en-CA", label: "English (Canada) [en-CA]" },
  { value: "fr-CA", label: "French (Canada) [fr-CA]" },
  { value: "iu", label: "Inuktitut [iu]" },
];

const meta = {
  title: "Components/MultipleSelectListbox",
  component: MultipleSelectListbox,
  tags: ["autodocs"],
} satisfies Meta<typeof MultipleSelectListbox>;

export default meta;
type Story = StoryObj<typeof meta>;

function ControlledExample() {
  const [value, setValue] = useState("en-CA");

  return (
    <div className="w-full max-w-lg space-y-3">
      <p className="text-sm text-muted-foreground">
        Some countries list more than one official language. Pick the one websites
        should see first.
      </p>
      <MultipleSelectListbox
        options={options}
        value={value}
        onValueChange={setValue}
        aria-label="Website language"
      />
      <p className="text-xs text-muted-foreground">Selected: {value}</p>
    </div>
  );
}

export const Default: Story = {
  args: {
    options,
    value: "en-CA",
    onValueChange: () => {},
  },
  render: () => <ControlledExample />,
};

export const Disabled: Story = {
  args: {
    options,
    value: "en-CA",
    onValueChange: () => {},
    disabled: true,
    "aria-label": "Website language",
  },
};
