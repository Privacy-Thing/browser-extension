import type { ReactNode, MouseEventHandler } from "react";

import type { ProviderFeature, ProviderFeatureState } from "@/shared/provider-feature";
import type { UiLocale } from "@/shared/ui-locale";
import type { ProviderFeatureMessages } from "@/ui/components/provider-feature/provider-feature-copy";

export type PluginFeatureUi = {
  messages: Record<UiLocale, ProviderFeatureMessages>;
  renderStatus?: (context: {
    state: ProviderFeatureState;
    locale: UiLocale;
    openSettings?: MouseEventHandler<HTMLAnchorElement>;
  }) => ReactNode;
  renderExplanation: (context: {
    feature: ProviderFeature;
    isJoin: boolean;
    isStaged?: boolean;
    state: ProviderFeatureState;
    locale: UiLocale;
    openSettings?: MouseEventHandler<HTMLAnchorElement>;
  }) => ReactNode;
};

const presentations = new Map<string, PluginFeatureUi>();
export const registerFeatureUi = (
  providerId: string,
  presentation: PluginFeatureUi,
): void => {
  presentations.set(providerId, presentation);
};
export const featureUiFor = (providerId: string): PluginFeatureUi | undefined =>
  presentations.get(providerId);
