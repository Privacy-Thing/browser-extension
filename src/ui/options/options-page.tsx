import {
  PRIVACY_THING_LOGO_TAG,
  dispatchPrivacyThingCommand,
  type PrivacyThingLogoElement,
} from "@privacy-thing/brand";
import React from "react";

import { BUILD_BROWSER_TARGET } from "@/shared/build-flags";
import { Button } from "@/ui/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/ui/components/ui/tabs";
import { AppToaster } from "@/ui/components/ui/toast";
import { t } from "@/ui/i18n";
import { OPTIONS_HOVER_REACTION, OPTIONS_THING_TIMING } from "@/ui/options/brand-thing";
import { ConfirmDialog } from "@/ui/options/components/modals/ConfirmDialog";
import { GlobalFallbackRuleDialog } from "@/ui/options/components/modals/GlobalFallbackRuleDialog";
import { LocationEditorModal } from "@/ui/options/components/modals/LocationEditorModal";
import { LocationGeneratorModal } from "@/ui/options/components/modals/LocationGeneratorModal";
import { OsmConsentModal } from "@/ui/options/components/modals/OsmConsentModal";
import { RuleDialog } from "@/ui/options/components/modals/RuleDialog";
import { TrustedSiteDialog } from "@/ui/options/components/modals/TrustedSiteDialog";
import { RulesTab } from "@/ui/options/components/tabs/RulesTab";
import { PAGE_ANCHORS } from "@/ui/options/navigation";
import { SettingsProvider, useSettings } from "@/ui/options/state/SettingsContext";
import type { SettingsTab } from "@/ui/options/utils";
import { capabilities, getVisibleSettingsTabs } from "@/ui/options/utils";
import { AppPageFrame } from "@/ui/shared/AppPageFrame";
import { HEADER_TRIGGER_CLASS } from "@/ui/shared/header-menu";
import { ThemeProvider, useTheme } from "@/ui/shared/ThemeProvider";

const isFirefoxTarget = BUILD_BROWSER_TARGET === "firefox";
const containersTabLabel = isFirefoxTarget ? "Containers" : null;

const createLazyTab = <TModule,>(
  load: () => Promise<TModule>,
  select: (module: TModule) => React.ComponentType,
) =>
  React.lazy(async () => ({
    default: select(await load()),
  }));

const LazyLocationsTab = createLazyTab(
  () => import("@/ui/options/components/tabs/LocationsTab"),
  (module) => module.LocationsTab,
);
const LazyTrustedSitesTab = createLazyTab(
  () => import("@/ui/options/components/tabs/TrustedSitesTab"),
  (module) => module.TrustedSitesTab,
);
const LazyOptionsTab = createLazyTab(
  () => import("@/ui/options/components/tabs/OptionsTab"),
  (module) => module.OptionsTab,
);
const LazyContainersTab = isFirefoxTarget
  ? createLazyTab(
      () => import("@/ui/options/components/tabs/ContainersTab"),
      (module) => module.ContainersTab,
    )
  : null;
const LazyAdvancedTab = createLazyTab(
  () => import("@/ui/options/components/tabs/AdvancedTab"),
  (module) => module.AdvancedTab,
);
const LazyPlaygroundTab = createLazyTab(
  () => import("@/ui/options/components/tabs/PlaygroundTab"),
  (module) => module.PlaygroundTab,
);
const LazyAboutTab = createLazyTab(
  () => import("@/ui/options/components/tabs/AboutTab"),
  (module) => module.AboutTab,
);
const LazyWelcomeWizard = React.lazy(async () => ({
  default: (await import("@/ui/options/components/onboarding/WelcomeWizard"))
    .WelcomeWizard,
}));

const isOnboardingUrlRequested = (): boolean => {
  if (typeof window === "undefined") {
    return false;
  }

  return new URLSearchParams(window.location.search).get("onboarding") === "1";
};

