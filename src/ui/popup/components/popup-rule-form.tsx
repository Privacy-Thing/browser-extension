import { useLayoutEffect, useRef, useState } from "react";

import { PopupButton } from "./PopupButton";
import { ExternalLinkIcon, InfoIcon, TrashIcon } from "./PopupIcons";

import type { SharedWorkerHandlingMode } from "@/shared/types";
import { Label } from "@/ui/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/components/ui/select";
import { Switch } from "@/ui/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/ui/components/ui/tooltip";

export type PopupRuleFormBodyProps = {
  body: React.ReactNode;
  preview: React.ReactNode;
  formExtra: React.ReactNode;
  isBodyOnlyView: boolean;
  selectedLocationId: string | null | undefined;
  regionalPresetEnabled: boolean;
  allowInheritedLocation: boolean;
  inheritedLocationLabel: string | undefined;
  noPresetLabel: string;
  locations: Array<{ id: string; label: string }>;
  locationLabel: string;
  onLocationChange: ((id: string | null) => void) | undefined;
  onRegionalPresetChange: ((enabled: boolean) => void) | undefined;
  ruleTypeLabel: string;
  ruleMode: "exact" | "suffix";
  onRuleModeChange: ((mode: "exact" | "suffix") => void) | undefined;
  exactLabel: string;
  suffixLabel: string;
  advancedTitle: string;
  serviceWorkerLabel: string;
  serviceWorkerHint: string;
  serviceWorkerBlockLabel: string;
  serviceWorkerInherit: string;
  serviceWorkerAllowLabel: string;
  serviceWorkerOverride: boolean | undefined;
  onServiceWorkerChange: ((value: boolean | undefined) => void) | undefined;
  workerHandlingLabel: string;
  workerHandlingHint: string;
  workerInherit: string;
  workerNative: string;
  workerHandlingSpoofLabel: string;
  workerStrict: string;
  workerHandlingOverride: SharedWorkerHandlingMode | undefined;
  onWorkerChange: ((value: SharedWorkerHandlingMode | undefined) => void) | undefined;
  relaxCspLabel: string;
  relaxCspHint: string;
  detailsAriaLabel: (label: string) => string;
  relaxCspForWorkers: boolean;
  onRelaxCspChange: ((checked: boolean) => void) | undefined;
  fullSettingsLabel: string;
  onOpenFullSettings: (() => void) | undefined;
  deleteTone: "secondary" | "destructive";
  canDelete: boolean;
  onRequestDelete: (() => void) | undefined;
  deleteLabel: string;
  canSave: boolean;
  onSave: (() => void) | undefined;
  saveLabel: string;
};

const NO_PRESET_VALUE = "__no-preset__";
const INHERITED_PRESET_VALUE = "__inherited-preset__";

const PopupSheetSelectField = ({
  id,
  label,
  value,
  onValueChange,
  options,
}: {
  id: string;
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  options: ReadonlyArray<{ value: string; label: string }>;
}) => (
  <div className="gw-popup-sheet-field">
    <label htmlFor={id} className="gw-popup-sheet-label">
      {label}
    </label>
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger id={id} className="gw-popup-sheet-select">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>
);

