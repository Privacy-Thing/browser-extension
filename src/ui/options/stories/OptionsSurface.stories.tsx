import "@/ui/options/options.css";

import type { Meta, StoryObj } from "@storybook/react";
import { useMemo, useRef, useState } from "react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";

import {
  installChromeBoundary,
  StorySettingsProvider,
  STORY_GLOBAL_FALLBACK,
  STORY_LOCATIONS,
  STORY_RULES,
  STORY_SHOWCASE_LOCATIONS,
  STORY_TRUSTED_SITES,
} from "./options-story-fixtures";

import { defaultSharedSpoofing } from "@/shared/fingerprint-spoofing";
import { DEFAULT_PREFERENCES } from "@/shared/settings-defaults";
import type { SpoofingBrowserTarget } from "@/shared/spoofing-surfaces";
import type {
  DomainRule,
  SharedSpoofingConfig,
  SurfaceOverrides,
} from "@/shared/types";
import { Button } from "@/ui/components/ui/button";
import { Tabs } from "@/ui/components/ui/tabs";
import { t } from "@/ui/i18n";
import { OPTIONS_HOVER_REACTION, OPTIONS_THING_TIMING } from "@/ui/options/brand-thing";
import { GlobalFallbackRuleDialog } from "@/ui/options/components/modals/GlobalFallbackRuleDialog";
import { LocationEditorModal } from "@/ui/options/components/modals/LocationEditorModal";
import { RuleDialog } from "@/ui/options/components/modals/RuleDialog";
import { TrustedSiteDialog } from "@/ui/options/components/modals/TrustedSiteDialog";
import { WelcomeWizard } from "@/ui/options/components/onboarding/WelcomeWizard";
import { AdvancedTab } from "@/ui/options/components/tabs/AdvancedTab";
import type { ContainerRow } from "@/ui/options/components/tabs/containers-table";
import { ContainersView } from "@/ui/options/components/tabs/containers-view";
import { LocationsTab } from "@/ui/options/components/tabs/LocationsTab";
import { OptionsTab } from "@/ui/options/components/tabs/OptionsTab";
import { RulesTab } from "@/ui/options/components/tabs/RulesTab";
import { TrustedSitesTab } from "@/ui/options/components/tabs/TrustedSitesTab";
import { countLocationRuleUsage } from "@/ui/options/location-usage";
import { getLocationAnchor, getRuleAnchor } from "@/ui/options/navigation";
import { getVisibleSelectionState } from "@/ui/options/rule-selection";
import { buildRuleViewModels, resolveRulePreview } from "@/ui/options/rule-utils";
import { AppPageFrame } from "@/ui/shared/AppPageFrame";
import { ThemeProvider } from "@/ui/shared/ThemeProvider";

installChromeBoundary();

type OptionsStoryState =
  "rules" | "profiles" | "containers" | "trusted-sites" | "options" | "advanced";

const tabLabels: Record<OptionsStoryState, string> = {
  rules: t.options.tabs.rules,
  profiles: t.options.tabs.locations,
  containers: "Containers",
  "trusted-sites": t.options.tabs.trustedSites,
  options: t.options.tabs.options,
  advanced: t.options.tabs.advanced,
};

const OptionsSurfaceShell = ({
  activeTab,
  children,
}: {
  activeTab: OptionsStoryState;
  children: React.ReactNode;
}) => (
  <Tabs value={activeTab} className="w-full min-w-0">
    <AppPageFrame
      title={t.options.title}
      animateBrandIcon
      brandThingTiming={OPTIONS_THING_TIMING}
      brandThingHoverReaction={OPTIONS_HOVER_REACTION}
      trackBrandThingPointer
      reduceBrandMotion
      hideTitle
      headerAside={
        <nav
          aria-label={t.options.tabsAriaLabel}
          className="flex flex-wrap justify-end gap-1"
        >
          {(Object.keys(tabLabels) as OptionsStoryState[]).map((tab) => (
            <span
              key={tab}
              aria-current={tab === activeTab ? "page" : undefined}
              className={
                tab === activeTab
                  ? "rounded-md bg-muted px-3 py-2 text-sm font-medium text-foreground"
                  : "rounded-md px-3 py-2 text-sm text-muted-foreground"
              }
            >
              {tabLabels[tab]}
            </span>
          ))}
        </nav>
      }
    >
      {children}
    </AppPageFrame>
  </Tabs>
);

