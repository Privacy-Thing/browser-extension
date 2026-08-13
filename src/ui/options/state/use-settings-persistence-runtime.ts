import { useCallback, useRef, useState, type RefObject } from "react";

import { EXTENSION_COMMAND_TYPES } from "@/shared/extension-contract";
import type { FeatureFlags } from "@/shared/feature-flags";
import type {
  ContainerAssignment,
  DomainRule,
  GetSettingsResponse,
  GlobalFallbackRule,
  ImportSettingsResponse,
  Location,
  OsmConsentState,
  ResetSettingsResponse,
  SaveLocationResponse,
  SaveSettingsResponse,
  SharedSpoofingConfig,
  SharedWorkerHandlingMode,
  ThemeAccentPreset,
  ThemeMode,
  TrustedSite,
} from "@/shared/types";
import { notify } from "@/ui/components/ui/toast";
import {
  clearAutosaveScopes,
  collectAutosaveScopes,
  hasPendingAutosaveScopes,
  type AutosaveScope,
} from "@/ui/options/state/settings-persistence";
import {
  applySettingsPayload,
  type SettingsStateSetters,
} from "@/ui/options/state/settings-state-sync";
import type { StatusTone } from "@/ui/options/utils";
import { dedupeRules } from "@/ui/options/utils";
import { sendMessageOrThrow } from "@/ui/shared/runtime-messaging";

const AUTOSAVE_DELAY_MS = 400;

/** Overrides staged by the UI and flushed on the next simple-settings save. */
export type PendingSettings = Partial<{
  themeMode: ThemeMode;
  themeAccentPreset: ThemeAccentPreset;
  debugMode: boolean;
  watchPositionDelay: [number, number];
  osmConsent: OsmConsentState;
  browserFingerprintSpoofingEnabled: boolean;
  featureFlags: Partial<FeatureFlags>;
  sharedWorkerHandlingMode: SharedWorkerHandlingMode;
  sharedWorkerCompatibilityMode: boolean;
  sharedSpoofing: SharedSpoofingConfig | undefined;
  highContrastMode: boolean;
  defaultNoiseRadius: number;
  randomizeGeneratedLocationByDefault: boolean;
  generatedLocationRandomizationRadiusKm: number;
  showBadgeQueryCount: boolean;
  includeDateCallsInBadgeCount: boolean;
}>;

/**
 * The `useLatestRef` mirrors the write funnel reads.
 *
 * They stay per-field rather than collapsing into one snapshot ref, so this
 * module is a pure move of the previous inline code and the read timing is
 * identical to what the hook did before.
 */
export type SettingsPersistenceRefs = {
  browserFingerprintSpoofingEnabled: RefObject<boolean>;
  containerAssignments: RefObject<readonly ContainerAssignment[]>;
  debugMode: RefObject<boolean>;
  featureFlags: RefObject<FeatureFlags>;
  generatedLocationRandomizationRadiusKm: RefObject<number>;
  globalFallbackRule: RefObject<GlobalFallbackRule | undefined>;
  highContrastMode: RefObject<boolean>;
  includeDateCallsInBadgeCount: RefObject<boolean>;
  osmConsent: RefObject<OsmConsentState>;
  profiles: RefObject<readonly Location[]>;
  randomizeGeneratedLocationByDefault: RefObject<boolean>;
  rules: RefObject<readonly DomainRule[]>;
  settingsLoaded: RefObject<boolean>;
  sharedSpoofing: RefObject<SharedSpoofingConfig | undefined>;
  sharedWorkerHandlingMode: RefObject<SharedWorkerHandlingMode>;
  showBadgeQueryCount: RefObject<boolean>;
  watchPositionDelay: RefObject<[number, number]>;
};

export type PersistenceOptions = {
  refs: SettingsPersistenceRefs;
  /** Generator-draft setters the shared payload sync does not cover. */
  setRadiusKm: (value: number) => void;
  setShouldRandomize: (value: boolean) => void;
  setters: SettingsStateSetters;
};

/** Overrides for one `persistSettings` call. */
export type PersistSettingsOptions = {
  containerAssignments?: readonly ContainerAssignment[];
  locations?: readonly Location[];
  osmConsent?: OsmConsentState;
  rules?: readonly DomainRule[];
  scopes?: readonly AutosaveScope[];
  toast?: string;
};

