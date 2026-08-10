import { type CSSProperties, useLayoutEffect } from "react";

import { PopupButton } from "./PopupButton";
import { PopupFooter } from "./PopupFooter";
import { PopupHeader } from "./PopupHeader";
import { PopupPowerButton } from "./PopupPowerButton";
import { getPopupRuleToneAccent, PopupRuleCard } from "./PopupRuleCard";

import type { PopupNotificationTone } from "@/shared/popup-notification-state";
import type { PopupBorderTiming } from "@/ui/popup/popup-border-timing";

const withAlpha = (color: string, alphaHex: string): string =>
  /^#(?:[0-9a-fA-F]{6})$/.test(color) ? `${color}${alphaHex}` : color;

const clearPopupAccent = (root: HTMLElement): void => {
  delete root.dataset.popupHasWindowAccent;
  root.style.removeProperty("--gw-popup-window-accent");
  root.style.removeProperty("--gw-popup-window-accent-border");
  root.style.removeProperty("--gw-popup-window-accent-wash");
  root.style.removeProperty("--gw-popup-window-accent-glow");
};

type PopupActionTone = "secondary" | "success" | "danger";
export type PopupShellPhase = "loading" | "ready" | "error";

type PopupShellFrameStyle = CSSProperties & {
  "--gw-popup-context-accent": string;
};

type PopupShellProps = {
  phase?: PopupShellPhase;
  loadingLabel?: string;
  title: string;
  brand?: React.ReactNode;
  headerActionLabel?: string;
  headerActionTitle?: string;
  headerActionIcon?: React.ReactNode;
  onHeaderAction?: () => void;
  notificationsLabel?: string;
  notificationsTitle?: string;
  notificationsIcon?: React.ReactNode;
  notificationsCount?: number;
  notificationsTone?: PopupNotificationTone;
  notificationsCountLabel?: string;
  onNotifications?: () => void;
  topAccentColor?: string;
  domain?: string;
  domainTitle?: string;
  location?: string;
  primaryLanguage?: string;
  languagePrioritiesTitle?: string;
  powerState: "active" | "disabled" | "warning";
  powerDisabled?: boolean;
  powerTitle: string;
  powerTarget: string;
  powerLabel: string;
  powerAriaLabel: string;
  powerWarningLabel?: string;
  powerWarningTitle?: string;
  onPowerWarningClick?: () => void;
  onPowerClick?: () => void;
  ruleTitle: string;
  ruleAnimatedBorderColor?: string;
  ruleAnimationTiming?: PopupBorderTiming;
  ruleFooterActionLabel?: string;
  ruleFooterActionId?: string;
  ruleFooterActionIntent?: string;
  ruleFooterActionDisabled?: boolean;
  ruleFooterActionTone?: PopupActionTone;
  secondaryActionLabel?: string;
  secondaryActionId?: string;
  secondaryActionIntent?: string;
  secondaryActionDisabled?: boolean;
  secondaryActionTone?: PopupActionTone;
  ruleTone: "active" | "disabled" | "warning" | "danger";
  ruleAccentColor?: string;
  ruleActionLabel?: string;
  ruleActionId?: string;
  ruleActionIntent?: string;
  ruleActionDisabled?: boolean;
  ruleActionTone?: PopupActionTone;
  onRuleAction?: () => void;
  onRuleFooterAction?: () => void;
  onSecondaryAction?: () => void;
  footerActions: Array<{
    id?: string;
    label: string;
    title?: string;
    ariaLabel?: string;
    disabled?: boolean;
    onClick?: () => void;
    icon: React.ReactNode;
  }>;
  protectionSource: string;
  protectionSourcePattern?: string;
  presentationKind?: string;
  protectionStatus?: string;
  protectionCounts?: string;
  protectedSurfaceCount?: number;
  protectionException?: string;
  protectionDetailsLabel?: string;
  onProtectionDetails?: () => void;
  alertTitle?: string;
  alertDescription?: string;
  alertActionLabel?: string;
  onAlertAction?: () => void;
};

