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

import type { SurfaceOverrides } from "@/shared/types";
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
  const [profileId, setProfileId] = useState("warsaw");
  const [enabled, setEnabled] = useState(true);
  const [surfaces, setSurfaces] = useState<SurfaceOverrides | undefined>({});
  const [relax, setRelax] = useState(false);
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
        ruleEnabled: enabled,
        setRuleEnabled: setEnabled,
        ruleProfileId: profileId,
        setRuleProfileId: setProfileId,
        ruleProfileOptions: STORY_LOCATIONS.map(({ id, label }) => ({
          value: id,
          label,
        })),
        ruleSurfaceOverrides: surfaces,
        setRuleSurfaceOverrides: setSurfaces,
        trustedSites: [],
        ruleRelaxCsp: relax,
        setRuleRelaxCsp: setRelax,
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
const selectProfile = async (canvasElement: HTMLElement, label: string) => {
  const root = canvasElement.ownerDocument;
  const trigger = root.getElementById("dialog-rule-profile");
  if (!trigger) throw new Error("Missing regional preset.");
  await userEvent.click(trigger);
  await userEvent.click(
    await body(canvasElement).findByRole("option", { name: label }),
  );
};

export const JoinExisting: Story = {
  args: { savedPattern: "music.youtube.com", scenario: "join" },
  play: async ({ canvasElement }) => {
    const root = canvasElement.ownerDocument;
    const panel = await findPanel(canvasElement);
    await expect(panel).toHaveAttribute("data-provider-feature-state", "join");
    await expect(panel.querySelector("[data-plugin-feature-join]")).toHaveTextContent(
      "YouTube",
    );
    await expect(panel.querySelector("[data-plugin-feature-term]")).toBeNull();
    const form = () => root.querySelector("[data-join-lock]");
    const preset = () => root.getElementById("dialog-rule-profile");
    await selectProfile(canvasElement, "New York");
    await expect(preset()).toHaveAttribute("data-selected-value", "new-york");
    await expect(preset()).toBeEnabled();
    await clickAction(panel, "join");
    await expect(form()).toHaveAttribute("data-join-lock", "locked");
    await expect(form()).toHaveAttribute("data-join-source", "canonical");
    await expect(preset()).toHaveAttribute("data-selected-value", "warsaw");
    await expect(preset()).toBeDisabled();
    await expect(root.getElementById("dialog-rule-enabled")).toBeDisabled();
    await expect(root.getElementById("dialog-rule-enabled")).toHaveAttribute(
      "aria-checked",
      "false",
    );
    await expect(root.getElementById("open-rule-advanced-dialog")).toBeDisabled();
    await expect(
      root.querySelector("[data-dialog-section='identity'] button"),
    ).toBeDisabled();
    const block = root.querySelector("button[aria-label='Block']");
    await expect(block).toHaveAttribute("aria-pressed", "true");
    await expect(block).toBeDisabled();
    await expect(root.getElementById("dialog-rule-pattern")).toBeEnabled();
    await expect(root.getElementById("save-rule-dialog")).toBeEnabled();
    await clickAction(panel, "join");
    await expect(form()).toHaveAttribute("data-join-source", "open");
    await expect(preset()).toHaveAttribute("data-selected-value", "new-york");
    await expect(preset()).toBeEnabled();
    await expect(root.getElementById("dialog-rule-enabled")).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await clickAction(panel, "join");
    const add = root.querySelector<HTMLElement>('[data-rule-host-action="add"]');
    if (!add) throw new Error("Missing add pattern.");
    await userEvent.click(add);
    const extra = root.querySelector<HTMLInputElement>("[data-rule-host-input]");
    await expect(extra).not.toBeNull();
    await expect(extra).toBeRequired();
    await expect(root.querySelector('input[name="featureDecision"]')).toBeNull();
    await expect(preset()).toHaveAttribute("data-selected-value", "new-york");
    await expect(preset()).toBeEnabled();
    await clickAction(await findPanel(canvasElement), "join");
    const pattern = root.getElementById("dialog-rule-pattern");
    if (!(pattern instanceof HTMLInputElement)) throw new Error("Missing pattern.");
    await userEvent.type(pattern, ".edited");
    await expect(root.querySelector('input[name="featureDecision"]')).toBeNull();
    await expect(preset()).toHaveAttribute("data-selected-value", "new-york");
    await expect(form()).toHaveAttribute("data-join-lock", "open");
  },
};
export const FeatureSyncFailed: Story = {
  args: { savedPattern: "www.youtube.com", scenario: "sync-failed" },
};
export const JoinSelected: Story = {
  args: { ...JoinExisting.args },
  play: async ({ canvasElement }) => {
    await clickAction(await findPanel(canvasElement), "join");
    await expect(
      canvasElement.ownerDocument.querySelector("[data-join-lock]"),
    ).toHaveAttribute("data-join-lock", "locked");
  },
};
export const JoinCollision: Story = {
  args: { ...JoinExisting.args, draft: true },
  play: async ({ canvasElement }) => {
    const root = canvasElement.ownerDocument;
    const panel = await findPanel(canvasElement);
    await expect(root.getElementById("dialog-rule-profile")).toBeDisabled();
    await expect(root.getElementById("open-rule-advanced-dialog")).toBeDisabled();
    await expect(root.getElementById("save-rule-dialog")).toBeDisabled();
    await expect(root.querySelector('input[name="featureDecision"]')).toBeNull();
    await expect(root.getElementById("dialog-rule-pattern")).toBeEnabled();
    const form = root.getElementById("rule-dialog-form");
    const EventType = root.defaultView?.Event;
    if (!form || !EventType) throw new Error("Missing rule form.");
    await expect(
      form.dispatchEvent(new EventType("submit", { bubbles: true, cancelable: true })),
    ).toBe(false);
    await clickAction(panel, "join");
    await expect(root.getElementById("save-rule-dialog")).toBeEnabled();
  },
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

export const ExcludedPreset: Story = {
  args: { scenario: "excluded", savedPattern: "youtube.com", draft: true },
  play: async ({ canvasElement }) => {
    const panel = await findPanel(canvasElement);
    await waitFor(() =>
      expect(panel.querySelector("[data-plugin-sync-context]")).toHaveAttribute(
        "data-plugin-sync-context",
        "excluded",
      ),
    );
    await expect(panel.querySelector("[data-plugin-settings-link]")).toHaveAttribute(
      "href",
      "chrome-extension://storybook/src/ui/options/index.html#page-experimental-integration?section=routes&preset=warsaw",
    );
  },
};
export const PausedSync: Story = {
  args: { scenario: "paused", savedPattern: "youtube.com", draft: true },
};
export const NoPreset: Story = {
  args: { scenario: "no-preset", savedPattern: "youtube.com", draft: true },
};
export const UnconfirmedRoute: Story = {
  args: { scenario: "pending", savedPattern: "youtube.com", draft: true },
};
export const DisabledRule: Story = {
  args: { scenario: "disabled", savedPattern: "youtube.com" },
};
export const LinkedExcludedPreset: Story = {
  args: { scenario: "linked-excluded", savedPattern: "youtube.com" },
};
export const ServiceTooltip: Story = {
  args: { scenario: "suggested", savedPattern: "youtube.com", draft: true },
  play: async ({ canvasElement }) => {
    const panel = await findPanel(canvasElement);
    const trigger = panel.querySelector<HTMLElement>("[data-plugin-feature-term]");
    if (!trigger) throw new Error("Missing service term");
    await userEvent.hover(trigger);
    await body(canvasElement).findByRole("tooltip");
  },
};

export const PatternActionRow: Story = {
  args: { savedPattern: "www.youtube.com", multipleSites: true },
  play: async ({ canvasElement }) => {
    const doc = canvasElement.ownerDocument;
    const add = () =>
      doc.querySelector<HTMLButtonElement>("[data-rule-host-action=add]");
    const last = () =>
      Array.from(
        doc.querySelectorAll<HTMLInputElement>("[data-rule-pattern-row] input"),
      ).at(-1);
    const sameRow = () => {
      const button = add(),
        input = last();
      if (!button || !input) throw new Error("Missing pattern controls");
      expect(button).toHaveAccessibleName("Add pattern");
      expect(button.textContent?.trim()).toBe("+");
      expect(button.closest("[data-rule-pattern-row]")).toBe(
        input.closest("[data-rule-pattern-row]"),
      );
      expect(
        Math.abs(
          button.getBoundingClientRect().y +
            button.getBoundingClientRect().height / 2 -
            input.getBoundingClientRect().y -
            input.getBoundingClientRect().height / 2,
        ),
      ).toBeLessThan(2);
    };
    sameRow();
    const before = doc.querySelectorAll("[data-rule-host-input]").length;
    await userEvent.click(add()!);
    await waitFor(() =>
      expect(doc.querySelectorAll("[data-rule-host-input]")).toHaveLength(before + 1),
    );
    sameRow();
    const remove = last()
      ?.closest("[data-rule-pattern-row]")
      ?.querySelector<HTMLElement>("[data-rule-host-action=remove]");
    if (!remove) throw new Error("Missing remove pattern action");
    await userEvent.click(remove);
    await waitFor(() =>
      expect(doc.querySelectorAll("[data-rule-host-input]")).toHaveLength(before),
    );
    sameRow();
  },
};
