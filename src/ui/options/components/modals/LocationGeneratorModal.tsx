import { useEffect, useMemo, useRef } from "react";

import { cn } from "@/ui/components/lib/utils";
import { Button } from "@/ui/components/ui/button";
import { FormDialogShell } from "@/ui/components/ui/form-dialog-shell";
import { MultipleSelectListbox } from "@/ui/components/ui/multiple-select-listbox";
import { TableSearchInput } from "@/ui/components/ui/table-search-input";
import { t } from "@/ui/i18n";
import { RandomizationControl } from "@/ui/options/components/CoordinateRandomizationControl";
import { LazyProfileDraftMap } from "@/ui/options/components/map/LazyProfileDraftMap";
import { LocationDetailsFields } from "@/ui/options/components/modals/LocationDetailsFields";
import { useSettings } from "@/ui/options/state/SettingsContext";
import type { ProfileGeneratorStep } from "@/ui/options/utils";

const getGeneratorDescription = (step: ProfileGeneratorStep): string => {
  switch (step) {
    case "search":
      return t.locations.generator.searchStepDescription;
    case "result":
      return t.locations.generator.resultStepDescription;
    case "language":
      return t.locations.generator.languageStepDescription;
    case "confirm":
      return t.locations.generator.confirmStepDescription;
  }
};

const getGeneratorClassName = (step: ProfileGeneratorStep): string => {
  switch (step) {
    case "search":
      return "sm:max-w-xl";
    case "result":
    case "language":
      return "sm:max-w-2xl";
    case "confirm":
      return "sm:max-w-4xl";
  }
};

const getGeneratorBackStep = ({
  step,
  hasResultStep,
  languageRequired,
}: {
  step: ProfileGeneratorStep;
  hasResultStep: boolean;
  languageRequired: boolean;
}): ProfileGeneratorStep => {
  if (step === "confirm" && languageRequired) {
    return "language";
  }

  if ((step === "confirm" || step === "language") && hasResultStep) {
    return "result";
  }

  return "search";
};

const GeneratorFooter = () => {
  const {
    closeGenerator,
    generatorStep,
    setGeneratorStep,
    searchCandidates = [],
    selectedCandidateId = "",
    pendingDraft,
    isDraftPending,
    saveInFlight,
    selectCandidate = async () => undefined,
    saveGenerator,
  } = useSettings();
  const busy = isDraftPending || saveInFlight;
  const languageReady =
    (pendingDraft?.languageSelection.selectedValue ?? "").length > 0;
  return (
    <div
      data-testid="profile-generator-footer"
      className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex items-center gap-2">
        {generatorStep === "search" ? (
          <Button
            id="close-profile-generator-dialog"
            type="button"
            variant="ghost"
            disabled={busy}
            onClick={closeGenerator}
          >
            {t.common.actions.cancel}
          </Button>
        ) : (
          <Button
            id="profile-generator-back"
            type="button"
            variant="ghost"
            disabled={busy}
            onClick={() =>
              setGeneratorStep(
                getGeneratorBackStep({
                  step: generatorStep,
                  hasResultStep: searchCandidates.length > 1,
                  languageRequired: pendingDraft?.languageSelection.required === true,
                }),
              )
            }
          >
            <span className="fa-solid fa-arrow-left" aria-hidden="true" />
            {t.common.actions.back}
          </Button>
        )}
      </div>
      <div className="flex items-center justify-end gap-2">
        <Button
          id="run-profile-generator"
          type="submit"
          hidden={generatorStep !== "search"}
          disabled={busy}
        >
          {isDraftPending ? t.common.actions.search + "…" : t.common.actions.search}
        </Button>
        <Button
          id="continue-profile-generator-result"
          type="button"
          hidden={generatorStep !== "result"}
          disabled={!selectedCandidateId || busy}
          onClick={() => void selectCandidate()}
        >
          {t.common.actions.continue}
        </Button>
        <Button
          id="continue-profile-generator-language"
          type="button"
          hidden={generatorStep !== "language"}
          disabled={!pendingDraft || busy || !languageReady}
          onClick={() => setGeneratorStep("confirm")}
        >
          {t.common.actions.continue}
        </Button>
        <Button
          id="save-profile-generator"
          type="button"
          hidden={generatorStep !== "confirm"}
          disabled={!pendingDraft || busy}
          onClick={() => void saveGenerator()}
        >
          {t.common.actions.create}
        </Button>
      </div>
    </div>
  );
};

