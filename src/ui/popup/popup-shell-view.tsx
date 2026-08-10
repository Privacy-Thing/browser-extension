import type { CSSProperties } from "react";

import { BellIcon } from "./components/PopupIcons";
import { PopupShell } from "./components/PopupShell";
import { resolvePopupBorderTiming } from "./popup-border-timing";
import type { PopupController } from "./popup-controller";
import { getPopupFooterActions } from "./popup-footer-actions";
import { getPopupAlertContent } from "./popup-mutation-state";

import { fireAndForget } from "@/shared/async";
import { BRAND_DISPLAY_NAME } from "@/shared/brand";
import {
  getPopupNotificationTone,
  isNoticeUnread,
} from "@/shared/popup-notification-state";
import { BrandHorizontalLogo } from "@/ui/branding/BrandHorizontalLogo";
import { t } from "@/ui/i18n";
import { useTheme } from "@/ui/shared/ThemeProvider";

type PopupShellProps = React.ComponentProps<typeof PopupShell>;
type PopupLayoutStyle = CSSProperties & {
  "--gw-popup-context-accent": string;
};

const getRuleFooterProps = (controller: PopupController): Partial<PopupShellProps> => {
  const { state, viewModel } = controller;
  const showRuleFooter =
    viewModel.ruleFooterActionIntent === "open-domain-rule" ||
    viewModel.ruleFooterActionIntent === "create-exact-domain-rule";
  if (showRuleFooter) {
    return {
      ...(viewModel.ruleFooterActionLabel
        ? { ruleFooterActionLabel: viewModel.ruleFooterActionLabel }
        : {}),
      ruleFooterActionId: "open-domain-rule-settings",
      ruleFooterActionIntent: viewModel.ruleFooterActionIntent,
      ruleFooterActionDisabled:
        !viewModel.supported ||
        (state.popupState?.availableLocations.length ?? 0) === 0,
      ...(viewModel.ruleFooterActionTone
        ? { ruleFooterActionTone: viewModel.ruleFooterActionTone }
        : {}),
    };
  }
  if (viewModel.ruleFooterActionIntent !== "open-trusted-site") return {};
  return {
    ...(viewModel.ruleFooterActionLabel
      ? { ruleFooterActionLabel: viewModel.ruleFooterActionLabel }
      : {}),
    ruleFooterActionId: "open-trusted-site-settings",
    ruleFooterActionIntent: viewModel.ruleFooterActionIntent,
    ...(viewModel.ruleFooterActionTone
      ? { ruleFooterActionTone: viewModel.ruleFooterActionTone }
      : {}),
  };
};

const getSecondaryFooterProps = (
  controller: PopupController,
): Partial<PopupShellProps> => {
  const { viewModel } = controller;
  const visible =
    viewModel.secondaryActionIntent === "add-to-trusted-sites" ||
    viewModel.secondaryActionIntent === "enable-matched-trusted-site";
  if (!visible) return {};
  return {
    ...(viewModel.secondaryActionLabel
      ? { secondaryActionLabel: viewModel.secondaryActionLabel }
      : {}),
    secondaryActionId:
      viewModel.secondaryActionIntent === "enable-matched-trusted-site"
        ? "enable-matched-trusted-site"
        : "disable-current-site",
    ...(viewModel.secondaryActionTone
      ? { secondaryActionTone: viewModel.secondaryActionTone }
      : {}),
  };
};

const getFooterHandlers = (controller: PopupController): Partial<PopupShellProps> => {
  const props: Partial<PopupShellProps> = {};
  const { ruleFooterActionIntent, secondaryActionIntent } = controller.viewModel;
  if (ruleFooterActionIntent === "open-domain-rule") {
    props.onRuleFooterAction = controller.editors.openDomainRuleSheet;
  } else if (ruleFooterActionIntent === "create-exact-domain-rule") {
    props.onRuleFooterAction = controller.newRules.createExactDomainRule;
  } else if (ruleFooterActionIntent === "open-trusted-site") {
    props.onRuleFooterAction = controller.editors.openTrustedSiteSettings;
  }
  if (secondaryActionIntent === "add-to-trusted-sites") {
    props.onSecondaryAction = () => {
      fireAndForget(controller.products.trustCurrentSite());
    };
  } else if (secondaryActionIntent === "enable-matched-trusted-site") {
    props.onSecondaryAction = () => {
      fireAndForget(controller.toggles.setMatchedSiteEnabled(true));
    };
  }
  return props;
};

