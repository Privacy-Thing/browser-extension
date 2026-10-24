import { useId } from "react";

import { t } from "@/ui/i18n";
import { TimeZoneCombobox } from "@/ui/options/components/TimeZoneCombobox";
import type { ImportTimeZoneCorrection } from "@/ui/options/state/import-time-zones";

const CorrectionRow = ({
  correction,
  disabled,
  applyTimeZone,
}: {
  correction: ImportTimeZoneCorrection;
  disabled: boolean;
  applyTimeZone: (id: string, timeZone: string) => void;
}) => {
  const labelId = useId();
  const rejectedId = useId();
  return (
    <div
      data-import-time-zone-correction={correction.id}
      data-import-time-zone-state={correction.timeZone ? "chosen" : "missing"}
      data-import-rejected-time-zone={correction.rejectedTimeZone}
      className="flex flex-col gap-2 rounded-md border border-border p-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="min-w-0 text-sm">
        <p id={labelId} className="break-words font-medium">
          {correction.label} ({correction.id})
        </p>
        <p id={rejectedId} className="break-words text-muted-foreground">
          {t.settingsImport.timeZoneRejected(correction.rejectedTimeZone || "—")}
        </p>
      </div>
      <div className="w-full sm:w-64 sm:shrink-0">
        <TimeZoneCombobox
          value={correction.timeZone ?? ""}
          aria-labelledby={`${labelId} ${rejectedId}`}
          placeholder={t.settingsImport.timeZoneChoose}
          disabled={disabled}
          onValueChange={(timeZone) => applyTimeZone(correction.id, timeZone)}
        />
      </div>
    </div>
  );
};

/** One picker per preset whose time zone the import preview rejected. */
export const ImportZoneCorrections = ({
  corrections,
  disabled,
  applyTimeZone,
}: {
  corrections: ImportTimeZoneCorrection[];
  disabled: boolean;
  applyTimeZone: (id: string, timeZone: string) => void;
}) => {
  if (corrections.length === 0) return null;
  const missing = corrections.filter((item) => item.timeZone === null).length;
  return (
    <section
      className="space-y-3"
      data-import-time-zone-corrections
      data-import-time-zone-missing={missing}
    >
      <h3 className="font-semibold">{t.settingsImport.timeZoneTitle}</h3>
      <p className="text-sm text-muted-foreground">{t.settingsImport.timeZoneHelp}</p>
      {corrections.map((correction) => (
        <CorrectionRow
          key={correction.id}
          correction={correction}
          disabled={disabled}
          applyTimeZone={applyTimeZone}
        />
      ))}
    </section>
  );
};
