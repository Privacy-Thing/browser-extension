import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import { FormDialogShell } from "../ui/form-dialog-shell";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";

const meta = {
  title: "Components/Dialog",
  component: Dialog,
  tags: ["autodocs"],
  parameters: { a11y: { test: "error" } },
} satisfies Meta<typeof Dialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">Edit Location</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit location</DialogTitle>
          <DialogDescription>
            Make changes to your spoofing location. Click save when done.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">
              Name
            </Label>
            <Input id="name" defaultValue="Paris" className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="lat" className="text-right">
              Latitude
            </Label>
            <Input id="lat" defaultValue="48.8566" className="col-span-3" />
          </div>
        </div>
        <DialogFooter>
          <Button type="submit">Save changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};

export const DefaultInteractionTest: Story = {
  ...Default,
  tags: ["!dev", "!autodocs"],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const documentBody = within(canvasElement.ownerDocument.body);
    const trigger = canvas.getByRole("button", { name: "Edit Location" });
    await userEvent.click(trigger);
    await expect(documentBody.getByRole("dialog")).toHaveAttribute(
      "data-state",
      "open",
    );
    await expect(documentBody.getByLabelText("Name")).toHaveValue("Paris");
    await userEvent.keyboard("{Escape}");
    await expect(documentBody.getByRole("dialog", { hidden: true })).toHaveAttribute(
      "data-state",
      "closed",
    );
    await waitFor(() => expect(trigger).toHaveFocus());
  },
};

const NestedSelectDialog = () => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        Edit container
      </Button>
      <FormDialogShell
        open={open}
        onOpenChange={setOpen}
        title="Edit container"
        closeLabel="Close"
      >
        <Select>
          <SelectTrigger aria-label="Container color">
            <SelectValue placeholder="Select a color" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="blue">Blue</SelectItem>
            <SelectItem value="orange">Orange</SelectItem>
          </SelectContent>
        </Select>
      </FormDialogShell>
    </>
  );
};

export const NestedDismissalTest: Story = {
  render: () => <NestedSelectDialog />,
  tags: ["!dev", "!autodocs"],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const documentBody = within(canvasElement.ownerDocument.body);

    await userEvent.click(canvas.getByRole("button", { name: "Edit container" }));
    const dialog = documentBody.getByRole("dialog");
    const select = documentBody.getByRole("combobox", { name: "Container color" });
    await userEvent.click(select);
    await expect(documentBody.getByRole("option", { name: "Blue" })).toBeVisible();

    const overlay =
      canvasElement.ownerDocument.querySelector<HTMLElement>(".gw-dialog-overlay");
    if (!overlay) throw new Error("Missing dialog overlay.");
    await userEvent.click(overlay);

    await expect(select).toHaveAttribute("aria-expanded", "false");
    await expect(dialog).toHaveAttribute("data-state", "open");
  },
};