const getAlertProps = (controller: PopupController): Partial<PopupShellProps> => {
  const { state, viewModel } = controller;
  const content = getPopupAlertContent({
    loadError: Boolean(state.loadError),
    mutationState: state.mutationState,
    showFirefoxWarning: viewModel.showFirefoxWarning,
  });
  if (!content) return {};
  const props: Partial<PopupShellProps> = {
    alertTitle: content.title,
    alertActionLabel: content.actionLabel,
  };
  if (content.description) props.alertDescription = content.description;
  if (content.action === "retry-load") {
    props.onAlertAction = () => fireAndForget(controller.refresh.loadPopupState());
  } else if (content.action === "dismiss-error") {
    props.onAlertAction = () => state.dispatchMutation({ type: "reset" });
  } else {
    props.onAlertAction = () => {
      fireAndForget(controller.products.enableFirefoxInline());
    };
  }
  return props;
};

type VisualState = {
  displayedRuleTone: PopupShellProps["ruleTone"];
  resolvedPowerState: PopupShellProps["powerState"];
  resolvedRuleAccentColor: string | undefined;
  ruleBorderProps: Partial<PopupShellProps>;
  popupLayoutStyle: PopupLayoutStyle;
};

const getDisplayedRuleTone = (
  hasError: boolean,
  attention: boolean,
  ruleTone: PopupShellProps["ruleTone"],
): PopupShellProps["ruleTone"] => {
  if (hasError) return "danger";
  if (attention) return "warning";
  return ruleTone;
};

const getAnimatedAccent = ({
  hasError,
  attention,
  ruleTone,
  configuredAccent,
}: {
  hasError: boolean;
  attention: boolean;
  ruleTone: PopupShellProps["ruleTone"];
  configuredAccent: string | undefined;
}): string => {
  if (hasError) return "hsl(var(--tone-error-text))";
  if (attention || ruleTone === "warning") {
    return "var(--gw-popup-warning-accent)";
  }
  if (configuredAccent) return configuredAccent;
  return ruleTone === "disabled"
    ? "var(--gw-popup-disabled-accent)"
    : "var(--gw-popup-success-accent)";
};

const getVisualState = (controller: PopupController): VisualState => {
  const { state, viewModel } = controller;
  const attention = Boolean(
    state.popupState?.effectiveSummary.surfaceSummary.highestPriorityAttention,
  );
  const context = Boolean(
    state.popupState?.effectiveSummary.surfaceSummary.highestPriorityContext,
  );
  const notificationTone = state.popupState
    ? getPopupNotificationTone(state.popupState.notifications)
    : null;
  const hasError =
    Boolean(state.loadError) ||
    state.mutationState.status === "error" ||
    viewModel.ruleTone === "danger";
  const displayedRuleTone = getDisplayedRuleTone(
    hasError,
    attention,
    viewModel.ruleTone,
  );
  const ruleAnimationTiming = resolvePopupBorderTiming({
    hasError,
    hasUserTopic:
      attention || context || notificationTone !== null || viewModel.showFirefoxWarning,
    tone: displayedRuleTone,
  });
  let accent = viewModel.ruleAccentColor ?? viewModel.containerContext?.colorCode;
  if (hasError) accent = "hsl(var(--tone-error-text))";
  else if (attention || viewModel.ruleTone === "warning") {
    accent = "var(--gw-popup-warning-accent)";
  } else if (viewModel.ruleTone === "disabled") {
    accent = "var(--gw-popup-disabled-accent)";
  }
  const animatedAccent = getAnimatedAccent({
    hasError,
    attention,
    ruleTone: viewModel.ruleTone,
    configuredAccent: viewModel.ruleAnimatedBorderColor,
  });
  const ruleBorderProps = {
    ruleAnimationTiming,
    ruleAnimatedBorderColor: animatedAccent,
  };
  return {
    displayedRuleTone,
    resolvedPowerState:
      attention || viewModel.powerTone === "danger" ? "warning" : viewModel.powerTone,
    resolvedRuleAccentColor: accent,
    ruleBorderProps,
    popupLayoutStyle: {
      "--gw-popup-context-accent":
        animatedAccent ?? accent ?? "hsl(var(--muted-foreground))",
    },
  };
};

const getShellFooterActions = (controller: PopupController) => {
  const actions = getPopupFooterActions({
    popupState: controller.state.popupState,
    supported: controller.viewModel.supported,
    onOpenXRay: controller.openXRay,
    onOpenNewIdentity: controller.newRules.openNewIdentitySheet,
    onOpenOptions: () => fireAndForget(chrome.runtime.openOptionsPage()),
  });
  return controller.state.popupState
    ? actions
    : actions.map((action) =>
        action.id === "open-options" ? action : { ...action, disabled: true },
      );
};

