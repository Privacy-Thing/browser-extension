import type { Meta, StoryObj } from "@storybook/react";

import { TableSelectionMenu } from "../ui/table-selection-menu";

const meta = {
  title: "Components/TableSelectionMenu",
  component: TableSelectionMenu,
  tags: ["autodocs"],
} satisfies Meta<typeof TableSelectionMenu>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    checked: false,
    toggleAllAriaLabel: "Select all rows",
    menuAriaLabel: "Open selection menu",
    onToggleAll: () => undefined,
    options: [
      { id: "all", label: "All", onSelect: () => undefined },
      { id: "active", label: "Active only", onSelect: () => undefined },
      { id: "inactive", label: "Inactive only", onSelect: () => undefined },
      { id: "none", label: "None", onSelect: () => undefined },
    ],
  },
};

export const Indeterminate: Story = {
  args: {
    ...Default.args,
    checked: "indeterminate",
  },
};

export const Checked: Story = {
  args: {
    ...Default.args,
    checked: true,
  },
};
