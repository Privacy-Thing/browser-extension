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
  draft?: boolean;
  /** Omitted for the pre-integration baseline with no provider listener. */
  scenario?: FeatureStoryScenario;
  multipleSites?: boolean;
};

const RuleEditorSurface = ({
  savedPattern,
  draft,
  scenario,
  multipleSites,
}: RuleEditorSurfaceProps) => {
  const [pattern, setPattern] = useState(savedPattern);
  return (
    <StorySettingsProvider
      value={{
        ruleDialogOpened: true,
        closeRuleDialog: fn(),
        ruleDialogMode: draft ? "add" : "edit",
        handleRuleSubmit: fn(async () => undefined),
        rulePattern: pattern,
        setRulePattern: setPattern,
        editingRulePattern: draft ? null : savedPattern,
        featureBindings:
          scenario === "group-linked"
            ? [
                {
                  rulePattern: savedPattern,
                  rulePatterns: [savedPattern, "music.youtube.com", "youtu.be"],
                  providerId: "control-d",
                  featureId: "youtube",
                  featureName: "YouTube",
                  featureType: "service",
                },
              ]
            : [],
        rules: [],
        ...(scenario === "group-linked" || multipleSites
          ? {
              rules: [savedPattern, "music.youtube.com", "youtu.be"].map((pattern) => ({
                pattern,
                groupId: "story-product-group",
                locationId: "warsaw",
                enabled: true,
                ruleSeedKey: "story-rule-identity",
                authKey: "story-controlled-auth",
              })),
            }
          : {}),
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

export const FeatureSuggested: Story = {
  args: { savedPattern: "www.youtube.com", scenario: "suggested" },
  play: async ({ canvasElement }) => {
    await expect(await findPanel(canvasElement)).toHaveAttribute(
      "data-provider-feature-state",
      "suggest",
    );
  },
};
export const AddDraft: Story = {
  args: { savedPattern: "www.youtube.com", draft: true, scenario: "not-checked" },
};
export const DraftStaged: Story = {
  args: { savedPattern: "www.youtube.com", draft: true, scenario: "suggested" },
  play: async ({ canvasElement }) => {
    const panel = await findPanel(canvasElement);
    await clickAction(panel, "accept");
    await expect(panel).toHaveAttribute("data-provider-feature-state", "staged");
    await expect(
      canvasElement.ownerDocument.querySelector('input[name="featureDecision"]'),
    ).not.toBeNull();
  },
};
export const FeatureUnresolved: Story = { args: { scenario: "unresolved" } };
export const FeatureDismissed: Story = {
  args: { savedPattern: "www.youtube.com", scenario: "dismissed" },
};
export const FeatureLinked: Story = {
  args: { savedPattern: "www.youtube.com", scenario: "linked" },
};
export const GroupLinked: Story = {
  args: { savedPattern: "www.youtube.com", scenario: "group-linked" },
};
export const JoinExisting: Story = {
  args: { savedPattern: "music.youtube.com", draft: true, scenario: "join" },
};
export const FeatureSyncFailed: Story = {
  args: { savedPattern: "www.youtube.com", scenario: "sync-failed" },
};
export const FeatureChecking: Story = {
  args: { savedPattern: "www.youtube.com", scenario: "checking" },
};
export const UnsupportedWildcard: Story = {
  args: { savedPattern: "*video*", scenario: "unresolved" },
};
export const LinkedMenu: Story = {
  args: { savedPattern: "www.youtube.com", scenario: "linked" },
  play: async ({ canvasElement }) => {
    const panel = await findPanel(canvasElement);
    await clickAction(panel, "open");
  },
};

/** Multi-site rules belong to PT even when no external provider is installed. */
export const MultiSiteRule: Story = {
  args: { savedPattern: "www.youtube.com", multipleSites: true },
  play: async ({ canvasElement }) => {
    const document = canvasElement.ownerDocument;
    const extras = document.querySelectorAll<HTMLInputElement>(
      "[data-rule-host-input]",
    );
    await expect([...extras].map((input) => input.value)).toEqual([
      "music.youtube.com",
      "youtu.be",
    ]);
    await expect(document.querySelector("[data-provider-decorator-badge]")).toBeNull();
  },
};