// Optional popup surfaces intentionally compose one stable shell contract.
// eslint-disable-next-line sonarjs/cognitive-complexity
export const PopupShellPane = ({ controller }: { controller: PopupController }) => {
  const { reduceMotion } = useTheme();
  const { state, viewModel } = controller;
  const visual = getVisualState(controller);
  const unreadCount =
    state.popupState?.notifications.filter(isNoticeUnread).length ?? 0;
  const notificationTone = state.popupState
    ? getPopupNotificationTone(state.popupState.notifications)
    : null;
  const popupDomain = viewModel.supported
    ? (state.popupState?.currentTab.hostname ?? undefined)
    : undefined;
  let shellPhase: PopupShellProps["phase"] = "loading";
  if (state.loadError) shellPhase = "error";
  if (state.popupState) shellPhase = "ready";
  return (
    <div className="gw-popup-core-pane">
      <PopupShell
        phase={shellPhase}
        loadingLabel={t.popup.loading}
        title={BRAND_DISPLAY_NAME}
        brand={
          <BrandHorizontalLogo
            className="gw-popup-brand-lockup"
            animateCursor
            animateIcon
            thingPose={viewModel.brandThingPose}
            reduceMotion={reduceMotion}
            elementRef={state.brandThingElementRef}
          />
        }
        notificationsLabel={t.popup.notificationsTitle}
        notificationsTitle={t.popup.notificationsTitle}
        notificationsIcon={<BellIcon />}
        notificationsCount={unreadCount}
        {...(notificationTone ? { notificationsTone: notificationTone } : {})}
        notificationsCountLabel={t.popup.notificationsBadgeLabel(unreadCount)}
        onNotifications={controller.notices.openNotificationList}
        {...(state.popupState?.currentTab.activeContainer?.colorCode
          ? { topAccentColor: state.popupState.currentTab.activeContainer.colorCode }
          : {})}
        {...(popupDomain ? { domain: popupDomain } : {})}
        {...(state.popupState?.currentTab.url
          ? { domainTitle: state.popupState.currentTab.url }
          : {})}
        {...(viewModel.locationLabel ? { location: viewModel.locationLabel } : {})}
        {...(viewModel.primaryLanguageLabel
          ? { primaryLanguage: viewModel.primaryLanguageLabel }
          : {})}
        {...(viewModel.languagePrioritiesTitle
          ? { languagePrioritiesTitle: viewModel.languagePrioritiesTitle }
          : {})}
        powerState={visual.resolvedPowerState}
        powerDisabled={
          !state.popupState ||
          viewModel.globalProtectionsOff ||
          state.popupState.panicMode ||
          (state.popupState.currentTab.winningSource !== "trusted-site" &&
            !state.popupState.currentRule.canToggle)
        }
        powerTitle={viewModel.powerTitle}
        powerTarget={viewModel.powerTarget}
        powerLabel={viewModel.powerLabel}
        powerAriaLabel={viewModel.powerAriaLabel}
        onPowerClick={() => fireAndForget(controller.toggles.handleToggle())}
        ruleTitle={viewModel.protectionTitle}
        {...visual.ruleBorderProps}
        ruleTone={visual.displayedRuleTone}
        presentationKind={viewModel.presentationKind}
        protectionStatus={viewModel.protectionStatus}
        protectedSurfaceCount={viewModel.protectedSurfaceCount}
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
              onProtectionDetails: controller.newRules.openProtectionDetails,
            }
          : {})}
        {...getAlertProps(controller)}
        {...(visual.resolvedRuleAccentColor
          ? { ruleAccentColor: visual.resolvedRuleAccentColor }
          : {})}
        {...(viewModel.ruleActionLabel
          ? { ruleActionLabel: viewModel.ruleActionLabel }
          : {})}
        {...(viewModel.ruleActionTone
          ? { ruleActionTone: viewModel.ruleActionTone }
          : {})}
        {...getRuleFooterProps(controller)}
        {...getSecondaryFooterProps(controller)}
        ruleActionId="open-rule-settings"
        ruleActionIntent={viewModel.ruleActionIntent}
        ruleActionDisabled={
          state.mutationState.status === "pending" ||
          (viewModel.ruleActionIntent !== "enable-extension" && !viewModel.supported) ||
          ((viewModel.ruleActionIntent === "open-domain-rule" ||
            (viewModel.ruleActionIntent === "create-exact-domain-rule" &&
              state.popupState?.currentRule.pattern !== null)) &&
            (state.popupState?.availableLocations.length ?? 0) === 0)
        }
        onRuleAction={() => {
          fireAndForget(
            Promise.resolve(
              controller.ruleActionHandlers[viewModel.ruleActionIntent](),
            ),
          );
        }}
        {...getFooterHandlers(controller)}
        footerActions={getShellFooterActions(controller)}
      />
    </div>
  );
};

export const getPopupLayoutStyle = (controller: PopupController): PopupLayoutStyle =>
  getVisualState(controller).popupLayoutStyle;
