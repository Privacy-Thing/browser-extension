import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";

import { CheckboxGroup } from "../ui/checkbox-group";

const meta: Meta<typeof CheckboxGroup> = {
  title: "Components/CheckboxGroup",
  component: CheckboxGroup,
  tags: ["autodocs"],
  decorators: [
    (Story, context) => {
      const [selectedKeys, setSelectedKeys] = useState<Set<string>>(
        new Set(context.args.selectedKeys || []),
      );
      return (
        <div className="w-64 max-w-full rounded-md border p-4 bg-background">
          <Story
            args={{
              ...context.args,
              selectedKeys,
              onSelectionChange: setSelectedKeys,
            }}
          />
        </div>
      );
    },
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    title: "Categories",
    options: [
      { id: "date.now", label: "Date.now" },
      { id: "date.toString", label: "Date.toString" },
      { id: "date.toLocaleString", label: "Date.toLocaleString" },
    ],
    selectedKeys: new Set(["date.now"]),
  },
};
