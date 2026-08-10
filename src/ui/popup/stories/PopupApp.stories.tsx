import {
  dispatchPrivacyThingCommand,
  type PrivacyThingLogoElement,
} from "@privacy-thing/brand";
import type { Meta, StoryObj } from "@storybook/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { expect, userEvent, within } from "storybook/test";
import "@fortawesome/fontawesome-free/css/fontawesome.css";
import "@fortawesome/fontawesome-free/css/solid.css";
import "../popup.css";

import { BellIcon } from "../components/PopupIcons";
import {
  PopupNotificationDetail,
  PopupNotificationList,
} from "../components/PopupNotifications";
import { PopupProtectionDetails } from "../components/PopupProtectionDetails";
import { PopupRuleSheet } from "../components/PopupRuleSheet";
import { PopupShell } from "../components/PopupShell";
import { resolvePopupBorderTiming } from "../popup-border-timing";
import {
  POPUP_PRESENTATION_KINDS,
  derivePopupViewModel,
  resolvePresentationKind,
  type PopupPresentationKind,
} from "../popup-view-model";

import { createPopupStoryState, type PopupStoryContext } from "./popup-story-fixtures";

import { BRAND_DISPLAY_NAME } from "@/shared/brand";
import { BUILD_BROWSER_TARGET } from "@/shared/build-flags";
import { isPopupPolicyNoticeKind } from "@/shared/popup-notification-kinds";
import { isNoticeUnread } from "@/shared/popup-notification-state";
import type { PopupNotification, SharedWorkerHandlingMode } from "@/shared/types";
import { BrandHorizontalLogo } from "@/ui/branding/BrandHorizontalLogo";
import { t } from "@/ui/i18n";
import { icon } from "@/ui/options/utils";

type PopupStoryWorkspace =
  | "closed"
  | "rule-form"
  | "protection-details"
  | "notification-list"
  | "notification-detail"
  | "cleanup-confirm"
  | "cleanup-result"
  | "delete-confirm"
  | "rule-conflict-confirm";

type PopupStoryViewport = "browser" | "compact";

type PopupStoryHarnessProps = {
  variant: PopupPresentationKind;
  context: PopupStoryContext;
  workspace: PopupStoryWorkspace;
  viewport: PopupStoryViewport;
  showWorkbench: boolean;
};

const STORY_CONTEXTS: readonly PopupStoryContext[] = [
  "baseline",
  "global-protections-off",
  "runtime-degraded",
  "worker-runtime-warning",
  "service-worker-block",
  "shared-worker-strict",
  "worker-csp-relaxed",
  "all-policy-risks",
  "notifications",
  "notifications-acknowledged",
  "notifications-mixed",
  "notifications-resolved",
  "extension-notification",
  "firefox-first-inline",
];

const STORY_WORKSPACES: readonly PopupStoryWorkspace[] = [
  "closed",
  "rule-form",
  "protection-details",
  "notification-list",
  "notification-detail",
  "cleanup-confirm",
  "cleanup-result",
  "delete-confirm",
  "rule-conflict-confirm",
];

const STORY_VIEWPORTS: readonly PopupStoryViewport[] = ["browser", "compact"];

const getNextPowerVariant = (variant: PopupPresentationKind): PopupPresentationKind => {
  switch (variant) {
    case "rule-active":
      return "rule-inactive";
    case "rule-inactive":
      return "rule-active";
    case "fallback-active":
    case "fallback-protections":
      return "fallback-inactive";
    case "fallback-inactive":
    case "fallback-unconfigured":
      return "fallback-active";
    case "container-active":
    case "container-protections":
      return "container-inactive";
    case "container-inactive":
      return "container-active";
    default:
      return variant;
  }
};

