import { useCallback, useState, type RefObject } from "react";

import { DEFAULT_PREFERENCES } from "@/shared/settings-defaults";
import type {
  ContainerAssignment,
  DomainRule,
  GlobalFallbackRule,
  Location,
  ProfileDraft,
} from "@/shared/types";
import { notify } from "@/ui/components/ui/toast";
import { t } from "@/ui/i18n";
import { duplicateLocation } from "@/ui/options/duplicate-utils";
import { collectPresetUsage, type PresetUsage } from "@/ui/options/location-usage";
import { getLocationAnchor } from "@/ui/options/navigation";
import { useLatestRef } from "@/ui/options/state/use-latest-ref";
import type { ConfirmDialogConfig } from "@/ui/options/state/use-settings-confirm-dialog";
import type { PersistSettingsOptions } from "@/ui/options/state/use-settings-persistence-runtime";
import { createUniqueLocationId } from "@/ui/options/utils";

export const useLocationState = () => {
  const [profiles, setProfiles] = useState<Location[]>([]);
  const [containerAssignments, setContainerAssignments] = useState<
    ContainerAssignment[]
  >([]);
  const [profileDialogOpened, setProfileDialogOpened] = useState(false);
  const [profileEditorSessionId, setEditorSessionId] = useState(0);
  const [editingProfileIndex, setEditingProfileIndex] = useState<number | null>(null);
  const [pendingEditorDraft, setEditorDraft] = useState<Location | null>(null);
  const [defaultNoiseRadius, setDefaultNoiseRadius] = useState(
    DEFAULT_PREFERENCES.defaultNoiseRadius,
  );
  const [randomizeByDefault, setRandomizeDefault] = useState(
    DEFAULT_PREFERENCES.randomizeGeneratedLocationByDefault,
  );
  const [radiusKm, setRadiusKm] = useState(
    DEFAULT_PREFERENCES.generatedLocationRandomizationRadiusKm,
  );
  const [profilesSearch, setProfilesSearch] = useState("");
  const [tabContentReadyVersion, setTabReadyVersion] = useState(0);
  const profilesRef = useLatestRef(profiles);
  const containerAssignmentsRef = useLatestRef(containerAssignments);
  const randomizeByDefaultRef = useLatestRef(randomizeByDefault);
  const radiusKmRef = useLatestRef(radiusKm);

  const notifyTabContentReady = useCallback((): void => {
    setTabReadyVersion((current) => current + 1);
  }, []);

  const openProfileEditor = (profileIndex: number): void => {
    setEditorDraft(null);
    setEditingProfileIndex(profileIndex);
    setEditorSessionId((current) => current + 1);
    setProfileDialogOpened(true);
  };

  return {
    containerAssignments,
    containerAssignmentsRef,
    defaultNoiseRadius,
    editingProfileIndex,
    generatedLocationRandomizationRadiusKm: radiusKm,
    radiusKmRef,
    notifyTabContentReady,
    openProfileEditor,
    pendingEditorDraft,
    profileDialogOpened,
    profileEditorSessionId,
    profiles,
    profilesRef,
    profilesSearch,
    randomizeGeneratedLocationByDefault: randomizeByDefault,
    randomizeByDefaultRef,
    setDefaultNoiseRadius,
    setContainerAssignments,
    setEditingProfileIndex,
    setRadiusKm,
    setEditorDraft,
    setProfileDialogOpened,
    setEditorSessionId,
    setProfiles,
    setProfilesSearch,
    setRandomizeDefault,
    tabContentReadyVersion,
  };
};

export type LocationState = ReturnType<typeof useLocationState>;

type NavigateToAnchor = (
  anchorId: string,
  options?: { replace?: boolean; highlight?: boolean },
) => void;

export type LocationHandlerOptions = {
  containerAssignmentsRef: RefObject<readonly ContainerAssignment[]>;
  globalFallbackRuleRef: RefObject<GlobalFallbackRule | undefined>;
  navigateToAnchor: NavigateToAnchor;
  persistSettings: (options: PersistSettingsOptions) => Promise<boolean>;
  requestConfirmation: (config: ConfirmDialogConfig) => Promise<boolean>;
  rules: readonly DomainRule[];
  rulesRef: RefObject<readonly DomainRule[]>;
  state: LocationState;
};

