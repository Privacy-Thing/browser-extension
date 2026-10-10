import {
  PopupNotificationDetail,
  PopupNotificationList,
} from "./components/PopupNotifications";
import { PopupProtectionDetails } from "./components/PopupProtectionDetails";
import { PopupRuleSheet, type PopupRuleSheetProps } from "./components/PopupRuleSheet";
import type { PopupController } from "./popup-controller";
import { getInheritedProfileLabel } from "./popup-navigation";

import { fireAndForget } from "@/shared/async";
import type { CleanupPlan, CleanupResult } from "@/shared/types";
import { t } from "@/ui/i18n";
import { useUiLocale } from "@/ui/i18n/LocaleRefresh";
import { icon } from "@/ui/options/utils";
import { ProviderFeatureHost } from "@/ui/shared/ProviderFeatureHost";
import { ruleGroupCopy } from "@/ui/shared/rule-group-copy";
import { RuleHostList } from "@/ui/shared/RuleHosts";
import {
  applyJoinToPopupDraft,
  useProviderFeatureJoin,
  type JoinOfferChange,
  type FeatureDecisionChange,
} from "@/ui/shared/use-provider-feature-join";

const getCleanupSurfaceLabel = (key: CleanupPlan["surfaces"][number]["key"]): string =>
  ({
    cookies: t.popup.cleanupSurfaceCookies,
    "local-storage": t.popup.cleanupSurfaceLocalStorage,
    "indexed-db": t.popup.cleanupSurfaceIndexedDb,
    "cache-storage": t.popup.cleanupSurfaceCacheStorage,
    "service-workers": t.popup.cleanupSurfaceServiceWorkers,
    "page-storage": t.popup.cleanupSurfacePageStorage,
  })[key];

const getCleanupOutcomeLabel = (outcome: CleanupResult["outcome"]): string => {
  if (outcome === "complete") return t.popup.cleanupResultComplete;
  if (outcome === "partial") return t.popup.cleanupResultPartial;
  return t.popup.cleanupResultFailed;
};

const getCleanupStatusLabel = (
  status: CleanupResult["surfaces"][number]["status"],
): string => {
  if (status === "cleaned") return t.popup.cleanupStatusCleaned;
  if (status === "failed") return t.popup.cleanupStatusFailed;
  return t.popup.cleanupStatusSkipped;
};

const getSheetTitle = (
  controller: PopupController,
): { title: string; description: string } => {
  const view = controller.state.sheetView;
  if (view === "cleanup-result") {
    return { title: t.popup.cleanupResultTitle, description: "" };
  }
  if (view === "notification-list" || view === "notification-detail") {
    return { title: t.popup.notificationsTitle, description: "" };
  }
  if (view === "protection-details") {
    return {
      title: t.popup.protectionDetailsTitle,
      description: t.popup.protectionDetailsLead,
    };
  }
  if (view === "cleanup-confirm") {
    return { title: t.popup.cleanupSheetTitle, description: "" };
  }
  const ruleTitle =
    (controller.state.popupState?.groupPatterns?.length ?? 0) > 1
      ? t.rules.dialog.titleEdit
      : controller.sheets.getRuleSheetPatternLabel();
  return {
    title: view === "rule-form" ? ruleTitle : t.popup.sheetTitle,
    description: t.popup.sheetLead,
  };
};

const getSheetConfirmProps = (
  controller: PopupController,
): Partial<PopupRuleSheetProps> => {
  const { state } = controller;
  if (state.sheetView === "rule-conflict-confirm") {
    return {
      confirmTitle: t.popup.ruleConflictTitle,
      confirmDescription: state.conflictPattern
        ? t.popup.ruleConflictConfirm(state.conflictPattern)
        : "",
      confirmActionLabel: t.popup.ruleConflictReplace,
      confirmTone: "warning",
    };
  }
  if (state.sheetView === "delete-confirm") {
    return {
      confirmTitle: t.popup.deleteConfirmTitle,
      ...(state.popupState?.currentRule.pattern
        ? {
            confirmDescription: t.popup.deleteConfirmDescription(
              state.popupState.currentRule.pattern,
            ),
          }
        : {}),
      confirmActionLabel: t.common.actions.delete,
      confirmTone: "destructive",
    };
  }
  if (state.sheetView !== "cleanup-confirm") return {};
  const available =
    state.cleanupPlan?.surfaces
      .filter((surface) => surface.available)
      .map((surface) => getCleanupSurfaceLabel(surface.key))
      .join(", ") ?? "";
  const unavailable =
    state.cleanupPlan?.surfaces
      .filter((surface) => !surface.available)
      .map((surface) => getCleanupSurfaceLabel(surface.key))
      .join(", ") ?? "";
  return {
    confirmTitle: t.popup.cleanupConfirmTitle,
    confirmDescription: state.cleanupPlan
      ? t.popup.cleanupPlanDescription(available, unavailable)
      : t.popup.cleanupPlanLoading,
    confirmActionLabel: t.popup.cleanupConfirmLabel,
    confirmTone: "warning",
    confirmIcon: icon("fa-user-secret", "text-[2rem]"),
  };
};