const RulesSurface = ({ rules = STORY_RULES }: { rules?: readonly DomainRule[] }) => {
  const [rulesFilter, setRulesFilter] = useState("");
  const [linkedRuleLocationId, setRuleLocationFilter] = useState<string | null>(null);
  const [selectedRulePatterns, setSelectedRulePatterns] = useState(new Set<string>());
  const [previewHostname, setPreviewHostname] = useState("cnn.com");
  const viewModels = useMemo(
    () =>
      buildRuleViewModels(rules, STORY_LOCATIONS, rulesFilter, linkedRuleLocationId),
    [linkedRuleLocationId, rules, rulesFilter],
  );
  const visibleRuleKeys = viewModels.map(({ rule }) => rule.pattern);

  return (
    <StorySettingsProvider
      value={{
        rulesFilter,
        setRulesFilter,
        profiles: STORY_LOCATIONS,
        globalFallbackRule: STORY_GLOBAL_FALLBACK,
        openFallbackDialog: fn(),
        linkedRuleLocationId,
        setRuleLocationFilter,
        selectedRulePatterns,
        ruleProfileOptions: STORY_LOCATIONS.map(({ id, label }) => ({
          value: id,
          label,
        })),
        assignBulkLocation: fn(async () => undefined),
        handleBulkDelete: fn(async () => undefined),
        viewModels,
        allRuleKeys: rules.map(({ pattern }) => pattern),
        bulkSelectionState: getVisibleSelectionState(
          visibleRuleKeys,
          selectedRulePatterns,
        ),
        visibleRuleKeys,
        setSelectedRulePatterns,
        openRuleDialog: fn(),
        handleDeleteRule: fn(async () => true),
        highlightedAnchorId: null,
        getRuleAnchor,
        previewHostname,
        setPreviewHostname,
        preview: resolveRulePreview({
          hostname: previewHostname,
          cookieStoreId: undefined,
          rules,
          locations: STORY_LOCATIONS,
          trustedSites: STORY_TRUSTED_SITES,
          globalFallbackRule: STORY_GLOBAL_FALLBACK,
        }),
      }}
    >
      <OptionsSurfaceShell activeTab="rules">
        <RulesTab />
      </OptionsSurfaceShell>
    </StorySettingsProvider>
  );
};

const DomainRuleEditorSurface = () => {
  const [rulesFilter, setRulesFilter] = useState("");
  const [linkedRuleLocationId, setRuleLocationFilter] = useState<string | null>(null);
  const [selectedRulePatterns, setSelectedRulePatterns] = useState(new Set<string>());
  const [previewHostname, setPreviewHostname] = useState("cloudflare.com");
  const [ruleDialogOpened, setRuleDialogOpened] = useState(true);
  const [ruleEnabled, setRuleEnabled] = useState(true);
  const [rulePattern, setRulePattern] = useState("cloudflare.com");
  const [ruleProfileId, setRuleProfileId] = useState("new-york");
  const [ruleRelaxCsp, setRuleRelaxCsp] = useState(false);
  const [ruleSurfaceOverrides, setRuleSurfaceOverrides] = useState<
    SurfaceOverrides | undefined
  >({ canvas: true, webGL: true, audio: false });
  const viewModels = useMemo(
    () =>
      buildRuleViewModels(
        STORY_RULES,
        STORY_LOCATIONS,
        rulesFilter,
        linkedRuleLocationId,
      ),
    [linkedRuleLocationId, rulesFilter],
  );
  const visibleRuleKeys = viewModels.map(({ rule }) => rule.pattern);

  return (
    <StorySettingsProvider
      value={{
        rulesFilter,
        setRulesFilter,
        profiles: STORY_LOCATIONS,
        globalFallbackRule: STORY_GLOBAL_FALLBACK,
        openFallbackDialog: fn(),
        linkedRuleLocationId,
        setRuleLocationFilter,
        selectedRulePatterns,
        ruleProfileOptions: STORY_LOCATIONS.map(({ id, label }) => ({
          value: id,
          label,
        })),
        assignBulkLocation: fn(async () => undefined),
        handleBulkDelete: fn(async () => undefined),
        viewModels,
        allRuleKeys: STORY_RULES.map(({ pattern }) => pattern),
        bulkSelectionState: getVisibleSelectionState(
          visibleRuleKeys,
          selectedRulePatterns,
        ),
        visibleRuleKeys,
        setSelectedRulePatterns,
        openRuleDialog: () => setRuleDialogOpened(true),
        handleDeleteRule: fn(async () => true),
        highlightedAnchorId: null,
        getRuleAnchor,
        previewHostname,
        setPreviewHostname,
        preview: resolveRulePreview({
          hostname: previewHostname,
          cookieStoreId: undefined,
          rules: STORY_RULES,
          locations: STORY_LOCATIONS,
          trustedSites: STORY_TRUSTED_SITES,
          globalFallbackRule: STORY_GLOBAL_FALLBACK,
        }),
        ruleDialogOpened,
        closeRuleDialog: () => setRuleDialogOpened(false),
        ruleDialogMode: "edit",
        handleRuleSubmit: async (event) => event.preventDefault(),
        editingRulePattern: "cloudflare.com",
        editingRuleSeedKey: "storybook-cloudflare",
        rotateRuleIdentity: fn(async () => true),
        ruleEnabled,
        setRuleEnabled,
        rulePattern,
        setRulePattern,
        ruleProfileId,
        setRuleProfileId,
        ruleRelaxCsp,
        setRuleRelaxCsp,
        ruleSurfaceOverrides,
        setRuleSurfaceOverrides,
        trustedSites: STORY_TRUSTED_SITES,
      }}
    >
      <OptionsSurfaceShell activeTab="rules">
        <RulesTab />
      </OptionsSurfaceShell>
      <RuleDialog />
    </StorySettingsProvider>
  );
};