const PopupAdvancedAccordion = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => {
  const [open, setOpen] = useState(false);
  const [panelHeight, setPanelHeight] = useState(0);
  const panelInnerRef = useRef<HTMLDivElement | null>(null);

  useLayoutEffect(() => {
    const panelElement = panelInnerRef.current;
    if (!panelElement) return;

    const syncHeight = () => setPanelHeight(panelElement.scrollHeight);
    syncHeight();

    if (typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(syncHeight);
    observer.observe(panelElement);
    return () => observer.disconnect();
  }, [children]);

  return (
    <div className="gw-popup-advanced">
      <PopupButton
        variant="ghost"
        className="gw-popup-advanced-trigger"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="gw-popup-advanced-title">{title}</span>
        <span className="gw-popup-advanced-chevron">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </span>
      </PopupButton>
      <div
        className="gw-popup-advanced-region"
        data-open={open ? "true" : "false"}
        style={
          {
            "--popup-advanced-panel-height": `${Math.max(panelHeight, 1)}px`,
          } as React.CSSProperties
        }
      >
        <div ref={panelInnerRef} aria-hidden={!open} inert={!open}>
          <div className="gw-popup-advanced-panel">{children}</div>
        </div>
      </div>
    </div>
  );
};

const PopupAdvancedHelp = ({
  ariaLabel,
  hint,
}: {
  ariaLabel: string;
  hint: string;
}) => (
  <TooltipProvider delayDuration={100}>
    <Tooltip>
      <TooltipTrigger asChild>
        <PopupButton
          variant="ghost"
          size="icon"
          className="gw-popup-advanced-help"
          aria-label={ariaLabel}
        >
          <InfoIcon className="gw-popup-icon-sm" />
        </PopupButton>
      </TooltipTrigger>
      <TooltipContent side="left" align="start" className="gw-popup-advanced-tooltip">
        {hint}
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
);

const PopupAdvancedRow = ({
  id,
  label,
  hint,
  helpAriaLabel,
  children,
}: {
  id?: string;
  label: string;
  hint: string;
  helpAriaLabel: string;
  children: React.ReactNode;
}) => (
  <div className="gw-popup-advanced-row">
    <div className="gw-popup-advanced-row-inner">
      <div className="gw-popup-advanced-label-group">
        {id ? (
          <Label htmlFor={id} className="gw-popup-advanced-toggle-label">
            {label}
          </Label>
        ) : (
          <span className="gw-popup-advanced-toggle-label">{label}</span>
        )}
        <PopupAdvancedHelp ariaLabel={helpAriaLabel} hint={hint} />
      </div>
      {children}
    </div>
  </div>
);

type Choice<T> = {
  key: string;
  label: string;
  tone?: "warning" | "neutral" | "success";
  value: T;
};

const WorkerChoiceGroup = <T,>({
  label,
  columns,
  choices,
  value,
  onChange,
}: {
  label: string;
  columns: "3" | "4";
  choices: ReadonlyArray<Choice<T>>;
  value: T;
  onChange: ((value: T) => void) | undefined;
}) => (
  <div
    className="gw-popup-worker-choice"
    data-columns={columns}
    role="group"
    aria-label={label}
  >
    {choices.map((choice) => (
      <PopupButton
        key={choice.key}
        variant="ghost"
        aria-pressed={value === choice.value}
        className="gw-popup-worker-option"
        {...(choice.tone ? { "data-tone": choice.tone } : {})}
        onClick={() => onChange?.(choice.value)}
      >
        {choice.label}
      </PopupButton>
    ))}
  </div>
);

const ServiceWorkerControl = ({ props }: { props: PopupRuleFormBodyProps }) => {
  const choices = [
    {
      key: "block",
      label: props.serviceWorkerBlockLabel,
      tone: "warning",
      value: true,
    },
    {
      key: "inherit",
      label: props.serviceWorkerInherit,
      tone: "neutral",
      value: undefined,
    },
    {
      key: "allow",
      label: props.serviceWorkerAllowLabel,
      tone: "success",
      value: false,
    },
  ] as const;

  return (
    <div className="gw-popup-advanced-choice-row">
      <div className="gw-popup-advanced-label-group">
        <span className="gw-popup-advanced-toggle-label">
          {props.serviceWorkerLabel}
        </span>
        <PopupAdvancedHelp
          ariaLabel={props.detailsAriaLabel(props.serviceWorkerLabel)}
          hint={props.serviceWorkerHint}
        />
      </div>
      <WorkerChoiceGroup
        label={props.serviceWorkerLabel}
        columns="3"
        choices={choices}
        value={props.serviceWorkerOverride}
        onChange={props.onServiceWorkerChange}
      />
    </div>
  );
};

const WorkerHandlingControl = ({ props }: { props: PopupRuleFormBodyProps }) => {
  const choices: ReadonlyArray<Choice<SharedWorkerHandlingMode | undefined>> = [
    { key: "inherit", label: props.workerInherit, value: undefined },
    { key: "native", label: props.workerNative, value: "native" },
    { key: "spoof", label: props.workerHandlingSpoofLabel, value: "spoof" },
    { key: "strict", label: props.workerStrict, value: "strict" },
  ];

  return (
    <div className="gw-popup-advanced-choice-row">
      <div className="gw-popup-advanced-label-group">
        <span className="gw-popup-advanced-toggle-label">
          {props.workerHandlingLabel}
        </span>
        <PopupAdvancedHelp
          ariaLabel={props.detailsAriaLabel(props.workerHandlingLabel)}
          hint={props.workerHandlingHint}
        />
      </div>
      <WorkerChoiceGroup
        label={props.workerHandlingLabel}
        columns="4"
        choices={choices}
        value={props.workerHandlingOverride}
        onChange={props.onWorkerChange}
      />
    </div>
  );
};

const PopupRuleFields = ({ props }: { props: PopupRuleFormBodyProps }) => {
  const handleLocationChange = (value: string) => {
    if (value === NO_PRESET_VALUE) {
      props.onLocationChange?.(null);
      props.onRegionalPresetChange?.(false);
      return;
    }

    props.onRegionalPresetChange?.(true);
    props.onLocationChange?.(value === INHERITED_PRESET_VALUE ? null : value);
  };
  const locationValue = props.regionalPresetEnabled
    ? (props.selectedLocationId ?? INHERITED_PRESET_VALUE)
    : NO_PRESET_VALUE;
  const inheritedOption =
    (props.allowInheritedLocation || props.selectedLocationId === null) &&
    props.inheritedLocationLabel
      ? [{ value: INHERITED_PRESET_VALUE, label: props.inheritedLocationLabel }]
      : [];
  const locationOptions = [
    { value: NO_PRESET_VALUE, label: props.noPresetLabel },
    ...inheritedOption,
    ...props.locations.map((location) => ({
      value: location.id,
      label: location.label,
    })),
  ];

  return (
    <div className="gw-popup-rule-form-fields">
      <PopupSheetSelectField
        id="current-profile-select"
        label={props.locationLabel}
        value={locationValue}
        onValueChange={handleLocationChange}
        options={locationOptions}
      />
      {props.formExtra}
      <PopupSheetSelectField
        id="current-rule-mode"
        label={props.ruleTypeLabel}
        value={props.ruleMode}
        onValueChange={(value) =>
          props.onRuleModeChange?.(value === "suffix" ? "suffix" : "exact")
        }
        options={[
          { value: "exact", label: props.exactLabel },
          { value: "suffix", label: props.suffixLabel },
        ]}
      />
    </div>
  );
};

const PopupAdvancedSettings = ({ props }: { props: PopupRuleFormBodyProps }) => (
  <PopupAdvancedAccordion title={props.advancedTitle}>
    <ServiceWorkerControl props={props} />
    <WorkerHandlingControl props={props} />
    <PopupAdvancedRow
      id="current-rule-relax-csp"
      label={props.relaxCspLabel}
      hint={props.relaxCspHint}
      helpAriaLabel={props.detailsAriaLabel(props.relaxCspLabel)}
    >
      <Switch
        id="current-rule-relax-csp"
        checked={props.relaxCspForWorkers}
        {...(props.onRelaxCspChange ? { onCheckedChange: props.onRelaxCspChange } : {})}
      />
    </PopupAdvancedRow>
  </PopupAdvancedAccordion>
);

const PopupRuleActions = ({ props }: { props: PopupRuleFormBodyProps }) => (
  <div className="gw-popup-workspace-actions gw-popup-rule-form-actions">
    <PopupButton
      id="delete-current-rule"
      type="button"
      variant="secondary"
      {...(props.deleteTone === "destructive" ? { tone: "danger" as const } : {})}
      disabled={!props.canDelete}
      onClick={props.onRequestDelete}
      className="gw-popup-context-action gw-popup-sheet-delete"
    >
      <TrashIcon className="gw-popup-icon-sm" />
      {props.deleteLabel}
    </PopupButton>
    <PopupButton
      id="apply-current-profile"
      type="button"
      variant="secondary"
      tone="success"
      disabled={!props.canSave}
      onClick={props.onSave}
      className="gw-popup-context-action gw-popup-sheet-save"
    >
      {props.saveLabel}
    </PopupButton>
    <PopupButton
      id="open-full-rule-settings"
      type="button"
      variant="secondary"
      onClick={props.onOpenFullSettings}
      className="gw-popup-context-action gw-popup-full-settings"
      wide
    >
      {props.fullSettingsLabel}
      <ExternalLinkIcon className="gw-popup-icon-xs" />
    </PopupButton>
  </div>
);

export const PopupRuleFormBody = (props: PopupRuleFormBodyProps) => {
  if (props.isBodyOnlyView) return props.body ?? null;

  return (
    <div className="gw-popup-rule-editor">
      <div className="gw-popup-workspace-scroll" data-popup-scrollport="true">
        {props.preview ? (
          <div id="sheet-domain-preview" className="gw-popup-sheet-domain">
            {props.preview}
          </div>
        ) : null}
        <PopupRuleFields props={props} />
        <PopupAdvancedSettings props={props} />
      </div>
      <PopupRuleActions props={props} />
    </div>
  );
};
