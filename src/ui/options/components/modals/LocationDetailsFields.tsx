import type { RefObject } from "react";

import {
  getEnglishLocale,
  canPreferEnglish,
  normalizeLocationLocales,
  normalizeLocaleConfig,
} from "@/shared/locale-catalog";
import { cn } from "@/ui/components/lib/utils";
import { Checkbox } from "@/ui/components/ui/checkbox";
import { Combobox } from "@/ui/components/ui/combobox";
import { FieldLabel } from "@/ui/components/ui/field-label";
import { FormSection } from "@/ui/components/ui/form-section";
import { Input } from "@/ui/components/ui/input";
import { Label } from "@/ui/components/ui/label";
import { NumberInput } from "@/ui/components/ui/number-input";
import { TagsInput } from "@/ui/components/ui/tags-input";
import { t } from "@/ui/i18n";
import { commonLocales } from "@/ui/options/locales";
import { toFiniteNumber } from "@/ui/options/utils";

const timezoneOptions = Intl.supportedValuesOf("timeZone").map((tz) => ({
  value: tz,
  label: tz.replace(/_/g, " "),
}));

type LocationFieldsDraft = {
  label: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  noiseRadius: number;
  language: string;
  languages: string[];
  preferEnglishContent?: boolean;
  timeZone: string;
};

type LocationFieldsProps<TDraft extends LocationFieldsDraft> = {
  draft: TDraft;
  onDraftChange: (mutate: (current: TDraft) => TDraft) => void;
  disabled: boolean;
  nameInputId?: string;
  nameInputRef?: RefObject<HTMLInputElement | null>;
  autoFocusName?: boolean;
  sectionsCollapsible?: boolean;
  activeSection?: LocationDetailsSectionId | "advanced" | null;
  onSectionOpenChange?: (section: LocationDetailsSectionId | null) => void;
};

export type LocationDetailsSectionId = "geolocation" | "locale";

const NameField = <TDraft extends LocationFieldsDraft>({
  draft,
  onDraftChange,
  disabled,
  nameInputId,
  nameInputRef,
  autoFocusName = false,
}: LocationFieldsProps<TDraft>) => (
  <div>
    <FieldLabel htmlFor={nameInputId}>{t.common.fields.name}</FieldLabel>
    <Input
      ref={nameInputRef}
      id={nameInputId}
      value={draft.label}
      // eslint-disable-next-line jsx-a11y/no-autofocus -- intentional first-field focus when dialog opens
      autoFocus={autoFocusName}
      disabled={disabled}
      onChange={(event) => {
        const value = event.currentTarget.value;
        onDraftChange((current) => ({ ...current, label: value }));
      }}
    />
  </div>
);

const GeolocationFields = <TDraft extends LocationFieldsDraft>({
  draft,
  onDraftChange,
  disabled,
  sectionsCollapsible = true,
  activeSection,
  onSectionOpenChange,
}: LocationFieldsProps<TDraft>) => {
  const numberField =
    (field: "latitude" | "longitude" | "accuracy" | "noiseRadius") =>
    (next: number | string) => {
      const finite = toFiniteNumber(next);
      if (finite !== null) {
        onDraftChange((current) => ({ ...current, [field]: finite }));
      }
    };
  return (
    <FormSection
      title={t.locations.editor.geolocationSectionTitle}
      description={t.locations.editor.geolocationSectionDescription}
      collapsible={sectionsCollapsible}
      variant="plain"
      showCollapsedStateLabel={false}
      titleClassName="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground"
      activeTitleClassName="text-primary"
      {...(activeSection !== undefined
        ? {
            open: activeSection === "geolocation",
            onOpenChange: (open: boolean) =>
              onSectionOpenChange?.(open ? "geolocation" : null),
          }
        : {})}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <FieldLabel>{t.common.fields.latitude}</FieldLabel>
          <NumberInput
            value={draft.latitude}
            decimalScale={6}
            min={-90}
            max={90}
            step={0.000001}
            stepper
            onChange={numberField("latitude")}
            disabled={disabled}
          />
        </div>
        <div>
          <FieldLabel>{t.common.fields.longitude}</FieldLabel>
          <NumberInput
            value={draft.longitude}
            decimalScale={6}
            min={-180}
            max={180}
            step={0.000001}
            stepper
            onChange={numberField("longitude")}
            disabled={disabled}
          />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <FieldLabel
            info={t.locations.editor.accuracyDescription}
            infoLabel="What accuracy means"
          >
            {t.common.fields.accuracy}
          </FieldLabel>
          <NumberInput
            value={draft.accuracy}
            min={0}
            max={10_000}
            step={5}
            stepper
            onChange={numberField("accuracy")}
            disabled={disabled}
          />
        </div>
        <div>
          <FieldLabel
            info={t.locations.editor.noiseRadiusDescription}
            infoLabel="What max coordinate radius means"
          >
            {t.common.fields.noiseRadius}
          </FieldLabel>
          <NumberInput
            value={draft.noiseRadius}
            min={0}
            max={500}
            step={10}
            stepper
            onChange={numberField("noiseRadius")}
            disabled={disabled}
          />
        </div>
      </div>
    </FormSection>
  );
};

