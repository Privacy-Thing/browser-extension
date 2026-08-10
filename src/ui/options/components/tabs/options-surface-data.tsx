import type { ReactNode } from "react";

import {
  CONFIGURABLE_SURFACES,
  isSurfaceSupported,
  type ConfigurableSurface,
  type ConfigurableSurfaceKey,
  type SpoofingBrowserTarget,
} from "@/shared/spoofing-surfaces";
import type { SharedSpoofingConfig } from "@/shared/types";
import { t } from "@/ui/i18n";
import { SETTING_ANCHORS } from "@/ui/options/navigation";

export type SpoofingSurface = {
  key: ConfigurableSurfaceKey;
  anchorId: string;
  label: string;
  description: ReactNode;
  checked: boolean;
  supported?: boolean;
  methods: ConfigurableSurface["methods"];
};

export const FULL_WIDTH_SURFACES: readonly ConfigurableSurfaceKey[] = [
  "clientHints",
  "serviceWorker",
  "sharedWorker",
];

const SURFACE_ANCHORS: Record<ConfigurableSurfaceKey, string> = {
  geolocation: SETTING_ANCHORS.options.geolocation,
  timeLocale: SETTING_ANCHORS.options.timeLocale,
  canvas: SETTING_ANCHORS.options.canvas,
  webGL: SETTING_ANCHORS.options.webGL,
  audio: SETTING_ANCHORS.options.audio,
  navigator: SETTING_ANCHORS.options.navigator,
  screen: SETTING_ANCHORS.options.screen,
  clientHints: SETTING_ANCHORS.options.clientHints,
  battery: SETTING_ANCHORS.options.battery,
  webRTC: SETTING_ANCHORS.options.webRTC,
  serviceWorker: SETTING_ANCHORS.options.serviceWorker,
  sharedWorker: SETTING_ANCHORS.options.sharedWorkerHandlingMode,
};

const SURFACE_COPY: Record<
  ConfigurableSurfaceKey,
  { label: string; description: ReactNode }
> = {
  geolocation: {
    label: t.optionsPage.browserFingerprintSpoofing.items.geolocation.label,
    description: t.optionsPage.browserFingerprintSpoofing.items.geolocation.description,
  },
  timeLocale: {
    label: t.optionsPage.browserFingerprintSpoofing.items.timeLocale.label,
    description: t.optionsPage.browserFingerprintSpoofing.items.timeLocale.description,
  },
  canvas: {
    label: t.optionsPage.browserFingerprintSpoofing.items.canvas.label,
    description: t.optionsPage.browserFingerprintSpoofing.items.canvas.description,
  },
  webGL: {
    label: t.optionsPage.browserFingerprintSpoofing.items.webGL.label,
    description: t.optionsPage.browserFingerprintSpoofing.items.webGL.description,
  },
  audio: {
    label: t.optionsPage.browserFingerprintSpoofing.items.audio.label,
    description: t.optionsPage.browserFingerprintSpoofing.items.audio.description,
  },
  navigator: {
    label: t.optionsPage.browserFingerprintSpoofing.items.navigator.label,
    description: t.optionsPage.browserFingerprintSpoofing.items.navigator.description,
  },
  screen: {
    label: t.optionsPage.browserFingerprintSpoofing.items.screen.label,
    description: t.optionsPage.browserFingerprintSpoofing.items.screen.description,
  },
  clientHints: {
    label: t.optionsPage.browserFingerprintSpoofing.items.clientHints.label,
    description: t.optionsPage.browserFingerprintSpoofing.items.clientHints.description,
  },
  battery: {
    label: t.optionsPage.browserFingerprintSpoofing.items.battery.label,
    description: t.optionsPage.browserFingerprintSpoofing.items.battery.description,
  },
  webRTC: {
    label: t.optionsPage.browserFingerprintSpoofing.items.webRTC.label,
    description: t.optionsPage.browserFingerprintSpoofing.items.webRTC.description,
  },
  serviceWorker: {
    label: t.optionsPage.browserFingerprintSpoofing.items.serviceWorker.label,
    description: (
      <div className="space-y-2">
        <p>
          {t.optionsPage.browserFingerprintSpoofing.items.serviceWorker.description}
        </p>
        <p className="text-tone-warning-text">
          {t.optionsPage.browserFingerprintSpoofing.items.serviceWorker.warning}
        </p>
        <p>
          {t.optionsPage.browserFingerprintSpoofing.items.serviceWorker.defaultState}
        </p>
      </div>
    ),
  },
  sharedWorker: {
    label: t.optionsPage.browserFingerprintSpoofing.items.sharedWorker.label,
    description: (
      <div className="space-y-3">
        <p>
          {t.optionsPage.browserFingerprintSpoofing.items.sharedWorker.descriptionLead}
        </p>
        <dl className="space-y-2">
          {[
            {
              label: t.optionsPage.browserFingerprintSpoofing.items.sharedWorker.native,
              description:
                t.optionsPage.browserFingerprintSpoofing.items.sharedWorker
                  .nativeDescription,
            },
            {
              label: t.optionsPage.browserFingerprintSpoofing.items.sharedWorker.spoof,
              description:
                t.optionsPage.browserFingerprintSpoofing.items.sharedWorker
                  .spoofDescription,
            },
            {
              label: t.optionsPage.browserFingerprintSpoofing.items.sharedWorker.strict,
              description:
                t.optionsPage.browserFingerprintSpoofing.items.sharedWorker
                  .strictDescription,
            },
          ].map((mode) => (
            <div key={mode.label}>
              <dt className="inline font-semibold text-foreground">{mode.label}</dt>
              <dd className="inline">
                {" — "}
                {mode.description}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    ),
  },
};

export const buildSpoofingSurfaces = ({
  browserTarget,
  sharedSpoofing,
}: {
  browserTarget: SpoofingBrowserTarget;
  sharedSpoofing: SharedSpoofingConfig | undefined;
}): SpoofingSurface[] =>
  CONFIGURABLE_SURFACES.map((surface) => {
    const copy = SURFACE_COPY[surface.key];
    return {
      key: surface.key,
      anchorId: SURFACE_ANCHORS[surface.key],
      label: copy.label,
      description: copy.description,
      checked:
        surface.key === "sharedWorker"
          ? true
          : Boolean(sharedSpoofing?.[surface.key] ?? surface.defaultEnabled),
      supported: isSurfaceSupported(surface, browserTarget),
      methods: surface.methods,
    } satisfies SpoofingSurface;
  }).filter((surface) => surface.supported !== false);

export const renderOsmConsentState = (osmConsent: "unknown" | "granted" | "denied") => {
  if (osmConsent === "unknown") return t.advanced.privacy.osmConsent.stateUnknown;
  return (
    <>
      {t.advanced.privacy.osmConsent.statePrefix}{" "}
      <strong>
        {osmConsent === "granted"
          ? t.advanced.privacy.osmConsent.stateEnabled
          : t.advanced.privacy.osmConsent.stateDisabled}
      </strong>
      .
    </>
  );
};
