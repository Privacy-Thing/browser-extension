import type { Meta, StoryObj } from "@storybook/react";
import { useMemo } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";

import "@fortawesome/fontawesome-free/css/fontawesome.css";
import "@fortawesome/fontawesome-free/css/solid.css";

import "../sidebar.css";

import { createMemoryInspectorApi } from "../modules/xray/inspector/memory-inspector-api";

import {
  createInspectorPreset,
  createInspectorXRayState,
  INSPECTOR_STORY_PRESETS,
  type InspectorStoryPreset,
} from "./xray-inspector-story-fixtures";
import { XRayStoryShell } from "./XRayStoryShell";

import type { SpoofingBrowserTarget } from "@/shared/spoofing-surfaces";
import { t } from "@/ui/i18n";

type HarnessProps = {
  preset: InspectorStoryPreset;
  width: 360 | 400 | 720;
  browserTarget: SpoofingBrowserTarget;
};

const InspectorHarness = ({ preset, width, browserTarget }: HarnessProps) => {
  const api = useMemo(
    () =>
      createMemoryInspectorApi(createInspectorPreset(preset), {
        ...(preset === "error" ? { failWith: "The tab was closed." } : {}),
        ...(preset === "slow" ? { holdCommands: true } : {}),
      }),
    [preset],
  );
  const state = useMemo(() => createInspectorXRayState(), []);
  return (
    <XRayStoryShell
      state={state}
      width={width}
      inspectorApi={api}
      browserTarget={browserTarget}
    />
  );
};

const meta = {
  title: "Sidebar/XRay/Inspector",
  component: InspectorHarness,
  parameters: {
    privacyThing: { surface: "component" },
  },
  args: { preset: "idle", width: 400, browserTarget: "chromium" },
  argTypes: {
    preset: { control: "select", options: INSPECTOR_STORY_PRESETS },
    width: { control: "inline-radio", options: [360, 400, 720] },
    browserTarget: { control: "inline-radio", options: ["chromium", "firefox"] },
  },
} satisfies Meta<typeof InspectorHarness>;

export default meta;
type Story = StoryObj<typeof meta>;
type PlayContext = Parameters<NonNullable<Story["play"]>>[0];

const inspectorToggle = (canvas: ReturnType<typeof within>) =>
  canvas.getByRole("button", { name: new RegExp(t.sidebar.inspector.toggle) });

const panel = (canvasElement: HTMLElement) =>
  canvasElement.querySelector<HTMLElement>("[data-xray-inspector-panel]");

const expectPhase = async (canvasElement: HTMLElement, phase: string) =>
  waitFor(() =>
    expect(panel(canvasElement)).toHaveAttribute("data-inspector-phase", phase),
  );

const openInspector = async ({ canvasElement }: Pick<PlayContext, "canvasElement">) => {
  const canvas = within(canvasElement);
  await userEvent.click(inspectorToggle(canvas));
  await waitFor(() =>
    expect(panel(canvasElement)).not.toHaveAttribute("data-inspector-phase", "loading"),
  );
  return canvas;
};

const expandCategory = async (canvas: ReturnType<typeof within>, label: string) => {
  await userEvent.click(
    canvas.getByRole("button", { name: t.sidebar.inspector.list.methodsOf(label) }),
  );
};

const checkMethod = async (canvas: ReturnType<typeof within>, label: string) =>
  userEvent.click(canvas.getByRole("checkbox", { name: label }));

const battery = t.sidebar.accessed.categories.battery;
const batteryLevel = t.sidebar.accessed.methods.batteryManagerLevel;

/** Opens Inspector and selects only `battery.manager.level`. */
const selectBatteryLevel = async (context: Pick<PlayContext, "canvasElement">) => {
  const canvas = await openInspector(context);
  await expandCategory(canvas, battery);
  await checkMethod(canvas, batteryLevel);
  return canvas;
};

