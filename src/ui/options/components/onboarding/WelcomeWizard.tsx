import "@/ui/options/components/subpages/privacy-policy-content.css";

import type { ChangeEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

import { fireAndForget } from "@/shared/async";
import {
  parseChromiumUaVersion,
  readFingerprintSource,
  type BrowserFingerprintSource,
} from "@/shared/browser-fingerprint";
import { BUILD_BROWSER_TARGET } from "@/shared/build-flags";
import { pickChromeFrames } from "@/shared/chrome-version-catalog";
import { EXTENSION_COMMAND_TYPES } from "@/shared/extension-contract";
import { defaultSharedSpoofing } from "@/shared/fingerprint-spoofing";
import { withFallbackSeed } from "@/shared/rule-seed";
import type {
  ImportLocationsResponse,
  ImportSettingsResponse,
  SaveSettingsResponse,
  SharedSpoofingConfig,
} from "@/shared/types";
import { notify } from "@/ui/components/ui/toast";
import { t } from "@/ui/i18n";
import { WelcomeWizardView } from "@/ui/options/components/onboarding/welcome-wizard-view";
import { PAGE_ANCHORS } from "@/ui/options/navigation";
import { useSettings } from "@/ui/options/state/SettingsContext";
import { sendMessageOrThrow } from "@/ui/shared/runtime-messaging";
import { getThemeAccentTokens } from "@/ui/shared/theme";
import { THEME_ACCENT_OPTIONS } from "@/ui/shared/theme-accent-options";
import { useTheme } from "@/ui/shared/ThemeProvider";

const DEFAULT_PRESET_IDS = [
  "spf-warsaw",
  "spf-paris",
  "spf-london",
  "spf-ottawa",
  "spf-new-york",
  "spf-las-vegas",
  "spf-san-francisco",
  "spf-sydney",
  "spf-beijing",
  "spf-hong-kong",
  "spf-new-delhi",
  "spf-cairo",
] as const;
const ALL_PRESET_IDS = [
  ...DEFAULT_PRESET_IDS,
  "spf-lagos",
  "spf-kyiv",
  "spf-kinshasa",
  "spf-sao-paulo",
  "spf-buenos-aires",
  "spf-lima",
  "spf-rio-de-janeiro",
  "spf-caracas",
  "spf-berlin",
  "spf-madrid",
] as const;
const PRESET_OPTIONS = [
  { id: "spf-warsaw", label: t.welcome.presetNames.spfWarsaw },
  { id: "spf-paris", label: t.welcome.presetNames.spfParis },
  { id: "spf-london", label: t.welcome.presetNames.spfLondon },
  { id: "spf-ottawa", label: t.welcome.presetNames.spfOttawa },
  { id: "spf-new-york", label: t.welcome.presetNames.spfNewYork },
  { id: "spf-las-vegas", label: t.welcome.presetNames.spfLasVegas },
  { id: "spf-san-francisco", label: t.welcome.presetNames.spfSanFrancisco },
  { id: "spf-sydney", label: t.welcome.presetNames.spfSydney },
  { id: "spf-beijing", label: t.welcome.presetNames.spfBeijing },
  { id: "spf-hong-kong", label: t.welcome.presetNames.spfHongKong },
  { id: "spf-new-delhi", label: t.welcome.presetNames.spfNewDelhi },
  { id: "spf-cairo", label: t.welcome.presetNames.spfCairo },
  { id: "spf-lagos", label: t.welcome.presetNames.spfLagos },
  { id: "spf-kyiv", label: t.welcome.presetNames.spfKyiv },
  { id: "spf-kinshasa", label: t.welcome.presetNames.spfKinshasa },
  { id: "spf-sao-paulo", label: t.welcome.presetNames.spfSaoPaulo },
  { id: "spf-buenos-aires", label: t.welcome.presetNames.spfBuenosAires },
  { id: "spf-lima", label: t.welcome.presetNames.spfLima },
  { id: "spf-rio-de-janeiro", label: t.welcome.presetNames.spfRioDeJaneiro },
  { id: "spf-caracas", label: t.welcome.presetNames.spfCaracas },
  { id: "spf-berlin", label: t.welcome.presetNames.spfBerlin },
  { id: "spf-madrid", label: t.welcome.presetNames.spfMadrid },
] as const;
const SORTED_PRESETS = [...PRESET_OPTIONS].sort((a, b) =>
  a.label.localeCompare(b.label, "en", { sensitivity: "base" }),
);
const PRESET_LABELS = new Map<string, string>(
  PRESET_OPTIONS.map((option) => [option.id, option.label]),
);

export type WizardStep =
  "welcome" | "privacy" | "presets" | "scope" | "browser" | "appearance" | "done";
const STEP_ORDER: WizardStep[] = [
  "welcome",
  "privacy",
  "presets",
  "scope",
  "browser",
  "appearance",
  "done",
];
const STEP_COPY = {
  privacy: {
    title: t.welcome.steps.privacy.title,
    description: t.welcome.steps.privacy.description,
  },
  presets: {
    title: t.welcome.steps.presets.title,
    description: t.welcome.steps.presets.description,
  },
  scope: {
    title: t.welcome.steps.scope.title,
    description: t.welcome.steps.scope.description,
  },
  appearance: {
    title: t.welcome.steps.appearance.title,
    description: t.welcome.steps.appearance.description,
  },
  done: {
    title: t.welcome.steps.done.title,
    description: t.welcome.steps.done.description,
  },
} as const;

const requestUserScripts = async (): Promise<boolean | null> => {
  const permissionsApi = (
    globalThis as typeof globalThis & {
      browser?: {
        permissions?: {
          request?: (permissions: { permissions?: string[] }) => Promise<boolean>;
        };
      };
    }
  ).browser?.permissions;
  if (!permissionsApi?.request) return null;
  try {
    return await permissionsApi.request({ permissions: ["userScripts"] });
  } catch {
    return false;
  }
};

const getPreviewCatalog = (source: BrowserFingerprintSource | null) => {
  const parsed = source?.userAgent ? parseChromiumUaVersion(source.userAgent) : null;
  if (parsed) {
    const catalog = pickChromeFrames(
      parsed.major,
      source?.userAgentData?.platform ?? source?.platform,
    );
    if (catalog.length > 0) return catalog;
  }
  return pickChromeFrames(149, "Windows");
};

type Settings = ReturnType<typeof useSettings>;
type Theme = ReturnType<typeof useTheme>;

const useWizardDraft = (settings: Settings) => {
  const [step, setStep] = useState<WizardStep>("welcome");
  const [osmConsent, setOsmConsent] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    () => new Set(DEFAULT_PRESET_IDS),
  );
  const [randomize, setRandomize] = useState(
    settings.randomizeGeneratedLocationByDefault,
  );
  const [radiusKm, setRadius] = useState(
    settings.generatedLocationRandomizationRadiusKm,
  );
  const [enableEverywhere, setEnableEverywhere] = useState(true);
  const [rotateVersion, setRotateVersion] = useState(
    (settings.sharedSpoofing ?? defaultSharedSpoofing).clientHintsVersionRotation ??
      true,
  );
  const [fingerprintSource, setFingerprintSource] =
    useState<BrowserFingerprintSource | null>(null);
  const [permissionGranted, setPermissionGranted] = useState<boolean | null>(null);
  const [policyOpen, setPolicyOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const importFileRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (BUILD_BROWSER_TARGET !== "chromium") return;
    let cancelled = false;
    fireAndForget(
      readFingerprintSource().then((source) => {
        if (!cancelled) setFingerprintSource(source ?? null);
      }),
    );
    return () => {
      cancelled = true;
    };
  }, []);
  useEffect(() => {
    if (!settings.settingsLoaded) return;
    setRandomize(settings.randomizeGeneratedLocationByDefault);
    setRadius(settings.generatedLocationRandomizationRadiusKm);
  }, [
    settings.generatedLocationRandomizationRadiusKm,
    settings.randomizeGeneratedLocationByDefault,
    settings.settingsLoaded,
  ]);
  return {
    enableEverywhere,
    error,
    fingerprintSource,
    importFileRef,
    osmConsent,
    permissionGranted,
    policyOpen,
    radiusKm,
    randomize,
    rotateVersion,
    saving,
    selectedIds,
    setEnableEverywhere,
    setError,
    setOsmConsent,
    setPermissionGranted,
    setPolicyOpen,
    setRadius,
    setRandomize,
    setRotateVersion,
    setSaving,
    setSelectedIds,
    setStep,
    step,
  };
};

