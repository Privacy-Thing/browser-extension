import "@fortawesome/fontawesome-free/css/fontawesome.css";
import "@fortawesome/fontawesome-free/css/solid.css";
import "../popup.css";

import type { Meta, StoryObj } from "@storybook/react";
import type { CSSProperties } from "react";
import { expect, fn, userEvent, within } from "storybook/test";

import { PopupPowerButton } from "../components/PopupPowerButton";

const meta = {
  title: "Popup/Power Button",
  component: PopupPowerButton,
  tags: ["autodocs"],
  parameters: { privacyThing: { surface: "component" } },
  args: {
    ariaLabel: "Turn off this Domain Rule",
  },
  decorators: [
    (Story) => (
      <div
        className="flex min-h-[280px] items-center justify-center rounded-[2rem] border border-border bg-card p-12"
        style={{ "--gw-power-size": "var(--gw-popup-power-size)" } as CSSProperties}
      >
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PopupPowerButton>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Active: Story = {
  args: {
    state: "active",
    onClick: fn(),
  },
};

export const ActiveInteractionTest: Story = {
  ...Active,
  tags: ["!dev", "!autodocs"],
  play: async ({ args, canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole("button", { name: "Turn off this Domain Rule" }),
    );
    await expect(args.onClick).toHaveBeenCalledTimes(1);
  },
};

export const Disabled: Story = {
  args: {
    state: "disabled",
  },
};

export const Warning: Story = {
  args: {
    state: "warning",
  },
};

export const HoverPulse: Story = {
  args: {
    state: "active",
  },
};

export const AllStates: Story = {
  args: {
    state: "active",
  },
  render: () => (
    <div className="flex flex-wrap items-center justify-center gap-10">
      <PopupPowerButton state="active" ariaLabel="Active" />
      <PopupPowerButton state="warning" ariaLabel="Warning" />
      <PopupPowerButton state="disabled" ariaLabel="Disabled" />
    </div>
  ),
};

export const Scaled: Story = {
  args: {
    state: "active",
  },
  render: () => (
    <div className="flex flex-wrap items-end justify-center gap-8">
      <div style={{ "--gw-power-size": "5rem" } as CSSProperties}>
        <PopupPowerButton state="active" ariaLabel="Small" />
      </div>
      <PopupPowerButton state="active" ariaLabel="Default" />
      <div style={{ "--gw-power-size": "14rem" } as CSSProperties}>
        <PopupPowerButton state="active" ariaLabel="Large" />
      </div>
    </div>
  ),
};
