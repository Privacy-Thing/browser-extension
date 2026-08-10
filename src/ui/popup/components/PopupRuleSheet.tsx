import { useEffect, useLayoutEffect, useRef } from "react";

import { PopupRuleFormBody, type PopupRuleFormBodyProps } from "./popup-rule-form";
import { PopupButton, type PopupButtonVariant } from "./PopupButton";
import { TrashIcon } from "./PopupIcons";

import type { SharedWorkerHandlingMode } from "@/shared/types";

export type PopupRuleSheetProps = {
  open: boolean;
  drillIn?: boolean;
  view:
    | "rule-form"
    | "delete-confirm"
    | "cleanup-confirm"
    | "protection-details"
    | "notification-list"
    | "notification-detail"
    | "cleanup-result"
    | "rule-conflict-confirm";
  busy?: boolean;
  errorMessage?: string;
  title: string;
  titleTooltip?: string;
  description: string;
  preview?: React.ReactNode;
  body?: React.ReactNode;
  formExtra?: React.ReactNode;
  selectedLocationId?: string | null;
  allowInheritedLocation?: boolean;
  inheritedLocationLabel?: string;
  noPresetLabel: string;
  regionalPresetEnabled?: boolean;
  locations: Array<{ id: string; label: string }>;
  ruleMode: "exact" | "suffix";
  serviceWorkerOverride?: boolean | undefined;
  workerHandlingOverride?: SharedWorkerHandlingMode | undefined;
  relaxCspForWorkers: boolean;
  locationLabel: string;
  ruleTypeLabel: string;
  exactLabel: string;
  suffixLabel: string;
  advancedTitle: string;
  serviceWorkerLabel: string;
  serviceWorkerHint: string;
  serviceWorkerBlockLabel: string;
  serviceWorkerInherit: string;
  serviceWorkerAllowLabel: string;
  workerHandlingLabel: string;
  workerHandlingHint: string;
  workerInherit: string;
  workerNative: string;
  workerHandlingSpoofLabel: string;
  workerStrict: string;
  relaxCspLabel: string;
  relaxCspHint: string;
  detailsAriaLabel: (label: string) => string;
  fullSettingsLabel: string;
  saveLabel: string;
  deleteLabel: string;
  closeAriaLabel: string;
  closeLabel: string;
  backLabel: string;
  cancelLabel: string;
  confirmTitle?: string;
  confirmDescription?: string;
  confirmActionLabel?: string;
  confirmTone?: "default" | "secondary" | "warning" | "destructive";
  confirmIcon?: React.ReactNode;
  canDelete?: boolean;
  canSave?: boolean;
  deleteTone?: "secondary" | "destructive";
  onOpenChange?: (open: boolean) => void;
  onLocationChange?: (id: string | null) => void;
  onRegionalPresetChange?: (enabled: boolean) => void;
  onRuleModeChange?: (mode: "exact" | "suffix") => void;
  onServiceWorkerChange?: (value: boolean | undefined) => void;
  onWorkerChange?: (value: SharedWorkerHandlingMode | undefined) => void;
  onRelaxCspChange?: (checked: boolean) => void;
  onOpenFullSettings?: () => void;
  onSave?: () => void;
  onRequestDelete?: () => void;
  onConfirmAction?: () => void;
  onBack?: () => void;
  onCloseHandleReady?: (close: () => void) => void;
};

type PopupRuleSheetView = PopupRuleSheetProps["view"];
type ConfirmTone = NonNullable<PopupRuleSheetProps["confirmTone"]>;

const isConfirmSheetView = (view: PopupRuleSheetView): boolean =>
  view === "delete-confirm" ||
  view === "cleanup-confirm" ||
  view === "rule-conflict-confirm";

const isBodyOnlySheetView = (view: PopupRuleSheetView): boolean =>
  view === "protection-details" ||
  view === "notification-list" ||
  view === "notification-detail" ||
  view === "cleanup-result";

