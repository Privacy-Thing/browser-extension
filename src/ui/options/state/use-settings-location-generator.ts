import { useState, type Dispatch, type RefObject, type SetStateAction } from "react";

import { EXTENSION_COMMAND_TYPES } from "@/shared/extension-contract";
import { DEFAULT_PREFERENCES } from "@/shared/settings-defaults";
import type {
  LocationDraftResponse,
  LocationSearchCandidate,
  OsmConsentState,
  ProfileDraft,
} from "@/shared/types";
import { notify } from "@/ui/components/ui/toast";
import type { PersistSettingsOptions } from "@/ui/options/state/use-settings-persistence-runtime";
import type { OsmConsentPromptAction, ProfileGeneratorStep } from "@/ui/options/utils";
import { sendMessageOrThrow } from "@/ui/shared/runtime-messaging";

/**
 * Generator wizard state plus the OpenStreetMap consent prompt that gates it.
 *
 * The two randomization setters are also consumed by the persistence runtime,
 * which re-seeds them from a loaded payload — so this hook has to run before it.
 */
export const useGeneratorState = () => {
  const [isGeneratorOpen, setGeneratorOpen] = useState(false);
  const [generatorStep, setGeneratorStep] = useState<ProfileGeneratorStep>("search");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchCandidates, setSearchCandidates] = useState<LocationSearchCandidate[]>(
    [],
  );
  const [selectedCandidateId, setSelectedCandidateId] = useState("");
  const [shouldRandomize, setShouldRandomize] = useState(
    DEFAULT_PREFERENCES.randomizeGeneratedLocationByDefault,
  );
  const [radiusKm, setRadiusKm] = useState(
    DEFAULT_PREFERENCES.generatedLocationRandomizationRadiusKm,
  );
  const [pendingDraft, setPendingDraft] = useState<ProfileDraft | null>(null);
  const [isDraftPending, setDraftPending] = useState(false);
  const [isOsmDialogOpen, setOsmDialogOpen] = useState(false);
  const [pendingOsmAction, setPendingOsmAction] =
    useState<OsmConsentPromptAction | null>(null);

  return {
    radiusKm,
    isOsmDialogOpen,
    pendingOsmAction,
    pendingDraft,
    isDraftPending,
    searchQuery,
    isGeneratorOpen,
    generatorStep,
    searchCandidates,
    shouldRandomize,
    selectedCandidateId,
    setRadiusKm,
    setOsmDialogOpen,
    setPendingOsmAction,
    setPendingDraft,
    setDraftPending,
    setSearchQuery,
    setGeneratorOpen,
    setGeneratorStep,
    setSearchCandidates,
    setShouldRandomize,
    setSelectedCandidateId,
  };
};

export type GeneratorOptions = {
  radiusKm: number;
  radiusKmRef: RefObject<number>;
  openProfileEditor: (profileIndex: number) => void;
  osmConsent: OsmConsentState;
  pendingOsmAction: OsmConsentPromptAction | null;
  pendingDraft: ProfileDraft | null;
  persistSettings: (options: PersistSettingsOptions) => Promise<boolean>;
  searchQuery: string;
  generatorStep: ProfileGeneratorStep;
  searchCandidates: readonly LocationSearchCandidate[];
  shouldRandomize: boolean;
  randomizeByDefaultRef: RefObject<boolean>;
  selectedCandidateId: string;
  setRadiusKm: Dispatch<SetStateAction<number>>;
  setOsmConsent: Dispatch<SetStateAction<OsmConsentState>>;
  setOsmDialogOpen: Dispatch<SetStateAction<boolean>>;
  setPendingOsmAction: Dispatch<SetStateAction<OsmConsentPromptAction | null>>;
  setPendingDraft: Dispatch<SetStateAction<ProfileDraft | null>>;
  setDraftPending: Dispatch<SetStateAction<boolean>>;
  setSearchQuery: Dispatch<SetStateAction<string>>;
  setGeneratorOpen: Dispatch<SetStateAction<boolean>>;
  setGeneratorStep: Dispatch<SetStateAction<ProfileGeneratorStep>>;
  setSearchCandidates: Dispatch<SetStateAction<LocationSearchCandidate[]>>;
  setShouldRandomize: Dispatch<SetStateAction<boolean>>;
  setSelectedCandidateId: Dispatch<SetStateAction<string>>;
  /** Adds the finished draft to the location list and saves it. */
  commitGeneratedLocation: (
    draft: ProfileDraft,
    onCommitted: () => void,
  ) => Promise<void>;
};

type DraftRequest =
  | { type: typeof EXTENSION_COMMAND_TYPES.createLocationDraft; query: string }
  | {
      type: typeof EXTENSION_COMMAND_TYPES.createDraftFromCandidate;
      candidate: LocationSearchCandidate;
    };

/**
 * Shared body of the two draft requests: both toggle the in-flight flag, send a
 * command, and either surface candidates or advance the wizard.
 */