/** Everything a write needs that is not part of one call's overrides. */
type PersistenceContext = {
  autosaveTimerRef: RefObject<ReturnType<typeof setTimeout> | null>;
  pendingOverridesRef: RefObject<PendingSettings>;
  pendingScopesRef: RefObject<Record<AutosaveScope, boolean>>;
  refs: SettingsPersistenceRefs;
  setSaveInFlight: (value: boolean) => void;
  setters: SettingsStateSetters;
};

const showToast = (
  message: string,
  tone: Exclude<StatusTone, "neutral"> | "neutral",
): void => {
  const method = tone === "neutral" ? "info" : tone;
  notify[method](message);
};

const resolvePendingWorkerMode = (
  pending: PendingSettings,
  current: SharedWorkerHandlingMode,
): SharedWorkerHandlingMode => {
  if (pending.sharedWorkerHandlingMode) {
    return pending.sharedWorkerHandlingMode;
  }

  if (pending.sharedWorkerCompatibilityMode === undefined) {
    return current;
  }

  return pending.sharedWorkerCompatibilityMode ? "native" : "strict";
};

/**
 * The simple-settings message body: staged overrides, plus every field that
 * actually differs from its mirror.
 */
const buildSimpleSettingsPatch = (
  refs: SettingsPersistenceRefs,
  pending: PendingSettings,
  osmConsentOverride?: OsmConsentState,
) => {
  const nextDebugMode = pending.debugMode ?? refs.debugMode.current;
  const nextWatchPositionDelay =
    pending.watchPositionDelay ?? refs.watchPositionDelay.current;
  const nextOsmConsent =
    osmConsentOverride ?? pending.osmConsent ?? refs.osmConsent.current;
  const nextFingerprintSpoofing =
    pending.browserFingerprintSpoofingEnabled ??
    refs.browserFingerprintSpoofingEnabled.current;
  const nextHighContrastMode =
    pending.highContrastMode ?? refs.highContrastMode.current;
  const nextShowBadgeQueryCount =
    pending.showBadgeQueryCount ?? refs.showBadgeQueryCount.current;
  const nextCountDateCalls =
    pending.includeDateCallsInBadgeCount ?? refs.includeDateCallsInBadgeCount.current;
  const nextWorkerMode = resolvePendingWorkerMode(
    pending,
    refs.sharedWorkerHandlingMode.current,
  );
  const nextWorkerCompat = nextWorkerMode === "native";
  const nextRandomizeDefault =
    pending.randomizeGeneratedLocationByDefault ??
    refs.randomizeGeneratedLocationByDefault.current;
  const nextRadiusKm =
    pending.generatedLocationRandomizationRadiusKm ??
    refs.generatedLocationRandomizationRadiusKm.current;

  return {
    ...pending,
    ...(nextDebugMode !== refs.debugMode.current ? { debugMode: nextDebugMode } : {}),
    ...(nextWatchPositionDelay !== refs.watchPositionDelay.current
      ? { watchPositionDelay: nextWatchPositionDelay }
      : {}),
    ...(nextOsmConsent !== refs.osmConsent.current
      ? { osmConsent: nextOsmConsent }
      : {}),
    ...(nextFingerprintSpoofing !== refs.browserFingerprintSpoofingEnabled.current
      ? { browserFingerprintSpoofingEnabled: nextFingerprintSpoofing }
      : {}),
    ...(nextWorkerMode !== refs.sharedWorkerHandlingMode.current
      ? {
          sharedWorkerHandlingMode: nextWorkerMode,
          sharedWorkerCompatibilityMode: nextWorkerCompat,
        }
      : {}),
    ...(nextHighContrastMode !== refs.highContrastMode.current
      ? { highContrastMode: nextHighContrastMode }
      : {}),
    ...(nextRandomizeDefault !== refs.randomizeGeneratedLocationByDefault.current
      ? { randomizeGeneratedLocationByDefault: nextRandomizeDefault }
      : {}),
    ...(nextRadiusKm !== refs.generatedLocationRandomizationRadiusKm.current
      ? {
          generatedLocationRandomizationRadiusKm: nextRadiusKm,
        }
      : {}),
    ...(nextShowBadgeQueryCount !== refs.showBadgeQueryCount.current
      ? { showBadgeQueryCount: nextShowBadgeQueryCount }
      : {}),
    ...(nextCountDateCalls !== refs.includeDateCallsInBadgeCount.current
      ? { includeDateCallsInBadgeCount: nextCountDateCalls }
      : {}),
  };
};

