import type {
  PopupPresentationKind,
  PopupRuleTone,
  PopupVariantActionState,
} from "./popup-view-model-types";

import type { PopupState } from "@/shared/types";
import { t } from "@/ui/i18n";

const resolveContainerKind = (popupState: PopupState): PopupPresentationKind => {
  if (popupState.currentTab.winningSource === "container") {
    return popupState.currentTab.locationProfileActive === false
      ? "container-protections"
      : "container-active";
  }
  if (popupState.currentTab.containerAssignmentConfigured !== true) {
    switch (popupState.currentTab.fallbackState) {
      case "active":
        return "container-unconfigured-default";
      case "protections":
        return "container-unconfigured-default-protections";
      case "unconfigured":
        return "container-unconfigured-default-unconfigured";
      default:
        return "container-unconfigured";
    }
  }
  if (popupState.currentTab.winningSource === "fallback") {
    return popupState.currentTab.fallbackState === "active"
      ? "fallback-active"
      : "fallback-protections";
  }
  return "container-inactive";
};

export const getInitialLocationId = (popupState: PopupState): string | null =>
  popupState.currentRule.locationId ??
  popupState.currentTab.locationId ??
  popupState.availableLocations[0]?.id ??
  null;

export const getInitialRuleMode = (popupState: PopupState): "exact" | "suffix" =>
  popupState.currentRule.type ?? "suffix";

export const getTargetPattern = (popupState: PopupState): string | null =>
  popupState.currentRule.pattern ?? popupState.currentTab.hostname;

export const resolvePresentationKind = (
  popupState: PopupState | null,
): PopupPresentationKind => {
  if (!popupState) return "loading";
  if (popupState.panicMode) return "panic";
  if (!popupState.currentTab.supported) return "unsupported";
  if (popupState.currentRule.pattern) {
    return popupState.currentRule.enabled === false ? "rule-inactive" : "rule-active";
  }
  if (popupState.currentTab.winningSource === "trusted-site") return "trusted-site";
  if (popupState.currentTab.activeContainer) return resolveContainerKind(popupState);
  switch (popupState.currentTab.fallbackState) {
    case "active":
      return "fallback-active";
    case "protections":
      return "fallback-protections";
    case "unconfigured":
      return "fallback-unconfigured";
    default:
      return "fallback-inactive";
  }
};

export const isInactiveContainerKind = (kind: PopupPresentationKind): boolean =>
  kind === "container-inactive";

export const isDefaultRuleKind = (kind: PopupPresentationKind): boolean =>
  kind === "fallback-active" ||
  kind === "fallback-protections" ||
  kind === "fallback-inactive" ||
  kind === "fallback-unconfigured";

const isDirectIdentityKind = (kind: PopupPresentationKind): boolean =>
  kind === "rule-active" ||
  kind === "rule-inactive" ||
  kind === "container-active" ||
  kind === "container-protections" ||
  kind === "container-inactive";

export const isUnconfiguredKind = (kind: PopupPresentationKind): boolean =>
  kind === "container-unconfigured-default" ||
  kind === "container-unconfigured-default-protections" ||
  kind === "container-unconfigured-default-unconfigured";

export const isContainerKind = (kind: PopupPresentationKind): boolean =>
  kind === "container-active" ||
  kind === "container-protections" ||
  kind === "container-inactive" ||
  kind === "container-unconfigured" ||
  isUnconfiguredKind(kind);

export const getVariantActionState = ({
  presentationKind,
  currentRuleType,
}: {
  presentationKind: PopupPresentationKind;
  currentRuleType: PopupState["currentRule"]["type"] | undefined;
}): PopupVariantActionState => {
  const none: PopupVariantActionState = {
    ruleActionIntent: "none",
    ruleFooterActionIntent: "none",
    secondaryActionIntent: "none",
  };
  const domainRuleFooter: PopupVariantActionState = {
    ...none,
    ruleFooterActionIntent: "create-exact-domain-rule",
    ruleFooterActionLabel: t.popup.addExactOverrideCta,
    ruleFooterActionTone: "success",
  };
  const trustedSiteException = {
    secondaryActionIntent: "add-to-trusted-sites",
    secondaryActionLabel: t.popup.disableOnSiteCta,
    secondaryActionTone: "secondary",
  } as const;

  switch (presentationKind) {
    case "loading":
    case "unsupported":
    case "panic":
      return none;
    case "trusted-site":
      return {
        ...none,
        ruleFooterActionIntent: "open-trusted-site",
        ruleFooterActionLabel: t.popup.trustedSiteCta,
        ruleFooterActionTone: "success",
      };
    case "rule-active":
    case "rule-inactive":
      return {
        ...(currentRuleType === "suffix" ? domainRuleFooter : none),
        ruleActionIntent: "open-rule-options",
        ruleActionLabel: t.popup.editDomainRuleLabel,
      };
    case "container-active":
    case "container-protections":
      return {
        ...domainRuleFooter,
        ...trustedSiteException,
        ruleActionIntent: "open-container-options",
        ruleActionLabel: t.popup.editContainerLabel,
      };
    case "container-inactive":
      return {
        ...domainRuleFooter,
        ruleActionIntent: "open-container-options",
        ruleActionLabel: t.popup.editContainerLabel,
      };
    case "container-unconfigured":
    case "container-unconfigured-default-unconfigured":
      return {
        ...domainRuleFooter,
        ruleActionIntent: "open-container",
        ruleActionLabel: t.popup.containerSetupCta,
        ruleActionTone: "success",
      };
    case "container-unconfigured-default":
    case "container-unconfigured-default-protections":
      return {
        ...domainRuleFooter,
        ...trustedSiteException,
        ruleActionIntent: "open-container",
        ruleActionLabel: t.popup.containerSetupCta,
        ruleActionTone: "success",
      };
    case "fallback-active":
    case "fallback-protections":
      return {
        ...domainRuleFooter,
        ...trustedSiteException,
        ruleActionIntent: "open-global-fallback-options",
        ruleActionLabel: t.popup.globalFallbackRuleCta,
      };
    case "fallback-inactive":
    case "fallback-unconfigured":
      return {
        ...domainRuleFooter,
        ruleActionIntent: "open-global-fallback-options",
        ruleActionLabel: t.popup.globalFallbackRuleCta,
      };
  }
};

