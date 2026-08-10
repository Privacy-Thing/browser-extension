import type { Meta, StoryObj } from "@storybook/react";

import { Table, TableBody } from "../ui/table";
import { TableSelectionNotice } from "../ui/table-selection-notice";

const meta = {
  title: "Components/TableSelectionNotice",
  component: TableSelectionNotice,
  tags: ["autodocs"],
} satisfies Meta<typeof TableSelectionNotice>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  render: (args) => (
    <div className="overflow-hidden rounded-md border">
      <Table>
        <TableBody>
          <TableSelectionNotice {...args} />
        </TableBody>
      </Table>
    </div>
  ),
  args: {
    colSpan: 4,
  },
};

export const WithSelection: Story = {
  render: (args) => (
    <div className="overflow-hidden rounded-md border">
      <Table>
        <TableBody>
          <TableSelectionNotice {...args} />
        </TableBody>
      </Table>
    </div>
  ),
  args: {
    colSpan: 4,
    children: <span className="font-medium text-foreground">6 selected</span>,
  },
};
