import { useState } from "react";

import { getPolicyNoticeView } from "../popup-policy-notices";

import { PopupButton } from "./PopupButton";

import { compareNoticeVersions } from "@/shared/notification-version";
import { isPopupPolicyNoticeKind } from "@/shared/popup-notification-kinds";
import { isNoticeAttention, isNoticeUnread } from "@/shared/popup-notification-state";
import {
  getReleaseNotice,
  getVersionNotices,
  type ReleaseNotice,
} from "@/shared/release-notification";
import type {
  PopupNotification,
  PopupSiteSuggestion,
  WorkerInjectionMode,
} from "@/shared/types";
import { t, UI_LOCALE } from "@/ui/i18n";

export type NotificationDisplayState = "unread" | "acknowledged" | "resolved";

export const getNotificationState = (
  notification: PopupNotification,
): NotificationDisplayState => {
  if (notification.resolvedAt !== null) return "resolved";
  return notification.readAt === null ? "unread" : "acknowledged";
};

const getReleaseNotification = (
  notification: PopupNotification,
): ReleaseNotice | null => {
  if (notification.kind !== "significant-update") return null;
  return (
    getReleaseNotice(notification.id, UI_LOCALE) ??
    (notification.channel && notification.introducedInVersion
      ? (getVersionNotices(
          notification.channel,
          notification.introducedInVersion,
          UI_LOCALE,
        )[0] ?? null)
      : null)
  );
};

export const getNotificationTitle = (notification: PopupNotification): string => {
  if (notification.kind === "significant-update") {
    return (
      getReleaseNotification(notification)?.title ?? t.popup.notificationsUpdateTitle
    );
  }
  if (isPopupPolicyNoticeKind(notification.kind)) {
    return getPolicyNoticeView(notification.kind).title;
  }
  if (notification.kind === "worker-csp-relaxation") {
    return t.popup.notificationsCspTitle;
  }
  return t.popup.notificationsSharedWorkerTitle;
};

export const getNotificationSummary = (notification: PopupNotification): string => {
  if (notification.kind === "significant-update") {
    return (
      getReleaseNotification(notification)?.message[0] ??
      t.popup.notificationsUpdateSummary
    );
  }
  if (isPopupPolicyNoticeKind(notification.kind)) {
    return getPolicyNoticeView(notification.kind).summary;
  }
  if (notification.kind === "worker-csp-relaxation") {
    return t.popup.notificationsCspSummary;
  }
  if (notification.kind === "shared-worker-injection-relaxation") {
    return t.popup.notificationsSharedWorkerSummary;
  }
  return t.popup.notificationsUpdateSummary;
};

export const getNotificationMessage = (
  notification: PopupNotification,
): readonly string[] =>
  notification.kind === "significant-update"
    ? (getReleaseNotification(notification)?.message ?? [
        t.popup.notificationsUpdateSummary,
      ])
    : [getNotificationSummary(notification)];

const sortActiveNotifications = (
  notifications: readonly PopupNotification[],
): PopupNotification[] =>
  [...notifications].sort((left, right) => {
    const leftState = getNotificationState(left);
    const rightState = getNotificationState(right);
    if (leftState !== rightState) return leftState === "unread" ? -1 : 1;
    return right.lastDetectedAt.localeCompare(left.lastDetectedAt);
  });

const getStatusLabel = (displayState: NotificationDisplayState): string => {
  if (displayState === "resolved") return t.popup.notificationsResolved;
  if (displayState === "unread") return t.popup.notificationsNew;
  return t.popup.notificationsAcknowledged;
};

const isNotificationHistory = (notification: PopupNotification): boolean =>
  notification.resolvedAt !== null ||
  (notification.kind === "significant-update" && notification.readAt !== null);

const sortNotificationHistory = (
  notifications: readonly PopupNotification[],
): PopupNotification[] => {
  const first = notifications[0];
  const versionChannel =
    first?.kind === "significant-update" ? first.channel : undefined;
  const useVersionOrder =
    versionChannel !== undefined &&
    notifications.every(
      (notification) =>
        notification.kind === "significant-update" &&
        notification.channel === versionChannel &&
        notification.introducedInVersion !== undefined &&
        compareNoticeVersions(
          versionChannel,
          notification.introducedInVersion,
          notification.introducedInVersion,
        ) === 0,
    );

  return [...notifications].sort((left, right) => {
    if (useVersionOrder) {
      const versionOrder = compareNoticeVersions(
        versionChannel,
        left.introducedInVersion ?? "",
        right.introducedInVersion ?? "",
      );
      if (versionOrder !== null && versionOrder !== 0) return -versionOrder;
    }
    const leftDate = left.resolvedAt ?? left.lastDetectedAt;
    const rightDate = right.resolvedAt ?? right.lastDetectedAt;
    return rightDate.localeCompare(leftDate);
  });
};

