import type { Meta, StoryObj } from "@storybook/react";
import "../popup.css";
import { expect, fn, userEvent, within } from "storybook/test";

import { PopupHostPause } from "../components/PopupHostPause";

const meta = {
  title: "Popup/Host Pause",
  component: PopupHostPause,
  decorators: [
    (Story) => (
      <div style={{ width: 312 }}>
        <Story />
      </div>
    ),
  ],
  args: {
    hostname: "example.com",
    disabled: false,
    pending: false,
    onPause: fn(),
    onExpired: () => undefined,
  },
} satisfies Meta<typeof PopupHostPause>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Available: Story = {
  args: { status: { pause: null, reloadRequired: false } },
  play: async ({ canvasElement, args }) => {
    const trigger = canvasElement.querySelector("#host-protection-pause");
    if (!(trigger instanceof HTMLElement)) throw new Error("Missing pause trigger");
    await userEvent.click(trigger);
    const dialog = within(canvasElement.ownerDocument.body).getByRole("dialog");
    const timed = dialog.querySelector("#pause-host-ten-minutes");
    const session = dialog.querySelector("#pause-host-session");
    if (!(timed instanceof HTMLElement) || !(session instanceof HTMLElement))
      throw new Error("Missing duration choices");
    await expect(timed).toBeVisible();
    await expect(session).toBeVisible();
    await userEvent.click(timed);
    await expect(args.onPause).toHaveBeenCalledWith("ten-minutes");
    await userEvent.click(within(dialog).getByRole("button", { name: "Close" }));
  },
};
export const Session: Story = {
  args: {
    status: {
      pause: { hostname: "example.com", id: "session", expiresAt: null },
      reloadRequired: false,
    },
  },
  play: async ({ canvasElement }) => {
    const trigger = canvasElement.querySelector("#host-protection-pause");
    if (!(trigger instanceof HTMLElement)) throw new Error("Missing pause trigger");
    await userEvent.click(trigger);
    const dialog = within(canvasElement.ownerDocument.body).getByRole("dialog");
    const resume = dialog.querySelector("#resume-host-protection");
    const symbol = resume?.querySelector(".gw-popup-pause-option-icon");
    if (!(resume instanceof HTMLElement) || !(symbol instanceof HTMLElement))
      throw new Error("Missing resume action");
    await userEvent.tab();
    await expect(resume).toHaveFocus();
    await expect(getComputedStyle(resume).outlineColor).toBe(
      getComputedStyle(symbol).color,
    );
    await userEvent.click(within(dialog).getByRole("button", { name: "Close" }));
  },
};
export const ReloadRequired: Story = {
  args: { status: { pause: null, reloadRequired: true } },
};
export const ReloadFailed: Story = {
  args: {
    status: {
      pause: { hostname: "example.com", id: "session", expiresAt: null },
      reloadRequired: true,
    },
  },
};
