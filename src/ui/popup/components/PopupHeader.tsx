import { PopupIconButton } from "./PopupIconButton";

import type { PopupNotificationTone } from "@/shared/popup-notification-state";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/ui/components/ui/tooltip";

const PopupHost = ({
  domain,
  domainTitle,
}: {
  domain: string | undefined;
  domainTitle: string | undefined;
}) => {
  if (!domain) return null;

  const label = (
    <span
      className="gw-popup-header-domain"
      aria-label={domainTitle ? `${domain}. ${domainTitle}` : domain}
    >
      {domain}
    </span>
  );

  if (!domainTitle) return label;

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>{label}</TooltipTrigger>
        <TooltipContent side="bottom" align="end">
          {domainTitle}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

export const PopupHeader = ({
  title,
  brand,
  domain,
  domainTitle,
  actionLabel,
  actionTitle,
  actionIcon,
  onAction,
  notificationsLabel,
  notificationsTitle,
  notificationsIcon,
  notificationsCount = 0,
  notificationsTone,
  notificationsCountLabel,
  onNotifications,
}: {
  title: string;
  brand?: React.ReactNode;
  domain?: string;
  domainTitle?: string;
  actionLabel?: string;
  actionTitle?: string;
  actionIcon?: React.ReactNode;
  onAction?: () => void;
  notificationsLabel?: string;
  notificationsTitle?: string;
  notificationsIcon?: React.ReactNode;
  notificationsCount?: number;
  notificationsTone?: PopupNotificationTone;
  notificationsCountLabel?: string;
  onNotifications?: () => void;
}) => {
  const heading = brand ? (
    <>
      <h1 className="sr-only">{title}</h1>
      <div className="gw-popup-header-brand">{brand}</div>
    </>
  ) : (
    <h1 className="gw-popup-header-title">{title}</h1>
  );
  const tooltipContent = actionTitle ? (
    <TooltipContent side="bottom" align="end">
      {actionTitle}
    </TooltipContent>
  ) : null;
  const actionButtonProps = onAction ? { onClick: onAction } : {};
  const notificationLabel = notificationsCountLabel ?? notificationsLabel ?? title;
  const notificationTooltip =
    notificationsCountLabel ?? notificationsTitle ?? notificationLabel;
  const notificationButtonProps: { onClick?: () => void } = {};
  if (onNotifications) notificationButtonProps.onClick = onNotifications;
  return (
    <header className="gw-popup-header">
      <div className="gw-popup-header-inner">
        <div className="gw-popup-header-heading">{heading}</div>
        <div className="gw-popup-header-controls">
          <PopupHost domain={domain} domainTitle={domainTitle} />
          {notificationsIcon ? (
            <span className="gw-popup-notification-anchor">
              <TooltipProvider delayDuration={150}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <PopupIconButton
                      id="open-notifications"
                      ariaLabel={notificationLabel}
                      {...notificationButtonProps}
                      icon={notificationsIcon}
                      className="gw-popup-header-action"
                      iconClassName="h-4 w-4"
                    />
                  </TooltipTrigger>
                  <TooltipContent side="bottom" align="end">
                    {notificationTooltip}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              {notificationsCount > 0 ? (
                <span
                  className="gw-popup-notification-badge"
                  data-tone={notificationsTone}
                  aria-hidden="true"
                >
                  {notificationsCount > 9 ? "9+" : notificationsCount}
                </span>
              ) : null}
            </span>
          ) : null}
          {actionIcon ? (
            <TooltipProvider delayDuration={150}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <PopupIconButton
                    ariaLabel={actionLabel ?? title}
                    {...actionButtonProps}
                    icon={actionIcon}
                    className="gw-popup-header-action"
                    iconClassName="h-4 w-4"
                  />
                </TooltipTrigger>
                {tooltipContent}
              </Tooltip>
            </TooltipProvider>
          ) : null}
        </div>
      </div>
    </header>
  );
};
