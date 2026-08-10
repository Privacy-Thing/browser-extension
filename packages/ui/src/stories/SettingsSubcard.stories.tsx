import type { Meta, StoryObj } from "@storybook/react";

import { SettingsSubcard } from "../SettingsSubcard";
import { Switch } from "../ui/switch";

const meta = {
  title: "Components/SettingsSubcard",
  component: SettingsSubcard,
  tags: ["autodocs"],
} satisfies Meta<typeof SettingsSubcard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    anchorId: "storybook-client-hints-rotation",
    copyLabel: "Copy link to Rotate version",
    title: (
      <h4 className="min-w-0 text-sm font-medium leading-5 text-foreground">
        Rotate version
      </h4>
    ),
    description: (
      <>
        <div className="inline-flex flex-wrap items-center gap-2">
          <span className="text-muted-foreground">e.g.:</span>
          <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.72rem] text-foreground">
            124.0.6350.12
          </span>
        </div>
        <p className="mt-1">
          Keeps reduced UA and major-only brands unchanged while rotating build and
          patch.
        </p>
      </>
    ),
    action: (
      <Switch
        aria-label="Rotate version"
        className="mt-0.5 origin-left scale-90"
        checked
      />
    ),
  },
};