const EnglishPreference = <TDraft extends LocationFieldsDraft>({
  draft,
  disabled,
  id,
  update,
}: {
  draft: TDraft;
  disabled: boolean;
  id: string;
  update: (mutate: (current: TDraft) => TDraft) => void;
}) => {
  const englishLocale = getEnglishLocale();
  const enabled = canPreferEnglish(draft);
  return (
    <div
      className={cn(
        "mb-3 rounded-lg border border-border/70 bg-muted/20 px-3 py-3 transition-opacity",
        !enabled && "opacity-60",
      )}
    >
      <div className="flex items-start gap-3">
        <span className="flex h-5 items-center">
          <Checkbox
            id={id}
            checked={draft.preferEnglishContent === true}
            onChange={(event) => {
              const checked = event.currentTarget.checked;
              update((current) => ({ ...current, preferEnglishContent: checked }));
            }}
            disabled={disabled || !enabled}
          />
        </span>
        <div className="space-y-1">
          <Label
            htmlFor={id}
            className={cn(
              "text-sm font-medium",
              enabled && !disabled ? "cursor-pointer" : "cursor-default",
            )}
          >
            {t.locations.editor.preferEnglishContentLabel}
          </Label>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {t.locations.editor.preferEnglishContentDescriptionPrefix}{" "}
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.72rem] text-foreground">
              {englishLocale}
            </code>{" "}
            {t.locations.editor.preferEnglishContentDescriptionSuffix}
          </p>
        </div>
      </div>
    </div>
  );
};

const TimeZoneField = <TDraft extends LocationFieldsDraft>({
  draft,
  disabled,
  onDraftChange,
}: LocationFieldsProps<TDraft>) => (
  <div>
    <FieldLabel id="location-timezone-label">{t.common.fields.timeZone}</FieldLabel>
    <Combobox
      options={timezoneOptions}
      value={draft.timeZone}
      aria-labelledby="location-timezone-label"
      onValueChange={(value) => {
        if (value) onDraftChange((current) => ({ ...current, timeZone: value }));
      }}
      searchPlaceholder={t.common.fields.timeZone}
      disabled={disabled}
    />
  </div>
);

const LocaleFields = <TDraft extends LocationFieldsDraft>(
  props: LocationFieldsProps<TDraft>,
) => {
  const {
    draft,
    onDraftChange,
    disabled,
    nameInputId,
    sectionsCollapsible = true,
    activeSection,
    onSectionOpenChange,
  } = props;
  const options = commonLocales.some((entry) => entry.value === draft.language)
    ? [...commonLocales]
    : [{ value: draft.language, label: draft.language }, ...commonLocales];
  const englishLocale = getEnglishLocale();
  const locked = draft.preferEnglishContent === true && canPreferEnglish(draft);
  const preferenceId = nameInputId
    ? `${nameInputId}-prefer-english-content`
    : "location-prefer-english-content";
  const update = (mutate: (current: TDraft) => TDraft) =>
    onDraftChange((current) => normalizeLocationLocales(mutate(current)));
  return (
    <FormSection
      title={t.locations.editor.localeSectionTitle}
      description={t.locations.editor.localeSectionDescription}
      collapsible={sectionsCollapsible}
      variant="plain"
      showCollapsedStateLabel={false}
      titleClassName="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground"
      activeTitleClassName="text-primary"
      {...(activeSection !== undefined
        ? {
            open: activeSection === "locale",
            onOpenChange: (open: boolean) =>
              onSectionOpenChange?.(open ? "locale" : null),
          }
        : {})}
    >
      <div>
        <FieldLabel
          id="location-primary-locale-label"
          info={
            <>
              <p>{t.locations.editor.languageDescription}</p>
              <p>{t.locations.editor.languageBehaviorDescription}</p>
            </>
          }
          infoLabel="What primary locale means"
        >
          {t.locations.editor.primaryLocaleLabel}
        </FieldLabel>
        <Combobox
          options={options}
          value={draft.language}
          aria-labelledby="location-primary-locale-label"
          onValueChange={(value) => {
            if (value) {
              update((current) => ({
                ...current,
                ...normalizeLocaleConfig({
                  language: value,
                  languages: current.languages,
                }),
              }));
            }
          }}
          searchPlaceholder={t.locations.editor.primaryLocaleLabel}
          disabled={disabled}
        />
      </div>
      <div>
        <EnglishPreference
          draft={draft}
          disabled={disabled}
          id={preferenceId}
          update={update}
        />
        <FieldLabel
          info={
            <>
              <p>{t.locations.editor.languagesDescription}</p>
              <p>{t.locations.editor.languagesBehaviorDescription}</p>
            </>
          }
          infoLabel="What preferred languages means"
        >
          {t.locations.editor.preferredLanguagesLabel}
        </FieldLabel>
        <TagsInput
          value={draft.languages}
          prefixTags={[
            {
              value: englishLocale,
              tone: "accent",
              title:
                t.locations.editor.preferEnglishContentLockedTagTitle(englishLocale),
              visible: locked,
              animated: true,
            },
          ]}
          onChange={(value) =>
            update((current) => ({
              ...current,
              ...normalizeLocaleConfig({
                language: current.language,
                languages: value,
              }),
            }))
          }
          disabled={disabled}
        />
      </div>
      <TimeZoneField {...props} />
    </FormSection>
  );
};

export function LocationDetailsFields<TDraft extends LocationFieldsDraft>(
  props: LocationFieldsProps<TDraft>,
) {
  return (
    <div className="flex flex-col gap-4">
      <NameField {...props} />
      <GeolocationFields {...props} />
      <LocaleFields {...props} />
    </div>
  );
}