const CleanupResultView = ({ controller }: { controller: PopupController }) => {
  const result = controller.state.cleanupResult;
  if (!result) return null;
  return (
    <div className="gw-popup-cleanup-result">
      <p className="gw-popup-cleanup-result-summary">
        {getCleanupOutcomeLabel(result.outcome)}
      </p>
      <div className="gw-popup-cleanup-surfaces">
        {result.surfaces.map((surface) => (
          <div key={surface.key} className="gw-popup-cleanup-surface">
            <span className="gw-popup-cleanup-surface-label">
              {getCleanupSurfaceLabel(surface.key)}
            </span>
            <span
              className="gw-popup-cleanup-surface-status"
              data-status={surface.status}
            >
              {getCleanupStatusLabel(surface.status)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

const renderSheetBody = (controller: PopupController): React.ReactNode => {
  const { state } = controller;
  if (state.sheetView === "cleanup-result" && state.cleanupResult) {
    return <CleanupResultView controller={controller} />;
  }
  if (state.sheetView === "notification-list" && state.popupState) {
    return (
      <PopupNotificationList
        notifications={state.popupState.notifications}
        onOpen={controller.notices.openNotificationDetail}
      />
    );
  }
  if (state.sheetView === "notification-detail" && controller.selectedNotification) {
    return (
      <PopupNotificationDetail
        notification={controller.selectedNotification}
        onApplySuggestion={controller.suggestions.handleApplySuggestion}
        onDismiss={controller.notices.dismissNotification}
        onDismissSuggestion={controller.suggestions.handleDismissSuggestion}
        onNotificationAction={controller.notices.activateNotification}
      />
    );
  }
  if (state.sheetView === "protection-details" && state.popupState) {
    return (
      <PopupProtectionDetails
        popupState={state.popupState}
        onNotificationOpen={controller.notices.openNotificationDetail}
        onOpenXRay={controller.openXRay}
      />
    );
  }
  return undefined;
};

const confirmSheetAction = (controller: PopupController): void => {
  const view = controller.state.sheetView;
  if (view === "rule-conflict-confirm") {
    fireAndForget(controller.saves.handleSave(true));
  } else if (view === "cleanup-confirm") {
    fireAndForget(controller.cleanup.handleNewIdentity());
  } else {
    fireAndForget(controller.saves.handleRuleDelete());
  }
};

const goBack = (controller: PopupController): void => {
  const { state } = controller;
  if (state.sheetView === "delete-confirm") {
    state.setSheetView("rule-form");
  } else if (state.sheetView === "rule-conflict-confirm") {
    state.setConflictPattern(null);
    state.setSheetView("rule-form");
  } else if (state.sheetView === "cleanup-result") {
    controller.sheets.closeSheet();
  } else if (state.sheetView === "notification-detail") {
    state.setNotificationId(null);
    state.setSheetView("notification-list");
  } else {
    controller.sheets.closeSheet();
  }
};

const PopupFeatureHost = ({
  hostname,
  patternLabel,
  savedRulePattern,
  locationId,
  onDecisionChange,
  onJoinOfferChange,
}: {
  hostname: string | null;
  patternLabel: string;
  savedRulePattern: string | null;
  locationId: string | null;
  onDecisionChange: FeatureDecisionChange;
  onJoinOfferChange: JoinOfferChange;
}) => {
  if (!hostname) return null;
  const savedFeatureProps = savedRulePattern ? { savedRulePattern } : {};
  return (
    <ProviderFeatureHost
      key={patternLabel}
      variant="compact"
      rulePattern={savedRulePattern ?? patternLabel}
      {...savedFeatureProps}
      hostname={hostname}
      locationId={locationId}
      onDecisionChange={onDecisionChange}
      onJoinOfferChange={onJoinOfferChange}
    />
  );
};

const updateRegionalPreset = (controller: PopupController, enabled: boolean): void => {
  if (enabled !== controller.state.isRegionalPresetOn) {
    controller.state.setRegionalPresetChanged(true);
  }
  controller.state.setRegionalPresetOn(enabled);
};

const ruleFormExtra = (
  controller: PopupController,
  savedRulePattern: string | null,
  featureExtra: React.ReactNode,
) => (
  <>
    {savedRulePattern ? (
      <RuleHostList
        patterns={(controller.state.popupState?.groupPatterns ?? []).map((pattern) =>
          pattern === savedRulePattern
            ? controller.sheets.getRuleSheetPatternLabel()
            : pattern,
        )}
      />
    ) : null}
    {featureExtra}
  </>
);

const getSavedRulePattern = ({ state }: PopupController): string | null => {
  const pattern = state.popupState?.currentRule.pattern;
  return pattern &&
    state.sheetView === "rule-form" &&
    !state.creatingExactOverride &&
    state.sheetTargetPattern === pattern
    ? pattern
    : null;
};

export const PopupSheetPane = ({ controller }: { controller: PopupController }) => {
  const { state, viewModel } = controller;
  const groupCopy = ruleGroupCopy[useUiLocale()];
  const patternLabel = controller.sheets.getRuleSheetPatternLabel();
  const join = useProviderFeatureJoin(
    patternLabel,
    state.setFeatureDecision,
    getSavedRulePattern(controller) === null,
  );
  if (!state.popupState) return null;
  const presented = applyJoinToPopupDraft(
    {
      selectedLocationId: state.selectedLocationId,
      regionalPresetEnabled: state.isRegionalPresetOn,
      serviceWorkerOverride: state.serviceWorkerOverride,
      workerHandlingOverride: state.workerOverride,
      relaxCspForWorkers: state.shouldRelaxWorkerCsp,
    },
    join,
  );
  const copy = getSheetTitle(controller);
  const inheritedProfileLabel = getInheritedProfileLabel(state.popupState);
  const savedRulePattern = getSavedRulePattern(controller);
  const featureExtra = (
    <PopupFeatureHost
      hostname={state.popupState.currentTab.hostname}
      patternLabel={patternLabel}
      savedRulePattern={savedRulePattern}
      locationId={state.isRegionalPresetOn ? state.selectedLocationId : null}
      onDecisionChange={join.onDecisionChange}
      onJoinOfferChange={join.onJoinOfferChange}
    />
  );
  const titleTooltip =
    state.sheetView === "rule-form"
      ? controller.sheets.getRuleSheetPatternLabel()
      : undefined;
  return (
    <PopupRuleSheet
      open={state.isRuleSheetOpen}
      drillIn={state.sizingState === "drill-in"}
      view={state.sheetView}
      title={copy.title}
      {...(titleTooltip ? { titleTooltip } : {})}
      description={copy.description}
      body={renderSheetBody(controller)}
      formExtra={ruleFormExtra(controller, savedRulePattern, featureExtra)}
      selectedLocationId={presented.selectedLocationId}
      settingsLocked={presented.settingsLocked}
      joinSource={join.source}
      allowInheritedLocation={state.allowInheritedLocation}
      {...(inheritedProfileLabel
        ? { inheritedLocationLabel: inheritedProfileLabel }
        : {})}
      noPresetLabel={t.popup.noPresetLabel}
      regionalPresetEnabled={presented.regionalPresetEnabled}
      locations={state.popupState.availableLocations}
      ruleMode={state.selectedRuleMode}
      serviceWorkerOverride={presented.serviceWorkerOverride}
      workerHandlingOverride={presented.workerHandlingOverride}
      relaxCspForWorkers={presented.relaxCspForWorkers}
      locationLabel={t.popup.currentProfileLabel}
      ruleTypeLabel={
        savedRulePattern && (state.popupState.groupPatterns?.length ?? 0) > 1
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
      saveLabel={viewModel.hasRule ? t.popup.saveLabelSave : t.popup.saveLabelCreate}
      deleteLabel={t.popup.deleteButtonLabel}
      deleteTone="destructive"
      closeAriaLabel={t.popup.closeSheetAriaLabel}
      closeLabel={t.common.actions.close}
      backLabel={t.common.actions.back}
      cancelLabel={t.common.actions.cancel}
      busy={state.mutationState.status === "pending"}
      {...(state.mutationState.status === "error" && state.mutationState.message
        ? { errorMessage: state.mutationState.message }
        : {})}
      {...getSheetConfirmProps(controller)}
      canDelete={canDeleteSheetRule(controller)}
      canSave={viewModel.supported && !join.saveDisabled}
      onOpenChange={(open) => {
        if (!open) controller.sheets.closeSheet();
      }}
      onLocationChange={state.setSelectedLocationId}
      onRegionalPresetChange={(enabled) => updateRegionalPreset(controller, enabled)}
      onRuleModeChange={state.setSelectedRuleMode}
      onServiceWorkerChange={state.setServiceWorkerOverride}
      onWorkerChange={state.setWorkerOverride}
      onRelaxCspChange={state.setRelaxWorkerCsp}
      onOpenFullSettings={controller.editors.openFullRuleSettings}
      onSave={() => fireAndForget(controller.saves.handleSave())}
      onRequestDelete={() => state.setSheetView("delete-confirm")}
      onConfirmAction={() => confirmSheetAction(controller)}
      onBack={() => goBack(controller)}
    />
  );
};

const canDeleteSheetRule = ({ state, viewModel }: PopupController): boolean =>
  viewModel.supported &&
  viewModel.hasRule &&
  !state.creatingExactOverride &&
  state.sheetTargetPattern === state.popupState?.currentRule.pattern;
