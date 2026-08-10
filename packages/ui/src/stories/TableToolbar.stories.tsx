import type { Meta, StoryObj } from "@storybook/react";

import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { TableToolbar } from "../ui/table-toolbar";

const meta = {
  title: "Components/TableToolbar",
  component: TableToolbar,
  tags: ["autodocs"],
} satisfies Meta<typeof TableToolbar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    search: <Input placeholder="Filter rows..." className="max-w-sm" />,
    actions: (
      <>
        <Button variant="secondary" size="sm">
          Export selected
        </Button>
        <Button variant="destructive" size="sm">
          Delete selected
        </Button>
      </>
    ),
  },
};

export const NoSelection: Story = {
  args: {
    search: <Input placeholder="Filter rows..." className="max-w-sm" />,
    actions: (
      <Button variant="secondary" size="sm">
        Refresh
      </Button>
    ),
  },
};