const PopupContextActions = ({
  actions,
}: {
  actions: Array<{
    id: string | undefined;
    label: string | undefined;
    disabled: boolean | undefined;
    tone: PopupActionTone | undefined;
    /** Published as `data-action-intent` so tests read the action, not its label. */
    intent: string | undefined;
    onClick: (() => void) | undefined;
  }>;
}) => {
  const visible = actions.filter((action) => action.label);

  const getActionTone = (tone: PopupActionTone | undefined) => {
    if (tone === "danger") return "danger";
    if (tone === "success") return "success";
    return "neutral";
  };

  return (
    <div
      className="gw-popup-action-strip"
      data-row-count={visible.length > 2 ? "2" : "1"}
      data-empty={visible.length === 0 ? "true" : undefined}
      aria-hidden={visible.length === 0 ? "true" : undefined}
    >
      {visible.map((action, index) => (
        <PopupButton
          key={action.id ?? action.label}
          {...(action.id ? { id: action.id } : {})}
          {...(action.intent ? { "data-action-intent": action.intent } : {})}
          disabled={action.disabled}
          onClick={action.onClick}
          title={action.label}
          className="gw-popup-context-action"
          variant="secondary"
          tone={getActionTone(action.tone)}
          wide={visible.length === 1 || (visible.length === 3 && index === 2)}
        >
          {action.label}
        </PopupButton>
      ))}
    </div>
  );
};

const usePopupWindowAccent = (topAccentColor: string | undefined): boolean => {
  const hasTopAccent = Boolean(topAccentColor);
  useLayoutEffect(() => {
    const root = document.documentElement;

    if (hasTopAccent && topAccentColor) {
      root.dataset.popupHasWindowAccent = "true";
      root.style.setProperty(
        "--gw-popup-window-accent",
        withAlpha(topAccentColor, "24"),
      );
      root.style.setProperty(
        "--gw-popup-window-accent-border",
        withAlpha(topAccentColor, "88"),
      );
      root.style.setProperty(
        "--gw-popup-window-accent-wash",
        withAlpha(topAccentColor, "26"),
      );
      root.style.setProperty(
        "--gw-popup-window-accent-glow",
        withAlpha(topAccentColor, "20"),
      );
      return () => clearPopupAccent(root);
    }

    clearPopupAccent(root);
    return undefined;
  }, [hasTopAccent, topAccentColor]);

  return hasTopAccent;
};

const PopupShellHeader = ({ props }: { props: PopupShellProps }) => (
  <PopupHeader
    title={props.title}
    {...(props.domain ? { domain: props.domain } : {})}
    {...(props.brand ? { brand: props.brand } : {})}
    {...(props.domainTitle ? { domainTitle: props.domainTitle } : {})}
    {...(props.headerActionLabel ? { actionLabel: props.headerActionLabel } : {})}
    {...(props.headerActionTitle ? { actionTitle: props.headerActionTitle } : {})}
    {...(props.headerActionIcon ? { actionIcon: props.headerActionIcon } : {})}
    {...(props.onHeaderAction ? { onAction: props.onHeaderAction } : {})}
    {...(props.notificationsLabel
      ? { notificationsLabel: props.notificationsLabel }
      : {})}
    {...(props.notificationsTitle
      ? { notificationsTitle: props.notificationsTitle }
      : {})}
    {...(props.notificationsIcon ? { notificationsIcon: props.notificationsIcon } : {})}
    {...(props.notificationsCount !== undefined
      ? { notificationsCount: props.notificationsCount }
      : {})}
    {...(props.notificationsTone ? { notificationsTone: props.notificationsTone } : {})}
    {...(props.notificationsCountLabel
      ? { notificationsCountLabel: props.notificationsCountLabel }
      : {})}
    {...(props.onNotifications ? { onNotifications: props.onNotifications } : {})}
  />
);

const PopupPowerSection = ({ props }: { props: PopupShellProps }) => (
  <div className="gw-popup-power-stack">
    <PopupPowerButton
      id="toggle-current-rule"
      state={props.powerState}
      ariaLabel={props.powerAriaLabel}
      title={props.powerTitle}
      {...(props.powerDisabled !== undefined ? { disabled: props.powerDisabled } : {})}
      {...(props.powerWarningLabel
        ? { warningBadgeLabel: props.powerWarningLabel }
        : {})}
      {...(props.powerWarningTitle
        ? { warningBadgeTitle: props.powerWarningTitle }
        : {})}
      {...(props.onPowerWarningClick
        ? { onWarningBadgeClick: props.onPowerWarningClick }
        : {})}
      {...(props.onPowerClick ? { onClick: props.onPowerClick } : {})}
    />
    <div className="gw-popup-power-copy">
      <p className="gw-popup-power-status">{props.powerLabel}</p>
      <p className="gw-popup-power-target">{props.powerTarget}</p>
    </div>
  </div>
);

