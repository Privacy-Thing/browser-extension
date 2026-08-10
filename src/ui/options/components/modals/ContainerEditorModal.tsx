import {
  FIREFOX_CONTAINER_COLORS,
  CONTAINER_COLOR_TOKENS,
  CONTAINER_COLOR_SWATCHES,
  FIREFOX_CONTAINER_ICONS,
  getContainerIconUrl,
  type FirefoxContainerColor,
  type FirefoxContainerIcon,
} from "@/shared/firefox-containers";
import type { SurfaceOverrides, Location } from "@/shared/types";
import { ContainerBadge } from "@/ui/components/ContainerBadge";
import { Button } from "@/ui/components/ui/button";
import { FormDialogShell } from "@/ui/components/ui/form-dialog-shell";
import { Input } from "@/ui/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/ui/components/ui/select";
import { Switch } from "@/ui/components/ui/switch";
import { t } from "@/ui/i18n";
import {
  DialogIdentitySection,
  DialogFieldRow,
  DialogToggleRow,
} from "@/ui/options/components/modals/dialog-primitives";
import { UNASSIGNED_VALUE } from "@/ui/options/components/modals/LocationFormFields";
import { LocationFormFields } from "@/ui/options/components/modals/LocationFormFields";
import { SurfaceOverridesControls } from "@/ui/options/components/modals/surface-overrides-controls";

const containersT = t.firefoxContainers;
type IdentitySectionProps = React.ComponentProps<typeof DialogIdentitySection>;

export type ContainerEditorDraft = {
  name: string;
  color: FirefoxContainerColor;
  icon: FirefoxContainerIcon;
  enabled: boolean;
  locationId: string | null;
  surfaceOverrides: SurfaceOverrides | undefined;
};

export type DefaultRulePreview = {
  status:
    "active-location" | "active-protections" | "unconfigured" | "disabled" | "missing";
  locationLabel: string | null;
};

type ContainerEditorProps = {
  open: boolean;
  mode: "create" | "edit";
  draft: ContainerEditorDraft;
  defaultRulePreview?: DefaultRulePreview | null;
  profiles: readonly Location[];
  saveInFlight: boolean;
  currentSeedKey?: string | null;
  modalAnchorId?: string;
  onOpenChange: (open: boolean) => void;
  onDraftChange: (draft: ContainerEditorDraft) => void;
  onSave: () => void;
  onRotateIdentity?: () => void;
  onDelete?: () => void;
};

const toChoiceLabel = (value: string): string =>
  value.replace(/-/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());

const ColorSwatch = ({ color }: { color: FirefoxContainerColor }) => (
  <span
    aria-hidden="true"
    className="block size-3 shrink-0 rounded-full border border-border/60"
    style={{ backgroundColor: CONTAINER_COLOR_SWATCHES[color] }}
  />
);

const IconGlyph = ({
  icon,
  color,
}: {
  icon: FirefoxContainerIcon;
  color: FirefoxContainerColor;
}) => (
  <span
    aria-hidden="true"
    className="block size-4 shrink-0 bg-current"
    style={{
      color: CONTAINER_COLOR_SWATCHES[color],
      maskImage: `url("${getContainerIconUrl(icon)}")`,
      maskRepeat: "no-repeat",
      maskPosition: "center",
      maskSize: "contain",
      WebkitMaskImage: `url("${getContainerIconUrl(icon)}")`,
      WebkitMaskRepeat: "no-repeat",
      WebkitMaskPosition: "center",
      WebkitMaskSize: "contain",
    }}
  />
);

const getPreviewDescription = (
  preview: DefaultRulePreview | null | undefined,
): string | null => {
  if (!preview) return null;
  switch (preview.status) {
    case "active-location":
      return containersT.editor.defaultRulePreviewLocation(
        preview.locationLabel ?? containersT.noLocationAssigned,
      );
    case "active-protections":
      return containersT.editor.defaultRulePreviewProtections;
    case "unconfigured":
      return containersT.editor.defaultRulePreviewUnconfigured;
    case "disabled":
      return containersT.editor.defaultRulePreviewDisabled;
    default:
      return containersT.editor.defaultRulePreviewMissing;
  }
};

const ContainerDialogTitle = ({ mode, draft }: ContainerEditorProps) =>
  mode === "create" ? (
    containersT.editor.createTitle
  ) : (
    <span className="flex min-w-0 items-center gap-2">
      <span>{containersT.editor.editTitlePrefix}</span>
      <ContainerBadge
        className="min-w-0 gap-2"
        nameClassName="text-lg font-semibold"
        name={draft.name.trim() || containersT.editor.previewUntitled}
        iconUrl={getContainerIconUrl(draft.icon)}
        colorCode={CONTAINER_COLOR_SWATCHES[draft.color]}
        accentName
      />
    </span>
  );