const hasOptionsHashTarget = (): boolean => {
  if (typeof window === "undefined") {
    return false;
  }

  const hash = window.location.hash.replace(/^#/, "");
  return hash.length > 0 && hash !== "onboarding";
};

const LazyTabReady = ({ Component }: { Component: React.ComponentType }) => {
  const { notifyTabContentReady } = useSettings();

  React.useEffect(() => {
    notifyTabContentReady();
  }, [notifyTabContentReady]);

  return <Component />;
};

const LazyTabFallback = ({ tab }: { tab: SettingsTab }) => (
  <TabsContent value={tab} data-panel={tab} id={PAGE_ANCHORS[tab]}>
    <div className="mt-2 rounded-xl border border-dashed border-border/70 bg-muted/20 px-4 py-6 text-sm text-muted-foreground">
      Loading tab...
    </div>
  </TabsContent>
);

const getTabTriggerContent = (tab: SettingsTab): React.ReactNode => {
  switch (tab) {
    case "rules":
      return t.options.tabs.rules;
    case "containers":
      return containersTabLabel;
    case "profiles":
      return t.options.tabs.locations;
    case "playground":
      return t.options.tabs.playground;
    case "trusted-sites":
      return t.options.tabs.trustedSites;
    case "options":
      return t.options.tabs.options;
    case "advanced":
      return t.options.tabs.advanced;
    case "about":
      return t.options.tabs.about;
  }
};

const HeaderTabs = ({ visibleTabs }: { visibleTabs: SettingsTab[] }) => (
  <TabsList
    className="flex h-auto w-full flex-wrap justify-end gap-1 bg-transparent p-0 xl:w-auto"
    aria-label={t.options.tabsAriaLabel}
  >
    {visibleTabs.map((tab) => (
      <TabsTrigger
        key={tab}
        value={tab}
        data-tab={tab}
        className={HEADER_TRIGGER_CLASS}
      >
        {getTabTriggerContent(tab)}
      </TabsTrigger>
    ))}
  </TabsList>
);

const PlaygroundHiddenModals = () => (
  <>
    <LocationEditorModal />
    <ConfirmDialog />
    <RuleDialog />
    <TrustedSiteDialog />
    <GlobalFallbackRuleDialog />
    <LocationGeneratorModal />
  </>
);

const LazySettingsTab = ({
  tab,
  Component,
  enabled = true,
}: {
  tab: SettingsTab;
  Component: React.LazyExoticComponent<React.ComponentType>;
  enabled?: boolean;
}) => {
  const { activeTab } = useSettings();
  const [shouldRender, setShouldRender] = React.useState(activeTab === tab);

  React.useEffect(() => {
    if (activeTab === tab) {
      setShouldRender(true);
    }
  }, [activeTab, tab]);

  if (!enabled || !shouldRender) {
    return null;
  }

  return (
    <React.Suspense fallback={activeTab === tab ? <LazyTabFallback tab={tab} /> : null}>
      <LazyTabReady Component={Component} />
    </React.Suspense>
  );
};

const useIntroLookPose = (): "east" | "idle" => {
  const [pose, setPose] = React.useState<"east" | "idle">("east");
  React.useEffect(() => {
    const el = document.querySelector<PrivacyThingLogoElement>(PRIVACY_THING_LOGO_TAG);
    if (!el) return;
    const lookId = setTimeout(() => {
      dispatchPrivacyThingCommand(el, { type: "look", direction: "idle" });
    }, 1500);
    const settleId = setTimeout(() => setPose("idle"), 2000);
    return () => {
      clearTimeout(lookId);
      clearTimeout(settleId);
    };
  }, []);
  return pose;
};

const PanicBanner = ({ onTurnOn }: { onTurnOn: () => void }) => (
  <div
    role="alert"
    className="mb-5 flex flex-col gap-3 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
  >
    <div className="min-w-0">
      <p className="font-semibold text-foreground">
        {t.options.spoofingOffBannerTitle}
      </p>
      <p className="text-muted-foreground">{t.options.spoofingOffBannerBody}</p>
    </div>
    <Button
      id="panic-banner-turn-on"
      size="sm"
      variant="ghost"
      className="w-fit text-destructive hover:bg-destructive/15 hover:text-destructive"
      onClick={onTurnOn}
    >
      {t.options.spoofingOffBannerAction}
    </Button>
  </div>
);

export const OptionsUi = () => {
  const { reduceMotion } = useTheme();
  const {
    panicMode,
    handleSetPanicMode,
    activeTab,
    settingsLoaded,
    onboardingCompleted,
    navigateToAnchor,
    getTabAnchor,
  } = useSettings();
  const [onboardingRequested, setOnboardingRequested] = React.useState(() => {
    return isOnboardingUrlRequested();
  });
  const introLookPose = useIntroLookPose();
  const showOnboarding =
    settingsLoaded &&
    (onboardingRequested || (!onboardingCompleted && !hasOptionsHashTarget()));
  const visibleTabs = getVisibleSettingsTabs({
    showContainers: Boolean(capabilities.supportsContainers && containersTabLabel),
  });
  const optionsHomeHref = chrome.runtime.getURL("src/ui/options/index.html");
  const navigateHome = (event?: { preventDefault(): void }): void => {
    event?.preventDefault();
    navigateToAnchor(PAGE_ANCHORS.rules, { highlight: false });
  };

  if (showOnboarding) {
    return (
      <AppPageFrame
        title={t.welcome.title}
        hideHeader
        pageClassName="max-w-[1120px] px-4 sm:px-6"
      >
        <React.Suspense
          fallback={
            <div className="flex min-h-[60vh] items-center justify-center text-sm text-muted-foreground">
              {t.welcome.loading}
            </div>
          }
        >
          <LazyWelcomeWizard
            onComplete={() => {
              setOnboardingRequested(false);
            }}
          />
        </React.Suspense>
        <GlobalFallbackRuleDialog />
        <AppToaster />
      </AppPageFrame>
    );
  }

  return (
    <Tabs
      value={activeTab}
      onValueChange={(value) => {
        navigateToAnchor(getTabAnchor(value as SettingsTab), { highlight: false });
      }}
    >
      <AppPageFrame
        title={t.options.title}
        brandHref={optionsHomeHref}
        onBrandNavigate={navigateHome}
        animateBrandIcon
        brandThingPose={panicMode ? "zz" : introLookPose}
        brandThingTiming={OPTIONS_THING_TIMING}
        brandThingHoverReaction={OPTIONS_HOVER_REACTION}
        trackBrandThingPointer
        reduceBrandMotion={reduceMotion}
        hideTitle
        headerClassName="items-center gap-x-6 gap-y-3"
        headerAsideClassName="flex-1 self-center pt-0"
        headerAside={<HeaderTabs visibleTabs={visibleTabs} />}
      >
        {activeTab !== "playground" && panicMode ? (
          <PanicBanner onTurnOn={() => void handleSetPanicMode(false)} />
        ) : null}

        <RulesTab />
        <LazySettingsTab tab="profiles" Component={LazyLocationsTab} />
        <LazySettingsTab tab="trusted-sites" Component={LazyTrustedSitesTab} />
        <LazySettingsTab tab="playground" Component={LazyPlaygroundTab} />
        <LazySettingsTab tab="options" Component={LazyOptionsTab} />
        {capabilities.supportsContainers && LazyContainersTab ? (
          <LazySettingsTab tab="containers" Component={LazyContainersTab} />
        ) : null}
        <LazySettingsTab tab="advanced" Component={LazyAdvancedTab} />
        <LazySettingsTab tab="about" Component={LazyAboutTab} />
        {activeTab !== "playground" ? <PlaygroundHiddenModals /> : null}
        <OsmConsentModal />
      </AppPageFrame>
    </Tabs>
  );
};

export const App = () => (
  <ThemeProvider>
    <SettingsProvider>
      <OptionsUi />
      <AppToaster />
    </SettingsProvider>
  </ThemeProvider>
);