const hasFixedSheetActions = (view: PopupRuleSheetView): boolean =>
  view === "rule-form" ||
  view === "protection-details" ||
  view === "notification-detail";

const hasWorkspaceBack = (props: PopupRuleSheetProps): boolean =>
  Boolean(props.drillIn) ||
  isConfirmSheetView(props.view) ||
  props.view === "notification-detail" ||
  props.view === "cleanup-result";

const getConfirmButtonVariant = (tone: ConfirmTone): PopupButtonVariant => {
  if (tone === "destructive") return "destructive";
  if (tone === "secondary" || tone === "warning") return "secondary";
  return "primary";
};

const getConfirmButtonTone = (tone: ConfirmTone): "neutral" | "warning" | "danger" => {
  if (tone === "warning") return "warning";
  if (tone === "destructive") return "danger";
  return "neutral";
};

type ConfirmSheetProps = {
  title?: string;
  description?: string;
  actionLabel?: string;
  tone: ConfirmTone;
  confirmIcon?: React.ReactNode;
  backLabel: string;
  onConfirm?: () => void;
  onBack?: () => void;
};

const PopupConfirmSheetView = (props: ConfirmSheetProps) => (
  <div className="gw-popup-sheet-confirm" data-tone={props.tone}>
    <div className="gw-popup-sheet-confirm-content">
      <div className="gw-popup-sheet-confirm-message">
        <div className="gw-popup-sheet-confirm-icon">
          {props.confirmIcon ?? <TrashIcon className="gw-popup-icon-lg" />}
        </div>
        <div className="gw-popup-sheet-confirm-copy">
          <h3 className="gw-popup-sheet-confirm-title">{props.title}</h3>
          {props.description ? (
            <p className="gw-popup-sheet-confirm-description">{props.description}</p>
          ) : null}
        </div>
      </div>
    </div>
    <div className="gw-popup-sheet-confirm-actions">
      <PopupButton
        id="confirm-sheet-action"
        type="button"
        variant={getConfirmButtonVariant(props.tone)}
        onClick={props.onConfirm}
        className="gw-popup-confirm-action"
        tone={getConfirmButtonTone(props.tone)}
      >
        {props.actionLabel}
      </PopupButton>
      <PopupButton
        id="confirm-sheet-back"
        type="button"
        variant="ghost"
        onClick={props.onBack}
        className="gw-popup-confirm-back"
      >
        {props.backLabel}
      </PopupButton>
    </div>
  </div>
);

const buildConfirmProps = (props: PopupRuleSheetProps): ConfirmSheetProps => {
  const confirmProps: ConfirmSheetProps = {
    tone: props.confirmTone ?? "destructive",
    backLabel: props.view === "delete-confirm" ? props.backLabel : props.cancelLabel,
  };
  if (props.confirmTitle) confirmProps.title = props.confirmTitle;
  if (props.confirmDescription) confirmProps.description = props.confirmDescription;
  if (props.confirmActionLabel) confirmProps.actionLabel = props.confirmActionLabel;
  if (props.confirmIcon) confirmProps.confirmIcon = props.confirmIcon;
  if (props.onConfirmAction) confirmProps.onConfirm = props.onConfirmAction;
  if (props.onBack) confirmProps.onBack = props.onBack;
  return confirmProps;
};

const syncScrollCue = (scrollport: HTMLElement): void => {
  const isScrollable = scrollport.scrollHeight > scrollport.clientHeight + 1;
  const atTop = !isScrollable || scrollport.scrollTop <= 1;
  const atBottom =
    !isScrollable ||
    scrollport.scrollTop + scrollport.clientHeight >= scrollport.scrollHeight - 1;
  scrollport.dataset.scrollAtTop = String(atTop);
  scrollport.dataset.scrollAtBottom = String(atBottom);
};

const syncWorkspaceCue = (workspace: HTMLElement, scrollport: HTMLElement): void => {
  workspace.dataset.scrollAtTop = scrollport.dataset.scrollAtTop ?? "true";
  workspace.dataset.scrollAtBottom = scrollport.dataset.scrollAtBottom ?? "true";
};

