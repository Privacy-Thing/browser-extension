import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within } from "storybook/test";

import { Button } from "../ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "../ui/sheet";

const meta = {
  title: "Components/Sheet",
  component: Sheet,
  tags: ["autodocs"],
} satisfies Meta<typeof Sheet>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Bottom: Story = {
  render: () => (
    <div className="min-h-[320px] rounded-2xl border border-border bg-background p-6">
      <Sheet>
        <SheetTrigger asChild>
          <Button>Open Sheet</Button>
        </SheetTrigger>
        <SheetContent side="bottom" className="mx-auto max-w-[420px]">
          <SheetHeader>
            <SheetTitle>Edit quick rule</SheetTitle>
            <SheetDescription>
              Use the sheet for compact, popup-like flows.
            </SheetDescription>
          </SheetHeader>
          <div className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
            Popup rule form content goes here.
          </div>
        </SheetContent>
      </Sheet>
    </div>
  ),
};

export const BottomInteractionTest: Story = {
  ...Bottom,
  tags: ["!dev", "!autodocs"],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    const trigger = canvas.getByRole("button", { name: "Open Sheet" });

    await userEvent.click(trigger);
    await expect(body.getByRole("dialog", { name: "Edit quick rule" })).toBeVisible();
    await userEvent.keyboard("{Escape}");
    await expect(
      body.queryByRole("dialog", { name: "Edit quick rule" }),
    ).not.toBeInTheDocument();
    await expect(trigger).toHaveFocus();
  },
};