const LocationsSurface = () => {
  const [profilesSearch, setProfilesSearch] = useState("");

  return (
    <StorySettingsProvider
      value={{
        profiles: STORY_SHOWCASE_LOCATIONS,
        profilesSearch,
        setProfilesSearch,
        profileUsage: countLocationRuleUsage(STORY_RULES),
        handleOpenProfileEditor: fn(),
        handleAddProfile: fn(async () => undefined),
        openGenerator: fn(),
        highlightedAnchorId: null,
        getLocationAnchor,
        navigateToAnchor: fn(),
      }}
    >
      <OptionsSurfaceShell activeTab="profiles">
        <LocationsTab />
      </OptionsSurfaceShell>
    </StorySettingsProvider>
  );
};

const PresetEditorSurface = () => {
  const [profilesSearch, setProfilesSearch] = useState("");
  const [profileDialogOpened, setProfileDialogOpened] = useState(true);

  return (
    <ThemeProvider>
      <StorySettingsProvider
        value={{
          profiles: STORY_LOCATIONS,
          profilesSearch,
          setProfilesSearch,
          profileUsage: countLocationRuleUsage(STORY_RULES),
          handleOpenProfileEditor: fn(),
          handleAddProfile: fn(async () => undefined),
          openGenerator: fn(),
          highlightedAnchorId: null,
          getLocationAnchor,
          navigateToAnchor: fn(),
          editingProfileIndex: 0,
          pendingEditorDraft: null,
          profileDialogOpened,
          profileEditorSessionId: 1,
          setProfileDialogOpened,
          saveInFlight: false,
          handleDuplicateProfile: fn(async () => true),
          handleRemoveProfile: fn(async () => true),
          handlePersistProfile: fn(async () => true),
          osmConsent: "granted",
          openOsmDialog: fn(),
          regionalPresetUsage: new Map(),
        }}
      >
        <OptionsSurfaceShell activeTab="profiles">
          <LocationsTab />
        </OptionsSurfaceShell>
        <LocationEditorModal />
      </StorySettingsProvider>
    </ThemeProvider>
  );
};

const CONTAINER_FIXTURES: readonly (readonly [
  string,
  string,
  string,
  string | null,
  string,
])[] = [
  ["firefox-container-1", "Personal", "#37adff", "warsaw", "Warsaw"],
  ["firefox-container-2", "Work", "#ff9f00", "new-york", "New York"],
  ["firefox-container-3", "Shopping", "#af51f5", "warsaw", "Warsaw"],
  ["firefox-container-4", "Banking", "#00c79a", null, "No preset"],
];

const CONTAINER_ROWS: ContainerRow[] = [
  {
    id: "default-rule",
    kind: "default-rule",
    cookieStoreId: null,
    name: "Default Rule",
    description: "Used when no site or container rule matches.",
    badgeLabel: null,
    iconUrl: "",
    colorCode: "",
    isOrphaned: false,
    isInactive: false,
    assignmentLocationId: "warsaw",
    assignmentLabel: "Warsaw",
    container: null,
  },
  ...CONTAINER_FIXTURES.map(
    ([cookieStoreId, name, colorCode, locationId, locationLabel]) => ({
      id: cookieStoreId,
      kind: "container" as const,
      cookieStoreId,
      name,
      description: null,
      badgeLabel: null,
      iconUrl: "",
      colorCode,
      isOrphaned: false,
      isInactive: false,
      assignmentLocationId: locationId,
      assignmentLabel: locationLabel,
      container: {
        cookieStoreId,
        name,
        icon: "briefcase" as const,
        iconUrl: "",
        color: "blue" as const,
        colorCode,
      },
    }),
  ),
];

