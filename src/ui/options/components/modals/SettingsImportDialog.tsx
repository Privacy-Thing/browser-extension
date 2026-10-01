import type {
  SettingsImportPreview,
  SettingsImportSelection,
  SettingsImportChange,
} from "@/shared/settings-import";
import { Button } from "@/ui/components/ui/button";
import {
  Dialog,
  DialogCloseButton,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/ui/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/components/ui/select";
import { t } from "@/ui/i18n";
import { useSettings } from "@/ui/options/state/SettingsContext";

export type ImportDialogProps = {
  preview: SettingsImportPreview | null;
  busy: boolean;
  error: string | null;
  saveInFlight: boolean;
  cancel: () => void;
  confirm: () => void;
  update: (selection: SettingsImportSelection) => void;
};

const collectionLabels = () => ({
  locations: t.settingsImport.locations,
  rules: t.settingsImport.rules,
  trustedSites: t.settingsImport.trustedSites,
  settings: t.settingsImport.settings,
  containerAssignments: t.settingsImport.containerAssignments,
});
const changeLabels = () => ({
  added: t.settingsImport.added,
  changed: t.settingsImport.changed,
  removed: t.settingsImport.removed,
});

const ChoiceSelect = (props: {
  label: string;
  value: string;
  choices: Array<{ value: string; label: string }>;
  disabled: boolean;
  change: (value: string) => void;
}) => (
  <Select value={props.value} onValueChange={props.change} disabled={props.disabled}>
    <SelectTrigger aria-label={props.label} className="w-full sm:w-56">
      <SelectValue placeholder={t.settingsImport.choose} />
    </SelectTrigger>
    <SelectContent>
      {props.choices.map((choice) => (
        <SelectItem key={choice.value} value={choice.value}>
          {choice.label}
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
);

const MergeCollection = (props: {
  preview: SettingsImportPreview;
  busy: boolean;
  update: ImportDialogProps["update"];
  collection: "locations" | "rules";
}) => {
  const { preview, busy, update, collection } = props;
  const choices = [
    { value: "import", label: t.settingsImport.importChoice },
    { value: "keep", label: t.settingsImport.keep },
    { value: "copy", label: t.settingsImport.copy },
    { value: "skip", label: t.settingsImport.skip },
  ].filter((choice) => collection === "locations" || choice.value !== "copy");
  const setAll = (choice: "import" | "skip"): void => {
    const selected: Record<string, string> = {};
    for (const item of preview.source[collection]) {
      const key = "id" in item ? item.id : item.pattern;
      const conflict = preview.conflicts[collection].includes(key);
      const value =
        conflict && choice === "import" ? preview.selection[collection][key] : choice;
      if (value) selected[key] = value;
    }
    update({ ...preview.selection, [collection]: selected });
  };
  return (
    <section className="space-y-2">
      <h3 className="font-semibold">{collectionLabels()[collection]}</h3>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => setAll("import")}
        >
          {t.settingsImport.selectAll}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={() => setAll("skip")}
        >
          {t.settingsImport.skipAll}
        </Button>
      </div>
      {preview.source[collection].map((item) => {
        const key = "id" in item ? item.id : item.pattern;
        const label = "label" in item ? `${item.label} (${key})` : key;
        const conflict = preview.conflicts[collection].includes(key);
        const value = preview.selection[collection][key] ?? (conflict ? "" : "import");
        return (
          <div
            key={key}
            data-import-item={key}
            data-import-conflict={conflict}
            className="flex flex-col gap-2 rounded-md border border-border p-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <span className="min-w-0 break-words text-sm">
              {label}
              {conflict ? (
                <span className="ml-2 text-muted-foreground">
                  ({t.settingsImport.conflict})
                </span>
              ) : null}
            </span>
            <ChoiceSelect
              label={label}
              value={value}
              choices={
                conflict ? choices : choices.filter((choice) => choice.value !== "keep")
              }
              disabled={busy}
              change={(choice) =>
                update({
                  ...preview.selection,
                  [collection]: { ...preview.selection[collection], [key]: choice },
                })
              }
            />
          </div>
        );
      })}
    </section>
  );
};
const MergeChoices = ({
  preview,
  busy,
  update,
}: {
  preview: SettingsImportPreview;
  busy: boolean;
  update: ImportDialogProps["update"];
}) => (
  <div className="space-y-4" data-import-selection="merge">
    <p className="text-sm text-muted-foreground">{t.settingsImport.mergeHelp}</p>
    <MergeCollection
      collection="locations"
      preview={preview}
      busy={busy}
      update={update}
    />
    <MergeCollection collection="rules" preview={preview} busy={busy} update={update} />
  </div>
);

const ContainerChoices = ({
  preview,
  busy,
  update,
}: {
  preview: SettingsImportPreview;
  busy: boolean;
  update: ImportDialogProps["update"];
}) => (
  <section className="space-y-3" data-import-containers>
    <h3 className="font-semibold">{t.settingsImport.containers}</h3>
    <p className="text-sm text-muted-foreground">{t.settingsImport.containerHelp}</p>
    {(preview.source.containerAssignments ?? []).map((assignment) => {
      const id = assignment.cookieStoreId;
      const mapped = preview.selection.containers[id];
      let value = mapped ?? "";
      if (mapped === null) value = "__skip__";
      return (
        <div
          key={id}
          className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
        >
          <span className="break-words text-sm">{id}</span>
          <ChoiceSelect
            label={id}
            value={value}
            disabled={busy}
            choices={[
              { value: "__skip__", label: t.settingsImport.skip },
              ...preview.localContainers.map((container) => ({
                value: container.cookieStoreId,
                label: container.name,
              })),
            ]}
            change={(choice) =>
              update({
                ...preview.selection,
                containers: {
                  ...preview.selection.containers,
                  [id]: choice === "__skip__" ? null : choice,
                },
              })
            }
          />
        </div>
      );
    })}
  </section>
);

const readableValue = (value: unknown): string => {
  if (value === undefined) return "—";
  return JSON.stringify(
    value,
    (key, item: unknown) =>
      key === "authKey" || key === "ruleSeedKey" ? undefined : item,
    2,
  );
};
const ImportChanges = ({ changes }: { changes: SettingsImportChange[] }) => (
  <section aria-live="polite" className="space-y-2" data-import-changes>
    {changes.length === 0 ? <p>{t.settingsImport.noChanges}</p> : null}
    {changes.map((change) => (
      <details
        key={`${change.collection}:${change.key}`}
        data-import-change={change.kind}
        className="rounded-md border border-border p-3 text-sm"
      >
        <summary className="cursor-pointer break-words">
          {changeLabels()[change.kind]} · {collectionLabels()[change.collection]} ·{" "}
          {change.key}
        </summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <span className="font-semibold">{t.settingsImport.before}</span>
            <pre className="mt-1 whitespace-pre-wrap break-words text-xs text-muted-foreground">
              {readableValue(change.before)}
            </pre>
          </div>
          <div>
            <span className="font-semibold">{t.settingsImport.after}</span>
            <pre className="mt-1 whitespace-pre-wrap break-words text-xs text-muted-foreground">
              {readableValue(change.after)}
            </pre>
          </div>
        </div>
      </details>
    ))}
  </section>
);

export const SettingsImportDialogView = (props: ImportDialogProps) => {
  const { preview, busy, error, saveInFlight, cancel, confirm, update } = props;
  return (
    <Dialog
      open={preview !== null || error !== null}
      onOpenChange={(open) => {
        if (!open && !busy) cancel();
      }}
    >
      <DialogContent
        id="settings-import-dialog"
        className="max-w-3xl"
        animationTiming="urgent"
      >
        <DialogCloseButton label={t.common.actions.close} disabled={busy} />
        <DialogHeader>
          <DialogTitle>{t.settingsImport.title}</DialogTitle>
          <DialogDescription>{t.settingsImport.description}</DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto space-y-5 pr-2">
          {preview ? (
            <>
              <ChoiceSelect
                label={t.settingsImport.title}
                value={preview.selection.mode}
                disabled={busy}
                choices={[
                  { value: "replace", label: t.settingsImport.replace },
                  { value: "merge", label: t.settingsImport.merge },
                ]}
                change={(mode) =>
                  update({
                    ...preview.selection,
                    mode: mode as SettingsImportSelection["mode"],
                  })
                }
              />
              {preview.selection.mode === "merge" ? (
                <MergeChoices preview={preview} busy={busy} update={update} />
              ) : null}
              {(preview.source.containerAssignments?.length ?? 0) > 0 ? (
                <ContainerChoices preview={preview} busy={busy} update={update} />
              ) : null}
              {preview.problems.length > 0 ? (
                <div
                  role="alert"
                  data-import-unresolved
                  className="space-y-1 text-sm text-destructive"
                >
                  <p>{t.settingsImport.resolve}</p>
                  {preview.problems.map((problem) => (
                    <p key={problem}>{problem}</p>
                  ))}
                </div>
              ) : null}
              <ImportChanges changes={preview.changes} />
            </>
          ) : null}
          {error ? (
            <p role="alert" data-import-error className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <p className="text-xs text-muted-foreground">{t.settingsImport.retention}</p>
        </div>
        <DialogFooter>
          <Button
            id="settings-import-cancel"
            variant="secondary"
            onClick={cancel}
            disabled={busy}
          >
            {t.common.actions.cancel}
          </Button>
          {preview ? (
            <Button
              id="settings-import-review"
              variant="outline"
              onClick={() => update(preview.selection)}
              disabled={busy || saveInFlight}
            >
              {t.settingsImport.review}
            </Button>
          ) : null}
          <Button
            id="settings-import-confirm"
            onClick={confirm}
            disabled={
              !preview ||
              busy ||
              saveInFlight ||
              preview.problems.length > 0 ||
              error !== null
            }
          >
            {t.settingsImport.confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export const SettingsImportDialog = () => {
  const settings = useSettings();
  return (
    <SettingsImportDialogView
      preview={settings.importPreview}
      busy={settings.importBusy}
      error={settings.importError}
      saveInFlight={settings.saveInFlight}
      cancel={settings.cancelImport}
      confirm={() => void settings.applyImport()}
      update={(selection) => void settings.updateImportSelection(selection)}
    />
  );
};
