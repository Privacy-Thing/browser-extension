import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within } from "storybook/test";

import { dropdownPanelSideOffset } from "../ui/dropdown-chrome";
import { FieldLabel } from "../ui/field-label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";

const meta = {
  title: "Components/Select",
  component: Select,
  tags: ["autodocs"],
} satisfies Meta<typeof Select>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Select>
      <SelectTrigger className="w-[280px]" aria-label="Location">
        <SelectValue placeholder="Select a location" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="warsaw">Warsaw</SelectItem>
        <SelectItem value="paris">Paris</SelectItem>
        <SelectItem value="new-york">New York</SelectItem>
        <SelectItem value="london">London</SelectItem>
        <SelectItem value="tokyo">Tokyo</SelectItem>
      </SelectContent>
    </Select>
  ),
};

export const DefaultInteractionTest: Story = {
  ...Default,
  tags: ["!dev", "!autodocs"],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    const trigger = canvas.getByRole("combobox");

    await userEvent.click(trigger);
    const option = body.getByRole("option", { name: "Paris" });
    await expect(option).toBeVisible();
    await userEvent.click(option);
    await expect(trigger).toHaveTextContent("Paris");
    await expect(trigger).toHaveFocus();
  },
};

export const AttachmentTest: Story = {
  ...Default,
  tags: ["!dev", "!autodocs"],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("combobox");
    await userEvent.click(trigger);
    const popup = canvasElement.ownerDocument.querySelector<HTMLElement>(
      '[data-state="open"][data-side]',
    );
    if (!popup) throw new Error("Missing Select popup.");
    await expect(popup).toBeVisible();

    const triggerBounds = trigger.getBoundingClientRect();
    const popupBounds = popup.getBoundingClientRect();
    const side = popup.dataset.side;
    const gap =
      side === "top"
        ? triggerBounds.top - popupBounds.bottom
        : popupBounds.top - triggerBounds.bottom;
    expect(Math.abs(gap - dropdownPanelSideOffset)).toBeLessThanOrEqual(1);
    expect(Math.abs(popupBounds.width - triggerBounds.width)).toBeLessThanOrEqual(1);

    await userEvent.keyboard("{Escape}");
    await expect(popup).not.toBeVisible();
  },
};

export const WithLabel: Story = {
  render: () => (
    <div className="grid w-full max-w-sm items-center gap-1.5">
      <FieldLabel htmlFor="time-zone-select">Time zone</FieldLabel>
      <Select>
        <SelectTrigger id="time-zone-select">
          <SelectValue placeholder="Select time zone" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="europe-warsaw">Europe/Warsaw</SelectItem>
          <SelectItem value="europe-paris">Europe/Paris</SelectItem>
          <SelectItem value="america-new-york">America/New_York</SelectItem>
          <SelectItem value="europe-london">Europe/London</SelectItem>
        </SelectContent>
      </Select>
    </div>
  ),
};

export const WithLabelAndInfo: Story = {
  render: () => (
    <div className="grid w-full max-w-sm items-center gap-1.5">
      <FieldLabel
        htmlFor="time-zone-info-select"
        info="Choose the time zone that best matches the saved coordinates and language settings."
        infoLabel="What time zone means"
      >
        Time zone
      </FieldLabel>
      <Select>
        <SelectTrigger id="time-zone-info-select">
          <SelectValue placeholder="Select time zone" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="europe-warsaw">Europe/Warsaw</SelectItem>
          <SelectItem value="europe-paris">Europe/Paris</SelectItem>
          <SelectItem value="america-new-york">America/New_York</SelectItem>
          <SelectItem value="europe-london">Europe/London</SelectItem>
        </SelectContent>
      </Select>
    </div>
  ),
};

export const WithoutLabel: Story = {
  render: () => (
    <Select>
      <SelectTrigger className="w-[280px]" aria-label="Theme">
        <SelectValue placeholder="Theme" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="system">System</SelectItem>
        <SelectItem value="light">Light</SelectItem>
        <SelectItem value="dark">Dark</SelectItem>
      </SelectContent>
    </Select>
  ),
};