const FirefoxContainersSurface = () => {
  const [filterQuery, setFilterQuery] = useState("");
  const [showInactive, setShowInactive] = useState(true);

  return (
    <OptionsSurfaceShell activeTab="containers">
      <ContainersView
        status="ready"
        rows={CONTAINER_ROWS}
        filterQuery={filterQuery}
        setFilterQuery={setFilterQuery}
        showInactive={showInactive}
        setShowInactive={setShowInactive}
        showEmptyTitle={false}
        emptyDescription="No containers match this filter."
        create={fn()}
        deleteRow={fn(async () => undefined)}
        editRow={fn()}
        openFallback={fn()}
        refresh={fn(async () => undefined)}
        editor={{
          open: false,
          mode: "edit",
          draft: {
            name: "Work",
            color: "orange",
            icon: "briefcase",
            enabled: true,
            locationId: "new-york",
            surfaceOverrides: undefined,
          },
          profiles: STORY_LOCATIONS,
          saveInFlight: false,
          onOpenChange: fn(),
          onDraftChange: fn(),
          onSave: fn(),
        }}
      />
    </OptionsSurfaceShell>
  );
};

const TrustedSitesSurface = () => {
  const [trustedSites, setTrustedSites] = useState(STORY_TRUSTED_SITES);
  const [trustedSitesFilter, setTrustedSitesFilter] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [trustedSitePattern, setTrustedSitePattern] = useState("");
  const [previewHostname, setPreviewHostname] = useState("accounts.google.com");
  const normalizedFilter = trustedSitesFilter.trim().toLowerCase();
  const filteredTrustedSites = trustedSites.filter(({ pattern }) =>
    pattern.toLowerCase().includes(normalizedFilter),
  );

  return (
    <StorySettingsProvider
      value={{
        rules: STORY_RULES,
        globalFallbackRule: STORY_GLOBAL_FALLBACK,
        trustedSitesFilter,
        setTrustedSitesFilter,
        filteredTrustedSites,
        openTrustedSiteDialog: () => setDialogOpen(true),
        handleToggleTrustedSite: async (pattern, enabled) => {
          setTrustedSites((current) =>
            current.map((site) =>
              site.pattern === pattern ? { ...site, enabled } : site,
            ),
          );
        },
        handleDeleteTrustedSite: fn(async () => undefined),
        highlightedAnchorId: null,
        navigateToAnchor: fn(),
        saveInFlight: false,
        previewHostname,
        setPreviewHostname,
        preview: resolveRulePreview({
          hostname: previewHostname,
          cookieStoreId: undefined,
          rules: STORY_RULES,
          locations: STORY_LOCATIONS,
          trustedSites,
          globalFallbackRule: STORY_GLOBAL_FALLBACK,
        }),
        openRuleDialog: fn(),
        openFallbackDialog: fn(),
        trustedSiteDialogOpened: dialogOpen,
        closeTrustedSiteDialog: () => setDialogOpen(false),
        handleTrustedSiteSubmit: async (event) => {
          event.preventDefault();
          setDialogOpen(false);
        },
        trustedSitePattern,
        setTrustedSitePattern,
      }}
    >
      <OptionsSurfaceShell activeTab="trusted-sites">
        <TrustedSitesTab />
      </OptionsSurfaceShell>
      <TrustedSiteDialog />
    </StorySettingsProvider>
  );
};

const AdvancedSurface = () => {
  const [debugMode, setDebugMode] = useState(false);
  const [panicMode, setPanicMode] = useState(false);
  const importSettingsRef = useRef<HTMLInputElement>(null);

  return (
    <StorySettingsProvider
      value={{
        debugMode,
        setDebugMode,
        settingsLoaded: true,
        panicMode,
        handleSetPanicMode: async (value) => setPanicMode(value),
        settingsSubpageView: "none",
        scheduleAutosave: fn(),
        handleExportSettings: fn(async () => undefined),
        importSettingsRef,
        handleImportSettings: fn(async () => undefined),
        handleReloadSettings: fn(async () => undefined),
        requestResetSettings: fn(async () => undefined),
        saveInFlight: false,
        highlightedAnchorId: null,
        logsHostFilter: null,
      }}
    >
      <OptionsSurfaceShell activeTab="advanced">
        <AdvancedTab />
      </OptionsSurfaceShell>
    </StorySettingsProvider>
  );
};

