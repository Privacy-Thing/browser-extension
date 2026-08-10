/** Presentation-ready popup model assembled from raw background state. */

import {
  getPowerAriaLabel,
  getPowerLabel,
  getPowerTarget,
  getPowerTitle,
  getPowerTone,
  getRuleTone,
  getVariantActionState,
  isContainerKind,
  isDefaultRuleKind,
  isInactiveContainerKind,
  isUnconfiguredKind,
  resolvePresentationKind,
} from "./popup-presentation";
import { getProtectionSummary, hasGlobalProtectionsOff } from "./popup-protection-view";
import {
  getPopupBrandThingPose,
  type PopupActionDescriptor,
  type PopupActionIntent,
  type PopupPresentationKind,
  type PopupRuleTone,
  type PopupViewModel,
  type PopupViewModelCore,
} from "./popup-view-model-types";

import { getLocaleDisplayName } from "@/shared/locale-catalog";
import type { PopupState } from "@/shared/types";
import { t } from "@/ui/i18n";

export {
  getIdentityBlockReason,
  getInitialLocationId,
  getInitialRuleMode,
  getPowerAriaLabel,
  getPowerLabel,
  getPowerTarget,
  getPowerTitle,
  getPowerTone,
  getRuleTone,
  getTargetPattern,
  resolvePresentationKind,
} from "./popup-presentation";
export {
  getPopupBrandThingPose,
  POPUP_PRESENTATION_KINDS,
} from "./popup-view-model-types";
export type {
  PopupActionDescriptor,
  PopupActionIntent,
  PopupActionTone,
  PopupPresentationKind,
  PopupProtectionStatus,
  PopupRuleTone,
  PopupViewModel,
} from "./popup-view-model-types";

const getActionTarget = (
  intent: PopupActionIntent,
  popupState: PopupState | null,
): string | null => {
  switch (intent) {
    case "open-rule-options":
      return popupState?.currentRule.pattern ?? null;
    case "open-domain-rule":
    case "create-exact-domain-rule":
    case "add-to-trusted-sites":
      return popupState?.currentTab.hostname ?? null;
    case "enable-matched-trusted-site":
      return popupState?.currentTab.matchedTrustedSitePattern ?? null;
    case "open-trusted-site":
      return (
        popupState?.currentTab.matchedTrustedSitePattern ??
        popupState?.currentTab.hostname ??
        null
      );
    case "open-container":
    case "open-container-options":
      return popupState?.currentTab.activeContainer?.cookieStoreId ?? null;
    case "open-global-fallback-options":
      return "global-fallback";
    case "enable-extension":
      return "extension";
    case "request-firefox-userscripts":
      return "userScripts";
    case "none":
      return null;
  }
};

const createActionDescriptor = (
  intent: PopupActionIntent,
  popupState: PopupState | null,
): PopupActionDescriptor => {
  const target = getActionTarget(intent, popupState);
  const unavailable =
    intent !== "none" && (!popupState?.currentTab.supported || target === null);
  return {
    intent,
    target,
    availabilityReason: unavailable ? t.popup.regularPageRequired : null,
  };
};

const withoutSecondaryAction = (model: PopupViewModelCore): PopupViewModelCore => {
  const next = { ...model, secondaryActionIntent: "none" as const };
  delete next.secondaryActionLabel;
  delete next.secondaryActionTone;
  return next;
};

const withActionDescriptors = (
  model: PopupViewModelCore,
  popupState: PopupState | null,
): PopupViewModel => {
  const effective = model.globalProtectionsOff ? withoutSecondaryAction(model) : model;
  const resolved =
    !effective.globalProtectionsOff &&
    popupState?.currentTab.matchedTrustedSiteEnabled === false
      ? {
          ...effective,
          secondaryActionIntent: "enable-matched-trusted-site" as const,
          secondaryActionLabel: t.popup.enableTrustCta,
          secondaryActionTone: "success" as const,
        }
      : effective;
  return {
    ...resolved,
    primaryAction: createActionDescriptor(resolved.ruleActionIntent, popupState),
    footerAction: createActionDescriptor(resolved.ruleFooterActionIntent, popupState),
    secondaryFooterAction: createActionDescriptor(
      resolved.secondaryActionIntent,
      popupState,
    ),
  };
};

