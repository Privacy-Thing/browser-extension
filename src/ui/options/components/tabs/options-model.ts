import { useEffect, useState } from "react";

import { fireAndForget } from "@/shared/async";
import { readFingerprintSource } from "@/shared/browser-fingerprint";
import { BUILD_BROWSER_TARGET } from "@/shared/build-flags";
import { pickChromeFrames } from "@/shared/chrome-version-catalog";
import { defaultSharedSpoofing } from "@/shared/fingerprint-spoofing";
import {
  getSurfaceDefinition,
  isSurfaceSupported,
  type SpoofingBrowserTarget,
} from "@/shared/spoofing-surfaces";
import { isGeoSettingsAnchor } from "@/ui/options/components/modals/GeolocationAdvancedSettingsDialog";
import { buildSpoofingSurfaces } from "@/ui/options/components/tabs/options-surface-data";
import {
  getVersionHintExample,
  type VersionHintExample,
} from "@/ui/options/components/tabs/options-version-hint";
import { SECTION_ANCHORS, SETTING_ANCHORS } from "@/ui/options/navigation";
import { useSettings } from "@/ui/options/state/SettingsContext";
import { useTheme } from "@/ui/shared/ThemeProvider";

const useVersionData = (supported: boolean) => {
  const [example, setExample] = useState<VersionHintExample | null>(null);
  const [catalog, setCatalog] = useState<readonly { build: string; patch: string }[]>(
    [],
  );
  useEffect(() => {
    if (!supported) {
      setExample(null);
      setCatalog([]);
      return;
    }
    let cancelled = false;
    fireAndForget(
      readFingerprintSource().then((source) => {
        if (cancelled) return;
        const nextExample = getVersionHintExample(source);
        setExample(nextExample);
        if (!nextExample) {
          setCatalog([]);
          return;
        }
        const major = Number(nextExample.fullVersion.split(".")[0]);
        const platform = source?.userAgentData?.platform ?? source?.platform;
        setCatalog(pickChromeFrames(major, platform));
      }),
    );
    return () => {
      cancelled = true;
    };
  }, [supported]);
  return { catalog, example };
};

export const useOptionsModel = (
  browserTarget: SpoofingBrowserTarget = BUILD_BROWSER_TARGET,
) => {
  const settings = useSettings();
  const themeState = useTheme();
  const [geoDialogOpen, setGeoDialogOpen] = useState(false);
  const supportsClientHints = isSurfaceSupported(
    getSurfaceDefinition("clientHints"),
    browserTarget,
  );
  const activeSpoofing = settings.sharedSpoofing ?? defaultSharedSpoofing;
  const version = useVersionData(supportsClientHints);
  useEffect(() => {
    if (isGeoSettingsAnchor(settings.highlightedAnchorId)) setGeoDialogOpen(true);
  }, [settings.highlightedAnchorId]);
  const spoofingHighlighted =
    settings.highlightedAnchorId === SECTION_ANCHORS.options.overview ||
    settings.highlightedAnchorId ===
      SETTING_ANCHORS.options.browserFingerprintSpoofing ||
    settings.highlightedAnchorId === SECTION_ANCHORS.options.surfaces ||
    settings.highlightedAnchorId === SETTING_ANCHORS.options.activeSpoofing ||
    (!supportsClientHints &&
      (settings.highlightedAnchorId === SETTING_ANCHORS.options.clientHints ||
        settings.highlightedAnchorId ===
          SETTING_ANCHORS.options.clientHintsVersionRotation));
  return {
    activeSpoofing,
    fingerprintNoteId: `${SETTING_ANCHORS.options.browserFingerprintSpoofing}__disabled-note`,
    geoDialogOpen,
    setGeoDialogOpen,
    settings,
    simpleDisabled: !settings.settingsLoaded,
    spoofingHighlighted,
    surfaces: buildSpoofingSurfaces({
      browserTarget,
      featureFlags: settings.featureFlags,
      sharedSpoofing: activeSpoofing,
    }),
    browserTarget,
    themeState,
    version,
    versionRotationOn: activeSpoofing.clientHintsVersionRotation ?? true,
  };
};

export type OptionsModel = ReturnType<typeof useOptionsModel>;