const handleAddProfile = async ({ state }: LocationHandlerOptions): Promise<void> => {
  state.setEditorDraft({
    id: "",
    label: "New location",
    latitude: 0,
    longitude: 0,
    accuracy: 25,
    noiseRadius: state.defaultNoiseRadius,
    language: "en-US",
    languages: ["en-US"],
    timeZone: "UTC",
  });
  state.setEditingProfileIndex(null);
  state.setEditorSessionId((current) => current + 1);
  state.setProfileDialogOpened(true);
};

const handleDuplicateProfile = async (
  options: LocationHandlerOptions,
  profile: Location,
): Promise<boolean> => {
  const { state } = options;
  const nextProfile = duplicateLocation(
    profile,
    state.profiles.map((entry) => entry.id),
  );
  const nextProfiles = [...state.profiles, nextProfile];
  state.setProfiles(nextProfiles);
  options.navigateToAnchor(getLocationAnchor(nextProfile.id), { replace: true });
  return await options.persistSettings({
    toast: "Location duplicated.",
    locations: nextProfiles,
    rules: options.rules,
    scopes: ["location-model"],
  });
};

const getPresetUsage = (
  options: LocationHandlerOptions,
  profileId: string,
): PresetUsage | undefined =>
  collectPresetUsage(
    options.rulesRef.current,
    options.globalFallbackRuleRef.current,
    options.containerAssignmentsRef.current,
  ).get(profileId);

const notifyPresetIsAssigned = (): void => {
  notify.warning("Remove every assignment before deleting this preset.");
};

const handleRemoveProfile = async (
  options: LocationHandlerOptions,
  profile: Location,
  _index: number,
): Promise<boolean> => {
  if (getPresetUsage(options, profile.id)) {
    notifyPresetIsAssigned();
    return false;
  }

  const confirmed = await options.requestConfirmation({
    title: "Delete preset?",
    description: `Delete preset "${profile.label}"?`,
    confirmLabel: t.common.actions.delete,
    confirmTone: "destructive",
  });
  if (!confirmed) {
    return false;
  }

  if (getPresetUsage(options, profile.id)) {
    notifyPresetIsAssigned();
    return false;
  }

  return await options.persistSettings({
    toast: "Preset deleted.",
    locations: options.state.profilesRef.current.filter(
      (current) => current.id !== profile.id,
    ),
    scopes: ["location-model"],
  });
};

const handlePersistProfile = async (
  options: LocationHandlerOptions,
  index: number | null,
  profile: Location,
): Promise<boolean> => {
  const { profilesRef } = options.state;
  const nextProfiles =
    index === null
      ? [
          ...profilesRef.current,
          {
            ...profile,
            id: createUniqueLocationId(
              profile.label,
              profilesRef.current.map((current) => current.id),
            ),
          },
        ]
      : profilesRef.current.map((current, profileIndex) =>
          profileIndex === index ? profile : current,
        );

  return await options.persistSettings({
    toast: index === null ? "Location added." : "Location saved.",
    locations: nextProfiles,
    scopes: ["location-model"],
  });
};

const commitGeneratedLocation = async (
  options: LocationHandlerOptions,
  draft: ProfileDraft,
  onCommitted: () => void,
): Promise<void> => {
  const { state } = options;
  const id = createUniqueLocationId(
    draft.label,
    state.profiles.map((profile) => profile.id),
  );
  const nextProfiles = [
    ...state.profiles,
    {
      id,
      label: draft.label,
      latitude: draft.latitude,
      longitude: draft.longitude,
      accuracy: draft.accuracy,
      noiseRadius: draft.noiseRadius,
      language: draft.language,
      languages: [...draft.languages],
      timeZone: draft.timeZone,
    },
  ];

  state.setProfiles(nextProfiles);
  onCommitted();
  await options.persistSettings({
    toast: "Location added.",
    locations: nextProfiles,
    rules: options.rules,
    scopes: ["location-model"],
  });
};

export const createLocationHandlers = (options: LocationHandlerOptions) => ({
  commitGeneratedLocation: (draft: ProfileDraft, onCommitted: () => void) =>
    commitGeneratedLocation(options, draft, onCommitted),
  handleAddProfile: () => handleAddProfile(options),
  handleDuplicateProfile: (profile: Location) =>
    handleDuplicateProfile(options, profile),
  handlePersistProfile: (index: number | null, profile: Location) =>
    handlePersistProfile(options, index, profile),
  handleRemoveProfile: (profile: Location, index: number) =>
    handleRemoveProfile(options, profile, index),
});
