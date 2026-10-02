import type { SettingsImportPreview } from "@/shared/settings-import";
import { t } from "@/ui/i18n";
import { RegionalProfileReview } from "@/ui/options/components/modals/RegionalProfileReview";

export const ImportRegionalReview = ({
  preview,
  disabled,
  applyTimeZone,
}: {
  preview: SettingsImportPreview;
  disabled: boolean;
  applyTimeZone?: ((id: string, timeZone: string) => void) | undefined;
}) => {
  const profiles = preview.source.locations.filter((profile) => {
    if (preview.selection.mode === "replace") return true;
    const choice = preview.selection.locations[profile.id];
    return (
      choice === "import" ||
      choice === "copy" ||
      (choice === undefined && !preview.conflicts.locations.includes(profile.id))
    );
  });
  if (profiles.length === 0) return null;
  return (
    <section className="space-y-3" data-import-regional-review>
      <h3 className="font-semibold">{t.locations.regionalReview.title}</h3>
      {profiles.map((profile) => (
        <div key={profile.id} data-regional-profile={profile.id} className="space-y-2">
          <h4 className="break-words text-sm font-medium">
            {profile.label} ({profile.id})
          </h4>
          <RegionalProfileReview
            profile={profile}
            disabled={disabled}
            applyTimeZone={
              applyTimeZone
                ? (timeZone) => applyTimeZone(profile.id, timeZone)
                : undefined
            }
          />
        </div>
      ))}
    </section>
  );
};
