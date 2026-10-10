import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, userEvent, waitFor } from "storybook/test";
import "@fortawesome/fontawesome-free/css/fontawesome.css";
import "@fortawesome/fontawesome-free/css/solid.css";
import "../popup.css";

import { PopupRuleSheet } from "../components/PopupRuleSheet";

import type { SharedWorkerHandlingMode } from "@/shared/types";
import { t } from "@/ui/i18n";
import { useUiLocale } from "@/ui/i18n/LocaleRefresh";
import { installChromeBoundary } from "@/ui/options/stories/options-story-fixtures";
import {
  createFeatureRuntimeMock,
  FEATURE_STORY_SCENARIOS,
  installFeatureRuntime,
  type FeatureStoryScenario,
} from "@/ui/options/stories/provider-feature-runtime-mock";
import { ProviderFeatureHost } from "@/ui/shared/ProviderFeatureHost";
import { ruleGroupCopy } from "@/ui/shared/rule-group-copy";
import { RuleHostList } from "@/ui/shared/RuleHosts";

installChromeBoundary();

const LOCATIONS = [
  { id: "warsaw", label: "Warsaw" },
  { id: "lisbon", label: "Lisbon" },
];

type PopupRuleFeatureProps = {
  /** Saved rule that matched the current tab; `null` models an unsaved draft. */
  savedPattern: string | null;
  hostname: string;
  scenario?: FeatureStoryScenario;
};

const PopupRuleFeatureSurface = ({
  savedPattern,
  hostname,
  scenario,
}: PopupRuleFeatureProps) => {
  const groupCopy = ruleGroupCopy[useUiLocale()];
  const [locationId, setLocationId] = useState<string | null>("warsaw");
  const [ruleMode, setRuleMode] = useState<"exact" | "suffix">(
    savedPattern?.startsWith("*") ? "suffix" : "exact",
  );
  const [serviceWorker, setServiceWorker] = useState<boolean | undefined>();
  const [worker, setWorker] = useState<SharedWorkerHandlingMode>();
  const [relaxCsp, setRelaxCsp] = useState(false);
  return (
    <div className="min-h-[640px] bg-background p-6 text-foreground">
      <div
        className="gw-popup-layout mx-auto flex h-[600px] w-[360px] overflow-hidden border border-border bg-background shadow-2xl"
        data-workspace-open="true"
        data-sizing-state="drill-in"
      >
        <PopupRuleSheet
          open
          drillIn
          view="rule-form"
          title={
            scenario === "group-linked"
              ? t.rules.dialog.titleEdit
              : (savedPattern ?? hostname)
          }
          description={t.popup.sheetLead}
          formExtra={
            <>
              {scenario === "group-linked" ? (
                <RuleHostList
                  patterns={[savedPattern ?? hostname, "music.youtube.com", "youtu.be"]}
                />
              ) : null}
              <ProviderFeatureHost
                variant="compact"
                rulePattern={savedPattern ?? hostname}
                {...(savedPattern ? { savedRulePattern: savedPattern } : {})}
                hostname={hostname}
              />
            </>
          }
          selectedLocationId={locationId}
          noPresetLabel={t.popup.noPresetLabel}
          locations={LOCATIONS}
          ruleMode={ruleMode}
          serviceWorkerOverride={serviceWorker}
          workerHandlingOverride={worker}
          relaxCspForWorkers={relaxCsp}
          locationLabel={t.popup.currentProfileLabel}
          ruleTypeLabel={
            scenario === "group-linked"
              ? groupCopy.matchThisDomain
              : t.popup.ruleTypeLabel
          }
          exactLabel={t.popup.ruleTypeExact}
          suffixLabel={t.popup.ruleTypeSuffix}
          advancedTitle={t.popup.advancedSectionTitle}
          serviceWorkerLabel={t.rules.dialog.surfaceOverrides.serviceWorker.label}
          serviceWorkerHint={t.rules.dialog.surfaceOverrides.serviceWorker.info}
          serviceWorkerBlockLabel={t.rules.dialog.surfaceOverrides.stateBlock}
          serviceWorkerInherit={t.rules.dialog.surfaceOverrides.stateInherit}
          serviceWorkerAllowLabel={t.rules.dialog.surfaceOverrides.stateAllow}
          workerHandlingLabel={t.popup.workerHandlingLabel}
          workerHandlingHint={t.popup.workerHandlingHint}
          workerInherit={t.popup.workerHandlingInherit}
          workerNative={t.popup.workerHandlingNative}
          workerHandlingSpoofLabel={t.popup.workerHandlingSpoof}
          workerStrict={t.popup.workerHandlingStrict}
          relaxCspLabel={t.rules.dialog.relaxCspLabel}
          relaxCspHint={t.popup.relaxCspHint}
          detailsAriaLabel={t.popup.detailsAbout}
          fullSettingsLabel={t.popup.openFullRuleSettings}
          saveLabel={savedPattern ? t.popup.saveLabelSave : t.popup.saveLabelCreate}
          deleteLabel={t.popup.deleteButtonLabel}
          deleteTone="destructive"
          closeAriaLabel={t.popup.closeSheetAriaLabel}
          closeLabel={t.common.actions.close}
          backLabel={t.common.actions.back}
          cancelLabel={t.common.actions.cancel}
          canDelete={savedPattern !== null}
          canSave
          onLocationChange={setLocationId}
          onRuleModeChange={setRuleMode}
          onServiceWorkerChange={setServiceWorker}
          onWorkerChange={setWorker}
          onRelaxCspChange={setRelaxCsp}
        />
      </div>
    </div>
  );
};