/** Re-applies the canonical state the background echoes back after a save. */
const applySettingsResponse = (
  setters: SettingsStateSetters,
  response: Extract<SaveSettingsResponse, { ok: true }>,
): void => {
  setters.setThemeMode(response.themeMode);
  setters.setThemeAccentPreset(response.themeAccentPreset);
  setters.setDebugMode(response.debugMode);
  setters.setWatchPositionDelay(response.watchPositionDelay);
  setters.setOsmConsent(response.osmConsent);
  setters.setFingerprintSpoofing(response.browserFingerprintSpoofingEnabled);
  setters.setFeatureFlags(response.featureFlags);
  setters.setWorkerMode(response.sharedWorkerHandlingMode);
  setters.setWorkerCompat(response.sharedWorkerCompatibilityMode);
  setters.setTrustedSites(response.trustedSites);
  if (Object.hasOwn(response, "sharedSpoofing")) {
    setters.setSharedSpoofing(response.sharedSpoofing);
  }
  if (Object.hasOwn(response, "globalFallbackRule")) {
    setters.setGlobalFallbackRule(response.globalFallbackRule);
  }
  setters.setHighContrastMode(response.highContrastMode);
  setters.setDefaultNoiseRadius(response.defaultNoiseRadius);
  setters.setRandomizeDefault(response.randomizeGeneratedLocationByDefault);
  setters.setRadiusKm(response.generatedLocationRandomizationRadiusKm);
  setters.setShowBadgeQueryCount(response.showBadgeQueryCount);
  setters.setCountDateCalls(response.includeDateCallsInBadgeCount);
};

const saveSimpleSettingsScope = async (
  context: PersistenceContext,
  osmConsent: OsmConsentState | undefined,
): Promise<void> => {
  const { refs, setters } = context;
  const response = (await sendMessageOrThrow({
    type: EXTENSION_COMMAND_TYPES.saveSimpleSettings,
    ...buildSimpleSettingsPatch(refs, context.pendingOverridesRef.current, osmConsent),
    // Deliberately the mirror, not `pending.sharedSpoofing ?? mirror`: every
    // caller passed the mirror explicitly, so a pending sharedSpoofing override
    // is dropped here today. Preserved verbatim; reconciling it is separate.
    sharedSpoofing: refs.sharedSpoofing.current,
    globalFallbackRule: refs.globalFallbackRule.current,
  })) as SaveSettingsResponse;

  if (!response.ok) {
    throw new Error(response.error);
  }

  applySettingsResponse(setters, response);
  context.pendingOverridesRef.current = {};
};

const saveLocationModelScope = async (
  context: PersistenceContext,
  options: PersistSettingsOptions,
): Promise<void> => {
  const { refs, setters } = context;
  const response = (await sendMessageOrThrow({
    type: EXTENSION_COMMAND_TYPES.saveLocationModel,
    locations: [...(options.locations ?? refs.profiles.current)],
    rules: dedupeRules(options.rules ?? refs.rules.current),
    containerAssignments: [
      ...(options.containerAssignments ?? refs.containerAssignments.current),
    ],
  })) as SaveLocationResponse;

  if (!response.ok) {
    throw new Error(response.error);
  }

  setters.setProfiles(response.locations);
  setters.setRules(response.rules);
  setters.setContainerAssignments(response.containerAssignments ?? []);
};

const runPersistSettings = async (
  context: PersistenceContext,
  options: PersistSettingsOptions,
): Promise<boolean> => {
  if (context.autosaveTimerRef.current) {
    clearTimeout(context.autosaveTimerRef.current);
    context.autosaveTimerRef.current = null;
  }

  const scopesToPersist = collectAutosaveScopes(
    context.pendingScopesRef.current,
    options.scopes ?? [],
  );
  if (scopesToPersist.length === 0) {
    return true;
  }

  clearAutosaveScopes(context.pendingScopesRef.current, ...scopesToPersist);
  context.setSaveInFlight(true);

  try {
    if (scopesToPersist.includes("simple-settings")) {
      await saveSimpleSettingsScope(context, options.osmConsent);
    }

    if (scopesToPersist.includes("location-model")) {
      await saveLocationModelScope(context, options);
    }

    if (options.toast) {
      showToast(options.toast, "success");
    }

    return true;
  } catch (error) {
    for (const scope of scopesToPersist) {
      context.pendingScopesRef.current[scope] = true;
    }

    notify.error(error instanceof Error ? error.message : "Saving settings failed.");
    return false;
  } finally {
    context.setSaveInFlight(false);
  }
};