const requestLocationDraft = async (
  request: DraftRequest,
  randomizeWithinMeters: number | false,
  options: Pick<
    GeneratorOptions,
    | "setDraftPending"
    | "setSearchCandidates"
    | "setSelectedCandidateId"
    | "setPendingDraft"
    | "setGeneratorStep"
  >,
  allowCandidates: boolean,
): Promise<void> => {
  options.setDraftPending(true);

  try {
    const response = (await sendMessageOrThrow({
      ...request,
      randomizeWithinMeters,
    })) as LocationDraftResponse;

    if (!response.ok) {
      notify.error(response.error);
      return;
    }

    if ("candidates" in response) {
      if (!allowCandidates) {
        notify.error("Location selection returned more results than expected.");
        return;
      }

      options.setSearchCandidates(response.candidates);
      options.setSelectedCandidateId("");
      options.setPendingDraft(null);
      options.setGeneratorStep("result");
      return;
    }

    if (allowCandidates) {
      options.setSearchCandidates([]);
      options.setSelectedCandidateId("");
    }

    options.setPendingDraft(response.location);
    options.setGeneratorStep(
      response.location.languageSelection.required ? "language" : "confirm",
    );
  } catch {
    notify.error("Location draft generation failed.");
  } finally {
    options.setDraftPending(false);
  }
};

const getRandomRadius = (options: GeneratorOptions): number | false =>
  options.shouldRandomize ? options.radiusKm * 1000 : false;

const resetGenerator = (options: GeneratorOptions): void => {
  options.setGeneratorStep("search");
  options.setSearchQuery("");
  options.setSearchCandidates([]);
  options.setSelectedCandidateId("");
  options.setShouldRandomize(options.randomizeByDefaultRef.current);
  options.setRadiusKm(options.radiusKmRef.current);
  options.setPendingDraft(null);
};

const openOsmDialog = (
  options: GeneratorOptions,
  action: OsmConsentPromptAction,
): void => {
  options.setPendingOsmAction(action);
  options.setOsmDialogOpen(true);
};

const completeOsmConsent = async (
  options: GeneratorOptions,
  nextConsent: OsmConsentState,
): Promise<void> => {
  options.setOsmConsent(nextConsent);
  options.setOsmDialogOpen(false);
  const action = options.pendingOsmAction;
  options.setPendingOsmAction(null);
  await options.persistSettings({
    toast: nextConsent === "granted" ? "Map access enabled." : "Map access disabled.",
    osmConsent: nextConsent,
    scopes: ["simple-settings"],
  });

  if (nextConsent === "granted" && action?.type === "generator") {
    resetGenerator(options);
    options.setGeneratorOpen(true);
    return;
  }

  if (action?.type === "editor") {
    options.openProfileEditor(action.profileIndex);
  }
};

const runGenerator = async (
  options: GeneratorOptions,
  event: React.FormEvent<HTMLFormElement>,
): Promise<void> => {
  event.preventDefault();

  if (options.generatorStep !== "search") {
    return;
  }

  if (options.osmConsent !== "granted") {
    notify.warning("Allow OpenStreetMap access before generating a location.");
    return;
  }

  const query = options.searchQuery.trim();
  if (!query) {
    notify.warning("Enter a location to generate a location.");
    return;
  }

  await requestLocationDraft(
    { type: EXTENSION_COMMAND_TYPES.createLocationDraft, query },
    getRandomRadius(options),
    options,
    true,
  );
};

const selectCandidate = async (options: GeneratorOptions): Promise<void> => {
  if (options.generatorStep !== "result") {
    return;
  }

  const candidate = options.searchCandidates.find(
    (item) => item.id === options.selectedCandidateId,
  );
  if (!candidate) {
    notify.warning("Choose a search result to continue.");
    return;
  }

  await requestLocationDraft(
    { type: EXTENSION_COMMAND_TYPES.createDraftFromCandidate, candidate },
    getRandomRadius(options),
    options,
    false,
  );
};

export const createGeneratorHandlers = (options: GeneratorOptions) => {
  const closeGenerator = (): void => options.setGeneratorOpen(false);

  return {
    closeOsmDialog: (): void => {
      options.setOsmDialogOpen(false);
      options.setPendingOsmAction(null);
    },
    closeGenerator,
    denyOsmConsent: () => completeOsmConsent(options, "denied"),
    grantOsmConsent: () => completeOsmConsent(options, "granted"),
    handleOpenProfileEditor: (profileIndex: number): void => {
      if (options.osmConsent === "granted" || options.osmConsent === "denied") {
        options.openProfileEditor(profileIndex);
        return;
      }
      openOsmDialog(options, { type: "editor", profileIndex });
    },
    openGenerator: (): void => {
      if (options.osmConsent === "granted") {
        resetGenerator(options);
        options.setGeneratorOpen(true);
        return;
      }
      openOsmDialog(options, { type: "generator" });
    },
    runGenerator: (event: React.FormEvent<HTMLFormElement>) =>
      runGenerator(options, event),
    saveGenerator: async (): Promise<void> => {
      if (!options.pendingDraft) {
        return;
      }
      await options.commitGeneratedLocation(options.pendingDraft, closeGenerator);
    },
    selectCandidate: () => selectCandidate(options),
    openOsmDialog: (action: OsmConsentPromptAction): void =>
      openOsmDialog(options, action),
    resetGenerator: (): void => resetGenerator(options),
    updatePendingDraft: (mutate: (draft: ProfileDraft) => ProfileDraft): void => {
      options.setPendingDraft((current) => (current ? mutate(current) : current));
    },
  };
};
