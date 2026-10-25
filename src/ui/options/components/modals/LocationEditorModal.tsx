import { useEffect, useId, useRef, useState } from "react";

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

const DeleteBlockedNotice = ({
  id,
  onClose,
  usage,
}: {
  id: string;
  onClose: () => void;
  usage: PresetUsage;
}) => {
  const noticeRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    noticeRef.current?.focus();
  }, []);
  return (
    <div
      ref={noticeRef}
      id={id}
      tabIndex={-1}
      role="group"
      aria-labelledby={`${id}-message`}
      data-preset-usage=""
      data-preset-usage-count={usage.sources.length}
      className="flex flex-col gap-2 rounded-md border border-tone-warning-border bg-tone-warning-bg p-3 text-sm text-tone-warning-text outline-none"
    >
      <div className="flex items-start justify-between gap-3">
        <p id={`${id}-message`} className="min-w-0 pt-1">
          {t.locations.editor.deleteBlocked(usage.sources.length)}
        </p>
        <Button
          variant="ghost"
          size="sm"
          className="shrink-0 text-tone-warning-text hover:bg-tone-warning-border hover:text-tone-warning-text"
          data-preset-usage-close=""
          onClick={onClose}
        >
          {t.common.actions.close}
        </Button>
      </div>
      <ul
        aria-label={t.locations.editor.deleteBlockedListLabel}
        // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- the bounded list scrolls, so keyboard users must reach it
        tabIndex={0}
        data-preset-usage-list=""
        className="max-h-28 space-y-0.5 overflow-y-auto overscroll-contain outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                <span className="shrink-0">
                  {t.locations.editor.disabledDependencySuffix}
                </span>
              </>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
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
}: EditorViewProps) => {
  const noticeId = useId();
  const deleteButtonRef = useRef<HTMLButtonElement>(null);
  const [deleteBlockedOpen, setDeleteBlockedOpen] = useState(false);
  const deleteBlockedMessage = regionalPresetUsage
    ? t.locations.editor.deleteBlocked(regionalPresetUsage.sources.length)
    : undefined;
  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
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
                  if (await handleDuplicateProfile(draft))
                    setProfileDialogOpened(false);
                }}
              >
                {t.common.actions.duplicate}
              </Button>
              {/* A used preset keeps Delete focusable so activating it can explain why. */}
              <Button
                ref={deleteButtonRef}
                variant="ghost"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive aria-disabled:opacity-40"
                disabled={saveInFlight}
                aria-disabled={regionalPresetUsage ? true : undefined}
                aria-controls={regionalPresetUsage ? noticeId : undefined}
                aria-expanded={regionalPresetUsage ? deleteBlockedOpen : undefined}
                title={deleteBlockedMessage}
                data-preset-delete=""
                onClick={async () => {
                  if (regionalPresetUsage) {
                    setDeleteBlockedOpen(true);
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
      </div>
      {deleteBlockedOpen && regionalPresetUsage ? (
        <DeleteBlockedNotice
          id={noticeId}
          usage={regionalPresetUsage}
          onClose={() => {
            setDeleteBlockedOpen(false);
            deleteButtonRef.current?.focus();
          }}
        />
      ) : null}
    </div>
  );
};

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
