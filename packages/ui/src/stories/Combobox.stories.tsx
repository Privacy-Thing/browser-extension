import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";

import { Combobox } from "../ui/combobox";
import { dropdownPanelSideOffset } from "../ui/dropdown-chrome";
import { FieldLabel } from "../ui/field-label";

const meta = {
  title: "Components/Combobox",
  component: Combobox,
  tags: ["autodocs"],
} satisfies Meta<typeof Combobox>;

export default meta;
type Story = StoryObj<typeof meta>;

const languages = [
  { value: "fr-FR", label: "French (France) (fr-FR)" },
  { value: "en-US", label: "English (United States) (en-US)" },
  { value: "en-GB", label: "English (United Kingdom) (en-GB)" },
  { value: "de-DE", label: "German (Germany) (de-DE)" },
  { value: "es-ES", label: "Spanish (Spain) (es-ES)" },
  { value: "it-IT", label: "Italian (Italy) (it-IT)" },
  { value: "ja-JP", label: "Japanese (Japan) (ja-JP)" },
  { value: "ko-KR", label: "Korean (Korea) (ko-KR)" },
  { value: "pl-PL", label: "Polish (Poland) (pl-PL)" },
  { value: "pt-BR", label: "Portuguese (Brazil) (pt-BR)" },
  { value: "zh-CN", label: "Chinese (Simplified) (zh-CN)" },
];

const timezones = [
  { value: "Europe/Paris", label: "Europe/Paris" },
  { value: "Europe/Warsaw", label: "Europe/Warsaw" },
  { value: "Europe/London", label: "Europe/London" },
  { value: "America/New_York", label: "America/New_York" },
  { value: "America/Los_Angeles", label: "America/Los_Angeles" },
  { value: "Asia/Tokyo", label: "Asia/Tokyo" },
  { value: "Asia/Shanghai", label: "Asia/Shanghai" },
  { value: "Australia/Sydney", label: "Australia/Sydney" },
];

export const Default: Story = {
  args: {
    options: languages,
    placeholder: "Select language...",
    searchPlaceholder: "Search languages...",
  },
};

function ControlledExample() {
  const [value, setValue] = useState("Europe/Warsaw");
  return (
    <div className="grid w-full max-w-sm items-center gap-1.5">
      <FieldLabel>Time zone</FieldLabel>
      <Combobox
        options={timezones}
        value={value}
        onValueChange={setValue}
        placeholder="Select time zone..."
        searchPlaceholder="Search time zones..."
        ariaLabel="Time zone"
      />
      <p className="text-xs text-muted-foreground">Selected: {value || "none"}</p>
    </div>
  );
}

export const Controlled: Story = {
  args: { options: timezones },
  render: () => <ControlledExample />,
};

export const ControlledTest: Story = {
  ...Controlled,
  tags: ["!dev", "!autodocs"],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    const trigger = canvas.getByRole("combobox", { name: "Time zone" });

    await userEvent.click(trigger);
    const search = body.getByPlaceholderText("Search time zones...");
    await expect(search).toHaveFocus();
    await userEvent.type(search, "Tokyo");
    await userEvent.click(body.getByRole("option", { name: "Asia/Tokyo" }));
    await expect(canvas.getByText("Selected: Asia/Tokyo")).toBeVisible();
    await expect(trigger).toHaveFocus();
  },
};

export const OverlayLayoutTest: Story = {
  args: { options: languages },
  tags: ["!dev", "!autodocs"],
  parameters: {
    layout: "fullscreen",
  },
  render: () => (
    <div style={{ position: "fixed", bottom: 8, left: 16, width: 320 }}>
      <Combobox
        options={languages}
        value="fr-FR"
        ariaLabel="Language layout contract"
        searchPlaceholder="Search layout languages"
      />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("combobox", { name: "Language layout contract" });
    await userEvent.click(trigger);

    const content = canvasElement.ownerDocument.querySelector<HTMLElement>(
      '[data-slot="combobox-content"]',
    );
    if (!content) throw new Error("Missing combobox content.");
    await expect(content).toBeVisible();
    expect(canvasElement.contains(content)).toBe(false);

    const triggerBounds = trigger.getBoundingClientRect();
    const contentBounds = content.getBoundingClientRect();
    await expect(content).toHaveAttribute("data-side", "top");
    expect(
      Math.abs(triggerBounds.top - contentBounds.bottom - dropdownPanelSideOffset),
    ).toBeLessThanOrEqual(1);
    expect(getComputedStyle(trigger).borderTopLeftRadius).toBe("0px");
    expect(getComputedStyle(content).borderBottomLeftRadius).toBe("0px");

    const list = content.querySelector<HTMLElement>("[cmdk-list]");
    if (!list) throw new Error("Missing combobox list.");
    const previousScrollTop = list.scrollTop;
    content.dispatchEvent(
      new WheelEvent("wheel", { bubbles: true, cancelable: true, deltaY: 600 }),
    );
    expect(list.scrollTop).toBeGreaterThan(previousScrollTop);

    await userEvent.keyboard("{Escape}");
    await expect(content).not.toBeVisible();
  },
};

function ActionTriggerExample() {
  const [lastAction, setLastAction] = useState<string>("none");

  return (
    <div className="grid w-full max-w-sm items-center gap-1.5">
      <FieldLabel>Bulk action</FieldLabel>
      <Combobox
        options={[
          { value: "warsaw", label: "Warsaw" },
          { value: "paris", label: "Paris" },
          { value: "tokyo", label: "Tokyo" },
        ]}
        placeholder="Assign location"
        searchPlaceholder="Search locations..."
        onValueChange={(value) => {
          if (value) {
            setLastAction(value);
          }
        }}
      />
      <p className="text-xs text-muted-foreground">Last action: {lastAction}</p>
    </div>
  );
}

export const ActionTrigger: Story = {
  args: { options: [] },
  render: () => <ActionTriggerExample />,
};

function ControlledInfoExample() {
  const [value, setValue] = useState("pl-PL");
  return (
    <div className="grid w-full max-w-sm items-center gap-1.5">
      <FieldLabel
        info="Use a locale that matches the region suggested by the saved coordinates."
        infoLabel="What language means"
      >
        Language
      </FieldLabel>
      <Combobox
        options={languages}
        value={value}
        onValueChange={setValue}
        placeholder="Select language..."
        searchPlaceholder="Search languages..."
      />
    </div>
  );
}

export const ControlledWithInfo: Story = {
  args: { options: languages },
  render: () => <ControlledInfoExample />,
};

export const Disabled: Story = {
  args: {
    options: languages,
    placeholder: "Select language...",
    disabled: true,
  },
};