const getActionLabel = (
  notification: PopupNotification,
  needsAttention: boolean,
): string | null => {
  if (notification.kind === "significant-update") {
    return notification.actionTarget ? t.popup.notificationsOpenLink : null;
  }
  if (needsAttention) return t.popup.notificationsStillActive;
  return null;
};

const NotificationItem = ({
  notification,
  onOpen,
}: {
  notification: PopupNotification;
  onOpen: (notification: PopupNotification) => void;
}) => {
  const displayState = getNotificationState(notification);
  const needsAttention = isNoticeAttention(notification);
  const activeWarning =
    notification.severity === "needs-action" && notification.resolvedAt === null;
  const actionLabel = getActionLabel(notification, activeWarning);
  const versionLabel =
    notification.kind === "significant-update"
      ? notification.introducedInVersion
      : null;
  return (
    <PopupButton
      variant="ghost"
      data-notification-id={notification.id}
      data-notification-state={displayState}
      data-needs-attention={needsAttention ? "true" : undefined}
      className="gw-popup-notification-item"
      onClick={() => onOpen(notification)}
    >
      <span className="gw-popup-notification-heading">
        {displayState === "unread" ? (
          <span className="gw-popup-notification-unread-dot" aria-hidden="true" />
        ) : null}
        <span className="gw-popup-notification-title">
          {getNotificationTitle(notification)}
        </span>
      </span>
      <span className="gw-popup-notification-summary">
        {getNotificationSummary(notification)}
      </span>
      <span className="gw-popup-notification-meta">
        <span className="gw-popup-notification-status">
          {getStatusLabel(displayState)}
        </span>
        {versionLabel ? (
          <>
            <span aria-hidden="true" className="gw-popup-notification-separator">
              ·
            </span>
            <span className="gw-popup-notification-version">
              {t.popup.notificationsVersionLabel} {versionLabel}
            </span>
          </>
        ) : null}
        {actionLabel ? (
          <>
            <span aria-hidden="true" className="gw-popup-notification-separator">
              ·
            </span>
            <span className="gw-popup-notification-action-label">{actionLabel}</span>
          </>
        ) : null}
      </span>
    </PopupButton>
  );
};

