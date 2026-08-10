import type { Meta, StoryObj } from "@storybook/react";

import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";

const meta = {
  title: "Components/Table",
  component: Table,
  tags: ["autodocs"],
} satisfies Meta<typeof Table>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Rule</TableHead>
          <TableHead>Profile</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell className="font-medium">browserleaks.com</TableCell>
          <TableCell>
            <Badge variant="secondary">New York</Badge>
          </TableCell>
          <TableCell className="text-right">
            <Button variant="ghost" size="sm">
              Edit
            </Button>
          </TableCell>
        </TableRow>
        <TableRow>
          <TableCell className="font-medium">example.com</TableCell>
          <TableCell>
            <Badge variant="secondary">Paris</Badge>
          </TableCell>
          <TableCell className="text-right">
            <Button variant="ghost" size="sm">
              Edit
            </Button>
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  ),
};