const OptionsSettingsSurface = ({
  browserTarget,
}: {
  browserTarget: SpoofingBrowserTarget;
}) => {
  const [fingerprintEnabled, setFingerprintEnabled] = useState(
    DEFAULT_PREFERENCES.browserFingerprintSpoofingEnabled,
  );
  const [sharedSpoofing, setSharedSpoofing] = useState<
    SharedSpoofingConfig | undefined
  >({
    ...defaultSharedSpoofing,
  });
  const [workerMode, setWorkerMode] = useState(
    DEFAULT_PREFERENCES.sharedWorkerHandlingMode,
  );
  const [themeMode, setThemeMode] = useState(DEFAULT_PREFERENCES.themeMode);
  const [themeAccentPreset, setThemeAccentPreset] = useState(
    DEFAULT_PREFERENCES.themeAccentPreset,
  );
  const [osmConsent, setOsmConsent] = useState(DEFAULT_PREFERENCES.osmConsent);
  const [highContrastMode, setHighContrastMode] = useState(
    DEFAULT_PREFERENCES.highContrastMode,
  );
  const [showBadgeQueryCount, setShowBadgeQueryCount] = useState(
    DEFAULT_PREFERENCES.showBadgeQueryCount,
  );
  const [countDateCalls, setCountDateCalls] = useState(
    DEFAULT_PREFERENCES.includeDateCallsInBadgeCount,
  );
  const [defaultNoiseRadius, setDefaultNoiseRadius] = useState(
    DEFAULT_PREFERENCES.defaultNoiseRadius,
  );
  const [randomizeDefault, setRandomizeDefault] = useState(
    DEFAULT_PREFERENCES.randomizeGeneratedLocationByDefault,
  );
  const [randomRadiusKm, setRandomRadiusKm] = useState(
    DEFAULT_PREFERENCES.generatedLocationRandomizationRadiusKm,
  );
  const [watchPositionDelay, setWatchPositionDelay] = useState<[number, number]>(
    DEFAULT_PREFERENCES.watchPositionDelay,
  );

  return (
    <ThemeProvider>
      <StorySettingsProvider
        value={{
          browserFingerprintSpoofingEnabled: fingerprintEnabled,
          setFingerprintSpoofing: setFingerprintEnabled,
          sharedSpoofing,
          setSharedSpoofing,
          sharedWorkerHandlingMode: workerMode,
          setWorkerMode,
          themeMode,
          setThemeMode,
          themeAccentPreset,
          setThemeAccentPreset,
          osmConsent,
          setOsmConsent,
          highContrastMode,
          setHighContrastMode,
          showBadgeQueryCount,
          setShowBadgeQueryCount,
          includeDateCallsInBadgeCount: countDateCalls,
          setCountDateCalls,
          defaultNoiseRadius,
          setDefaultNoiseRadius,
          randomizeGeneratedLocationByDefault: randomizeDefault,
          setRandomizeDefault,
          generatedLocationRandomizationRadiusKm: randomRadiusKm,
          setRadiusKm: setRandomRadiusKm,
          watchPositionDelay,
          setWatchPositionDelay,
          settingsLoaded: true,
          navigateToAnchor: fn(),
          scheduleAutosave: fn(),
          highlightedAnchorId: null,
        }}
      >
        <OptionsSurfaceShell activeTab="options">
          <OptionsTab browserTarget={browserTarget} />
        </OptionsSurfaceShell>
      </StorySettingsProvider>
    </ThemeProvider>
  );
};

const OnboardingSurface = () => {
  return (
    <ThemeProvider>
      <StorySettingsProvider
        value={{
          setProfiles: fn(),
          setOsmConsent: fn(),
          setFingerprintSpoofing: fn(),
          sharedSpoofing: undefined,
          setSharedSpoofing: fn(),
          globalFallbackRule: undefined,
          setGlobalFallbackRule: fn(),
          fallbackLocationId: "",
          setHighContrastMode: fn(),
          setOnboardingOptions: fn(),
          openFallbackDialog: fn(),
          onboardingCompleted: false,
          setOnboardingCompleted: fn(),
          randomizeGeneratedLocationByDefault: true,
          generatedLocationRandomizationRadiusKm: 10,
          settingsLoaded: true,
        }}
      >
        <AppPageFrame
          title={t.welcome.title}
          hideHeader
          pageClassName="max-w-[1120px] px-4 sm:px-6"
        >
          <WelcomeWizard onComplete={fn()} />
        </AppPageFrame>
      </StorySettingsProvider>
    </ThemeProvider>
  );
};

