import type { Meta, StoryObj } from "@storybook/react";

import { SettingsControlCard } from "../SettingsControlCard";
import { Button } from "../ui/button";
import { Slider } from "../ui/slider";
import { Switch } from "../ui/switch";

const meta = {
  title: "Components/SettingsControlCard",
  component: SettingsControlCard,
  tags: ["autodocs"],
} satisfies Meta<typeof SettingsControlCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ToggleRow: Story = {
  args: {
    anchorId: "storybook-toggle",
    copyLabel: "Copy link to Debug mode",
    title: <h3 className="text-sm font-semibold">Debug mode</h3>,
    description: "Expose extra diagnostics in the UI for troubleshooting.",
    action: <Switch aria-label="Debug mode" checked />,
  },
};

export const SliderWithHint: Story = {
  args: {
    anchorId: "storybook-slider",
    copyLabel: "Copy link to Noise radius",
    title: <h3 className="text-sm font-semibold">Default noise radius</h3>,
    description: "Seed new profiles with a safe coordinate spread.",
    hint: "Websites receive updates within this configured range.",
    hintClassName: "text-orange-800 dark:text-orange-300",
    actionClassName: "sm:w-72",
    action: (
      <Slider
        aria-label="Default noise radius"
        valueLabel="120m"
        minLabel="0m"
        maxLabel="500m"
        min={0}
        max={500}
        step={10}
        value={[120]}
      />
    ),
  },
};

export const ActionButton: Story = {
  args: {
    anchorId: "storybook-export",
    copyLabel: "Copy link to Export settings",
    title: <h3 className="text-sm font-semibold">Export settings</h3>,
    description: "Save the current extension configuration as a JSON backup.",
    action: <Button variant="outline">Export</Button>,
  },
};