const StoryWorkspaceBody = ({
  workspace,
  popupState,
  selectedNotification,
  onOpenNotification,
  onResolveNotification,
  onAction,
}: {
  workspace: PopupStoryWorkspace;
  popupState: NonNullable<ReturnType<typeof createPopupStoryState>>;
  selectedNotification: PopupNotification | null;
  onOpenNotification: (notification: PopupNotification) => void;
  onResolveNotification: (notification: PopupNotification, message: string) => void;
  onAction: (message: string) => void;
}) => {
  if (workspace === "protection-details") {
    return (
      <PopupProtectionDetails
        popupState={popupState}
        onNotificationOpen={onOpenNotification}
        onOpenXRay={() => onAction("Opened X-Ray")}
      />
    );
  }
  if (workspace === "notification-list") {
    return (
      <PopupNotificationList
        notifications={popupState.notifications}
        onOpen={onOpenNotification}
      />
    );
  }
  if (workspace === "notification-detail") {
    return selectedNotification ? (
      <PopupNotificationDetail
        notification={selectedNotification}
        onApplySuggestion={async () =>
          onResolveNotification(selectedNotification, "Applied suggestion")
        }
        onDismiss={async (notification) => {
          if (notification.kind === "significant-update") {
            onResolveNotification(notification, "Dismissed notification");
          }
        }}
        onDismissSuggestion={async () =>
          onResolveNotification(selectedNotification, "Dismissed suggestion")
        }
        onNotificationAction={async (_notification, mode) =>
          onResolveNotification(
            selectedNotification,
            `Applied notification action${mode ? `: ${mode}` : ""}`,
          )
        }
      />
    ) : (
      <p className="py-4 text-[12px] text-muted-foreground">
        {t.popup.notificationsEmpty}
      </p>
    );
  }
  if (workspace === "cleanup-result") {
    return (
      <div className="grid gap-3 text-sm">
        <p className="text-muted-foreground">{t.popup.cleanupResultComplete}</p>
        {[
          t.popup.cleanupSurfaceCookies,
          t.popup.cleanupSurfaceLocalStorage,
          t.popup.cleanupSurfaceServiceWorkers,
        ].map((surface) => (
          <div key={surface} className="flex justify-between gap-3">
            <span>{surface}</span>
            <span className="text-tone-success-text">
              {t.popup.cleanupStatusCleaned}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

const getWorkspaceTitle = (
  workspace: PopupStoryWorkspace,
  hostname: string,
): string => {
  if (workspace === "rule-form") return hostname;
  if (workspace === "protection-details") return t.popup.protectionDetailsTitle;
  if (workspace === "notification-list" || workspace === "notification-detail")
    return t.popup.notificationsTitle;
  if (workspace === "cleanup-confirm") return t.popup.cleanupSheetTitle;
  if (workspace === "cleanup-result") return t.popup.cleanupResultTitle;
  return t.popup.sheetTitle;
};

const PopupStoryHarness = ({
  variant: initialVariant,
  context,
  workspace: initialWorkspace,
  viewport: initialViewport,
  showWorkbench,
}: PopupStoryHarnessProps) => {
  const [variant, setVariant] = useState(initialVariant);
  const [activeContext, setActiveContext] = useState(context);
  const [workspace, setWorkspace] = useState(initialWorkspace);
  const [viewport, setViewport] = useState(initialViewport);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>("warsaw");
  const [regionalPresetEnabled, setRegionalPresetEnabled] = useState(true);
  const [ruleMode, setRuleMode] = useState<"exact" | "suffix">(
    () => createPopupStoryState(initialVariant, context)?.currentRule.type ?? "suffix",
  );
  const [serviceWorkerOverride, setServiceWorkerOverride] = useState<
    boolean | undefined
  >();
  const [workerHandlingOverride, setWorkerOverride] =
    useState<SharedWorkerHandlingMode>();
  const [relaxCsp, setRelaxCsp] = useState(false);
  const [lastAction, setLastAction] = useState("Ready");
  const [selectedNotification, setSelectedNotification] =
    useState<PopupNotification | null>(null);
  const [notifications, setNotifications] = useState<PopupNotification[]>([]);
  const brandThingElementRef = useRef<PrivacyThingLogoElement | null>(null);
  const previousSheetOpenRef = useRef(false);

  useEffect(() => setVariant(initialVariant), [initialVariant]);
  useEffect(() => setActiveContext(context), [context]);
  useEffect(() => setWorkspace(initialWorkspace), [initialWorkspace]);
  useEffect(() => setViewport(initialViewport), [initialViewport]);

  const fixtureState = useMemo(
    () => createPopupStoryState(variant, activeContext),
    [activeContext, variant],
  );
  useEffect(() => {
    setNotifications(fixtureState?.notifications ?? []);
    setSelectedNotification(null);
    setRuleMode(fixtureState?.currentRule.type ?? "suffix");
    setWorkerOverride(fixtureState?.currentRule.workerHandlingOverride);
  }, [fixtureState]);
  const popupState = useMemo(
    () =>
      fixtureState
        ? {
            ...fixtureState,
            notifications,
            hasUnreadNotification: notifications.some(isNoticeUnread),
          }
        : null,
    [fixtureState, notifications],
  );
  const viewModel = derivePopupViewModel(popupState);
  const resolvedVariant = resolvePresentationKind(popupState);
  const openWorkspace = (next: PopupStoryWorkspace) => {
    setWorkspace(next);
    setLastAction(`Opened ${next}`);
  };
  const recordAction = (message: string) => setLastAction(message);
  const resolveNotification = (notification: PopupNotification, message: string) => {
    const resolved = {
      ...notification,
      readAt: notification.readAt ?? notification.lastDetectedAt,
      resolvedAt: notification.lastDetectedAt,
    };
    setNotifications((current) =>
      current.map((item) => (item.id === notification.id ? resolved : item)),
    );
    setSelectedNotification(resolved);
    setLastAction(message);
    if (isPopupPolicyNoticeKind(notification.kind)) {
      if (activeContext === "all-policy-risks") {
        setActiveContext(
          notification.kind === "service-worker-block"
            ? "shared-worker-strict"
            : "service-worker-block",
        );
      } else if (activeContext === notification.kind) {
        setActiveContext("baseline");
      }
    }
    setWorkspace("closed");
  };
  const unreadCount =
    popupState?.notifications.filter(
      (notification) =>
        notification.readAt === null && notification.resolvedAt === null,
    ).length ?? 0;
  const policyKinds =
    popupState?.effectiveSummary.surfaceSummary.surfaces
      .map((surface) => surface.attention?.notificationKind)
      .filter(isPopupPolicyNoticeKind) ?? [];
  const hasAttention =
    popupState?.effectiveSummary.surfaceSummary.highestPriorityAttention !== null;
  const displayedRuleTone = hasAttention ? "warning" : viewModel.ruleTone;
  const ruleAnimationTiming = resolvePopupBorderTiming({
    hasError: viewModel.ruleTone === "danger",
    hasUserTopic: hasAttention || unreadCount > 0 || viewModel.showFirefoxWarning,
    tone: displayedRuleTone,
  });
  const powerState =
    hasAttention ||
    viewModel.powerTone === "warning" ||
    viewModel.powerTone === "danger"
      ? "warning"
      : viewModel.powerTone === "active"
        ? "active"
        : "disabled";
  const activeContainer = viewModel.containerContext;
  const sheetOpen = workspace !== "closed" && popupState !== null;
  useEffect(() => {
    const wasOpen = previousSheetOpenRef.current;
    previousSheetOpenRef.current = sheetOpen;
    const element = brandThingElementRef.current;
    if (!element || wasOpen === sheetOpen) return;
    dispatchPrivacyThingCommand(
      element,
      sheetOpen ? { type: "look", direction: "south-west" } : { type: "reset" },
    );
  }, [sheetOpen]);
  const isConfirm =
    workspace === "cleanup-confirm" ||
    workspace === "delete-confirm" ||
    workspace === "rule-conflict-confirm";
  const notificationFallback =
    selectedNotification ?? popupState?.notifications[0] ?? null;
  const popupWidth = sheetOpen ? 720 : 360;
  const footerActions = [
    {
      id: "open-xray",
      label: t.popup.viewXRay,
      icon: icon("fa-stethoscope"),
      onClick: () => recordAction("Opened X-Ray"),
    },
    {
      id: "new-identity-current-domain",
      label: t.popup.cleanDomainLabel,
      icon: icon("fa-user-secret"),
      onClick: () => openWorkspace("cleanup-confirm"),
    },
    {
      id: "open-options",
      label: t.popup.settingsLabel,
      icon: icon("fa-gear"),
      onClick: () => recordAction("Opened Settings"),
    },
  ];

  const body = popupState ? (
    <StoryWorkspaceBody
      workspace={workspace}
      popupState={popupState}
      selectedNotification={notificationFallback}
      onOpenNotification={(notification) => {
        const acknowledged = {
          ...notification,
          readAt: notification.readAt ?? notification.lastDetectedAt,
        };
        setNotifications((current) =>
          current.map((item) => (item.id === notification.id ? acknowledged : item)),
        );
        setSelectedNotification(acknowledged);
        openWorkspace("notification-detail");
      }}
      onResolveNotification={resolveNotification}
      onAction={recordAction}
    />
  ) : null;

  return (
    <div className="min-h-[820px] w-screen bg-background p-6 text-foreground">
      {showWorkbench ? (
        <div className="mx-auto mb-6 grid w-full max-w-[1120px] gap-4 rounded-2xl border border-border bg-card/85 p-4 shadow-sm">
          <div>
            <p className="text-sm font-semibold text-foreground">Popup workbench</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Combine a base state, page context, workspace, and browser height.
            </p>
          </div>
          <div className="grid items-start gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="grid content-start gap-1.5 text-[11px] font-semibold text-muted-foreground">
              Base variant
              <select
                className="h-9 min-w-0 rounded-lg border border-border bg-background px-2 text-xs text-foreground"
                value={variant}
                onChange={(event) =>
                  setVariant(event.target.value as PopupPresentationKind)
                }
              >
                {POPUP_PRESENTATION_KINDS.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
            <label className="grid content-start gap-1.5 text-[11px] font-semibold text-muted-foreground">
              Context
              <select
                className="h-9 min-w-0 rounded-lg border border-border bg-background px-2 text-xs text-foreground"
                value={activeContext}
                onChange={(event) =>
                  setActiveContext(event.target.value as PopupStoryContext)
                }
              >
                {STORY_CONTEXTS.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
            <label className="grid content-start gap-1.5 text-[11px] font-semibold text-muted-foreground">
              Workspace
              <select
                className="h-9 min-w-0 rounded-lg border border-border bg-background px-2 text-xs text-foreground"
                value={workspace}
                onChange={(event) =>
                  setWorkspace(event.target.value as PopupStoryWorkspace)
                }
              >
                {STORY_WORKSPACES.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
            <label className="grid content-start gap-1.5 text-[11px] font-semibold text-muted-foreground">
              Popup height
              <select
                className="h-9 min-w-0 rounded-lg border border-border bg-background px-2 text-xs text-foreground"
                value={viewport}
                onChange={(event) =>
                  setViewport(event.target.value as PopupStoryViewport)
                }
              >
                <option value="browser">Browser frame · 600 px</option>
                <option value="compact">Content-sized shell · min 450 px</option>
              </select>
            </label>
          </div>
          <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-border bg-muted/35 px-3 py-2 text-[11px] text-muted-foreground">
            <span>
              <strong className="font-semibold text-foreground">Resolved</strong> ·{" "}
              {resolvedVariant}
            </span>
            <span className="min-w-0 truncate" title={policyKinds.join(", ") || "none"}>
              <strong className="font-semibold text-foreground">Policies</strong> ·{" "}
              {policyKinds.join(", ") || "none"}
            </span>
            <span className="min-w-0 truncate">
              <strong className="font-semibold text-foreground">Last action</strong> ·{" "}
              {lastAction}
            </span>
          </div>
        </div>
      ) : null}

      <div className="mx-auto max-w-full" style={{ width: popupWidth }}>
        <div className="mb-2 flex items-center justify-between gap-4 px-1 font-mono text-[10px] text-muted-foreground">
          <span>
            {popupWidth} × {viewport === "browser" || sheetOpen ? "600" : "content"}
          </span>
          <span>Browser limit: 800 × 600</span>
        </div>
        <div
          className={`max-w-full ${viewport === "browser" ? "h-[600px] overflow-auto" : "overflow-visible"}`}
          data-story-browser-frame={viewport === "browser" ? "true" : "false"}
        >
          <div
            className="gw-popup-layout mx-auto flex min-h-0 flex-row-reverse items-stretch overflow-hidden border border-border bg-background shadow-2xl"
            data-story-viewport={viewport}
            data-workspace-open={sheetOpen ? "true" : "false"}
            data-sizing-state={sheetOpen ? "sidecar" : "compact"}
          >
            <div className="gw-popup-core-pane w-[360px] shrink-0">
              <PopupShell
                phase={popupState ? "ready" : "loading"}
                loadingLabel={t.popup.loading}
                title={BRAND_DISPLAY_NAME}
                brand={
                  <BrandHorizontalLogo
                    className="w-full"
                    animateCursor
                    animateIcon
                    thingPose={viewModel.brandThingPose}
                    elementRef={brandThingElementRef}
                  />
                }
                notificationsLabel={t.popup.notificationsTitle}
                notificationsTitle={t.popup.notificationsTitle}
                notificationsIcon={<BellIcon />}
                notificationsCount={unreadCount}
                notificationsCountLabel={t.popup.notificationsBadgeLabel(unreadCount)}
                onNotifications={() => openWorkspace("notification-list")}
                {...(activeContainer?.colorCode
                  ? { topAccentColor: activeContainer.colorCode }
                  : {})}
                {...(popupState?.currentTab.hostname
                  ? { domain: popupState.currentTab.hostname }
                  : {})}
                {...(popupState?.currentTab.url
                  ? { domainTitle: popupState.currentTab.url }
                  : {})}
                {...(viewModel.locationLabel
                  ? { location: viewModel.locationLabel }
                  : {})}
                {...(viewModel.primaryLanguageLabel
                  ? { primaryLanguage: viewModel.primaryLanguageLabel }
                  : {})}
                {...(viewModel.languagePrioritiesTitle
                  ? { languagePrioritiesTitle: viewModel.languagePrioritiesTitle }
                  : {})}
                powerState={powerState}
                powerDisabled={
                  viewModel.globalProtectionsOff ||
                  popupState?.panicMode ||
                  !popupState?.currentRule.canToggle
                }
                powerTitle={viewModel.powerTitle}
                powerTarget={viewModel.powerTarget}
                powerLabel={viewModel.powerLabel}
                powerAriaLabel={viewModel.powerAriaLabel}
                onPowerClick={() => {
                  const next = getNextPowerVariant(variant);
                  setVariant(next);
                  recordAction(
                    next === variant
                      ? "Control is unavailable in this scenario"
                      : `Protection changed to ${next}`,
                  );
                }}
                ruleTitle={viewModel.protectionTitle}
                ruleTone={displayedRuleTone}
                ruleAnimationTiming={ruleAnimationTiming}
                {...(activeContainer?.colorCode
                  ? { ruleAccentColor: activeContainer.colorCode }
                  : {})}
                {...(viewModel.ruleActionLabel
                  ? { ruleActionLabel: viewModel.ruleActionLabel }
                  : {})}
                {...(viewModel.ruleActionTone
                  ? { ruleActionTone: viewModel.ruleActionTone }
                  : {})}
                onRuleAction={() => openWorkspace("rule-form")}
                protectionSource={viewModel.protectionSource}
                {...(viewModel.protectionSourcePattern
                  ? { protectionSourcePattern: viewModel.protectionSourcePattern }
                  : {})}
                protectionCounts={viewModel.protectionCounts}
                {...(viewModel.protectionException
                  ? { protectionException: viewModel.protectionException }
                  : {})}
                {...(viewModel.hasProtectionDetails
                  ? {
                      protectionDetailsLabel: t.popup.protectionViewDetails,
                      onProtectionDetails: () => openWorkspace("protection-details"),
                    }
                  : {})}
                {...(viewModel.ruleFooterActionLabel
                  ? {
                      ruleFooterActionLabel: viewModel.ruleFooterActionLabel,
                      onRuleFooterAction: () => openWorkspace("rule-form"),
                    }
                  : {})}
                {...(viewModel.ruleFooterActionTone
                  ? { ruleFooterActionTone: viewModel.ruleFooterActionTone }
                  : {})}
                {...(viewModel.secondaryActionLabel
                  ? {
                      secondaryActionLabel: viewModel.secondaryActionLabel,
                      onSecondaryAction: () =>
                        recordAction(
                          viewModel.secondaryActionLabel ?? "Secondary action",
                        ),
                    }
                  : {})}
                {...(viewModel.secondaryActionTone
                  ? {
                      secondaryActionTone: viewModel.secondaryActionTone,
                    }
                  : {})}
                {...(viewModel.showFirefoxWarning
                  ? {
                      alertTitle: t.popup.firefoxFirstInlinePermissionTitle,
                      alertDescription: t.popup.firefoxFirstInlinePermissionDescription,
                      alertActionLabel: t.popup.firefoxFirstInlinePermissionEnableLabel,
                      onAlertAction: () =>
                        recordAction("Requested Firefox userScripts permission"),
                    }
                  : {})}
                footerActions={
                  popupState
                    ? footerActions
                    : footerActions.map((action) =>
                        action.id === "open-options"
                          ? action
                          : { ...action, disabled: true },
                      )
                }
              />
            </div>

            {popupState ? (
              <PopupRuleSheet
                open={sheetOpen}
                view={workspace === "closed" ? "rule-form" : workspace}
                title={getWorkspaceTitle(
                  workspace,
                  popupState.currentTab.hostname ?? "Current site",
                )}
                description={
                  workspace === "protection-details"
                    ? t.popup.protectionDetailsLead
                    : workspace === "rule-form"
                      ? t.popup.sheetLead
                      : ""
                }
                body={body}
                selectedLocationId={selectedLocationId}
                allowInheritedLocation
                inheritedLocationLabel={t.popup.inheritedDefaultRuleProfileLabel}
                noPresetLabel={t.popup.noPresetLabel}
                regionalPresetEnabled={regionalPresetEnabled}
                locations={popupState.availableLocations}
                ruleMode={ruleMode}
                serviceWorkerOverride={serviceWorkerOverride}
                workerHandlingOverride={workerHandlingOverride}
                relaxCspForWorkers={relaxCsp}
                locationLabel={t.popup.currentProfileLabel}
                ruleTypeLabel={t.popup.ruleTypeLabel}
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
                saveLabel={t.popup.saveLabelSave}
                deleteLabel={t.popup.deleteButtonLabel}
                closeAriaLabel={t.popup.closeSheetAriaLabel}
                closeLabel={t.common.actions.close}
                backLabel={t.common.actions.back}
                cancelLabel={t.common.actions.cancel}
                canDelete={popupState.currentRule.pattern !== null}
                canSave
                {...(isConfirm
                  ? {
                      confirmTitle:
                        workspace === "cleanup-confirm"
                          ? t.popup.cleanupConfirmTitle
                          : workspace === "rule-conflict-confirm"
                            ? t.popup.ruleConflictTitle
                            : t.popup.deleteConfirmTitle,
                      confirmDescription:
                        workspace === "cleanup-confirm"
                          ? t.popup.cleanupPlanDescription(
                              "cookies, local storage, IndexedDB, Cache Storage, Service Workers",
                              "",
                            )
                          : workspace === "rule-conflict-confirm"
                            ? t.popup.ruleConflictConfirm("browserleaks.com")
                            : t.popup.deleteConfirmDescription("browserleaks.com"),
                      confirmActionLabel:
                        workspace === "cleanup-confirm"
                          ? t.popup.cleanupConfirmLabel
                          : workspace === "rule-conflict-confirm"
                            ? t.popup.ruleConflictReplace
                            : t.common.actions.delete,
                      confirmTone:
                        workspace === "cleanup-confirm"
                          ? ("warning" as const)
                          : ("destructive" as const),
                      ...(workspace === "cleanup-confirm"
                        ? { confirmIcon: icon("fa-user-secret", "text-xl") }
                        : {}),
                    }
                  : {})}
                onOpenChange={(open) => {
                  if (!open) setWorkspace("closed");
                }}
                onLocationChange={setSelectedLocationId}
                onRegionalPresetChange={setRegionalPresetEnabled}
                onRuleModeChange={setRuleMode}
                onServiceWorkerChange={setServiceWorkerOverride}
                onWorkerChange={setWorkerOverride}
                onRelaxCspChange={setRelaxCsp}
                onSave={() => {
                  recordAction("Saved rule draft");
                  setWorkspace("closed");
                }}
                onRequestDelete={() => openWorkspace("delete-confirm")}
                onConfirmAction={() => {
                  recordAction(`Confirmed ${workspace}`);
                  setWorkspace(
                    workspace === "cleanup-confirm" ? "cleanup-result" : "closed",
                  );
                }}
                onBack={() =>
                  setWorkspace(
                    workspace === "notification-detail"
                      ? "notification-list"
                      : "rule-form",
                  )
                }
                onOpenFullSettings={() => recordAction("Opened full settings")}
              />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};

const meta = {
  title: "Popup/Functional App",
  component: PopupStoryHarness,
  parameters: {
    privacyThing: { surface: "component" },
  },
  args: {
    variant: "rule-active",
    context: "baseline",
    workspace: "closed",
    viewport: "browser",
    showWorkbench: true,
  },
  argTypes: {
    variant: { control: "select", options: POPUP_PRESENTATION_KINDS },
    context: { control: "select", options: STORY_CONTEXTS },
    workspace: { control: "select", options: STORY_WORKSPACES },
    viewport: { control: "select", options: STORY_VIEWPORTS },
    showWorkbench: { control: "boolean" },
  },
} satisfies Meta<typeof PopupStoryHarness>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Interactive: Story = {};

export const InteractionTest: Story = {
  ...Interactive,
  tags: ["!dev", "!autodocs"],
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const workspace = canvas.getByRole("combobox", { name: "Workspace" });

    await userEvent.selectOptions(workspace, "rule-form");
    await expect(workspace).toHaveValue("rule-form");
    await expect(
      canvas.getByRole("dialog", { name: "browserleaks.com" }),
    ).toBeVisible();
    await userEvent.keyboard("{Escape}");
    await expect(
      canvas.queryByRole("dialog", { name: "browserleaks.com" }),
    ).not.toBeInTheDocument();
  },
};

/**
 * Computed geometry of the composed popup. PopupSignatureContract.test.tsx pins
 * the CSS declarations; this pins what they resolve to once the popup is laid
 * out, which is the half a token change can break without touching a selector.
 * These assertions used to run in the product E2E lane, where they paid an
 * extension build and a browser launch and made a CSS tweak fail the slowest job.
 */
export const GeometryInteractionTest: Story = {
  args: {
    variant: "rule-active",
    context: "baseline",
    workspace: "closed",
    viewport: "compact",
    showWorkbench: false,
  },
  tags: ["!dev", "!autodocs"],
  play: async ({ canvasElement }) => {
    const rect = (selector: string) => {
      const element = canvasElement.querySelector<HTMLElement>(selector);
      if (!element) throw new Error(`Missing ${selector}`);
      return element.getBoundingClientRect();
    };
    const style = (selector: string) => {
      const element = canvasElement.querySelector<HTMLElement>(selector);
      if (!element) throw new Error(`Missing ${selector}`);
      return getComputedStyle(element);
    };

    const header = rect(".gw-popup-header");
    const power = rect(".gw-popup-power-button");
    const card = rect("#current-rule");
    const action = rect(".gw-popup-action-strip");
    const footer = rect(".gw-popup-footer");

    await expect(power.top - header.bottom).toBeGreaterThanOrEqual(12);
    await expect(card.top - power.bottom).toBeGreaterThanOrEqual(18);
    await expect(action.top - card.bottom).toBeGreaterThanOrEqual(28);
    await expect(footer.top - action.bottom).toBeGreaterThanOrEqual(20);
    await expect(card.bottom).toBeLessThanOrEqual(footer.top);

    await expect(
      rect(".gw-popup-rule-source").top - rect(".gw-popup-rule-title").bottom,
    ).toBe(4);

    const headerButtons = [
      ...canvasElement.querySelectorAll<HTMLElement>(".gw-popup-header-action"),
    ].map((button) => {
      const bounds = button.getBoundingClientRect();
      const icon = button.querySelector("svg")?.getBoundingClientRect();
      return {
        width: bounds.width,
        height: bounds.height,
        iconWidth: icon?.width,
        iconHeight: icon?.height,
      };
    });
    await expect(headerButtons).toEqual([
      { width: 28, height: 28, iconWidth: 16, iconHeight: 16 },
    ]);

    await expect(style(".gw-popup-protection-counts").fontSize).toBe("12px");
    await expect(style(".gw-popup-header").backgroundColor).toBe("rgba(0, 0, 0, 0)");
    await expect(style(".gw-popup-header").borderBottomWidth).toBe("0px");
    await expect(style(".gw-popup-footer").borderTopWidth).toBe("1px");
    await expect(style(".gw-popup-language-trigger").color).toBe(
      style(".gw-popup-rule-source").color,
    );

    // Radix drives this tooltip from pointer events, not CSS `:hover`, so it
    // opens under userEvent here.
    await userEvent.hover(
      canvasElement.querySelector<HTMLElement>(".gw-popup-language-trigger")!,
    );
    const tooltip = await within(canvasElement.ownerDocument.body).findByRole(
      "tooltip",
    );
    await expect(tooltip.getBoundingClientRect().width).toBeLessThanOrEqual(220);
  },
};

/**
 * The workspace pane at browser width, plus the protection rows it hosts. Also
 * moved out of the product E2E lane — none of it depends on the extension.
 */
export const WorkspaceGeometryTest: Story = {
  args: {
    variant: "rule-active",
    context: "all-policy-risks",
    workspace: "protection-details",
    viewport: "browser",
    showWorkbench: false,
  },
  tags: ["!dev", "!autodocs"],
  play: async ({ canvasElement }) => {
    const find = (selector: string) => {
      const element = canvasElement.querySelector<HTMLElement>(selector);
      if (!element) throw new Error(`Missing ${selector}`);
      return element;
    };

    // Width is not asserted here: StableGeometryTest in
    // PopupShell.stories.tsx already pins the 360 shell, and this harness wraps
    // the pane in a browser frame whose border makes the box 2px narrower.
    const workspaceElement = find(".gw-popup-workspace");
    const workspace = workspaceElement.getBoundingClientRect();
    const workspaceBody = find(".gw-popup-workspace-body");
    await expect(workspaceElement).toHaveFocus();
    await expect(find(".gw-popup-sheet-close")).not.toHaveFocus();
    await userEvent.tab();
    await expect(find(".gw-popup-sheet-close")).toHaveFocus();
    await expect(workspace.height).toBe(600);
    await expect(
      find(".gw-popup-workspace > header").getBoundingClientRect().height,
    ).toBe(find(".gw-popup-header").getBoundingClientRect().height);

    const actions = find(".gw-popup-workspace-actions");
    const actionsBounds = actions.getBoundingClientRect();
    const xRayButton = find(".gw-popup-workspace-actions button");
    const xRayBounds = xRayButton.getBoundingClientRect();

    await expect(xRayBounds.height).toBe(36);
    await expect(actionsBounds.height).toBe(72);
    await expect(getComputedStyle(actions).borderTopWidth).toBe("1px");
    await expect(workspace.bottom - xRayBounds.bottom).toBeGreaterThanOrEqual(8);
    await expect(getComputedStyle(workspaceBody).scrollbarGutter).toBe("auto");

    const scrollport = find(
      ".gw-popup-protection-details > .gw-popup-workspace-scroll",
    );
    const groupBounds = find(".gw-popup-protection-group").getBoundingClientRect();
    const closeLabelBounds = find(
      ".gw-popup-workspace-back-label",
    ).getBoundingClientRect();
    await expect(getComputedStyle(scrollport).scrollbarWidth).toBe("none");
    await expect(groupBounds.right).toBeCloseTo(closeLabelBounds.right, 4);

    const state = getComputedStyle(find(".gw-popup-protection-state"));
    await expect(state.fontSize).toBe("10px");
    await expect(state.lineHeight).toBe("18px");
  },
};

export const CompatibilityPolicies: Story = {
  args: {
    variant: "rule-active",
    context: "all-policy-risks",
    workspace: "protection-details",
  },
};

export const GlobalProtectionsOff: Story = {
  args: {
    variant: "rule-active",
    context: "global-protections-off",
    workspace: "protection-details",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole("heading", { name: t.popup.protectionDisabled }),
    ).toBeVisible();
    await expect(
      canvas.getByText(
        BUILD_BROWSER_TARGET === "firefox"
          ? "11 not modified · 2 not applicable"
          : "13 not modified",
      ),
    ).toBeVisible();
    await expect(canvas.queryByText(t.popup.protectionStatePending)).toBeNull();
    await expect(canvas.queryByText(t.popup.protectionStateMixed)).toBeNull();
    await expect(
      canvas.getByRole("button", {
        name: t.popup.powerAriaGlobalProtectionsDisabled,
      }),
    ).toBeDisabled();
    await expect(
      canvas.getByRole("button", { name: t.popup.addExactOverrideCta }),
    ).toBeVisible();
    await expect(
      canvas.getByRole("button", { name: t.popup.editDomainRuleLabel }),
    ).toBeVisible();
    await expect(
      canvas.queryByRole("button", { name: t.popup.enableTrustCta }),
    ).toBeNull();
  },
};

export const RuntimeAttention: Story = {
  args: {
    variant: "rule-active",
    context: "worker-runtime-warning",
    workspace: "protection-details",
  },
};

export const DegradedSummary: Story = {
  args: {
    variant: "rule-active",
    context: "runtime-degraded",
    workspace: "closed",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      canvas.getByRole("heading", { name: t.popup.protectionStateDegraded }),
    ).toBeVisible();
    await expect(canvas.getByText(/1 degraded/)).toBeVisible();
  },
};

export const DegradedDetails: Story = {
  args: {
    variant: "rule-active",
    context: "runtime-degraded",
    workspace: "protection-details",
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByText(t.popup.protectionStateDegraded)).toHaveLength(2);
  },
};

export const Notifications: Story = {
  args: {
    variant: "rule-active",
    context: "notifications",
    workspace: "notification-list",
  },
};

export const ExtensionNotification: Story = {
  args: {
    variant: "rule-active",
    context: "extension-notification",
    workspace: "notification-detail",
  },
};

export const RuleEditor: Story = {
  args: {
    variant: "rule-active",
    context: "baseline",
    workspace: "rule-form",
  },
  play: async ({ canvasElement }) => {
    const ruleMode = canvasElement.querySelector<HTMLElement>("#current-rule-mode");
    const scrollport = canvasElement.querySelector<HTMLElement>(
      ".gw-popup-workspace-scroll",
    );

    if (!ruleMode || !scrollport) {
      throw new Error("Missing rule editor controls");
    }

    await expect(ruleMode).toHaveTextContent(t.popup.ruleTypeExact);
    await expect(
      ruleMode.getBoundingClientRect().left - scrollport.getBoundingClientRect().left,
    ).toBeGreaterThanOrEqual(4);
  },
};

export const NewRuleEditor: Story = {
  args: {
    variant: "fallback-active",
    context: "baseline",
    workspace: "rule-form",
  },
  play: async ({ canvasElement }) => {
    const ruleMode = canvasElement.querySelector<HTMLElement>("#current-rule-mode");

    if (!ruleMode) {
      throw new Error("Missing rule mode control");
    }

    await expect(ruleMode).toHaveTextContent(t.popup.ruleTypeSuffix);
  },
};

export const AllBaseVariants: Story = {
  parameters: {
    a11y: {
      config: {
        rules: [
          { id: "landmark-no-duplicate-main", enabled: false },
          { id: "landmark-unique", enabled: false },
        ],
      },
    },
  },
  args: { showWorkbench: false },
  render: (args) => (
    <div className="grid min-h-screen gap-8 bg-background p-8 xl:grid-cols-2">
      {POPUP_PRESENTATION_KINDS.map((variant) => (
        <section key={variant} className="min-w-0">
          <h2 className="mb-2 font-mono text-xs font-semibold text-muted-foreground">
            {variant}
          </h2>
          <div className="origin-top-left scale-[0.86]">
            <PopupStoryHarness
              {...args}
              variant={variant}
              workspace="closed"
              showWorkbench={false}
            />
          </div>
        </section>
      ))}
    </div>
  ),
};