const GeneratorSearchStep = () => {
  const {
    generatorStep,
    searchQuery,
    setSearchQuery,
    shouldRandomize = true,
    setShouldRandomize = () => undefined,
    radiusKm = 10,
    setRadiusKm = () => undefined,
    isDraftPending,
    saveInFlight,
  } = useSettings();
  const busy = isDraftPending || saveInFlight;
  return (
    <div id="profile-generator-search-step" hidden={generatorStep !== "search"}>
      <div className="flex flex-col gap-4">
        <label htmlFor="profile-draft-query" className="sr-only">
          {t.locations.generator.locationLabel}
        </label>
        <TableSearchInput
          id="profile-draft-query"
          name="profileDraftQuery"
          // eslint-disable-next-line jsx-a11y/no-autofocus -- intentional first-field focus when generator dialog opens
          autoFocus
          placeholder={t.locations.generator.locationPlaceholder}
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.currentTarget.value)}
          disabled={busy}
        />
        <p className="text-xs leading-relaxed text-muted-foreground">
          {t.locations.generator.osmDisclaimer}
        </p>
        <RandomizationControl
          id="profile-generator-randomize"
          checked={shouldRandomize}
          radiusKm={radiusKm}
          disabled={busy}
          compact
          onCheckedChange={setShouldRandomize}
          onRadiusKmChange={setRadiusKm}
        />
      </div>
    </div>
  );
};

const GeneratorResultStep = () => {
  const {
    generatorStep,
    searchCandidates = [],
    selectedCandidateId = "",
    setSelectedCandidateId = () => undefined,
    isDraftPending,
    saveInFlight,
  } = useSettings();
  const options = useMemo(
    () =>
      searchCandidates.map((candidate) => ({
        value: candidate.id,
        label: `${candidate.label} - ${candidate.description}`,
      })),
    [searchCandidates],
  );
  const selected = searchCandidates.find((item) => item.id === selectedCandidateId);
  return (
    <div id="profile-generator-result-step" hidden={generatorStep !== "result"}>
      <div className="flex flex-col gap-4">
        <p className="text-sm leading-relaxed text-muted-foreground">
          {t.locations.generator.resultStepBody}
        </p>
        <span id="profile-generator-result-label" className="sr-only">
          {t.locations.generator.resultSelectLabel}
        </span>
        <MultipleSelectListbox
          id="profile-generator-result-select"
          value={selectedCandidateId}
          disabled={isDraftPending || saveInFlight}
          aria-labelledby="profile-generator-result-label"
          className="w-full"
          options={options}
          onValueChange={setSelectedCandidateId}
        />
        <p className="text-xs leading-relaxed text-muted-foreground">
          {selected
            ? `${t.locations.generator.resultPrefix}${selected.sourceLabel}`
            : t.locations.generator.resultStepHint}
        </p>
      </div>
    </div>
  );
};

const GeneratorLanguageStep = () => {
  const {
    generatorStep,
    pendingDraft,
    updatePendingDraft,
    isDraftPending,
    saveInFlight,
  } = useSettings();
  if (!pendingDraft) return <div id="profile-generator-language-step" hidden />;
  const selection = pendingDraft.languageSelection;
  return (
    <div id="profile-generator-language-step" hidden={generatorStep !== "language"}>
      <div className="flex flex-col gap-4">
        <p className="text-sm leading-relaxed text-muted-foreground">
          {t.locations.generator.languageStepBody}
        </p>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {t.locations.generator.languageStepHint}
        </p>
        <span id="profile-generator-language-label" className="sr-only">
          {t.locations.generator.languageSelectLabel}
        </span>
        <MultipleSelectListbox
          id="profile-generator-language-select"
          value={selection.selectedValue}
          disabled={isDraftPending || saveInFlight}
          aria-labelledby="profile-generator-language-label"
          className="w-full"
          options={selection.options}
          onValueChange={(value) =>
            updatePendingDraft((current) => {
              const option = current.languageSelection.options.find(
                (item) => item.value === value,
              );
              return option
                ? {
                    ...current,
                    language: option.language,
                    languages: [...option.languages],
                    languageSelection: {
                      ...current.languageSelection,
                      selectedValue: option.value,
                    },
                  }
                : current;
            })
          }
        />
        <p className="text-xs leading-relaxed text-muted-foreground">{`${t.locations.generator.resultPrefix}${pendingDraft.sourceLabel}`}</p>
      </div>
    </div>
  );
};