const useSheetScrollCues = (
  workspaceRef: React.RefObject<HTMLDivElement | null>,
  props: PopupRuleSheetProps,
): void => {
  useLayoutEffect(() => {
    const workspace = workspaceRef.current;
    if (!workspace) return;
    const scrollports = [
      ...workspace.querySelectorAll<HTMLElement>("[data-popup-scrollport]"),
    ];
    if (scrollports.length === 0) return;

    const syncAll = () => {
      for (const scrollport of scrollports) syncScrollCue(scrollport);
      const primary = scrollports[0];
      if (primary) syncWorkspaceCue(workspace, primary);
    };
    const handleScroll = (event: Event) => {
      const scrollport = event.currentTarget;
      if (!(scrollport instanceof HTMLElement)) return;
      syncScrollCue(scrollport);
      syncWorkspaceCue(workspace, scrollport);
    };

    syncAll();
    for (const scrollport of scrollports) {
      scrollport.addEventListener("scroll", handleScroll, { passive: true });
    }
    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(syncAll);
    for (const scrollport of scrollports) observer?.observe(scrollport);

    return () => {
      observer?.disconnect();
      for (const scrollport of scrollports) {
        scrollport.removeEventListener("scroll", handleScroll);
      }
    };
  }, [
    props.body,
    props.formExtra,
    props.open,
    props.preview,
    props.view,
    workspaceRef,
  ]);
};

const useSheetLifecycle = (
  props: PopupRuleSheetProps,
  closeButtonRef: React.RefObject<HTMLButtonElement | null>,
  workspaceRef: React.RefObject<HTMLDivElement | null>,
): void => {
  const { onCloseHandleReady, onOpenChange, open } = props;
  const onOpenChangeRef = useRef(onOpenChange);
  const restoreFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    onCloseHandleReady?.(() => closeButtonRef.current?.click());
  }, [closeButtonRef, onCloseHandleReady]);

  useEffect(() => {
    onOpenChangeRef.current = onOpenChange;
  }, [onOpenChange]);

  useEffect(() => {
    if (!open) return;
    restoreFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    workspaceRef.current?.focus({ preventScroll: true });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      onOpenChangeRef.current?.(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      restoreFocusRef.current?.focus();
    };
  }, [open, workspaceRef]);
};

const PopupSheetHeader = ({
  props,
  closeButtonRef,
}: {
  props: PopupRuleSheetProps;
  closeButtonRef: React.RefObject<HTMLButtonElement | null>;
}) => {
  const isConfirmView = isConfirmSheetView(props.view);
  const showBack = hasWorkspaceBack(props);
  return (
    <header
      className="gw-popup-sheet-header"
      data-confirm-view={isConfirmView ? "true" : undefined}
    >
      <PopupButton
        ref={closeButtonRef}
        id="close-rule-settings"
        title={props.closeAriaLabel}
        aria-label={showBack ? props.backLabel : props.closeAriaLabel}
        variant="ghost"
        size="sm"
        className="gw-popup-sheet-close"
        data-back={showBack ? "true" : undefined}
        onClick={() => (showBack ? props.onBack?.() : props.onOpenChange?.(false))}
      >
        <span className="gw-popup-workspace-back-label">
          {showBack ? props.backLabel : props.closeLabel}
        </span>
      </PopupButton>
      <h2
        id="popup-workspace-title"
        className="gw-popup-sheet-title"
        title={props.titleTooltip ?? props.title}
      >
        {props.title}
      </h2>
      {!isConfirmView ? (
        <p id="popup-workspace-description" className="sr-only">
          {props.description}
        </p>
      ) : null}
    </header>
  );
};

