import type { Meta, StoryObj } from "@storybook/react";

import { SettingsSectionCard } from "../SettingsSectionCard";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";

const meta = {
  title: "Components/SettingsSectionCard",
  component: SettingsSectionCard,
  tags: ["autodocs"],
} satisfies Meta<typeof SettingsSectionCard>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    anchorId: "storybook-default",
    copyLabel: "Copy link to Overview",
    title: <h2 className="text-xl font-semibold">Rules</h2>,
    description:
      "Manage where each domain resolves and how the options page presents that mapping.",
    children: (
      <div className="rounded-lg border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">
        Section content goes here.
      </div>
    ),
  },
};

export const WithActions: Story = {
  args: {
    anchorId: "storybook-actions",
    copyLabel: "Copy link to Profiles",
    title: (
      <div className="flex items-center gap-2">
        <h2 className="text-xl font-semibold">Preview settings</h2>
        <Badge variant="outline">Experimental</Badge>
      </div>
    ),
    description: "Capture and reuse higher-fidelity movement presets.",
    headerActions: (
      <>
        <Button variant="secondary">Refresh</Button>
        <Button>New profile</Button>
      </>
    ),
    children: <div className="h-16 rounded-lg border border-border/60 bg-muted/20" />,
  },
};

export const Highlighted: Story = {
  args: {
    anchorId: "storybook-highlighted",
    copyLabel: "Copy link to Containers",
    title: <h3 className="text-base font-semibold">Containers help</h3>,
    description:
      "Shared section shells preserve anchor styling and spacing across tabs.",
    highlighted: true,
    contentClassName: "gap-3",
    children: (
      <>
        <p className="text-sm text-muted-foreground">
          Use this variant to preview the highlighted anchor state.
        </p>
        <p className="text-sm text-muted-foreground">
          The body stays fully composable.
        </p>
      </>
    ),
  },
};
