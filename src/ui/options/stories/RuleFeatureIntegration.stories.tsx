import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";

import {
  installChromeBoundary,
  STORY_LOCATIONS,
  StorySettingsProvider,
} from "./options-story-fixtures";
import {
  createFeatureRuntimeMock,
  FEATURE_STORY_SCENARIOS,
  installFeatureRuntime,
  type FeatureStoryScenario,
} from "./provider-feature-runtime-mock";

import { RuleDialog } from "@/ui/options/components/modals/RuleDialog";

installChromeBoundary();

type RuleEditorSurfaceProps = {
  savedPattern: string;
  /** Omitted for the pre-integration baseline with no provider listener. */
  scenario?: FeatureStoryScenario;
};

const RuleEditorSurface = ({ savedPattern }: RuleEditorSurfaceProps) => {
  const [pattern, setPattern] = useState(savedPattern);
  return (
    <StorySettingsProvider
      value={{
        ruleDialogOpened: true,
        closeRuleDialog: fn(),
        ruleDialogMode: "edit",
        handleRuleSubmit: fn(async () => undefined),
        rulePattern: pattern,
        setRulePattern: setPattern,
        editingRulePattern: savedPattern,
        editingRuleSeedKey: "story-rule-identity",
        rotateRuleIdentity: fn(async () => true),
        ruleEnabled: true,
        setRuleEnabled: fn(),
        ruleProfileId: "warsaw",
        setRuleProfileId: fn(),
        ruleProfileOptions: STORY_LOCATIONS.map(({ id, label }) => ({
          value: id,
          label,
        })),
        ruleSurfaceOverrides: {},
        setRuleSurfaceOverrides: fn(),
        trustedSites: [],
        ruleRelaxCsp: false,
        setRuleRelaxCsp: fn(),
        handleDeleteRule: fn(async () => true),
      }}
    >
      <RuleDialog />
    </StorySettingsProvider>
  );
};

const meta = {
  title: "Options/Rule feature integration",
  component: RuleEditorSurface,
  parameters: { layout: "fullscreen", privacyThing: { surface: "options" } },
  args: { savedPattern: "video.example.com" },
  argTypes: {
    scenario: { control: "select", options: FEATURE_STORY_SCENARIOS },
  },
  beforeEach: ({ args }) => {
    installFeatureRuntime(
      args.scenario
        ? createFeatureRuntimeMock(args.scenario, args.savedPattern, args.savedPattern)
            .sendMessage
        : null,
    );
  },
} satisfies Meta<typeof RuleEditorSurface>;

export default meta;
type Story = StoryObj<typeof meta>;

const body = (canvasElement: HTMLElement) => within(canvasElement.ownerDocument.body);

const findPanel = async (canvasElement: HTMLElement) =>
  waitFor(() => {
    const panel = canvasElement.ownerDocument.querySelector<HTMLElement>(
      "[data-provider-feature]",
    );
    if (!panel) throw new Error("Provider feature panel has not rendered.");
    return panel;
  });

const clickAction = async (panel: HTMLElement, action: string) => {
  const button = panel.querySelector<HTMLElement>(
    `[data-provider-feature-action="${action}"]`,
  );
  if (!button) throw new Error(`Missing ${action} action.`);
  await userEvent.click(button);
};

const expectNoPanel: NonNullable<Story["play"]> = async ({ canvasElement }) => {
  await body(canvasElement).findByRole("dialog");
  await expect(
    canvasElement.ownerDocument.querySelector("[data-provider-feature]"),
  ).toBeNull();
};

/** Baseline without a provider listener: the editor is unchanged. */
export const DomainRuleEditor: Story = { play: expectNoPanel };

export const ProviderUnavailable: Story = {
  args: { scenario: "unavailable" },
  play: expectNoPanel,
};

export const FeatureNotChecked: Story = {
  args: { savedPattern: "www.youtube.com", scenario: "not-checked" },
  play: async ({ canvasElement }) => {
    const panel = await findPanel(canvasElement);
    await expect(panel).toHaveAttribute("data-provider-feature-view", "idle");
  },
};

