import { useState } from "react";

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
};

type EditorViewProps = EditorSessionProps & {
  draft: Location;
  updateDraft: (mutate: (current: Location) => Location) => void;
};

const EditorFooter = ({
  draft,
  editingProfileIndex,
  handleDuplicateProfile,
  handlePersistProfile,
  handleRemoveProfile,
  profile,
  regionalPresetUsage,
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
            disabled={saveInFlight}
            onClick={async () => {
              if (await handleDuplicateProfile(draft)) setProfileDialogOpened(false);
            }}
          >
            {t.common.actions.duplicate}
          </Button>
          <Button
            variant="ghost"
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            disabled={saveInFlight || Boolean(regionalPresetUsage)}
            title={
              regionalPresetUsage
                ? t.locations.editor.deleteBlockedButtonTitle
                : undefined
            }
            onClick={async () => {
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
      disabled={saveInFlight}
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

const PresetUsageNotice = ({ usage }: { usage: PresetUsage }) => (
  <div
    className="mb-4 rounded-md border border-tone-warning-border bg-tone-warning-bg p-3 text-sm text-tone-warning-text"
    role="status"
  >
    <h4 className="font-semibold">{t.locations.editor.deleteBlockedTitle}</h4>
    <p className="mt-1">{t.locations.editor.deleteBlockedDescription}</p>
    <ul className="mt-2 list-disc space-y-1 pl-5">
      {usage.sources.map((source) => (
        <li key={`${source.kind}:${source.key}`}>
          {source.label}
          {!source.enabled ? ` ${t.locations.editor.disabledDependencySuffix}` : null}
        </li>
      ))}
    </ul>
  </div>
);

const EditorBody = ({
  draft,
  editingProfileIndex,
  openOsmDialog,
  osmConsent,
  profile,
  profileDialogOpened,
  regionalPresetUsage,
  saveInFlight,
  updateDraft,
}: EditorViewProps) => {
  const [activeSection, setActiveSection] = useState<LocationEditorSectionId | null>(
    "geolocation",
  );
  return (
    <div
      id={editingProfileIndex !== null ? getLocationModalAnchor(profile.id) : undefined}
      data-anchor-id={
        editingProfileIndex !== null ? getLocationModalAnchor(profile.id) : undefined
      }
      className="gw-anchor-target"
    >
      {regionalPresetUsage ? <PresetUsageNotice usage={regionalPresetUsage} /> : null}
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
      regionalPresetUsage={
        editingProfileIndex !== null ? regionalPresetUsage?.get(profile.id) : undefined
      }
    />
  ) : null;
};