type Draft = ReturnType<typeof useWizardDraft>;

const getStepCopy = (step: WizardStep, catalogSize: number) => {
  if (step === "browser") {
    return BUILD_BROWSER_TARGET === "firefox"
      ? {
          title: t.welcome.steps.firefox.title,
          description: t.welcome.steps.firefox.description,
        }
      : {
          title: t.welcome.steps.chromium.title,
          description: t.welcome.steps.chromium.description(catalogSize),
        };
  }
  if (step === "welcome") {
    return {
      title: t.welcome.steps.welcome.title,
      description: t.welcome.steps.welcome.description,
    };
  }
  return STEP_COPY[step];
};

const navigateToSettings = (): void => {
  window.history.replaceState(
    null,
    "",
    `${window.location.pathname}#${PAGE_ANCHORS.rules}`,
  );
};

const completeOnboarding = (settings: Settings, onComplete: () => void): void => {
  settings.setOnboardingCompleted(true);
  settings.setOnboardingOptions(null);
  navigateToSettings();
  onComplete();
};

const importSettings = async ({
  complete,
  draft,
  event,
}: {
  complete: () => void;
  draft: Draft;
  event: ChangeEvent<HTMLInputElement>;
}): Promise<void> => {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    const response = (await sendMessageOrThrow({
      type: EXTENSION_COMMAND_TYPES.importSettings,
      settings: JSON.parse(await file.text()),
    })) as ImportSettingsResponse;
    if (!response.ok) throw new Error(response.error);
    const saved = (await sendMessageOrThrow({
      type: EXTENSION_COMMAND_TYPES.saveSimpleSettings,
      onboardingCompleted: true,
    })) as SaveSettingsResponse;
    if (!saved.ok) throw new Error(saved.error);
    notify.success(t.welcome.importSuccess);
    complete();
  } catch (error) {
    const message = error instanceof Error ? error.message : t.welcome.importParseError;
    draft.setError(message);
    notify.error(t.welcome.importError, { description: message });
  } finally {
    event.target.value = "";
  }
};