/**
 * Owns both persistence scopes, the autosave timer, and `saveInFlight`.
 *
 * Every write to the background goes through here. Domain handlers receive
 * `persistSettings` and never message the background themselves, which is what
 * keeps the server-authoritative round-trip — both save commands echo the
 * canonical state back and it is re-applied across every domain — in one place.
 */
export const usePersistenceRuntime = ({
  refs,
  setRadiusKm,
  setShouldRandomize,
  setters,
}: PersistenceOptions) => {
  const [saveInFlight, setSaveInFlight] = useState(false);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingScopesRef = useRef<Record<AutosaveScope, boolean>>({
    "simple-settings": false,
    "location-model": false,
  });
  const pendingOverridesRef = useRef<PendingSettings>({});

  const context: PersistenceContext = {
    autosaveTimerRef,
    pendingOverridesRef,
    pendingScopesRef,
    refs,
    setSaveInFlight,
    setters,
  };

  const applyLoadedSettingsState = useCallback(
    (
      payload:
        | GetSettingsResponse
        | ResetSettingsResponse
        | Extract<ImportSettingsResponse, { ok: true }>,
    ): void => {
      applySettingsPayload(payload, setters);
      setShouldRandomize(payload.randomizeGeneratedLocationByDefault);
      setRadiusKm(payload.generatedLocationRandomizationRadiusKm);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the setter bags are stable for the provider's lifetime; listing them would rebuild this callback every render
    [],
  );

  const persistSettings = async (
    options: PersistSettingsOptions = {},
  ): Promise<boolean> => runPersistSettings(context, options);

  const persistPendingChanges = async (): Promise<void> => {
    if (
      !refs.settingsLoaded.current ||
      !hasPendingAutosaveScopes(pendingScopesRef.current)
    ) {
      return;
    }

    await persistSettings();
  };

  const queueAutosave = (scope: AutosaveScope): void => {
    if (!refs.settingsLoaded.current) {
      return;
    }

    pendingScopesRef.current[scope] = true;

    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }

    autosaveTimerRef.current = setTimeout(() => {
      autosaveTimerRef.current = null;
      void persistPendingChanges();
    }, AUTOSAVE_DELAY_MS);
  };

  const scheduleAutosave = (overrides: PendingSettings = {}): void => {
    pendingOverridesRef.current = { ...pendingOverridesRef.current, ...overrides };
    queueAutosave("simple-settings");
  };

  /**
   * Second write path, deliberately not routed through `persistSettings`: it
   * takes part in no autosave scope and does not clear the autosave timer, so a
   * trusted-site save can race a pending autosave. That gap predates this
   * module and is preserved rather than fixed, to keep this a move.
   */
  const persistTrustedSites = async (
    nextTrustedSites: readonly TrustedSite[],
    successMessage: string,
    successTone: StatusTone = "success",
  ): Promise<boolean> => {
    setSaveInFlight(true);

    try {
      const response = (await sendMessageOrThrow({
        type: EXTENSION_COMMAND_TYPES.saveSimpleSettings,
        trustedSites: [...nextTrustedSites],
      })) as SaveSettingsResponse;

      if (!response.ok) {
        throw new Error(response.error);
      }

      setters.setTrustedSites(response.trustedSites);
      showToast(successMessage, successTone);
      return true;
    } catch (error) {
      notify.error(error instanceof Error ? error.message : "Saving settings failed.");
      return false;
    } finally {
      setSaveInFlight(false);
    }
  };

  return {
    applyLoadedSettingsState,
    /** Exposed only so the provider can cancel a pending save on unmount. */
    autosaveTimerRef,
    persistSettings,
    persistTrustedSites,
    saveInFlight,
    scheduleAutosave,
    setSaveInFlight,
    showToast,
  };
};