export const InspectorOff: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(inspectorToggle(canvas)).toHaveAttribute("aria-pressed", "false");
    await expect(panel(canvasElement)).toBeNull();
    await expect(canvas.queryAllByRole("checkbox")).toHaveLength(0);
  },
};

export const NothingSelected: Story = {
  play: async (context) => {
    const canvas = await openInspector(context);
    await expect(inspectorToggle(canvas)).toHaveAttribute("aria-pressed", "true");
    await expectPhase(context.canvasElement, "idle");
    await expect(
      context.canvasElement.querySelector("[data-inspector-actions]"),
    ).toBeNull();
  },
};

export const PartialSelection: Story = {
  play: async (context) => {
    const canvas = await selectBatteryLevel(context);
    const category = canvas.getByRole("checkbox", { name: battery });
    await expect(category).toBePartiallyChecked();
    await expect(canvas.getByRole("checkbox", { name: batteryLevel })).toBeChecked();
    await expect(
      canvas.getByRole("button", { name: t.sidebar.inspector.actions.armReload }),
    ).toBeEnabled();
    await expect(
      canvas.getByRole("button", { name: t.sidebar.inspector.actions.armNextLoad }),
    ).toBeEnabled();
  },
};

export const CategorySelected: Story = {
  play: async (context) => {
    const canvas = await openInspector(context);
    const canvasCategory = canvas.getByRole("checkbox", {
      name: t.sidebar.accessed.categories.canvas,
    });
    await userEvent.click(canvasCategory);
    await expect(canvasCategory).toBeChecked();
    await expect(canvasCategory).not.toBePartiallyChecked();
    await expect(
      context.canvasElement.querySelector('[data-inspector-category="canvas"]'),
    ).toHaveAttribute("data-selection", "all");
    await userEvent.click(canvasCategory);
    await expect(canvasCategory).not.toBeChecked();
  },
};

export const SearchAndUsedFilter: Story = {
  play: async (context) => {
    const canvas = await openInspector(context);
    await userEvent.type(
      canvas.getByRole("searchbox", { name: t.sidebar.inspector.list.search }),
      "level",
    );
    await expect(canvas.getByRole("checkbox", { name: batteryLevel })).toBeVisible();
    await expect(
      canvas.queryByRole("checkbox", { name: t.sidebar.accessed.categories.canvas }),
    ).toBeNull();
    await userEvent.clear(canvas.getByRole("searchbox"));
    await userEvent.click(
      canvas.getByRole("button", {
        name: new RegExp(t.sidebar.inspector.list.usedOnly),
      }),
    );
    const categories = Array.from(
      context.canvasElement.querySelectorAll<HTMLElement>("[data-inspector-category]"),
    ).map((item) => item.dataset.inspectorCategory);
    await expect(categories).toEqual([
      "timeLocale",
      "canvas",
      "webGL",
      "navigator",
      "battery",
    ]);
  },
};

export const EveryCallWarning: Story = {
  play: async (context) => {
    const canvas = await openInspector(context);
    const everyCall = canvas.getByRole("switch", {
      name: t.sidebar.inspector.everyCall,
    });
    await userEvent.click(everyCall);
    await expect(everyCall).toHaveAccessibleDescription(
      t.sidebar.inspector.everyCallWarning,
    );
  },
};

export const UnspoofedMethods: Story = {
  play: async (context) => {
    const canvas = await openInspector(context);
    const screen = canvas.getByRole("checkbox", {
      name: t.sidebar.accessed.categories.screen,
    });
    await expect(screen).toBeDisabled();
    await expandCategory(canvas, t.sidebar.accessed.categories.screen);
    const width = canvas.getByRole("checkbox", {
      name: t.sidebar.accessed.methods.screenWidth,
    });
    await expect(width).toBeDisabled();
    await expect(width).toHaveAccessibleDescription(
      new RegExp(t.sidebar.inspector.list.notTrappable),
    );
  },
};