export const PopupNotificationList = ({
  notifications,
  onOpen,
}: {
  notifications: PopupNotification[];
  onOpen: (notification: PopupNotification) => void;
}) => {
  const initialScope = notifications.some(
    (notification) => notification.scope === "site" && notification.resolvedAt === null,
  )
    ? "site"
    : "extension";
  const [scope, setScope] = useState<PopupNotification["scope"]>(initialScope);
  const scopedActive = sortActiveNotifications(
    notifications.filter(
      (notification) =>
        notification.scope === scope && !isNotificationHistory(notification),
    ),
  );
  const scopedHistory = sortNotificationHistory(
    notifications.filter(
      (notification) =>
        notification.scope === scope && isNotificationHistory(notification),
    ),
  );
  const counts = {
    site: notifications.filter((item) => item.scope === "site" && isNoticeUnread(item))
      .length,
    extension: notifications.filter(
      (item) => item.scope === "extension" && isNoticeUnread(item),
    ).length,
  };
  return (
    <div className="gw-popup-notification-list">
      <div
        className="gw-popup-notification-tabs"
        role="group"
        aria-label={t.popup.notificationsTitle}
      >
        {(["site", "extension"] as const).map((itemScope) => {
          const count = counts[itemScope];
          return (
            <PopupButton
              key={itemScope}
              variant="ghost"
              aria-pressed={scope === itemScope}
              className="gw-popup-notification-tab"
              onClick={() => setScope(itemScope)}
            >
              {itemScope === "site"
                ? t.popup.notificationsThisSite
                : t.popup.notificationsExtension}
              {count > 0 ? (
                <span className="gw-popup-notification-tab-count">{count}</span>
              ) : null}
            </PopupButton>
          );
        })}
      </div>
      <div className="gw-popup-notification-items">
        {scopedActive.map((notification) => (
          <NotificationItem
            key={notification.id}
            notification={notification}
            onOpen={onOpen}
          />
        ))}
        {scopedActive.length === 0 ? (
          <p className="gw-popup-notification-empty">{t.popup.notificationsEmpty}</p>
        ) : null}
      </div>
      {scopedHistory.length > 0 ? (
        <details
          className="gw-popup-notification-resolved"
          data-notification-history={scope}
        >
          <summary className="gw-popup-notification-resolved-summary">
            {scope === "extension"
              ? t.popup.notificationsPreviousUpdates
              : t.popup.notificationsDismissed}{" "}
            ({scopedHistory.length})
          </summary>
          <div className="gw-popup-notification-resolved-items">
            {scopedHistory.map((notification) => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onOpen={onOpen}
              />
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
};

const getSuggestionDescription = (kind: PopupSiteSuggestion["kind"]): string =>
  kind === "shared-worker-injection-relaxation"
    ? t.popup.suggestionSharedWorkerInjectionDescription
    : t.popup.suggestionWorkerCspDescription;

const getPolicyDescription = (notification: PopupNotification): string | null =>
  isPopupPolicyNoticeKind(notification.kind)
    ? getPolicyNoticeView(notification.kind).description
    : null;

const getSuggestionKind = (
  notification: PopupNotification,
): PopupSiteSuggestion["kind"] | null => {
  if (
    notification.kind === "worker-csp-relaxation" ||
    notification.kind === "shared-worker-injection-relaxation"
  ) {
    return notification.kind;
  }
  return null;
};

const getPrimaryActionLabel = (notification: PopupNotification): string => {
  if (notification.kind === "service-worker-block") {
    return t.popup.notificationsAllowServiceWorkers;
  }
  if (notification.kind === "significant-update") return t.popup.notificationsOpenLink;
  return t.popup.notificationsRelaxWorkerPolicy;
};

/**
 * Explanatory prose ("What this affects" / "Before you continue") reads as part
 * of the notification body, so it stays unboxed; only structured option lists
 * keep the panel chrome.
 */
const PopupNotificationImpact = ({
  heading,
  copy,
}: {
  heading: string;
  copy: string;
}) => (
  <section className="gw-popup-notification-impact">
    <h4 className="gw-popup-notification-impact-title">{heading}</h4>
    <p className="gw-popup-notification-impact-copy">{copy}</p>
  </section>
);

const PopupSharedWorkerChoices = ({
  detailDescription,
}: {
  detailDescription: string | null;
}) => (
  <div className="gw-popup-panel gw-popup-notification-impact">
    <h4 className="gw-popup-notification-impact-title">
      {t.popup.notificationsChooseSharedWorkerMode}
    </h4>
    {detailDescription ? (
      <p className="gw-popup-notification-impact-copy">{detailDescription}</p>
    ) : null}
    <ul className="gw-popup-notification-impact-list">
      <li>
        <strong>{t.popup.notificationsSharedWorkerNative}</strong>
        {` — ${t.popup.notificationsSharedWorkerNativeDescription}`}
      </li>
      <li>
        <strong>{t.popup.notificationsSharedWorkerSpoof}</strong>
        {` — ${t.popup.notificationsSharedWorkerSpoofDescription}`}
      </li>
    </ul>
  </div>
);

const NotificationExplanation = ({
  notification,
  detailDescription,
  hasSharedWorkerChoices,
}: {
  notification: PopupNotification;
  detailDescription: string | null;
  hasSharedWorkerChoices: boolean;
}) => {
  // Strict-mode is a standing policy notice, not a runtime failure: lead with
  // "What this affects" (like the Service Worker notice) so the user sees the
  // trade-off before the Native/Spoof change options.
  if (notification.kind === "shared-worker-strict") {
    return (
      <>
        {detailDescription ? (
          <PopupNotificationImpact
            heading={t.popup.notificationsWhatThisAffects}
            copy={detailDescription}
          />
        ) : null}
        <PopupSharedWorkerChoices detailDescription={null} />
      </>
    );
  }
  if (hasSharedWorkerChoices) {
    return <PopupSharedWorkerChoices detailDescription={detailDescription} />;
  }
  if (!detailDescription) return null;

  return (
    <PopupNotificationImpact
      heading={
        notification.kind === "service-worker-block"
          ? t.popup.notificationsWhatThisAffects
          : t.popup.notificationsBeforeYouContinue
      }
      copy={detailDescription}
    />
  );
};

const NotificationActions = ({
  apply,
  columnCount,
  dismiss,
  hasSharedWorkerChoices,
  keepLabel,
  notification,
}: {
  apply: (mode?: WorkerInjectionMode) => Promise<void>;
  columnCount: string;
  dismiss: () => Promise<void>;
  hasSharedWorkerChoices: boolean;
  keepLabel: string;
  notification: PopupNotification;
}) => (
  <div
    className="gw-popup-workspace-actions gw-popup-notification-actions"
    data-column-count={columnCount}
  >
    {hasSharedWorkerChoices ? (
      <>
        <PopupButton
          variant="secondary"
          className="gw-popup-context-action"
          onClick={() => void apply("native")}
        >
          {t.popup.notificationsSharedWorkerNative}
        </PopupButton>
        <PopupButton
          variant="secondary"
          className="gw-popup-context-action"
          onClick={() => void apply("spoof")}
        >
          {t.popup.notificationsSharedWorkerSpoof}
        </PopupButton>
        <PopupButton
          variant="secondary"
          className="gw-popup-context-action"
          wide
          onClick={() => void dismiss()}
        >
          {keepLabel}
        </PopupButton>
      </>
    ) : (
      <>
        <PopupButton
          variant="secondary"
          className="gw-popup-context-action"
          onClick={() => void dismiss()}
        >
          {keepLabel}
        </PopupButton>
        {notification.kind !== "significant-update" || notification.actionTarget ? (
          <PopupButton
            variant="secondary"
            className="gw-popup-context-action"
            onClick={() => void apply()}
          >
            {getPrimaryActionLabel(notification)}
          </PopupButton>
        ) : null}
      </>
    )}
  </div>
);

export const PopupNotificationDetail = ({
  notification,
  onApplySuggestion,
  onDismiss,
  onDismissSuggestion,
  onNotificationAction,
}: {
  notification: PopupNotification;
  onApplySuggestion: (
    kind: PopupSiteSuggestion["kind"],
    mode?: WorkerInjectionMode,
  ) => Promise<void>;
  onDismiss: (notification: PopupNotification) => Promise<void>;
  onDismissSuggestion: (kind: PopupSiteSuggestion["kind"]) => Promise<void>;
  onNotificationAction: (
    notification: PopupNotification,
    mode?: WorkerInjectionMode,
  ) => Promise<void>;
}) => {
  const isSharedWorkerSuggestion =
    notification.kind === "shared-worker-injection-relaxation";
  const isSharedWorkerPolicy = notification.kind === "shared-worker-strict";
  const hasSharedWorkerChoices = isSharedWorkerSuggestion || isSharedWorkerPolicy;
  const suggestionKind = getSuggestionKind(notification);
  const dismissNotification = async () => {
    if (suggestionKind) await onDismissSuggestion(suggestionKind);
    await onDismiss(notification);
  };
  const applyNotification = async (mode?: WorkerInjectionMode) => {
    if (suggestionKind) {
      await onApplySuggestion(suggestionKind, mode);
      await onDismiss(notification);
      return;
    }
    await onNotificationAction(notification, mode);
  };
  const detailDescription = suggestionKind
    ? getSuggestionDescription(suggestionKind)
    : getPolicyDescription(notification);
  const messageParagraphs = getNotificationMessage(notification);
  const actionColumnCount =
    notification.kind === "significant-update" && !notification.actionTarget
      ? "1"
      : "2";
  const keepLabel = isSharedWorkerPolicy
    ? t.popup.notificationsKeepStrictMode
    : t.popup.notificationsDismiss;

  return (
    <div
      className="gw-popup-notification-detail"
      data-notification-id={notification.id}
      data-notification-view="detail"
    >
      <div className="gw-popup-workspace-scroll" data-popup-scrollport="true">
        <div className="gw-popup-notification-detail-intro">
          <h3 className="gw-popup-notification-detail-title">
            {getNotificationTitle(notification)}
          </h3>
          {notification.kind === "significant-update" &&
          notification.introducedInVersion ? (
            <p className="gw-popup-notification-detail-version">
              {t.popup.notificationsVersionLabel} {notification.introducedInVersion}
            </p>
          ) : null}
          <div className="gw-popup-notification-detail-copy">
            {messageParagraphs.map((paragraph) => (
              <p key={`${notification.id}:paragraph:${paragraph}`}>{paragraph}</p>
            ))}
          </div>
        </div>
        <NotificationExplanation
          notification={notification}
          detailDescription={detailDescription}
          hasSharedWorkerChoices={hasSharedWorkerChoices}
        />
      </div>
      <NotificationActions
        apply={applyNotification}
        columnCount={actionColumnCount}
        dismiss={dismissNotification}
        hasSharedWorkerChoices={hasSharedWorkerChoices}
        keepLabel={keepLabel}
        notification={notification}
      />
    </div>
  );
};
