import type { Meta, StoryObj } from "@storybook/react";
import { expect } from "storybook/test";

import { ProviderDecoratorBadge } from "./ProviderDecoratorBadge";

import type { ProviderDecorator } from "@/shared/provider-feature";

const controlD: ProviderDecorator = {
  providerId: "control-d",
  providerName: "Control D",
  initials: "CD",
  badgeColors: { background: "#1BE3AD", foreground: "#010818" },
  featureId: "youtube",
  label: "YouTube",
  type: "service",
};

const plainProvider: ProviderDecorator = {
  providerId: "example-dns",
  providerName: "Example DNS",
  initials: "ED",
  featureId: "youtube",
  label: "YouTube",
  type: "service",
};

const meta = {
  title: "Components/Provider decorator badge",
  component: ProviderDecoratorBadge,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div className="p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ProviderDecoratorBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Initials: Story = {
  args: { decorator: controlD },
  play: async ({ canvasElement }) => {
    const mark = canvasElement.querySelector("[data-provider-initials]");
    await expect(
      canvasElement.querySelector("[data-provider-decorator-badge]"),
    ).toHaveAttribute("data-provider-label", "initials");
    await expect(mark).toHaveAttribute("data-provider-initials", "CD");
    await expect(mark).toHaveClass("size-[24px]", "rounded-full", "text-[10px]");
    await expect(canvasElement.querySelector("[data-provider-name]")).toBeNull();
  },
};

export const Name: Story = {
  args: { decorator: controlD, providerLabel: "name" },
  play: async ({ canvasElement }) => {
    const mark = canvasElement.querySelector("[data-provider-name]");
    await expect(
      canvasElement.querySelector("[data-provider-decorator-badge]"),
    ).toHaveAttribute("data-provider-label", "name");
    await expect(mark).toHaveTextContent("Control D");
    await expect(mark).toHaveClass("h-6", "rounded-full", "px-2.5", "text-xs");
    await expect(mark).toHaveStyle({
      backgroundColor: "#1BE3AD",
      color: "#010818",
    });
    await expect(canvasElement.querySelector("[data-provider-initials]")).toBeNull();
  },
};

export const NameFallback: Story = {
  args: { decorator: plainProvider, providerLabel: "name" },
  play: async ({ canvasElement }) => {
    const mark = canvasElement.querySelector("[data-provider-name]");
    await expect(mark).toHaveTextContent("Example DNS");
    await expect(mark).toHaveClass(
      "border-border",
      "bg-secondary",
      "text-secondary-foreground",
    );
    await expect(mark?.getAttribute("style")).toBeNull();
  },
};
