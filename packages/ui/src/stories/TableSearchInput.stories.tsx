import type { Meta, StoryObj } from "@storybook/react";

import { TableSearchInput } from "../ui/table-search-input";

const meta = {
  title: "Components/TableSearchInput",
  component: TableSearchInput,
  tags: ["autodocs"],
} satisfies Meta<typeof TableSearchInput>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    placeholder: "Filter rows...",
  },
};