const saveSetup = async ({
  complete,
  draft,
  settings,
  sharedDraft,
  skip,
  validate,
}: {
  complete: () => void;
  draft: Draft;
  settings: Settings;
  sharedDraft: SharedSpoofingConfig;
  skip: boolean;
  validate: () => boolean;
}): Promise<void> => {
  if (!skip && !validate()) return;
  draft.setSaving(true);
  draft.setError(null);
  try {
    if (!skip && draft.selectedIds.size > 0) {
      const presets = (await sendMessageOrThrow({
        type: EXTENSION_COMMAND_TYPES.importPresetLocations,
        locationIds: [...draft.selectedIds],
        randomizeWithinMeters: draft.randomize ? draft.radiusKm * 1000 : false,
      })) as ImportLocationsResponse;
      if (!presets.ok) throw new Error(presets.error);
      settings.setProfiles(presets.locations);
    }
    const saved = (await sendMessageOrThrow({
      type: EXTENSION_COMMAND_TYPES.saveSimpleSettings,
      osmConsent: skip || !draft.osmConsent ? "denied" : "granted",
      browserFingerprintSpoofingEnabled: true,
      sharedSpoofing:
        BUILD_BROWSER_TARGET === "chromium" ? sharedDraft : settings.sharedSpoofing,
      globalFallbackRule: withFallbackSeed({
        ...(settings.globalFallbackRule ?? {}),
        enabled: skip ? false : draft.enableEverywhere,
      }),
      onboardingCompleted: true,
    })) as SaveSettingsResponse;
    if (!saved.ok) throw new Error(saved.error);
    settings.setOsmConsent(saved.osmConsent);
    settings.setFingerprintSpoofing(saved.browserFingerprintSpoofingEnabled);
    settings.setSharedSpoofing(saved.sharedSpoofing);
    settings.setGlobalFallbackRule(saved.globalFallbackRule);
    complete();
  } catch (error) {
    draft.setError(error instanceof Error ? error.message : t.welcome.unexpectedError);
  } finally {
    draft.setSaving(false);
  }
};

const requestFirefoxPermission = async (draft: Draft): Promise<void> => {
  const granted = await requestUserScripts();
  draft.setPermissionGranted(granted);
  if (granted) {
    await sendMessageOrThrow({
      type: EXTENSION_COMMAND_TYPES.requestFirefoxUserscriptsPermission,
    });
  }
};

const setWizardContrast = async (
  settings: Settings,
  theme: Theme,
  checked: boolean,
): Promise<void> => {
  settings.setHighContrastMode(checked);
  await theme.setHighContrast(checked);
};

const getAccentView = (theme: Theme) => ({
  color: `hsl(${getThemeAccentTokens(theme.accentPreset, theme.theme, theme.highContrast).primary})`,
  label:
    THEME_ACCENT_OPTIONS.find((option) => option.preset === theme.accentPreset)
      ?.label ??
    THEME_ACCENT_OPTIONS[0]?.label ??
    theme.accentPreset,
  options: THEME_ACCENT_OPTIONS.map((option) => ({
    ...option,
    color: `hsl(${getThemeAccentTokens(option.preset, theme.theme, theme.highContrast).primary})`,
  })),
});

