import type { ComponentProps, ReactNode } from "react";

import { BUILD_BROWSER_TARGET } from "@/shared/build-flags";
import {
  BOOLEAN_SURFACE_KEYS,
  getSurfaceDefinition,
  isSurfaceSupported,
  type BooleanSurfaceKey,
} from "@/shared/spoofing-surfaces";
import type { SurfaceOverrides } from "@/shared/types";
import type { SharedWorkerHandlingMode } from "@/shared/types";
import { cn } from "@/ui/components/lib/utils";
import { FieldLabel } from "@/ui/components/ui/field-label";
import type { Label } from "@/ui/components/ui/label";
import { t } from "@/ui/i18n";
import {
  getSegmentButtonClass,
  SEGMENTED_GROUP_CLASS,
} from "@/ui/options/components/modals/dialog-primitives";

const SURFACE_META: Record<BooleanSurfaceKey, { label: string; info: string }> = {
  canvas: {
    label: t.rules.dialog.surfaceOverrides.canvas.label,
    info: t.rules.dialog.surfaceOverrides.canvas.info,
  },
  webGL: {
    label: t.rules.dialog.surfaceOverrides.webGL.label,
    info: t.rules.dialog.surfaceOverrides.webGL.info,
  },
  audio: {
    label: t.rules.dialog.surfaceOverrides.audio.label,
    info: t.rules.dialog.surfaceOverrides.audio.info,
  },
  navigator: {
    label: t.rules.dialog.surfaceOverrides.navigator.label,
    info: t.rules.dialog.surfaceOverrides.navigator.info,
  },
  screen: {
    label: t.rules.dialog.surfaceOverrides.screen.label,
    info: t.rules.dialog.surfaceOverrides.screen.info,
  },
  clientHints: {
    label: t.rules.dialog.surfaceOverrides.clientHints.label,
    info: t.rules.dialog.surfaceOverrides.clientHints.info,
  },
  battery: {
    label: t.rules.dialog.surfaceOverrides.battery.label,
    info: t.rules.dialog.surfaceOverrides.battery.info,
  },
  webRTC: {
    label: t.rules.dialog.surfaceOverrides.webRTC.label,
    info: t.rules.dialog.surfaceOverrides.webRTC.info,
  },
  serviceWorker: {
    label: t.rules.dialog.surfaceOverrides.serviceWorker.label,
    info: t.rules.dialog.surfaceOverrides.serviceWorker.info,
  },
  geolocation: {
    label: t.rules.dialog.surfaceOverrides.geolocation.label,
    info: t.rules.dialog.surfaceOverrides.geolocation.info,
  },
  timeLocale: {
    label: t.rules.dialog.surfaceOverrides.timeLocale.label,
    info: t.rules.dialog.surfaceOverrides.timeLocale.info,
  },
};

const TriStateToggle = ({
  value,
  onChange,
  label,
  labels = {
    trueLabel: t.rules.dialog.surfaceOverrides.stateOn,
    inheritLabel: t.rules.dialog.surfaceOverrides.stateInherit,
    falseLabel: t.rules.dialog.surfaceOverrides.stateOff,
  },
}: {
  value: boolean | undefined;
  onChange: (next: boolean | undefined) => void;
  label: string;
  labels?: {
    trueLabel: string;
    inheritLabel: string;
    falseLabel: string;
  };
}) => (
  <div role="group" aria-label={label} className={SEGMENTED_GROUP_CLASS}>
    <button
      type="button"
      aria-pressed={value === true}
      aria-label={labels.trueLabel}
      className={getSegmentButtonClass({
        active: value === true,
      })}
      onClick={() => onChange(value === true ? undefined : true)}
    >
      {labels.trueLabel}
    </button>
    <button
      type="button"
      aria-pressed={value === undefined}
      aria-label={labels.inheritLabel}
      className={getSegmentButtonClass({
        active: value === undefined,
        dividerClassName: "border-x border-border",
      })}
      onClick={() => onChange(undefined)}
    >
      {labels.inheritLabel}
    </button>
    <button
      type="button"
      aria-pressed={value === false}
      aria-label={labels.falseLabel}
      className={getSegmentButtonClass({
        active: value === false,
      })}
      onClick={() => onChange(value === false ? undefined : false)}
    >
      {labels.falseLabel}
    </button>
  </div>
);