const DefaultRuleDialogSurface = () => {
  const [open, setOpen] = useState(true);
  const [enabled, setEnabled] = useState(true);
  const [locationId, setLocationId] = useState("warsaw");

  return (
    <StorySettingsProvider
      value={{
        isFallbackDialogOpen: open,
        closeFallbackDialog: () => setOpen(false),
        submitFallbackRule: async (event) => event.preventDefault(),
        submitOnboardingFallback: async (event) => event.preventDefault(),
        isFallbackEnabled: enabled,
        setFallbackEnabled: setEnabled,
        fallbackLocationId: locationId,
        setFallbackLocationId: setLocationId,
        fallbackSurfaceOverrides: undefined,
        setFallbackSurfaces: fn(),
        fallbackSeedKey: "storybook-fallback",
        ruleProfileOptions: STORY_LOCATIONS.map(({ id, label }) => ({
          value: id,
          label,
        })),
        onboardingOptions: null,
      }}
    >
      <Button onClick={() => setOpen(true)}>Open Default Rule</Button>
      <GlobalFallbackRuleDialog />
    </StorySettingsProvider>
  );
};

const meta = {
  title: "Options/Surface states",
  component: RulesSurface,
  parameters: {
    privacyThing: { surface: "options" },
  },
} satisfies Meta<typeof RulesSurface>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Rules: Story = {
  render: () => <RulesSurface />,
};

export const DomainRuleEditor: Story = {
  render: () => <DomainRuleEditorSurface />,
};

export const RulesInteractionTest: Story = {
  ...Rules,
  tags: ["!dev", "!autodocs"],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(
      canvas.getByRole("textbox", { name: t.rules.filterLabel }),
      "cloudflare",
    );
    await expect(canvas.getAllByText("cloudflare.com")[0]).toBeVisible();
    await expect(
      canvas.getByRole("textbox", { name: t.rules.filterLabel }),
    ).toHaveValue("cloudflare");
  },
};

// Moved from "renders a flat rules list in the options page" in
// `tests/e2e/extension-options-rules.spec.ts`. The rules table used to group rows by
// preset, and this was the only guard anywhere in the repo that it renders flat and
// in sort order — `rule-utils.target.test.ts` covers filtering, conflicts and
// reassignment, but neither ordering nor the grouped-vs-flat shape.
export const RulesFlatListTest: Story = {
  ...Rules,
  tags: ["!dev", "!autodocs"],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    const editButtons = canvas.getAllByRole("button", {
      name: /^Edit rule /,
    });
    await expect(editButtons).toHaveLength(STORY_RULES.length);

    // Sorted by preset label first: New York before Warsaw, then by hostname.
    await expect(editButtons[0]).toHaveAccessibleName(
      t.rules.editRuleAriaLabel("cloudflare.com"),
    );
    await expect(editButtons[1]).toHaveAccessibleName(
      t.rules.editRuleAriaLabel("allegro.pl"),
    );
    await expect(editButtons[2]).toHaveAccessibleName(
      t.rules.editRuleAriaLabel("cnn.com"),
    );

    await expect(canvas.queryByText(/Rule group/)).toBeNull();
  },
};

// Selection coverage moved here from `tests/e2e/extension-options-selection.spec.ts`.
// `RulesSurface` renders the real `RulesTab` over the real `buildRuleViewModels` and
// `getVisibleSelectionState`, so the wiring these assert — which key set each control
// passes to the selection helpers, and what the toolbar renders back — is the same
// wiring the extension runs. The helpers' own set algebra stays covered by
// `src/ui/options/rule-selection.test.ts`. One rule is disabled so the inactive
// marker and the "inactive only" menu entry have something to match; the shared
// `STORY_RULES` fixture stays untouched so existing snapshots do not move.
//
// Both rules point at the same location on purpose. `resolveConflicts` only flags
// overlapping patterns when they resolve to different locations, and the rules
// filter searches conflict messages too — so splitting them would make a filter for
// "shop." also match `*.example.com` through its conflict text.
const SELECTION_STORY_RULES: DomainRule[] = [
  {
    pattern: "*.example.com",
    enabled: true,
    locationId: "warsaw",
    ruleSeedKey: "storybook-selection-example",
  },
  {
    pattern: "shop.example.com",
    enabled: false,
    locationId: "warsaw",
    ruleSeedKey: "storybook-selection-shop",
  },
];

const selectionStory = (
  play: NonNullable<Story["play"]>,
): Story & { play: NonNullable<Story["play"]> } => ({
  ...Rules,
  tags: ["!dev", "!autodocs"],
  render: () => <RulesSurface rules={SELECTION_STORY_RULES} />,
  play,
});