export const getRuleTone = (kind: PopupPresentationKind): PopupRuleTone => {
  switch (kind) {
    case "loading":
    case "panic":
    case "unsupported":
    case "trusted-site":
    case "rule-inactive":
    case "container-inactive":
    case "container-unconfigured":
    case "container-unconfigured-default-unconfigured":
    case "fallback-inactive":
    case "fallback-unconfigured":
      return "disabled";
    default:
      return "active";
  }
};

export const getPowerTone = (kind: PopupPresentationKind): PopupRuleTone =>
  kind === "loading" || kind === "unsupported" ? "disabled" : getRuleTone(kind);

export const getIdentityBlockReason = (
  popupState: PopupState | null,
): string | null => {
  const kind = resolvePresentationKind(popupState);
  if (isDirectIdentityKind(kind)) return null;
  if (kind === "loading") return t.popup.cleanDomainLoadingDisabled;
  if (kind === "unsupported") return t.popup.cleanDomainPageDisabled;
  if (kind === "container-unconfigured" || isUnconfiguredKind(kind)) {
    return t.popup.cleanDomainContainerSetupDisabled;
  }
  if (isDefaultRuleKind(kind)) return t.popup.cleanDomainDefaultRuleDisabled;
  return t.popup.cleanDomainProductOffDisabled;
};

export const getPowerAriaLabel = (kind: PopupPresentationKind): string => {
  switch (kind) {
    case "loading":
      return t.popup.powerAriaLoading;
    case "panic":
      return t.popup.powerAriaGlobalOff;
    case "unsupported":
      return t.popup.powerAriaRestricted;
    case "trusted-site":
      return t.popup.powerAriaTrustedSite;
    case "rule-active":
      return t.popup.powerAriaDomainRuleOff;
    case "rule-inactive":
      return t.popup.powerAriaDomainRuleOn;
    case "container-active":
    case "container-protections":
      return t.popup.powerAriaContainerOff;
    case "container-inactive":
      return t.popup.powerAriaContainerOn;
    case "container-unconfigured":
      return t.popup.powerAriaContainerSetup;
    case "fallback-active":
    case "fallback-protections":
    case "container-unconfigured-default":
    case "container-unconfigured-default-protections":
      return t.popup.powerAriaDefaultRuleOff;
    case "fallback-inactive":
    case "fallback-unconfigured":
    case "container-unconfigured-default-unconfigured":
      return t.popup.powerAriaDefaultRuleOn;
  }
};

export const getPowerTitle = getPowerAriaLabel;

export const getPowerLabel = (kind: PopupPresentationKind): string => {
  switch (kind) {
    case "loading":
    case "panic":
      return t.popup.powerControlExtension;
    case "unsupported":
      return t.popup.unsupportedTab;
    case "trusted-site":
      return t.popup.protectionSourceTrustedSite;
    case "rule-active":
    case "rule-inactive":
      return t.popup.protectionSourceSiteRule;
    case "container-active":
    case "container-protections":
    case "container-inactive":
    case "container-unconfigured":
      return t.popup.protectionSourceContainer;
    default:
      return t.popup.protectionSourceDefaultRule;
  }
};

export const getPowerTarget = (kind: PopupPresentationKind): string => {
  switch (kind) {
    case "loading":
      return t.popup.powerTargetLoading;
    case "panic":
      return t.popup.powerTargetGlobal;
    case "unsupported":
      return t.popup.powerTargetUnsupported;
    case "trusted-site":
      return t.popup.powerTargetTrustedSite;
    case "rule-active":
    case "rule-inactive":
      return t.popup.powerTargetSiteRule;
    case "container-active":
    case "container-protections":
    case "container-inactive":
      return t.popup.powerTargetContainer;
    case "container-unconfigured":
      return t.popup.powerTargetContainerSetup;
    case "container-unconfigured-default":
    case "container-unconfigured-default-protections":
    case "container-unconfigured-default-unconfigured":
      return t.popup.powerTargetContainerDefaultRule;
    default:
      return t.popup.powerTargetDefaultRule;
  }
};