export const ArmAndReload: Story = {
  play: async (context) => {
    const canvas = await selectBatteryLevel(context);
    await userEvent.click(
      canvas.getByRole("button", { name: t.sidebar.inspector.actions.armReload }),
    );
    await expectPhase(context.canvasElement, "armed");
    await expect(panel(context.canvasElement)).toHaveAttribute(
      "data-inspector-pending-reload",
      "false",
    );
    await expect(canvas.getByRole("status")).toHaveTextContent(
      t.sidebar.inspector.result.reload,
    );
  },
};

export const ArmOnNextLoad: Story = {
  play: async (context) => {
    const canvas = await selectBatteryLevel(context);
    await userEvent.click(
      canvas.getByRole("button", { name: t.sidebar.inspector.actions.armNextLoad }),
    );
    await expectPhase(context.canvasElement, "armed");
    await expect(panel(context.canvasElement)).toHaveAttribute(
      "data-inspector-pending-reload",
      "true",
    );
    await expect(
      canvas.getByRole("button", { name: t.sidebar.inspector.actions.reloadNow }),
    ).toBeVisible();
  },
};

export const AppliesLive: Story = {
  args: { preset: "live" },
  play: async (context) => {
    const canvas = await selectBatteryLevel(context);
    await expect(
      canvas.queryByRole("button", { name: t.sidebar.inspector.actions.armNextLoad }),
    ).toBeNull();
    await expect(canvas.queryByText(t.sidebar.inspector.reloadNote)).toBeNull();
    await userEvent.click(
      canvas.getByRole("button", { name: t.sidebar.inspector.actions.arm }),
    );
    await expectPhase(context.canvasElement, "armed");
    await expect(canvas.getByRole("status")).toHaveTextContent(
      t.sidebar.inspector.result.live,
    );
  },
};

export const Armed: Story = {
  args: { preset: "armed" },
  play: async (context) => {
    const canvas = within(context.canvasElement);
    await expect(inspectorToggle(canvas)).toHaveAttribute(
      "data-inspector-armed",
      "true",
    );
    await openInspector(context);
    await expectPhase(context.canvasElement, "armed");
    await expect(
      canvas.getByRole("checkbox", { name: battery }),
    ).toBePartiallyChecked();
    await expect(
      canvas.getByRole("button", { name: t.sidebar.inspector.actions.disarmReload }),
    ).toBeEnabled();
  },
};

export const SelectionChanged: Story = {
  args: { preset: "armed" },
  play: async (context) => {
    const canvas = await openInspector(context);
    await userEvent.click(
      canvas.getByRole("checkbox", { name: t.sidebar.accessed.categories.canvas }),
    );
    await expectPhase(context.canvasElement, "changed");
    await expect(
      canvas.getByRole("button", { name: t.sidebar.inspector.actions.applyReload }),
    ).toBeEnabled();
    await userEvent.click(
      canvas.getByRole("button", { name: t.sidebar.inspector.actions.revert }),
    );
    await expectPhase(context.canvasElement, "armed");
  },
};

export const PendingReload: Story = {
  args: { preset: "pending-reload" },
  play: async (context) => {
    const canvas = await openInspector(context);
    await expectPhase(context.canvasElement, "armed");
    await expect(
      canvas.getByText(new RegExp(t.sidebar.inspector.hint.pendingArm)),
    ).toBeVisible();
  },
};

export const ApplyError: Story = {
  args: { preset: "error" },
  play: async (context) => {
    const canvas = await selectBatteryLevel(context);
    await userEvent.click(
      canvas.getByRole("button", { name: t.sidebar.inspector.actions.armReload }),
    );
    await expect(await canvas.findByRole("alert")).toHaveTextContent(
      t.sidebar.inspector.actionError("The tab was closed."),
    );
    await expectPhase(context.canvasElement, "idle");
  },
};

