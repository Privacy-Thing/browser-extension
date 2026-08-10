import type { ReactNode } from "react";

import { cn } from "@/ui/components/lib/utils";
import { Button } from "@/ui/components/ui/button";
import { FieldLabel } from "@/ui/components/ui/field-label";
import { Label } from "@/ui/components/ui/label";
import { t } from "@/ui/i18n";

export const SEGMENTED_GROUP_CLASS =
  "inline-flex max-w-full overflow-hidden rounded-md border border-border";

export const getSegmentButtonClass = ({
  active,
  dividerClassName,
  disabled = false,
}: {
  active: boolean;
  dividerClassName?: string;
  disabled?: boolean;
}) =>
  cn(
    "px-2.5 py-1 text-xs font-medium transition-colors first:rounded-l-[calc(var(--radius)-1px)] last:rounded-r-[calc(var(--radius)-1px)]",
    dividerClassName,
    active
      ? "bg-background text-primary ring-1 ring-inset ring-primary/35"
      : "bg-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground",
    disabled &&
      "cursor-not-allowed opacity-50 hover:bg-transparent hover:text-muted-foreground",
  );

export const BinaryToggle = ({
  id,
  value,
  onChange,
  label,
  disabled = false,
}: {
  id?: string;
  value: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
}) => (
  <div id={id} role="group" aria-label={label} className={SEGMENTED_GROUP_CLASS}>
    <button
      type="button"
      aria-pressed={value}
      aria-label={t.rules.dialog.surfaceOverrides.stateOn}
      disabled={disabled}
      className={getSegmentButtonClass({
        active: value,
        disabled,
      })}
      onClick={() => onChange(true)}
    >
      {t.rules.dialog.surfaceOverrides.stateOn}
    </button>
    <button
      type="button"
      aria-pressed={!value}
      aria-label={t.rules.dialog.surfaceOverrides.stateOff}
      disabled={disabled}
      className={getSegmentButtonClass({
        active: !value,
        dividerClassName: "border-l border-border",
        disabled,
      })}
      onClick={() => onChange(false)}
    >
      {t.rules.dialog.surfaceOverrides.stateOff}
    </button>
  </div>
);

export const DialogFieldRow = ({
  htmlFor,
  label,
  labelInfo,
  labelInfoAriaLabel,
  align = "center",
  children,
}: {
  htmlFor?: string;
  label: string;
  labelInfo?: ReactNode;
  labelInfoAriaLabel?: string;
  align?: "center" | "start";
  children: ReactNode;
}) => {
  const labelProps = htmlFor ? { htmlFor } : {};
  const labelInfoProps = labelInfoAriaLabel ? { infoLabel: labelInfoAriaLabel } : {};
  let labelNode = (
    <Label {...labelProps} variant="field" className="mb-0">
      {label}
    </Label>
  );

  if (labelInfo) {
    labelNode = (
      <FieldLabel {...labelProps} className="mb-0" info={labelInfo} {...labelInfoProps}>
        {label}
      </FieldLabel>
    );
  }

  return (
    <div
      className={cn(
        "grid gap-2 md:grid-cols-[6.5rem_minmax(0,1fr)] md:gap-4",
        align === "start" ? "md:items-start" : "md:items-center",
      )}
    >
      {labelNode}
      <div className="min-w-0">{children}</div>
    </div>
  );
};

export const DialogToggleRow = ({
  htmlFor,
  label,
  hint,
  control,
}: {
  htmlFor?: string;
  label: string;
  hint: ReactNode;
  control: ReactNode;
}) => (
  <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-start md:gap-4">
    <div className="min-w-0">
      <Label {...(htmlFor ? { htmlFor } : {})} variant="field" className="mb-2 block">
        {label}
      </Label>
      <div className="text-sm text-muted-foreground [&_p+p]:mt-2">{hint}</div>
    </div>
    <div className="md:pt-0.5">{control}</div>
  </div>
);

export const DialogIdentitySection = ({
  title,
  description,
  actionDescription,
  actionLabel,
  onAction,
  actionDisabled = false,
}: {
  title: string;
  description: ReactNode;
  actionDescription?: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  actionDisabled?: boolean;
}) => {
  return (
    <section className="space-y-4" data-dialog-section="identity">
      <div>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <div className="mt-1 text-sm leading-relaxed text-muted-foreground [&_p+p]:mt-2">
          {description}
        </div>
      </div>
      {actionLabel && onAction ? (
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-start md:gap-4">
          <div className="text-sm text-muted-foreground">{actionDescription}</div>
          <Button
            type="button"
            variant="secondary"
            className="shrink-0 md:justify-self-end"
            disabled={actionDisabled}
            onClick={onAction}
          >
            {actionLabel}
          </Button>
        </div>
      ) : null}
    </section>
  );
};