export const WelcomeWizard = ({ onComplete }: { onComplete: () => void }) => {
  const settings = useSettings();
  const theme = useTheme();
  const draft = useWizardDraft(settings);
  const catalog = useMemo(
    () => getPreviewCatalog(draft.fingerprintSource),
    [draft.fingerprintSource],
  );
  const presetOptions = useMemo(
    () =>
      SORTED_PRESETS.filter((option) => draft.selectedIds.has(option.id)).map(
        (option) => ({ value: option.id, label: option.label }),
      ),
    [draft.selectedIds],
  );
  const sharedDraft = useMemo<SharedSpoofingConfig>(
    () => ({
      ...(settings.sharedSpoofing ?? defaultSharedSpoofing),
      clientHintsVersionRotation: draft.rotateVersion,
    }),
    [draft.rotateVersion, settings.sharedSpoofing],
  );
  const setOnboardingOptions = settings.setOnboardingOptions;
  useEffect(() => {
    if (draft.step !== "scope") {
      setOnboardingOptions(null);
      return;
    }
    setOnboardingOptions(presetOptions);
    return () => setOnboardingOptions(null);
  }, [draft.step, presetOptions, setOnboardingOptions]);

  const complete = () => completeOnboarding(settings, onComplete);
  const validate = (): boolean => {
    const assignedId =
      settings.fallbackLocationId || settings.globalFallbackRule?.locationId || "";
    if (!assignedId || draft.selectedIds.has(assignedId)) return true;
    draft.setError(
      t.welcome.steps.scope.presetMismatch(PRESET_LABELS.get(assignedId) ?? assignedId),
    );
    return false;
  };
  const save = (skip: boolean) =>
    saveSetup({ complete, draft, settings, sharedDraft, skip, validate });
  const stepIndex = STEP_ORDER.indexOf(draft.step);
  const setStepOffset = (offset: number) => {
    draft.setError(null);
    if (offset > 0 && draft.step === "scope" && !validate()) return;
    const index = Math.max(0, Math.min(stepIndex + offset, STEP_ORDER.length - 1));
    draft.setStep(STEP_ORDER[index] ?? "welcome");
  };
  const accent = getAccentView(theme);
  return (
    <WelcomeWizardView
      appearance={{
        accentOptions: accent.options,
        accentPreset: theme.accentPreset,
        highContrast: theme.highContrast,
        motionOverride: theme.motionOverride,
        preference: theme.preference,
        reduceMotion: theme.reduceMotion,
        selectedAccentColor: accent.color,
        selectedAccentLabel: accent.label,
        setAccentPreset: theme.setAccentPreset,
        setHighContrast: (checked) => setWizardContrast(settings, theme, checked),
        setPreference: theme.setPreference,
        setReduceMotion: theme.setReduceMotion,
      }}
      browser={{
        catalog,
        permissionGranted: draft.permissionGranted,
        requestPermission: () => requestFirefoxPermission(draft),
        rotateVersion: draft.rotateVersion,
        setRotateVersion: draft.setRotateVersion,
      }}
      complete={() => save(false)}
      copy={getStepCopy(draft.step, catalog.length)}
      error={draft.error}
      goNext={() => setStepOffset(1)}
      goPrevious={() => setStepOffset(-1)}
      onboardingCompleted={settings.onboardingCompleted}
      policyOpen={draft.policyOpen}
      presets={{
        allIds: ALL_PRESET_IDS,
        options: SORTED_PRESETS,
        randomize: draft.randomize,
        radiusKm: draft.radiusKm,
        selectedIds: draft.selectedIds,
        setRandomize: draft.setRandomize,
        setRadius: draft.setRadius,
        setSelectedIds: draft.setSelectedIds,
      }}
      privacy={{ checked: draft.osmConsent, setChecked: draft.setOsmConsent }}
      reduceMotion={theme.reduceMotion}
      saving={draft.saving}
      scope={{
        enabled: draft.enableEverywhere,
        openDialog: () => {
          settings.setOnboardingOptions(presetOptions);
          settings.openFallbackDialog();
        },
        setEnabled: draft.setEnableEverywhere,
      }}
      setPolicyOpen={draft.setPolicyOpen}
      step={draft.step}
      welcome={{
        importFileRef: draft.importFileRef,
        importSettings: (event) => importSettings({ complete, draft, event }),
        saveAdvanced: () => save(true),
        startGuided: () => draft.setStep("privacy"),
      }}
    />
  );
};