export const Applying: Story = {
  args: { preset: "slow" },
  play: async (context) => {
    const canvas = await selectBatteryLevel(context);
    const arm = canvas.getByRole("button", {
      name: t.sidebar.inspector.actions.armReload,
    });
    await userEvent.click(arm);
    await expect(arm).toBeDisabled();
    await expect(arm).toHaveAttribute("aria-busy", "true");
    await expect(canvas.getByRole("checkbox", { name: batteryLevel })).toBeDisabled();
  },
};

const unavailableStory = (
  preset: InspectorStoryPreset,
  reason: string,
  message: string,
): Story => ({
  args: { preset },
  play: async (context) => {
    const canvas = await openInspector(context);
    await expect(panel(context.canvasElement)).toHaveAttribute(
      "data-inspector-unavailable",
      reason,
    );
    await expect(canvas.getByText(message)).toBeVisible();
    await expect(canvas.queryByRole("checkbox")).toBeNull();
  },
});

export const UnsupportedUrl = unavailableStory(
  "unsupported-url",
  "unsupported-url",
  t.sidebar.inspector.unavailable.unsupportedUrl,
);
export const TrustedSite = unavailableStory(
  "trusted-site",
  "trusted-site",
  t.sidebar.inspector.unavailable.trustedSite,
);
export const ProtectionPaused = unavailableStory(
  "protection-paused",
  "protection-paused",
  t.sidebar.inspector.unavailable.protectionPaused,
);
export const NoRuntime = unavailableStory(
  "no-runtime",
  "no-runtime",
  t.sidebar.inspector.unavailable.noRuntime,
);

export const FirefoxHint: Story = {
  args: { browserTarget: "firefox" },
  play: async (context) => {
    const canvas = await openInspector(context);
    await expect(canvas.getByText(t.sidebar.inspector.firefoxNotice)).toBeVisible();
  },
};

export const ChromiumHasNoFirefoxHint: Story = {
  tags: ["!dev", "!autodocs"],
  play: async (context) => {
    const canvas = await openInspector(context);
    await expect(canvas.queryByText(t.sidebar.inspector.firefoxNotice)).toBeNull();
  },
};

export const KeyboardOperation: Story = {
  tags: ["!dev", "!autodocs"],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    inspectorToggle(canvas).focus();
    await userEvent.keyboard("{Enter}");
    await waitFor(() =>
      expect(panel(canvasElement)).toHaveAttribute("data-inspector-phase", "idle"),
    );
    const disclosure = canvas.getByRole("button", {
      name: t.sidebar.inspector.list.methodsOf(battery),
    });
    disclosure.focus();
    await userEvent.keyboard("{Enter}");
    await expect(disclosure).toHaveAttribute("aria-expanded", "true");
    await userEvent.tab();
    await expect(canvas.getByRole("checkbox", { name: battery })).toHaveFocus();
    await userEvent.keyboard(" ");
    await expect(canvas.getByRole("checkbox", { name: battery })).toBeChecked();
    await expect(canvas.getByRole("checkbox", { name: batteryLevel })).toBeChecked();
  },
};

const layoutPlay = async (context: PlayContext) => {
  await selectBatteryLevel(context);
  const shell = context.canvasElement.querySelector<HTMLElement>("main");
  if (!shell) throw new Error("Missing story shell.");
  await expect(shell.scrollWidth).toBeLessThanOrEqual(shell.clientWidth);
};

export const Popup360: Story = { args: { width: 360 }, play: layoutPlay };
export const Sidebar400: Story = { args: { width: 400 }, play: layoutPlay };
export const Sidecar720: Story = { args: { width: 720 }, play: layoutPlay };
export const Popup360Dark: Story = {
  args: { width: 360 },
  globals: { theme: "dark" },
  play: layoutPlay,
};
export const Sidebar400Dark: Story = {
  args: { width: 400 },
  globals: { theme: "dark" },
  play: layoutPlay,
};
export const Sidecar720Dark: Story = {
  args: { width: 720 },
  globals: { theme: "dark" },
  play: layoutPlay,
};
export const ArmedDark: Story = { ...Armed, globals: { theme: "dark" } };