const buildRuleFormProps = (props: PopupRuleSheetProps): PopupRuleFormBodyProps => ({
  body: props.body,
  preview: props.preview,
  formExtra: props.formExtra,
  isBodyOnlyView: isBodyOnlySheetView(props.view),
  selectedLocationId: props.selectedLocationId,
  regionalPresetEnabled: props.regionalPresetEnabled ?? true,
  allowInheritedLocation: props.allowInheritedLocation ?? false,
  inheritedLocationLabel: props.inheritedLocationLabel,
  noPresetLabel: props.noPresetLabel,
  locations: props.locations,
  locationLabel: props.locationLabel,
  onLocationChange: props.onLocationChange,
  onRegionalPresetChange: props.onRegionalPresetChange,
  ruleTypeLabel: props.ruleTypeLabel,
  ruleMode: props.ruleMode,
  onRuleModeChange: props.onRuleModeChange,
  exactLabel: props.exactLabel,
  suffixLabel: props.suffixLabel,
  advancedTitle: props.advancedTitle,
  serviceWorkerLabel: props.serviceWorkerLabel,
  serviceWorkerHint: props.serviceWorkerHint,
  serviceWorkerBlockLabel: props.serviceWorkerBlockLabel,
  serviceWorkerInherit: props.serviceWorkerInherit,
  serviceWorkerAllowLabel: props.serviceWorkerAllowLabel,
  serviceWorkerOverride: props.serviceWorkerOverride,
  onServiceWorkerChange: props.onServiceWorkerChange,
  workerHandlingLabel: props.workerHandlingLabel,
  workerHandlingHint: props.workerHandlingHint,
  workerInherit: props.workerInherit,
  workerNative: props.workerNative,
  workerHandlingSpoofLabel: props.workerHandlingSpoofLabel,
  workerStrict: props.workerStrict,
  workerHandlingOverride: props.workerHandlingOverride,
  onWorkerChange: props.onWorkerChange,
  relaxCspLabel: props.relaxCspLabel,
  relaxCspHint: props.relaxCspHint,
  detailsAriaLabel: props.detailsAriaLabel,
  relaxCspForWorkers: props.relaxCspForWorkers,
  onRelaxCspChange: props.onRelaxCspChange,
  fullSettingsLabel: props.fullSettingsLabel,
  onOpenFullSettings: props.onOpenFullSettings,
  deleteTone: props.deleteTone ?? "destructive",
  canDelete: props.canDelete ?? false,
  onRequestDelete: props.onRequestDelete,
  deleteLabel: props.deleteLabel,
  canSave: props.canSave ?? true,
  onSave: props.onSave,
  saveLabel: props.saveLabel,
});

const PopupSheetContent = ({ props }: { props: PopupRuleSheetProps }) => {
  if (isConfirmSheetView(props.view)) {
    return <PopupConfirmSheetView {...buildConfirmProps(props)} />;
  }
  return (
    <div
      className="gw-popup-workspace-body"
      data-fixed-actions={hasFixedSheetActions(props.view) ? "true" : undefined}
      data-view={props.view}
    >
      <PopupRuleFormBody {...buildRuleFormProps(props)} />
    </div>
  );
};

export const PopupRuleSheet = (props: PopupRuleSheetProps) => {
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const workspaceRef = useRef<HTMLDivElement | null>(null);
  useSheetLifecycle(props, closeButtonRef, workspaceRef);
  useSheetScrollCues(workspaceRef, props);

  if (!props.open) return null;
  return (
    <div
      ref={workspaceRef}
      role="dialog"
      tabIndex={-1}
      aria-labelledby="popup-workspace-title"
      aria-describedby={
        !isConfirmSheetView(props.view) ? "popup-workspace-description" : undefined
      }
      aria-busy={props.busy ?? false}
      className="gw-popup-workspace gw-popup-sheet"
    >
      <PopupSheetHeader props={props} closeButtonRef={closeButtonRef} />
      {props.errorMessage ? (
        <div className="gw-popup-sheet-error" role="alert">
          {props.errorMessage}
        </div>
      ) : null}
      <PopupSheetContent props={props} />
    </div>
  );
};
