import type { ContainerPresentation } from "@/shared/types";
import type { BrandThingPose } from "@/ui/branding/BrandThing";

export type PopupRuleTone = "active" | "disabled" | "warning" | "danger";
export type PopupActionTone = "secondary" | "success" | "danger";
export type PopupActionIntent =
  | "open-rule-options"
  | "open-domain-rule"
  | "create-exact-domain-rule"
  | "open-global-fallback-options"
  | "open-container"
  | "open-container-options"
  | "add-to-trusted-sites"
  | "enable-matched-trusted-site"
  | "open-trusted-site"
  | "enable-extension"
  | "request-firefox-userscripts"
  | "none";

export type PopupActionDescriptor = {
  intent: PopupActionIntent;
  target: string | null;
  availabilityReason: string | null;
};

export type PopupPresentationKind =
  | "loading"
  | "panic"
  | "unsupported"
  | "trusted-site"
  | "rule-active"
  | "rule-inactive"
  | "container-active"
  | "container-protections"
  | "container-inactive"
  | "container-unconfigured"
  | "container-unconfigured-default"
  | "container-unconfigured-default-protections"
  | "container-unconfigured-default-unconfigured"
  | "fallback-active"
  | "fallback-protections"
  | "fallback-inactive"
  | "fallback-unconfigured";

export const POPUP_PRESENTATION_KINDS = [
  "loading",
  "panic",
  "unsupported",
  "trusted-site",
  "rule-active",
  "rule-inactive",
  "container-active",
  "container-protections",
  "container-inactive",
  "container-unconfigured",
  "container-unconfigured-default",
  "container-unconfigured-default-protections",
  "container-unconfigured-default-unconfigured",
  "fallback-active",
  "fallback-protections",
  "fallback-inactive",
  "fallback-unconfigured",
] as const satisfies readonly PopupPresentationKind[];

const SLEEPING_KINDS = new Set<PopupPresentationKind>([
  "panic",
  "unsupported",
  "trusted-site",
  "rule-inactive",
  "container-inactive",
  "container-unconfigured",
  "container-unconfigured-default-unconfigured",
  "fallback-inactive",
  "fallback-unconfigured",
]);

export const getPopupBrandThingPose = (
  presentationKind: PopupPresentationKind,
): BrandThingPose => (SLEEPING_KINDS.has(presentationKind) ? "zz" : "idle");

export type PopupProtectionStatus =
  "off" | "unrecoverable" | "degraded" | "needs-attention" | "unknown" | "protected";

export type PopupViewModel = {
  presentationKind: PopupPresentationKind;
  supported: boolean;
  hasRule: boolean;
  brandThingPose: BrandThingPose;
  locationLabel?: string;
  locationTitle?: string;
  primaryLanguageLabel?: string;
  languagePrioritiesTitle?: string;
  powerTone: PopupRuleTone;
  powerLabel: string;
  powerTitle: string;
  powerTarget: string;
  powerAriaLabel: string;
  ruleTone: PopupRuleTone;
  ruleAccentColor?: string;
  ruleAnimatedBorderColor?: string;
  containerContext: ContainerPresentation | null;
  containerDriven: boolean;
  containerMissing: boolean;
  ruleActionIntent: PopupActionIntent;
  ruleActionLabel?: string;
  ruleActionTone?: PopupActionTone;
  ruleFooterActionIntent: PopupActionIntent;
  ruleFooterActionLabel?: string;
  ruleFooterActionTone?: PopupActionTone;
  secondaryActionIntent: PopupActionIntent;
  secondaryActionLabel?: string;
  secondaryActionTone?: PopupActionTone;
  primaryAction: PopupActionDescriptor;
  footerAction: PopupActionDescriptor;
  secondaryFooterAction: PopupActionDescriptor;
  protectionTitle: string;
  protectionSource: string;
  protectionSourcePattern?: string;
  protectionStatus: PopupProtectionStatus;
  globalProtectionsOff: boolean;
  protectionCounts: string;
  protectedSurfaceCount: number;
  protectionException?: string;
  hasProtectionDetails: boolean;
  showFirefoxWarning: boolean;
};

export type PopupViewModelCore = Omit<
  PopupViewModel,
  "primaryAction" | "footerAction" | "secondaryFooterAction"
>;

export type PopupVariantActionState = Pick<
  PopupViewModel,
  | "ruleActionIntent"
  | "ruleActionLabel"
  | "ruleActionTone"
  | "ruleFooterActionIntent"
  | "ruleFooterActionLabel"
  | "ruleFooterActionTone"
  | "secondaryActionIntent"
  | "secondaryActionLabel"
  | "secondaryActionTone"
>;

export type ProtectionSummaryView = Pick<
  PopupViewModel,
  | "protectionTitle"
  | "protectionSource"
  | "protectionSourcePattern"
  | "protectionStatus"
  | "protectionCounts"
  | "protectedSurfaceCount"
  | "protectionException"
  | "hasProtectionDetails"
>;
