import { t } from "@/ui/i18n";

export type PopupMutationState = {
  status: "idle" | "pending" | "success" | "error";
  action: string | null;
  message: string | null;
};

export type PopupMutationAction =
  | { type: "reset" }
  | { type: "start"; action: string }
  | { type: "succeed"; action: string }
  | { type: "fail"; action: string; message: string };

export const INITIAL_MUTATION_STATE: PopupMutationState = {
  status: "idle",
  action: null,
  message: null,
};

export const reducePopupMutationState = (
  _state: PopupMutationState,
  action: PopupMutationAction,
): PopupMutationState => {
  switch (action.type) {
    case "reset":
      return INITIAL_MUTATION_STATE;
    case "start":
      return { status: "pending", action: action.action, message: null };
    case "succeed":
      return { status: "success", action: action.action, message: null };
    case "fail":
      return { status: "error", action: action.action, message: action.message };
  }
};

export type PopupAlertAction =
  "retry-load" | "dismiss-error" | "grant-firefox-permission";

export type PopupAlertContent = {
  title: string;
  description?: string;
  actionLabel: string;
  action: PopupAlertAction;
};

export const getPopupAlertContent = ({
  loadError,
  mutationState,
  showFirefoxWarning,
}: {
  loadError: boolean;
  mutationState: PopupMutationState;
  showFirefoxWarning: boolean;
}): PopupAlertContent | null => {
  if (loadError) {
    return {
      title: t.popup.popupDataUnavailable,
      actionLabel: t.popup.retryLabel,
      action: "retry-load",
    };
  }

  if (mutationState.status === "error") {
    return {
      title: mutationState.message ?? t.popup.mutationFailed,
      actionLabel: t.popup.dismissLabel,
      action: "dismiss-error",
    };
  }

  if (showFirefoxWarning) {
    return {
      title: t.popup.firefoxFirstInlinePermissionTitle,
      description: t.popup.firefoxFirstInlinePermissionDescription,
      actionLabel: t.popup.firefoxFirstInlinePermissionEnableLabel,
      action: "grant-firefox-permission",
    };
  }

  return null;
};
