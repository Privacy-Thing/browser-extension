import { useState } from "react";

import { getProfileTimeZoneError } from "@/shared/time-zone-validation";
import type { Location } from "@/shared/types";
import { Button } from "@/ui/components/ui/button";
import { FormDialogShell } from "@/ui/components/ui/form-dialog-shell";
import { t } from "@/ui/i18n";
import { LazyProfileDraftMap } from "@/ui/options/components/map/LazyProfileDraftMap";
import {
  LocationDetailsFields,
  type LocationDetailsSectionId,
} from "@/ui/options/components/modals/LocationDetailsFields";
import type { PresetUsage } from "@/ui/options/location-usage";
import { getLocationModalAnchor } from "@/ui/options/navigation";
import { useSettings } from "@/ui/options/state/SettingsContext";
import type { ConfirmDialogConfig } from "@/ui/options/state/use-settings-confirm-dialog";

type LocationEditorSectionId = LocationDetailsSectionId;

type EditorSessionProps = {
  profile: Location;
  editingProfileIndex: number | null;
  profileDialogOpened: boolean;
  setProfileDialogOpened: (opened: boolean) => void;
  saveInFlight: boolean;
  handleDuplicateProfile: (profile: Location) => Promise<boolean>;
  handleRemoveProfile: (profile: Location, index: number) => Promise<boolean>;
  handlePersistProfile: (index: number | null, profile: Location) => Promise<boolean>;
  osmConsent: "unknown" | "granted" | "denied";
  openOsmDialog: (action: { type: "editor"; profileIndex: number }) => void;
  regionalPresetUsage?: PresetUsage | undefined;
  requestConfirmation: (config: ConfirmDialogConfig) => Promise<boolean>;
};

type EditorViewProps = EditorSessionProps & {
  draft: Location;
  updateDraft: (mutate: (current: Location) => Location) => void;
};

const PresetUsageList = ({ usage }: { usage: PresetUsage }) => (
  <ul
    aria-label={t.locations.editor.deleteBlockedListLabel}
    // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- the bounded list scrolls, so keyboard users must reach it
    tabIndex={0}
    data-preset-usage=""
    data-preset-usage-count={usage.sources.length}
    className="max-h-40 space-y-1 overflow-y-auto overscroll-contain rounded-md border border-border p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
  >
    {usage.sources.map((source) => (
      <li
        key={`${source.kind}:${source.key}`}
        data-preset-usage-source={source.kind}
        className="flex min-w-0 gap-1"
      >
        <span className="truncate" title={source.label}>
          {source.label}
        </span>
        {!source.enabled ? (
          <>
            {" "}
            <span className="shrink-0 text-muted-foreground">
              {t.locations.editor.disabledDependencySuffix}
            </span>
          </>
        ) : null}
      </li>
    ))}
  </ul>
);

const showDeleteBlocked = (
  usage: PresetUsage,
  requestConfirmation: EditorSessionProps["requestConfirmation"],
) =>
  requestConfirmation({
    kind: "alert",
    title: t.locations.editor.deleteBlockedTitle,
    description: t.locations.editor.deleteBlocked(usage.sources.length),
    details: <PresetUsageList usage={usage} />,
    confirmLabel: t.common.actions.close,
  });

const EditorFooter = ({
  draft,
  editingProfileIndex,
  handleDuplicateProfile,
  handlePersistProfile,
  handleRemoveProfile,
  profile,
  regionalPresetUsage,
  requestConfirmation,
  saveInFlight,
  setProfileDialogOpened,
}: EditorViewProps) => (
  <>
    <div className="flex items-center gap-2">
      <Button
        variant="ghost"
        disabled={saveInFlight}
        onClick={() => setProfileDialogOpened(false)}
      >
        {t.common.actions.cancel}
      </Button>
      {editingProfileIndex !== null ? (
        <>
          <Button
            variant="ghost"
            disabled={saveInFlight || getProfileTimeZoneError(draft) !== null}
            onClick={async () => {
              if (await handleDuplicateProfile(draft)) setProfileDialogOpened(false);
            }}
          >
            {t.common.actions.duplicate}
          </Button>
          {/* A used preset keeps Delete focusable so activating it can explain why. */}
          <Button
            variant="ghost"
            className="text-destructive hover:bg-destructive/10 hover:text-destructive aria-disabled:opacity-40"
            disabled={saveInFlight}
            aria-disabled={regionalPresetUsage ? true : undefined}
            aria-haspopup={regionalPresetUsage ? "dialog" : undefined}
            title={
              regionalPresetUsage
                ? t.locations.editor.deleteBlocked(regionalPresetUsage.sources.length)
                : undefined
            }
            data-preset-delete=""
            onClick={async () => {
              if (regionalPresetUsage) {
                await showDeleteBlocked(regionalPresetUsage, requestConfirmation);
                return;
              }
              if (await handleRemoveProfile(profile, editingProfileIndex)) {
                setProfileDialogOpened(false);
              }
            }}
          >
            {t.common.actions.delete}
          </Button>
        </>
      ) : null}
    </div>
    <Button
      disabled={saveInFlight || getProfileTimeZoneError(draft) !== null}
      onClick={async () => {
        if (await handlePersistProfile(editingProfileIndex, draft)) {
          setProfileDialogOpened(false);
        }
      }}
    >
      {t.common.actions.save}
    </Button>
  </>
);

