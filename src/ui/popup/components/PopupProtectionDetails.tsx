import type { SurfacePresentationState } from "@privacy-brand/xray-protocol";

import { PopupButton } from "./PopupButton";

import type { PopupNotification, PopupState } from "@/shared/types";
import { t } from "@/ui/i18n";

const getGroupLabel = (
  key: PopupState["effectiveSummary"]["surfaceSummary"]["groups"][number]["key"],
): string =>
  ({
    "location-locale": t.popup.protectionGroupLocationLocale,
    "browser-identity": t.popup.protectionGroupBrowserIdentity,
    "rendering-media": t.popup.protectionGroupRenderingMedia,
    workers: t.popup.protectionGroupWorkers,
  })[key];

const getGroupStateLabel = (
  state: PopupState["effectiveSummary"]["surfaceSummary"]["groups"][number]["state"],
): string =>
  ({
    protected: t.popup.protectionStateProtected,
    "native-by-policy": t.popup.protectionStateNative,
    pending: t.popup.protectionStatePending,
    mixed: t.popup.protectionStateMixed,
  })[state];

const getGroupStateTone = (
  state: PopupState["effectiveSummary"]["surfaceSummary"]["groups"][number]["state"],
): "success" | "mixed" | "neutral" => {
  if (state === "protected") return "success";
  if (state === "mixed") return "mixed";
  return "neutral";
};

const getStateTone = (
  state: SurfacePresentationState,
): "success" | "danger" | "neutral" => {
  if (state === "protected" || state === "browser-enforced" || state === "repaired") {
    return "success";
  }
  if (state === "degraded" || state === "unrecoverable") return "danger";
  return "neutral";
};

const getSurfaceLabel = (
  key: PopupState["effectiveSummary"]["surfaceSummary"]["surfaces"][number]["key"],
): string =>
  ({
    geolocation: t.popup.surfaceGeolocation,
    timeLocale: t.popup.surfaceTimeLocale,
    navigator: t.popup.surfaceNavigator,
    screen: t.popup.surfaceScreen,
    clientHints: t.popup.surfaceClientHints,
    battery: t.popup.surfaceBattery,
    canvas: t.popup.surfaceCanvas,
    webGL: t.popup.surfaceWebGL,
    audio: t.popup.surfaceAudio,
    webRTC: t.popup.surfaceWebRTC,
    worker: t.popup.surfaceWorker,
    serviceWorker: t.popup.surfaceServiceWorker,
    sharedWorker: t.popup.surfaceSharedWorker,
  })[key];

const getSurfaceStateLabel = (
  surface: PopupState["effectiveSummary"]["surfaceSummary"]["surfaces"][number],
): string => {
  switch (surface.presentation) {
    case "not-applicable":
      return t.popup.protectionStateNotApplicable;
    case "native-by-policy":
      return t.popup.protectionStateNative;
    case "unrecoverable":
      return t.popup.protectionStateUnrecoverable;
    case "degraded":
      return t.popup.protectionStateDegraded;
    case "pending":
      return t.popup.protectionStatePending;
    case "repaired":
      return t.popup.protectionStateRepaired;
    case "browser-enforced":
      return t.popup.protectionStateBrowserEnforced;
    case "protected":
      return t.popup.protectionStateProtected;
    default:
      return t.popup.protectionSurfaceUnknown(getSurfaceLabel(surface.key));
  }
};

export const PopupProtectionDetails = ({
  popupState,
  onNotificationOpen,
  onOpenXRay,
}: {
  popupState: PopupState;
  onNotificationOpen: (notification: PopupNotification) => void;
  onOpenXRay: () => void;
}) => {
  const { surfaceSummary } = popupState.effectiveSummary;
  const getContextNotification = (kind: string | undefined) =>
    kind
      ? popupState.notifications.find(
          (notification) =>
            notification.kind === kind &&
            notification.scope === "site" &&
            notification.severity === "needs-action",
        )
      : undefined;

  return (
    <div className="gw-popup-protection-details">
      <div className="gw-popup-workspace-scroll" data-popup-scrollport="true">
        {surfaceSummary.groups.map((group) => {
          const surfaceContext =
            surfaceSummary.highestPriorityAttention ??
            surfaceSummary.highestPriorityContext;
          return (
            <section
              key={group.key}
              className="gw-popup-protection-group"
              data-group={group.key}
            >
              <div className="gw-popup-protection-group-heading">
                <h3 className="gw-popup-protection-group-title">
                  {getGroupLabel(group.key)}
                </h3>
                <span
                  className="gw-popup-protection-group-state"
                  data-group-state={group.state}
                  data-state-tone={getGroupStateTone(group.state)}
                >
                  {getGroupStateLabel(group.state)}
                </span>
              </div>
              <div className="gw-popup-protection-surface-list">
                {group.surfaces.map((surface) => {
                  const contextKind =
                    surface.attention?.notificationKind ??
                    (surfaceContext?.surfaceKey === surface.key
                      ? surfaceContext.kind
                      : undefined);
                  const surfaceNotification = getContextNotification(contextKind);
                  const stateLabel = getSurfaceStateLabel(surface);
                  // Protection state and compatibility attention are
                  // independent axes (#111): the state span always shows the
                  // real presentation, and an actionable attention overlay is
                  // rendered separately when there is a suggestion/notification
                  // to open.
                  const showAttention = Boolean(
                    surface.attention && surfaceNotification,
                  );
                  return (
                    <div
                      key={surface.key}
                      className="gw-popup-protection-surface"
                      data-surface={surface.key}
                      {...(showAttention && contextKind
                        ? { "data-attention-kind": contextKind }
                        : {})}
                    >
                      <span>{getSurfaceLabel(surface.key)}</span>
                      <span className="gw-popup-protection-surface-summary">
                        <span
                          className="gw-popup-protection-state"
                          data-surface-state={surface.presentation}
                          data-state-tone={getStateTone(surface.presentation)}
                        >
                          {stateLabel}
                        </span>
                        {showAttention && surfaceNotification ? (
                          <PopupButton
                            variant="link"
                            className="gw-popup-protection-attention"
                            data-compatibility-attention="true"
                            data-state-tone="warning"
                            onClick={() => onNotificationOpen(surfaceNotification)}
                          >
                            {`(${t.popup.protectionStateCompatibility})`}
                          </PopupButton>
                        ) : null}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
      <div className="gw-popup-workspace-actions">
        <PopupButton
          variant="ghost"
          className="gw-popup-footer-action gw-popup-protection-activity"
          onClick={onOpenXRay}
        >
          {t.popup.protectionViewPageActivity}
        </PopupButton>
      </div>
    </div>
  );
};