const PopupRuleSection = ({ props }: { props: PopupShellProps }) => (
  <div className="gw-popup-rule-slot">
    <div className="gw-popup-rule-motion">
      <PopupRuleCard
        {...(props.presentationKind
          ? { presentationKind: props.presentationKind }
          : {})}
        {...(props.protectionStatus
          ? { protectionStatus: props.protectionStatus }
          : {})}
        title={props.ruleTitle}
        tone={props.ruleTone}
        summarySource={props.protectionSource}
        {...(props.ruleAnimationTiming
          ? { animationTiming: props.ruleAnimationTiming }
          : {})}
        {...(props.ruleAnimatedBorderColor
          ? { animatedBorderColor: props.ruleAnimatedBorderColor }
          : {})}
        {...(props.ruleAccentColor ? { accentColor: props.ruleAccentColor } : {})}
        {...(props.protectionSourcePattern
          ? { summarySourcePattern: props.protectionSourcePattern }
          : {})}
        {...(props.location ? { summaryProfile: props.location } : {})}
        {...(props.primaryLanguage ? { summaryLanguage: props.primaryLanguage } : {})}
        {...(props.languagePrioritiesTitle
          ? { summaryLanguageTitle: props.languagePrioritiesTitle }
          : {})}
        {...(props.protectionCounts ? { summaryCounts: props.protectionCounts } : {})}
        {...(props.protectedSurfaceCount === undefined
          ? {}
          : { summaryProtectedCount: props.protectedSurfaceCount })}
        {...(props.protectionException
          ? { summaryException: props.protectionException }
          : {})}
        {...(props.protectionDetailsLabel
          ? { detailsLabel: props.protectionDetailsLabel }
          : {})}
        {...(props.onProtectionDetails ? { onDetails: props.onProtectionDetails } : {})}
      />
    </div>
  </div>
);

const PopupAlert = ({ props }: { props: PopupShellProps }) =>
  props.alertTitle ? (
    <div className="gw-popup-alert-row" role="alert">
      <i
        className="fa-solid fa-triangle-exclamation gw-popup-alert-icon"
        aria-hidden="true"
      />
      <div className="gw-popup-alert-copy">
        <p className="gw-popup-alert-title">{props.alertTitle}</p>
        {props.alertDescription ? (
          <p className="gw-popup-alert-description">{props.alertDescription}</p>
        ) : null}
      </div>
      {props.alertActionLabel && props.onAlertAction ? (
        <PopupButton
          variant="link"
          size="sm"
          className="gw-popup-alert-action"
          onClick={props.onAlertAction}
        >
          {props.alertActionLabel}
        </PopupButton>
      ) : null}
    </div>
  ) : null;

const PopupMain = ({ props }: { props: PopupShellProps }) => (
  <section className="gw-popup-main-section">
    <div className="gw-popup-content-stack">
      <PopupPowerSection props={props} />
      <PopupRuleSection props={props} />
      <PopupAlert props={props} />
      <PopupContextActions
        actions={[
          {
            id: props.ruleFooterActionId,
            intent: props.ruleFooterActionIntent,
            label: props.ruleFooterActionLabel,
            disabled: props.ruleFooterActionDisabled,
            tone: props.ruleFooterActionTone,
            onClick: props.onRuleFooterAction,
          },
          {
            id: props.secondaryActionId,
            intent: props.secondaryActionIntent,
            label: props.secondaryActionLabel,
            disabled: props.secondaryActionDisabled,
            tone: props.secondaryActionTone,
            onClick: props.onSecondaryAction,
          },
          {
            id: props.ruleActionId,
            intent: props.ruleActionIntent,
            label: props.ruleActionLabel,
            disabled: props.ruleActionDisabled,
            tone: props.ruleActionTone,
            onClick: props.onRuleAction,
          },
        ]}
      />
    </div>
  </section>
);

export const PopupShell = (props: PopupShellProps) => {
  const hasTopAccent = usePopupWindowAccent(props.topAccentColor);
  const contextAccent =
    props.ruleAnimatedBorderColor ??
    props.ruleAccentColor ??
    getPopupRuleToneAccent(props.ruleTone);
  const frameStyle: PopupShellFrameStyle = {
    "--gw-popup-context-accent": contextAccent,
  };
  const phase = props.phase ?? "ready";

  return (
    <div
      className="gw-popup-shell-frame"
      data-has-top-accent={hasTopAccent ? "true" : undefined}
      style={frameStyle}
    >
      <main
        className="gw-popup-shell"
        data-phase={phase}
        aria-busy={phase === "loading" ? "true" : undefined}
      >
        {phase === "loading" && props.loadingLabel ? (
          <span className="sr-only" role="status">
            {props.loadingLabel}
          </span>
        ) : null}
        <PopupShellHeader props={props} />
        <PopupMain props={props} />
        <PopupFooter actions={props.footerActions} />
      </main>
    </div>
  );
};