const GeneratorConfirmStep = ({
  nameInputRef,
}: {
  nameInputRef: React.RefObject<HTMLInputElement | null>;
}) => {
  const {
    generatorStep,
    pendingDraft,
    updatePendingDraft,
    defaultNoiseRadius,
    isGeneratorOpen,
    isDraftPending,
    saveInFlight,
  } = useSettings();
  return (
    <div id="profile-generator-confirm-step" hidden={generatorStep !== "confirm"}>
      <div className="gw-generator-layout">
        <LazyProfileDraftMap
          draft={pendingDraft}
          opened={isGeneratorOpen && generatorStep === "confirm"}
          loadWhen={isGeneratorOpen && generatorStep === "confirm"}
          rangeRadius={pendingDraft?.noiseRadius ?? defaultNoiseRadius}
          accuracyRadius={pendingDraft?.accuracy ?? 0}
          onMove={(latitude, longitude) =>
            updatePendingDraft((draft) => ({ ...draft, latitude, longitude }))
          }
        />
        <div className="flex flex-col gap-4">
          <div>
            <p
              id="profile-generator-source"
              className="mb-4 text-sm text-muted-foreground"
            >
              {pendingDraft
                ? `${t.locations.generator.resultPrefix}${pendingDraft.sourceLabel}`
                : ""}
            </p>
          </div>
          {pendingDraft ? (
            <LocationDetailsFields
              draft={pendingDraft}
              onDraftChange={updatePendingDraft}
              disabled={isDraftPending || saveInFlight}
              nameInputId="profile-generator-name"
              nameInputRef={nameInputRef}
              sectionsCollapsible={false}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
};

export const LocationGeneratorModal = () => {
  const {
    isGeneratorOpen,
    closeGenerator,
    generatorStep,
    isDraftPending,
    saveInFlight,
    runGenerator,
  } = useSettings();
  const generatorBusy = isDraftPending || saveInFlight;
  const nameInputRef = useRef<HTMLInputElement>(null);
  const description = getGeneratorDescription(generatorStep);
  const contentClassName = getGeneratorClassName(generatorStep);

  useEffect(() => {
    if (!isGeneratorOpen || generatorStep !== "confirm") {
      return;
    }

    const frame = requestAnimationFrame(() => {
      nameInputRef.current?.focus();
      nameInputRef.current?.select();
    });

    return () => cancelAnimationFrame(frame);
  }, [isGeneratorOpen, generatorStep]);

  return (
    <FormDialogShell
      open={isGeneratorOpen}
      onOpenChange={(open) => {
        if (!open) {
          closeGenerator();
        }
      }}
      id="profile-generator-dialog"
      title={t.locations.generator.title}
      description={description}
      closeLabel={t.common.actions.close}
      busy={generatorBusy}
      preventCloseWhenBusy
      contentClassName={cn(contentClassName)}
      scrollableBody
      formProps={{
        id: "profile-generator-form",
        onSubmit: runGenerator,
      }}
      footer={<GeneratorFooter />}
    >
      <div className="flex flex-col gap-4">
        <GeneratorSearchStep />
        <GeneratorResultStep />
        <GeneratorLanguageStep />
        <GeneratorConfirmStep nameInputRef={nameInputRef} />
      </div>
    </FormDialogShell>
  );
};
