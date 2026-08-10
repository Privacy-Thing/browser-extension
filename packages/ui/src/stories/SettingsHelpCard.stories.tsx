import type { Meta, StoryObj } from "@storybook/react";

import { SettingsHelpCard } from "../SettingsHelpCard";

const meta = {
  title: "Components/SettingsHelpCard",
  component: SettingsHelpCard,
  tags: ["autodocs"],
} satisfies Meta<typeof SettingsHelpCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    anchorId: "storybook-help",
    copyLabel: "Copy link to help",
    title: "Options help",
    children: (
      <>
        <p>
          These controls affect every runtime mode and keep shared spoofing behavior
          aligned.
        </p>
        <p>
          Use rule overrides for site-specific exceptions when the global default is too
          broad.
        </p>
      </>
    ),
  },
};
