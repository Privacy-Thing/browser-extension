import type { OsmConsentState } from "@/shared/types";
import type { OsmConsentPromptAction } from "@/ui/options/utils";

export const shouldPromptForGenerator = (osmConsent: OsmConsentState): boolean =>
  osmConsent !== "granted";

export const shouldPromptForEditor = (osmConsent: OsmConsentState): boolean =>
  osmConsent === "unknown";

export const shouldEnableOsmFeatures = (osmConsent: OsmConsentState): boolean =>
  osmConsent === "granted";

export const resolveDeniedFollowUp = (
  action: OsmConsentPromptAction | null,
): "open-editor" | "close" => (action?.type === "editor" ? "open-editor" : "close");