type PowerViewState = Pick<
  PopupViewModel,
  "powerTone" | "powerLabel" | "powerTitle" | "powerTarget" | "powerAriaLabel"
>;

const getPowerViewState = (
  kind: PopupPresentationKind,
  globalProtectionsOff: boolean,
): PowerViewState =>
  globalProtectionsOff
    ? {
        powerTone: "disabled",
        powerLabel: t.popup.powerControlGlobalProtections,
        powerTitle: t.popup.powerAriaGlobalProtectionsDisabled,
        powerTarget: t.popup.powerTargetGlobalProtectionsDisabled,
        powerAriaLabel: t.popup.powerAriaGlobalProtectionsDisabled,
      }
    : {
        powerTone: getPowerTone(kind),
        powerLabel: getPowerLabel(kind),
        powerTitle: getPowerTitle(kind),
        powerTarget: getPowerTarget(kind),
        powerAriaLabel: getPowerAriaLabel(kind),
      };

const getEffectiveRuleTone = ({
  kind,
  globalProtectionsOff,
  hasProtectionFailure,
}: {
  kind: PopupPresentationKind;
  globalProtectionsOff: boolean;
  hasProtectionFailure: boolean;
}): PopupRuleTone => {
  if (globalProtectionsOff) return "disabled";
  if (hasProtectionFailure) return "danger";
  return getRuleTone(kind);
};

const getLocationLabelState = ({
  supported,
  popupState,
  locationProfileActive,
  inactiveContainerView,
  defaultRulePresentation,
  kind,
}: {
  supported: boolean;
  popupState: PopupState | null;
  locationProfileActive: boolean;
  inactiveContainerView: boolean;
  defaultRulePresentation: boolean;
  kind: PopupPresentationKind;
}): Pick<PopupViewModel, "locationLabel" | "locationTitle"> => {
  const locationLabel = popupState?.currentTab.locationLabel;
  if (!popupState || kind === "unsupported") return {};
  if (
    kind === "container-unconfigured" ||
    kind === "container-unconfigured-default-protections" ||
    kind === "container-unconfigured-default-unconfigured"
  ) {
    return { locationLabel: t.popup.noPresetAssigned };
  }
  if (supported && locationLabel && (locationProfileActive || inactiveContainerView)) {
    return { locationLabel, locationTitle: locationLabel };
  }
  if (
    defaultRulePresentation ||
    (supported && popupState.currentTab.hasMatch && !locationProfileActive)
  ) {
    return {};
  }
  return supported ? { locationLabel: t.popup.noLocationYet } : {};
};

const getLocationLanguageState = (
  popupState: PopupState | null,
): Pick<PopupViewModel, "primaryLanguageLabel" | "languagePrioritiesTitle"> => {
  const locationId = popupState?.currentTab.locationId;
  if (!locationId) return {};
  const location = popupState.availableLocations.find(
    (candidate) => candidate.id === locationId,
  );
  if (!location) return {};
  const orderedTags = [location.language, ...location.languages].filter(
    (tag, index, tags) =>
      tag.length > 0 &&
      tags.findIndex((candidate) => candidate.toLowerCase() === tag.toLowerCase()) ===
        index,
  );
  return {
    primaryLanguageLabel: getLocaleDisplayName(location.language),
    languagePrioritiesTitle: t.popup.languagePriorityTooltip(
      orderedTags.map(getLocaleDisplayName),
    ),
  };
};