const ContainerFooter = ({
  mode,
  onDelete,
  onOpenChange,
  onSave,
  saveInFlight,
}: ContainerEditorProps) => (
  <>
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="ghost"
        onClick={() => onOpenChange(false)}
        disabled={saveInFlight}
      >
        {t.common.actions.cancel}
      </Button>
      {mode === "edit" ? (
        <Button
          type="button"
          variant="ghost"
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={onDelete}
          disabled={saveInFlight}
        >
          {containersT.deleteButton}
        </Button>
      ) : null}
    </div>
    <Button type="button" onClick={onSave} disabled={saveInFlight}>
      {containersT.editor.saveButton}
    </Button>
  </>
);

const ContainerCoreFields = ({
  draft,
  onDraftChange,
  saveInFlight,
}: ContainerEditorProps) => (
  <section className="rounded-xl border border-border/70 bg-card/35 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
    <div className="space-y-4">
      <DialogToggleRow
        htmlFor="container-editor-enabled"
        label={containersT.editor.fields.enabled}
        hint={containersT.editor.enabledHint}
        control={
          <Switch
            id="container-editor-enabled"
            checked={draft.enabled}
            onCheckedChange={(enabled) => onDraftChange({ ...draft, enabled })}
            disabled={saveInFlight}
          />
        }
      />
      <div className="border-t border-border/70" />
      <DialogFieldRow
        htmlFor="container-editor-name"
        label={containersT.editor.fields.name}
      >
        <Input
          id="container-editor-name"
          value={draft.name}
          onChange={(event) =>
            onDraftChange({ ...draft, name: event.currentTarget.value })
          }
          disabled={saveInFlight}
        />
      </DialogFieldRow>
      <DialogFieldRow label={containersT.editor.fields.color}>
        <Select
          value={draft.color}
          onValueChange={(value) =>
            onDraftChange({ ...draft, color: value as FirefoxContainerColor })
          }
          disabled={saveInFlight}
        >
          <SelectTrigger aria-label={containersT.editor.fields.color}>
            <div className="flex min-w-0 items-center gap-2">
              <ColorSwatch color={draft.color} />
              <span className="truncate">{toChoiceLabel(draft.color)}</span>
            </div>
          </SelectTrigger>
          <SelectContent>
            {FIREFOX_CONTAINER_COLORS.map((color) => (
              <SelectItem key={color} value={color}>
                <span className="flex items-center gap-2">
                  <ColorSwatch color={color} />
                  <span>{toChoiceLabel(color)}</span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </DialogFieldRow>
      <div className="border-t border-border/70" />
      <DialogFieldRow label={containersT.editor.fields.icon}>
        <Select
          value={draft.icon}
          onValueChange={(value) =>
            onDraftChange({ ...draft, icon: value as FirefoxContainerIcon })
          }
          disabled={saveInFlight}
        >
          <SelectTrigger aria-label={containersT.editor.fields.icon}>
            <div className="flex min-w-0 items-center gap-2">
              <IconGlyph icon={draft.icon} color={draft.color} />
              <span className="truncate">{toChoiceLabel(draft.icon)}</span>
            </div>
          </SelectTrigger>
          <SelectContent>
            {FIREFOX_CONTAINER_ICONS.map((icon) => (
              <SelectItem key={icon} value={icon}>
                <span className="flex items-center gap-2">
                  <IconGlyph icon={icon} color={draft.color} />
                  <span>{toChoiceLabel(icon)}</span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </DialogFieldRow>
    </div>
  </section>
);

const ContainerLocation = (props: ContainerEditorProps) => {
  const {
    currentSeedKey,
    draft,
    mode,
    onDraftChange,
    onRotateIdentity,
    profiles,
    saveInFlight,
  } = props;
  const accent = CONTAINER_COLOR_TOKENS[draft.color];
  const identity =
    mode === "edit" && currentSeedKey
      ? ({
          title: containersT.editor.identity.sectionTitle,
          description: containersT.editor.identity.sectionDescription,
          actionDisabled: saveInFlight,
          ...(onRotateIdentity
            ? {
                actionDescription: containersT.editor.identity.actionDescription,
                actionLabel: containersT.editor.identity.actionLabel,
                onAction: onRotateIdentity,
              }
            : {}),
        } satisfies IdentitySectionProps)
      : null;
  const options = [
    { value: UNASSIGNED_VALUE, label: containersT.editor.unassignedLocation },
    ...profiles.map((profile) => ({ value: profile.id, label: profile.label })),
  ];
  return (
    <section className="rounded-xl border border-border/70 bg-card/35 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
      <div className="space-y-4">
        <LocationFormFields
          sectionLabel={containersT.editor.fields.locationProfile}
          sectionHint={containersT.editor.locationProfileHint}
          selectId="container-editor-location"
          selectLabel={containersT.editor.fields.location}
          selectPlaceholder={containersT.editor.unassignedLocation}
          selectValue={draft.locationId ?? UNASSIGNED_VALUE}
          selectDisabled={saveInFlight}
          selectContentStyle={
            { "--primary": accent, "--ring": accent } as React.CSSProperties
          }
          selectItemClassName="focus:bg-primary/10 focus:text-foreground"
          selectOptions={options}
          onSelectValueChange={(value) =>
            onDraftChange({
              ...draft,
              locationId: value === UNASSIGNED_VALUE ? null : value,
            })
          }
        />
        {identity ? (
          <>
            <div className="border-t border-border/70" />
            <DialogIdentitySection {...identity} />
          </>
        ) : null}
      </div>
    </section>
  );
};

const ContainerSurfaces = ({ draft, onDraftChange }: ContainerEditorProps) => (
  <section className="rounded-xl border border-border/70 bg-card/35 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
    <div>
      <h3 className="text-sm font-semibold text-foreground">
        {t.rules.dialog.surfaceOverrides.title}
      </h3>
      <p className="mt-1 text-sm text-muted-foreground">
        {t.rules.dialog.surfaceOverrides.description}
      </p>
    </div>
    <div className="mt-4">
      <SurfaceOverridesControls
        value={draft.surfaceOverrides}
        onChange={(surfaceOverrides) => onDraftChange({ ...draft, surfaceOverrides })}
        labelVariant="field"
        labelClassName="mb-0"
      />
    </div>
  </section>
);

const ContainerBody = (props: ContainerEditorProps) => {
  const preview = getPreviewDescription(props.defaultRulePreview);
  return (
    <div className="grid gap-4 md:grid-cols-[minmax(0,1.08fr)_minmax(20rem,0.92fr)] md:items-start">
      <div className="space-y-4">
        {preview ? (
          <section className="rounded-xl border border-border/70 bg-card/35 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
            <h3 className="text-sm font-semibold text-primary">
              {containersT.editor.defaultRulePreviewTitle}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {preview}
            </p>
          </section>
        ) : null}
        <ContainerCoreFields {...props} />
        <ContainerLocation {...props} />
      </div>
      <div className="space-y-4">
        <ContainerSurfaces {...props} />
      </div>
    </div>
  );
};

export const ContainerEditorModal = (props: ContainerEditorProps) => {
  const { open, mode, draft, saveInFlight, modalAnchorId, onOpenChange } = props;
  const focusPrimaryControl = () => {
    document.getElementById("container-editor-name")?.focus();
  };
  const dialogAccentColor = CONTAINER_COLOR_SWATCHES[draft.color];
  const dialogAccentTokens = CONTAINER_COLOR_TOKENS[draft.color];
  const dialogTitle = <ContainerDialogTitle {...props} />;
  const dialogDescription =
    mode === "create"
      ? containersT.editor.createDescription
      : containersT.editor.editDescription;
  const headerProps = modalAnchorId
    ? {
        id: modalAnchorId,
        "data-anchor-id": modalAnchorId,
      }
    : undefined;

  return (
    <FormDialogShell
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) {
          onOpenChange(nextOpen);
        }
      }}
      id="container-editor-dialog"
      title={dialogTitle}
      description={dialogDescription}
      closeLabel={t.common.actions.close}
      busy={saveInFlight}
      preventCloseWhenBusy
      contentClassName="sm:max-w-[60rem]"
      contentStyle={
        {
          "--gw-dialog-accent-color": dialogAccentColor,
          "--primary": dialogAccentTokens,
          "--ring": dialogAccentTokens,
          "--scrollbar-thumb": dialogAccentColor,
          "--scrollbar-thumb-hover": "var(--gw-dialog-accent-peak)",
        } as React.CSSProperties
      }
      {...(headerProps ? { headerProps } : {})}
      {...(modalAnchorId ? { headerClassName: "gw-anchor-target" } : {})}
      footerClassName="sm:justify-between"
      onOpenAutoFocus={(event) => {
        event.preventDefault();
        queueMicrotask(focusPrimaryControl);
      }}
      footer={<ContainerFooter {...props} />}
    >
      <ContainerBody {...props} />
    </FormDialogShell>
  );
};