export const FeatureSuggested: Story = {
  args: { savedPattern: "www.youtube.com", scenario: "suggested" },
  play: async ({ canvasElement }) => {
    const panel = await findPanel(canvasElement);
    await expect(panel).toHaveAttribute("data-provider-feature-view", "suggested");
  },
};

export const FeatureUnresolved: Story = {
  args: { savedPattern: "video.example.com", scenario: "unresolved" },
};

export const FeatureDismissed: Story = {
  args: { savedPattern: "www.youtube.com", scenario: "dismissed" },
};

export const FeatureLinked: Story = {
  args: { savedPattern: "www.youtube.com", scenario: "linked" },
  play: async ({ canvasElement }) => {
    const panel = await findPanel(canvasElement);
    await expect(panel).toHaveAttribute("data-provider-feature-view", "bound");
    await expect(panel.querySelector("[data-provider-feature-sync]")).toHaveAttribute(
      "data-provider-feature-sync",
      "synced",
    );
  },
};

export const FeatureSyncFailed: Story = {
  args: { savedPattern: "www.youtube.com", scenario: "sync-failed" },
  play: async ({ canvasElement }) => {
    const panel = await findPanel(canvasElement);
    await expect(panel.querySelector("[data-provider-feature-sync]")).toHaveAttribute(
      "data-provider-feature-sync",
      "error",
    );
    await body(canvasElement).findByRole("alert");
  },
};

export const FeatureCheckFailed: Story = {
  args: { savedPattern: "www.youtube.com", scenario: "check-failed" },
  play: async ({ canvasElement }) => {
    const panel = await findPanel(canvasElement);
    await clickAction(panel, "recognize");
    await body(canvasElement).findByRole("alert");
    await expect(panel).toHaveAttribute("data-provider-feature-view", "idle");
    await expect(panel).toHaveAttribute("data-provider-feature-busy", "false");
  },
};

export const FeatureChecking: Story = {
  args: { savedPattern: "www.youtube.com", scenario: "checking" },
  play: async ({ canvasElement }) => {
    const panel = await findPanel(canvasElement);
    await clickAction(panel, "recognize");
    await waitFor(() =>
      expect(panel).toHaveAttribute("data-provider-feature-view", "checking"),
    );
  },
};

/** A broad source asks for one representative host instead of asserting the pattern. */
export const BroadPatternHostname: Story = {
  args: { savedPattern: "*.youtube.com", scenario: "not-checked" },
  play: async ({ canvasElement }) => {
    const panel = await findPanel(canvasElement);
    const field = canvasElement.ownerDocument.querySelector<HTMLInputElement>(
      "[data-provider-feature-host-field] input",
    );
    if (!field) throw new Error("Missing representative hostname field.");
    await expect(field).toHaveValue("");
    await userEvent.type(field, "music.youtube.com{Enter}");
    await clickAction(panel, "recognize");
    await waitFor(() =>
      expect(panel).toHaveAttribute("data-provider-feature-view", "suggested"),
    );
    await expect(
      panel.querySelector("[data-provider-feature-section=evidence]"),
    ).toHaveTextContent("music.youtube.com");
  },
};

/** Full suggestion → confirm → detach loop against the stateful mock. */
export const ConfirmAndDetach: Story = {
  args: { savedPattern: "www.youtube.com", scenario: "not-checked" },
  play: async ({ canvasElement }) => {
    const panel = await findPanel(canvasElement);
    await clickAction(panel, "recognize");
    await waitFor(() =>
      expect(panel).toHaveAttribute("data-provider-feature-view", "suggested"),
    );
    await clickAction(panel, "confirm");
    await waitFor(() =>
      expect(panel).toHaveAttribute("data-provider-feature-view", "bound"),
    );
    await expect(panel.querySelector("[data-provider-feature-sync]")).toHaveAttribute(
      "data-provider-feature-sync",
      "queued",
    );
    await clickAction(panel, "detach");
    await waitFor(() =>
      expect(panel).toHaveAttribute("data-provider-feature-view", "suggested"),
    );
  },
};