const createPanicModel = ({
  popupState,
  presentationKind,
  supported,
  hasRule,
}: {
  popupState: PopupState;
  presentationKind: PopupPresentationKind;
  supported: boolean;
  hasRule: boolean;
}): PopupViewModel =>
  withActionDescriptors(
    {
      presentationKind,
      supported,
      hasRule,
      brandThingPose: getPopupBrandThingPose(presentationKind),
      powerTone: "disabled",
      powerLabel: getPowerLabel(presentationKind),
      powerTitle: getPowerTitle(presentationKind),
      powerTarget: getPowerTarget(presentationKind),
      powerAriaLabel: getPowerAriaLabel(presentationKind),
      ruleTone: "danger",
      ruleAccentColor: "hsl(var(--tone-error-border))",
      ruleAnimatedBorderColor: "hsl(var(--tone-error-text))",
      containerContext: null,
      containerDriven: false,
      containerMissing: false,
      ruleActionIntent: "enable-extension",
      ruleActionLabel: t.popup.extensionOffCardAction,
      ruleActionTone: "danger",
      ruleFooterActionIntent: "none",
      secondaryActionIntent: "none",
      showFirefoxWarning: false,
      globalProtectionsOff: false,
      ...getProtectionSummary(popupState, false),
    },
    popupState,
  );

export const derivePopupViewModel = (popupState: PopupState | null): PopupViewModel => {
  const presentationKind = resolvePresentationKind(popupState);
  const globalProtectionsOff = hasGlobalProtectionsOff(popupState);
  const supported = popupState?.currentTab.supported ?? false;
  const hasRule = Boolean(popupState?.currentRule.pattern);
  if (popupState?.panicMode) {
    return createPanicModel({ popupState, presentationKind, supported, hasRule });
  }

  const inactiveContainerView = isInactiveContainerKind(presentationKind);
  const locationProfileActive =
    popupState?.currentTab.locationProfileActive ??
    Boolean(popupState?.currentTab.locationLabel || popupState?.currentTab.locationId);
  const locationState = getLocationLabelState({
    supported,
    popupState,
    locationProfileActive,
    inactiveContainerView,
    defaultRulePresentation: isDefaultRuleKind(presentationKind),
    kind: presentationKind,
  });
  const containerPresentation = isContainerKind(presentationKind);
  const hasProtectionFailure = Boolean(
    popupState &&
    (popupState.effectiveSummary.surfaceSummary.counts.degraded > 0 ||
      popupState.effectiveSummary.surfaceSummary.counts.unrecoverable > 0),
  );
  const base: PopupViewModelCore = {
    presentationKind,
    supported,
    hasRule,
    brandThingPose: globalProtectionsOff
      ? "zz"
      : getPopupBrandThingPose(presentationKind),
    ...(globalProtectionsOff ? {} : locationState),
    ...(globalProtectionsOff || !locationState.locationLabel
      ? {}
      : getLocationLanguageState(popupState)),
    ...getPowerViewState(presentationKind, globalProtectionsOff),
    ruleTone: getEffectiveRuleTone({
      kind: presentationKind,
      globalProtectionsOff,
      hasProtectionFailure,
    }),
    containerContext:
      supported && !hasRule && containerPresentation
        ? (popupState?.currentTab.activeContainer ?? null)
        : null,
    containerDriven:
      presentationKind === "container-active" ||
      presentationKind === "container-protections",
    containerMissing:
      presentationKind === "container-unconfigured" ||
      isUnconfiguredKind(presentationKind),
    ...getVariantActionState({
      presentationKind,
      currentRuleType: popupState?.currentRule.type,
    }),
    showFirefoxWarning:
      popupState?.currentTab.firefoxFirstInlinePermissionRequired === true &&
      popupState.currentTab.hasMatch &&
      presentationKind !== "trusted-site",
    globalProtectionsOff,
    ...getProtectionSummary(popupState, globalProtectionsOff),
  };
  if (presentationKind !== "trusted-site") {
    return withActionDescriptors(base, popupState);
  }
  return {
    ...withActionDescriptors(base, popupState),
    ruleTone: "active",
    ruleAccentColor: "var(--gw-popup-success-accent)",
    ruleAnimatedBorderColor: "var(--gw-popup-success-accent)",
  };
};
