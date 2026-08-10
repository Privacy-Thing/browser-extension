import type { ReactNode } from "react";

import { getIdentityBlockReason } from "./popup-view-model";

import type { PopupState } from "@/shared/types";
import { t } from "@/ui/i18n";
import { icon } from "@/ui/options/utils";

export type PopupFooterActionConfig = {
  id: string;
  label: string;
  title: string;
  ariaLabel?: string;
  disabled: boolean;
  onClick: () => void;
  icon: ReactNode;
};

type FooterActionArgs = {
  popupState: PopupState | null;
  supported: boolean;
  onOpenXRay: () => void;
  onOpenNewIdentity: () => void;
  onOpenOptions: () => void;
};

export const getPopupFooterActions = ({
  popupState,
  supported,
  onOpenXRay,
  onOpenNewIdentity,
  onOpenOptions,
}: FooterActionArgs): PopupFooterActionConfig[] => {
  const identityDisabledReason = getIdentityBlockReason(popupState);
  const newIdentityDisabled =
    !supported ||
    !popupState?.currentTab.canCleanDomain ||
    Boolean(identityDisabledReason);
  const newIdentityLabel = identityDisabledReason
    ? `${identityDisabledReason}. ${t.popup.cleanDomainAvailabilityHint}`
    : t.popup.cleanDomainAriaLabel;

  return [
    {
      id: "open-xray",
      label: t.popup.viewXRay,
      title: t.popup.openXRay,
      disabled: false,
      onClick: onOpenXRay,
      icon: icon("fa-stethoscope"),
    },
    {
      id: "new-identity-current-domain",
      label: t.popup.cleanDomainLabel,
      title: newIdentityLabel,
      ariaLabel: newIdentityLabel,
      disabled: newIdentityDisabled,
      onClick: onOpenNewIdentity,
      icon: icon("fa-user-secret", "text-[1rem]"),
    },
    {
      id: "open-options",
      label: t.popup.settingsLabel,
      title: t.popup.openSettingsAriaLabel,
      ariaLabel: t.popup.openSettingsAriaLabel,
      disabled: false,
      onClick: onOpenOptions,
      icon: icon("fa-gear"),
    },
  ];
};