const filterRules = async (canvas: ReturnType<typeof within>, value: string) => {
  const filter = canvas.getByRole("textbox", { name: t.rules.filterLabel });
  await userEvent.clear(filter);
  if (value) {
    await userEvent.type(filter, value);
  }
};

const openSelectionMenu = async (
  canvas: ReturnType<typeof within>,
  body: ReturnType<typeof within>,
  item: string,
) => {
  await userEvent.click(
    canvas.getByRole("button", { name: t.rules.selectMenuAriaLabel }),
  );
  await waitFor(() => {
    expect(body.getByRole("menuitem", { name: item })).toBeVisible();
  });
  await userEvent.click(body.getByRole("menuitem", { name: item }));
};

export const RulesSelectVisibleTest: Story = selectionStory(
  async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(
      canvas.getByRole("checkbox", { name: t.rules.selectAllAriaLabel }),
    );

    await expect(canvas.getByText(t.common.selectionCount(2))).toBeVisible();
    for (const { pattern } of SELECTION_STORY_RULES) {
      await expect(
        canvas.getByRole("checkbox", { name: t.rules.selectRuleAriaLabel(pattern) }),
      ).toBeChecked();
    }
  },
);

export const RulesSelectFilteredTest: Story = selectionStory(
  async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await filterRules(canvas, "shop.");
    await waitFor(() => {
      expect(
        canvas.queryByRole("checkbox", {
          name: t.rules.selectRuleAriaLabel("*.example.com"),
        }),
      ).toBeNull();
    });

    await userEvent.click(
      canvas.getByRole("checkbox", { name: t.rules.selectAllAriaLabel }),
    );

    await expect(canvas.getByText(t.common.selectionCount(1))).toBeVisible();
    await expect(
      canvas.getByRole("checkbox", {
        name: t.rules.selectRuleAriaLabel("shop.example.com"),
      }),
    ).toBeChecked();
  },
);

export const RulesSelectBeyondTest: Story = selectionStory(
  async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);

    await filterRules(canvas, "shop.");
    await openSelectionMenu(canvas, body, t.rules.selectionMenuAll);

    await expect(canvas.getByText(t.common.selectionCount(2))).toBeVisible();

    await filterRules(canvas, "");
    for (const { pattern } of SELECTION_STORY_RULES) {
      await waitFor(() => {
        expect(
          canvas.getByRole("checkbox", { name: t.rules.selectRuleAriaLabel(pattern) }),
        ).toBeChecked();
      });
    }
  },
);

export const RulesClearSelectionTest: Story = selectionStory(
  async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await userEvent.click(
      canvas.getByRole("checkbox", {
        name: t.rules.selectRuleAriaLabel("shop.example.com"),
      }),
    );
    await expect(canvas.getByText(t.common.selectionCount(1))).toBeVisible();

    await userEvent.click(
      canvas.getByRole("button", { name: t.common.actions.clearSelection }),
    );

    await waitFor(() => {
      expect(canvas.queryByText(t.common.selectionCount(1))).toBeNull();
    });
    await expect(
      canvas.getByRole("checkbox", {
        name: t.rules.selectRuleAriaLabel("shop.example.com"),
      }),
    ).not.toBeChecked();
  },
);

export const RulesSelectInactiveTest: Story = selectionStory(
  async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);

    const inactiveRow = canvas
      .getByRole("checkbox", { name: t.rules.selectRuleAriaLabel("shop.example.com") })
      .closest("tr");
    await expect(inactiveRow).toHaveTextContent(t.rules.inactiveBadge);

    await openSelectionMenu(canvas, body, t.rules.selectionMenuInactive);

    await expect(canvas.getByText(t.common.selectionCount(1))).toBeVisible();
    await expect(
      canvas.getByRole("checkbox", {
        name: t.rules.selectRuleAriaLabel("shop.example.com"),
      }),
    ).toBeChecked();
    await expect(
      canvas.getByRole("checkbox", {
        name: t.rules.selectRuleAriaLabel("*.example.com"),
      }),
    ).not.toBeChecked();
  },
);

export const Locations: Story = {
  render: () => <LocationsSurface />,
};

export const RegionalPresetEditor: Story = {
  render: () => <PresetEditorSurface />,
};

export const FirefoxContainers: Story = {
  render: () => <FirefoxContainersSurface />,
};

export const LocationsInteractionTest: Story = {
  ...Locations,
  tags: ["!dev", "!autodocs"],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(
      canvas.getByRole("textbox", { name: t.locations.searchPlaceholder }),
      "Sydney",
    );
    await expect(canvas.getByText("Sydney")).toBeVisible();
    await expect(canvas.queryByText("Warsaw")).not.toBeInTheDocument();
  },
};