const SharedWorkerModeToggle = ({
  value,
  onChange,
  label,
}: {
  value: SharedWorkerHandlingMode | undefined;
  onChange: (next: SharedWorkerHandlingMode | undefined) => void;
  label: string;
}) => {
  const entries: Array<{
    value: SharedWorkerHandlingMode | undefined;
    label: string;
  }> = [
    { value: undefined, label: t.rules.dialog.surfaceOverrides.stateInherit },
    { value: "native", label: t.rules.dialog.surfaceOverrides.stateNative },
    { value: "spoof", label: t.rules.dialog.surfaceOverrides.stateSpoof },
    { value: "strict", label: t.rules.dialog.surfaceOverrides.stateStrict },
  ];

  return (
    <div role="group" aria-label={label} className={SEGMENTED_GROUP_CLASS}>
      {entries.map((entry, index) => (
        <button
          key={entry.value ?? "inherit"}
          type="button"
          aria-pressed={value === entry.value}
          aria-label={entry.label}
          className={cn(
            getSegmentButtonClass({
              active: value === entry.value,
              ...(index > 0 ? { dividerClassName: "border-l border-border" } : {}),
            }),
            "whitespace-nowrap px-2",
          )}
          onClick={() => onChange(entry.value)}
        >
          {entry.label}
        </button>
      ))}
    </div>
  );
};

type SurfaceControlsProps = {
  value: SurfaceOverrides | undefined;
  onChange: (next: SurfaceOverrides | undefined) => void;
  labelClassName?: string;
  labelVariant?: ComponentProps<typeof Label>["variant"];
};

const SurfaceOverrideRow = ({
  label,
  info,
  children,
  labelClassName,
  labelVariant,
}: {
  label: string;
  info: string;
  children: ReactNode;
  labelClassName?: string | undefined;
  labelVariant?: ComponentProps<typeof Label>["variant"] | undefined;
}) => (
  <div className="grid gap-2 md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:gap-4">
    <FieldLabel
      {...(labelVariant ? { variant: labelVariant } : {})}
      {...(labelClassName ? { className: labelClassName } : {})}
      info={info}
      infoLabel={t.rules.dialog.surfaceOverrides.helpAriaLabel(label)}
    >
      {label}
    </FieldLabel>
    <div className="w-fit max-w-full overflow-x-auto px-1 py-1 md:-mt-0.5 md:-mb-1">
      {children}
    </div>
  </div>
);

export const SurfaceOverridesControls = ({
  value,
  onChange,
  labelClassName,
  labelVariant,
}: SurfaceControlsProps) => {
  const supportedSurfaceKeys = BOOLEAN_SURFACE_KEYS.filter((key) =>
    isSurfaceSupported(getSurfaceDefinition(key), BUILD_BROWSER_TARGET),
  );
  const hasAnyOverride = (next: SurfaceOverrides): boolean =>
    next.sharedWorker !== undefined ||
    BOOLEAN_SURFACE_KEYS.some((key) => next[key] !== undefined);

  return (
    <div className="grid gap-3">
      {supportedSurfaceKeys.map((surface) => (
        <SurfaceOverrideRow
          key={surface}
          label={SURFACE_META[surface].label}
          info={SURFACE_META[surface].info}
          labelClassName={labelClassName}
          labelVariant={labelVariant}
        >
          <TriStateToggle
            value={value?.[surface]}
            onChange={(surfaceValue) => {
              const next: SurfaceOverrides = {
                ...(value ?? {}),
                [surface]: surfaceValue,
              };
              onChange(hasAnyOverride(next) ? next : undefined);
            }}
            label={SURFACE_META[surface].label}
            {...(surface === "serviceWorker"
              ? {
                  labels: {
                    trueLabel: t.rules.dialog.surfaceOverrides.stateBlock,
                    inheritLabel: t.rules.dialog.surfaceOverrides.stateInherit,
                    falseLabel: t.rules.dialog.surfaceOverrides.stateAllow,
                  },
                }
              : {})}
          />
        </SurfaceOverrideRow>
      ))}
      <SurfaceOverrideRow
        label={t.rules.dialog.surfaceOverrides.sharedWorker.label}
        info={t.rules.dialog.surfaceOverrides.sharedWorker.info}
        labelClassName={labelClassName}
        labelVariant={labelVariant}
      >
        <SharedWorkerModeToggle
          value={value?.sharedWorker}
          onChange={(sharedWorkerValue) => {
            const next: SurfaceOverrides = {
              ...(value ?? {}),
              sharedWorker: sharedWorkerValue,
            };
            onChange(hasAnyOverride(next) ? next : undefined);
          }}
          label={t.rules.dialog.surfaceOverrides.sharedWorker.label}
        />
      </SurfaceOverrideRow>
    </div>
  );
};