const meta = {
  title: "Popup/Rule feature integration",
  component: PopupRuleFeatureSurface,
  parameters: { layout: "fullscreen", privacyThing: { surface: "component" } },
  args: {
    savedPattern: "*youtube.com",
    hostname: "www.youtube.com",
    scenario: "suggested",
  },
  argTypes: {
    scenario: { control: "select", options: FEATURE_STORY_SCENARIOS },
  },
  beforeEach: ({ args }) => {
    installFeatureRuntime(
      args.scenario
        ? createFeatureRuntimeMock(
            args.scenario,
            args.savedPattern ?? args.hostname,
            args.hostname,
          ).sendMessage
        : null,
    );
  },
} satisfies Meta<typeof PopupRuleFeatureSurface>;

export default meta;
type Story = StoryObj<typeof meta>;

const findPanel = async (canvasElement: HTMLElement) =>
  waitFor(() => {
    const panel = canvasElement.querySelector<HTMLElement>("[data-provider-feature]");
    if (!panel) throw new Error("Provider feature panel has not rendered.");
    return panel;
  });

export const SavedRuleSuggested: Story = {
  play: async ({ canvasElement }) => {
    const panel = await findPanel(canvasElement);
    await expect(panel).toHaveAttribute("data-provider-feature-state", "suggest");
    const choice = panel.querySelector("[data-provider-feature-choice]");
    const question = choice?.querySelector("p");
    const scope = choice?.querySelector("[data-provider-feature-scope]");
    const control = choice?.querySelector('[role="switch"]');
    if (!choice || !question || !scope || !control)
      throw new Error("Missing service choice.");
    await expect(scope.getBoundingClientRect().top).toBeGreaterThanOrEqual(
      question.getBoundingClientRect().bottom,
    );
    await expect(control.getBoundingClientRect().top).toBeGreaterThanOrEqual(
      scope.getBoundingClientRect().bottom,
    );
    await expect(question.getBoundingClientRect().left).toBeCloseTo(
      scope.getBoundingClientRect().left,
      0,
    );
    await expect(control).toHaveAttribute("aria-checked", "false");
  },
};
export const SavedRuleLinked: Story = { args: { scenario: "linked" } };
export const GroupLinked: Story = {
  args: { scenario: "group-linked" },
  play: async ({ canvasElement }) => {
    await expect(
      [...canvasElement.querySelectorAll("[data-rule-host]")].map((element) =>
        element.getAttribute("data-rule-host"),
      ),
    ).toEqual(["*youtube.com", "music.youtube.com", "youtu.be"]);
    await expect(
      canvasElement.querySelector("[data-provider-feature-site-count]"),
    ).toBeNull();
  },
};
export const JoinExisting: Story = {
  args: { savedPattern: null, hostname: "music.youtube.com", scenario: "join" },
};
export const UnsavedDraft: Story = {
  args: { savedPattern: null, scenario: "not-checked" },
};
export const DraftStaged: Story = {
  args: { savedPattern: null, scenario: "suggested" },
  play: async ({ canvasElement }) => {
    const panel = await findPanel(canvasElement);
    const accept = panel.querySelector<HTMLElement>(
      '[data-provider-feature-action="accept"]',
    );
    if (!accept) throw new Error("Missing accept action.");
    await userEvent.click(accept);
    await expect(panel).toHaveAttribute("data-provider-feature-state", "staged");
  },
};