export const TrustedSites: Story = {
  render: () => <TrustedSitesSurface />,
};

export const TrustedSitesTest: Story = {
  ...TrustedSites,
  tags: ["!dev", "!autodocs"],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const body = within(canvasElement.ownerDocument.body);
    await userEvent.click(
      canvas.getByRole("button", { name: t.trustedSites.addButton }),
    );
    await expect(
      body.getByRole("dialog", { name: t.trustedSites.dialog.title }),
    ).toHaveAttribute("data-state", "open");
    await waitFor(() =>
      expect(body.getByLabelText(t.trustedSites.patternLabel)).toHaveFocus(),
    );
    await userEvent.keyboard("{Escape}");
  },
};

export const Advanced: Story = {
  render: () => <AdvancedSurface />,
};

export const OptionsChromium: Story = {
  render: () => <OptionsSettingsSurface browserTarget="chromium" />,
  play: async ({ canvasElement }) => {
    const geolocation = canvasElement.querySelector<HTMLElement>(
      "#setting-options-geolocation-spoofing",
    );
    const timeLocale = canvasElement.querySelector<HTMLElement>(
      "#setting-options-time-locale-spoofing",
    );
    const battery = canvasElement.querySelector<HTMLElement>(
      "#setting-options-battery-spoofing",
    );
    const webRtc = canvasElement.querySelector<HTMLElement>(
      "#setting-options-webrtc-spoofing",
    );

    await expect(geolocation).not.toBeNull();
    await expect(timeLocale).not.toBeNull();
    await expect(battery).not.toBeNull();
    await expect(webRtc).not.toBeNull();
    await expect(geolocation!.getBoundingClientRect().width).toBeGreaterThan(
      timeLocale!.getBoundingClientRect().width * 1.8,
    );
    await expect(battery!.getBoundingClientRect().top).toBeCloseTo(
      webRtc!.getBoundingClientRect().top,
      1,
    );
  },
};

export const OptionsFirefox: Story = {
  render: () => <OptionsSettingsSurface browserTarget="firefox" />,
  play: async ({ canvasElement }) => {
    const geolocation = canvasElement.querySelector<HTMLElement>(
      "#setting-options-geolocation-spoofing",
    );
    const timeLocale = canvasElement.querySelector<HTMLElement>(
      "#setting-options-time-locale-spoofing",
    );

    await expect(geolocation).not.toBeNull();
    await expect(timeLocale).not.toBeNull();
    await expect(
      canvasElement.querySelector("#setting-options-client-hints-spoofing"),
    ).toBeNull();
    await expect(
      canvasElement.querySelector("#setting-options-battery-spoofing"),
    ).toBeNull();
    await expect(geolocation!.getBoundingClientRect().width).toBeCloseTo(
      timeLocale!.getBoundingClientRect().width,
      1,
    );
    await expect(geolocation!.getBoundingClientRect().top).toBeCloseTo(
      timeLocale!.getBoundingClientRect().top,
      1,
    );
  },
};

export const AdvancedInteractionTest: Story = {
  ...Advanced,
  tags: ["!dev", "!autodocs"],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const debugSwitch = canvas.getByRole("switch", {
      name: t.advanced.debugMode.title,
    });
    await userEvent.click(debugSwitch);
    await expect(debugSwitch).toBeChecked();
  },
};

export const Onboarding: Story = {
  render: () => <OnboardingSurface />,
};

export const OnboardingTest: Story = {
  ...Onboarding,
  tags: ["!dev", "!autodocs"],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(
      canvas.getByRole("button", {
        name: new RegExp(t.welcome.steps.welcome.guidedTitle, "i"),
      }),
    );
    await waitFor(() => {
      const visiblePrivacyHeading = canvas
        .getAllByText(t.welcome.steps.privacy.title)
        .some((element) => element.getClientRects().length > 0);
      expect(visiblePrivacyHeading).toBe(true);
    });
  },
};

export const DefaultRuleDialog: Story = {
  render: () => <DefaultRuleDialogSurface />,
};

export const DefaultRuleDialogTest: Story = {
  ...DefaultRuleDialog,
  tags: ["!dev", "!autodocs"],
  play: async ({ canvasElement }) => {
    const body = within(canvasElement.ownerDocument.body);
    await waitFor(() => {
      expect(
        body.getByRole("dialog", { name: t.rules.globalFallback.dialog.title }),
      ).toBeVisible();
    });
    await userEvent.keyboard("{Escape}");
  },
};