const EditorBody = ({
  draft,
  editingProfileIndex,
  openOsmDialog,
  osmConsent,
  profile,
  profileDialogOpened,
  saveInFlight,
  updateDraft,
}: EditorViewProps) => {
  const [activeSection, setActiveSection] = useState<LocationEditorSectionId | null>(
    getProfileTimeZoneError(draft) ? "locale" : "geolocation",
  );
  return (
    <div
      id={editingProfileIndex !== null ? getLocationModalAnchor(profile.id) : undefined}
      data-anchor-id={
        editingProfileIndex !== null ? getLocationModalAnchor(profile.id) : undefined
      }
      className="gw-anchor-target"
    >
      {getProfileTimeZoneError(draft) ? (
        <p
          role="alert"
          data-field-error="timeZone"
          className="mb-4 text-sm text-destructive"
        >
          {getProfileTimeZoneError(draft)}
        </p>
      ) : null}
      <div className="gw-generator-layout">
        <LazyProfileDraftMap
          draft={draft}
          opened={profileDialogOpened}
          loadWhen={profileDialogOpened && osmConsent === "granted"}
          rangeRadius={draft.noiseRadius ?? 50}
          accuracyRadius={draft.accuracy ?? 0}
          enabled={osmConsent === "granted"}
          placeholder={
            <div className="flex h-full flex-col items-center justify-center gap-3 p-4 text-center">
              <h4 className="text-sm font-semibold">
                {t.locations.editor.mapDisabledTitle}
              </h4>
              <p className="max-w-[300px] text-sm text-muted-foreground">
                {t.locations.editor.mapDisabledBody}
              </p>
              <Button
                variant="secondary"
                onClick={() => {
                  if (editingProfileIndex !== null) {
                    openOsmDialog({
                      type: "editor",
                      profileIndex: editingProfileIndex,
                    });
                  }
                }}
              >
                {t.common.actions.allowOpenStreetMap}
              </Button>
            </div>
          }
          onMove={(latitude, longitude) =>
            updateDraft((current) => ({ ...current, latitude, longitude }))
          }
        />
        <div className="flex flex-col gap-4">
          <LocationDetailsFields
            draft={draft}
            onDraftChange={updateDraft}
            disabled={saveInFlight}
            autoFocusName
            sectionsCollapsible
            activeSection={activeSection}
            onSectionOpenChange={setActiveSection}
          />
        </div>
      </div>
    </div>
  );
};

const LocationEditorSession = (props: EditorSessionProps) => {
  const { profile, profileDialogOpened, setProfileDialogOpened, saveInFlight } = props;
  const [draft, setDraft] = useState<Location>(profile);
  const updateDraft = (mutate: (current: Location) => Location) => {
    setDraft(mutate);
  };
  const viewProps: EditorViewProps = { ...props, draft, updateDraft };

  return (
    <FormDialogShell
      open={profileDialogOpened}
      onOpenChange={(open) => {
        if (!open) {
          setProfileDialogOpened(false);
        }
      }}
      id="profile-dialog"
      title={t.locations.editor.title}
      description={t.locations.editor.description}
      closeLabel={t.common.actions.close}
      busy={saveInFlight}
      preventCloseWhenBusy
      contentClassName="sm:max-w-4xl"
      scrollableBody
      footerClassName="sm:justify-between"
      footer={<EditorFooter {...viewProps} />}
    >
      <EditorBody {...viewProps} />
    </FormDialogShell>
  );
};

export const LocationEditorModal = () => {
  const {
    profiles,
    editingProfileIndex,
    pendingEditorDraft,
    profileDialogOpened,
    profileEditorSessionId,
    setProfileDialogOpened,
    saveInFlight,
    handleDuplicateProfile,
    handleRemoveProfile,
    handlePersistProfile,
    osmConsent,
    openOsmDialog,
    regionalPresetUsage,
    requestConfirmation,
  } = useSettings();

  const profile =
    editingProfileIndex !== null
      ? profiles[editingProfileIndex]
      : (pendingEditorDraft ?? undefined);
  return profile ? (
    <LocationEditorSession
      key={profileEditorSessionId}
      profile={profile}
      editingProfileIndex={editingProfileIndex}
      profileDialogOpened={profileDialogOpened}
      setProfileDialogOpened={setProfileDialogOpened}
      saveInFlight={saveInFlight}
      handleDuplicateProfile={handleDuplicateProfile}
      handleRemoveProfile={handleRemoveProfile}
      handlePersistProfile={handlePersistProfile}
      osmConsent={osmConsent}
      openOsmDialog={openOsmDialog}
      requestConfirmation={requestConfirmation}
      regionalPresetUsage={
        editingProfileIndex !== null ? regionalPresetUsage?.get(profile.id) : undefined
      }
    />
  ) : null;
};
