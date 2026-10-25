import { useId } from "react";

import type {
  XRayInspectorApply,
  XRayInspectorState,
  XRayInspectorUnavailableReason,
} from "./inspector-contract";
import type { InspectorResult, XRayInspectorController } from "./useXRayInspector";

import { cn } from "@/ui/components/lib/utils";
import { Button } from "@/ui/components/ui/button";
import { Label } from "@/ui/components/ui/label";
import { Switch } from "@/ui/components/ui/switch";
import { t } from "@/ui/i18n";

type ActionSet = "arm" | "apply" | "disarm";

/** The one action group the panel offers for the current state, if any. */
export const getInspectorActionSet = (
  controller: Pick<XRayInspectorController, "state" | "dirty" | "armableMethodIds">,
): ActionSet | null => {
  const { state, dirty, armableMethodIds } = controller;
  if (!state?.available) return null;
  const hasSelection = armableMethodIds.length > 0;
  if (!state.armed) return hasSelection ? "arm" : null;
  if (!dirty) return "disarm";
  return hasSelection ? "apply" : "disarm";
};

export type InspectorPhase = "loading" | "unavailable" | "idle" | "armed" | "changed";

export const getInspectorPhase = (
  controller: Pick<XRayInspectorController, "state" | "dirty">,
): InspectorPhase => {
  const { state, dirty } = controller;
  if (!state) return "loading";
  if (!state.available) return "unavailable";
  if (!state.armed) return "idle";
  return dirty ? "changed" : "armed";
};

const ACTION_LABELS = {
  arm: {
    live: t.sidebar.inspector.actions.arm,
    reload: t.sidebar.inspector.actions.armReload,
    nextLoad: t.sidebar.inspector.actions.armNextLoad,
  },
  apply: {
    live: t.sidebar.inspector.actions.apply,
    reload: t.sidebar.inspector.actions.applyReload,
    nextLoad: t.sidebar.inspector.actions.applyNextLoad,
  },
  disarm: {
    live: t.sidebar.inspector.actions.disarm,
    reload: t.sidebar.inspector.actions.disarmReload,
    nextLoad: t.sidebar.inspector.actions.disarmNextLoad,
  },
};

const APPLIED_VIA_LABELS = {
  live: t.sidebar.inspector.result.live,
  reload: t.sidebar.inspector.result.reload,
  "next-load": t.sidebar.inspector.result.nextLoad,
};

const resultMessage = (result: InspectorResult): string => {
  const outcome =
    result.kind === "armed"
      ? t.sidebar.inspector.result.armed(result.count)
      : t.sidebar.inspector.result.disarmed;
  return `${outcome} ${APPLIED_VIA_LABELS[result.appliedVia]}`;
};

/** Guidance the panel shows only when the user has something to do or wait for. */
const statusHint = (
  phase: InspectorPhase,
  controller: XRayInspectorController,
  state: XRayInspectorState,
): string | null => {
  if (phase === "changed") {
    return controller.armableMethodIds.length > 0
      ? t.sidebar.inspector.hint.changed
      : t.sidebar.inspector.hint.changedToEmpty;
  }
  if (state.pendingReload) {
    return phase === "armed"
      ? t.sidebar.inspector.hint.pendingArm
      : t.sidebar.inspector.hint.pendingDisarm;
  }
  return phase === "idle" && controller.armableMethodIds.length === 0
    ? t.sidebar.inspector.hint.empty
    : null;
};

const ActionButtons = ({
  actionSet,
  controller,
  state,
  className,
}: {
  actionSet: ActionSet;
  controller: XRayInspectorController;
  state: XRayInspectorState;
  className?: string;
}) => {
  const countId = useId();
  const labels = ACTION_LABELS[actionSet];
  const busy = controller.pending !== null;
  const describesSelection = actionSet !== "disarm";
  const run = (apply: XRayInspectorApply) => {
    if (actionSet === "disarm") controller.disarm(apply);
    else controller.apply(apply);
  };
  const isRunning = (apply: XRayInspectorApply) => controller.pending?.apply === apply;
  const spinner = (
    <i
      className="fa-solid fa-circle-notch fa-spin mr-1.5 text-[10px]"
      aria-hidden="true"
    />
  );
  const primaryVariant = actionSet === "disarm" ? "outline" : "default";

  return (
    <div
      className={cn("flex flex-wrap gap-2", className)}
      data-inspector-actions={actionSet}
    >
      {describesSelection ? (
        <span id={countId} className="sr-only">
          {t.sidebar.inspector.hint.ready(controller.armableMethodIds.length)}
        </span>
      ) : null}
      <Button
        size="sm"
        variant={primaryVariant}
        disabled={busy}
        aria-busy={isRunning("now") || undefined}
        aria-describedby={describesSelection ? countId : undefined}
        data-inspector-apply="now"
        onClick={() => run("now")}
      >
        {isRunning("now") ? spinner : null}
        {state.appliesLive ? labels.live : labels.reload}
      </Button>
      {state.appliesLive ? null : (
        <Button
          size="sm"
          variant={actionSet === "disarm" ? "ghost" : "outline"}
          disabled={busy}
          aria-busy={isRunning("next-load") || undefined}
          aria-describedby={describesSelection ? countId : undefined}
          data-inspector-apply="next-load"
          onClick={() => run("next-load")}
        >
          {isRunning("next-load") ? spinner : null}
          {labels.nextLoad}
        </Button>
      )}
      {controller.dirty ? (
        <Button
          size="sm"
          variant="ghost"
          disabled={busy}
          data-inspector-revert
          onClick={controller.revert}
        >
          {t.sidebar.inspector.actions.revert}
        </Button>
      ) : null}
    </div>
  );
};

const Notice = ({ icon, children }: { icon: string; children: string }) => (
  <p className="flex gap-2 text-[11px] leading-snug text-muted-foreground">
    <i className={`${icon} mt-[2px] shrink-0 text-[10px]`} aria-hidden="true" />
    <span>{children}</span>
  </p>
);

const panelClassName =
  "flex flex-col gap-3 rounded-lg border border-border/70 bg-card/60 p-3";

const PlaceholderPanel = ({ loadError }: { loadError: string | null }) => (
  <div
    className={panelClassName}
    data-xray-inspector-panel
    data-inspector-phase="loading"
  >
    {loadError ? (
      <p role="alert" className="text-xs text-tone-error-text">
        {t.sidebar.inspector.loadError(loadError)}
      </p>
    ) : (
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <i className="fa-solid fa-circle-notch fa-spin" aria-hidden="true" />
        {t.sidebar.inspector.loading}
      </p>
    )}
  </div>
);

const UNAVAILABLE_REASONS: Record<XRayInspectorUnavailableReason, string> = {
  "unsupported-url": t.sidebar.inspector.unavailable.unsupportedUrl,
  "trusted-site": t.sidebar.inspector.unavailable.trustedSite,
  "protection-paused": t.sidebar.inspector.unavailable.protectionPaused,
  "no-runtime": t.sidebar.inspector.unavailable.noRuntime,
};

const UnavailablePanel = ({ state }: { state: XRayInspectorState }) => {
  const reason = state.unavailableReason ?? "no-runtime";
  return (
    <div
      className={panelClassName}
      data-xray-inspector-panel
      data-inspector-phase="unavailable"
      data-inspector-unavailable={reason}
    >
      <div className="flex items-start gap-2">
        <i
          className="fa-solid fa-circle-info mt-[2px] text-xs text-muted-foreground"
          aria-hidden="true"
        />
        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium">{t.sidebar.inspector.unavailable.title}</p>
          <p className="text-xs text-muted-foreground">{UNAVAILABLE_REASONS[reason]}</p>
        </div>
      </div>
    </div>
  );
};

const StatusBlock = ({
  phase,
  controller,
  state,
}: {
  phase: InspectorPhase;
  controller: XRayInspectorController;
  state: XRayInspectorState;
}) => {
  const hint = statusHint(phase, controller, state);
  const canReloadNow =
    state.pendingReload && !controller.dirty && controller.pending === null;
  if (!hint && !controller.actionError) return null;
  return (
    <div className="flex flex-col items-start gap-1.5">
      {hint ? (
        <p className="text-xs text-foreground/80" data-inspector-hint>
          {hint}
          {canReloadNow ? (
            <Button
              variant="link"
              size="sm"
              className="ml-1 h-auto p-0 text-xs"
              data-inspector-reload-now
              onClick={() =>
                state.armed ? controller.apply("now") : controller.disarm("now")
              }
            >
              {t.sidebar.inspector.actions.reloadNow}
            </Button>
          ) : null}
        </p>
      ) : null}
      {controller.actionError ? (
        <p role="alert" className="text-xs text-tone-error-text">
          {t.sidebar.inspector.actionError(controller.actionError)}
        </p>
      ) : null}
    </div>
  );
};

/**
 * The mode switch and the actions. A single action shares the switch row; several
 * actions get their own row so nothing wraps mid-group at popup width.
 */
const Controls = ({
  actionSet,
  controller,
  state,
}: {
  actionSet: ActionSet | null;
  controller: XRayInspectorController;
  state: XRayInspectorState;
}) => {
  const switchId = useId();
  const hintId = useId();
  const everyCall = controller.mode === "every-call";
  const singleAction = state.appliesLive && !controller.dirty;
  const actions = actionSet ? (
    <ActionButtons
      actionSet={actionSet}
      controller={controller}
      state={state}
      className={singleAction ? "shrink-0" : "mt-0.5"}
    />
  ) : null;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-h-8 min-w-0 items-center gap-2">
          <Switch
            id={switchId}
            checked={everyCall}
            disabled={controller.pending !== null}
            aria-describedby={hintId}
            data-inspector-mode={controller.mode}
            onCheckedChange={(checked) =>
              controller.setMode(checked ? "every-call" : "first-call")
            }
          />
          <Label htmlFor={switchId} className="text-xs">
            {t.sidebar.inspector.everyCall}
          </Label>
        </div>
        {singleAction ? actions : null}
      </div>
      {everyCall ? (
        <p
          id={hintId}
          className="flex gap-2 rounded-md border border-tone-warning-border bg-tone-warning-bg px-2 py-1.5 text-[11px] leading-snug text-tone-warning-text"
          data-inspector-every-call-warning
        >
          <i
            className="fa-solid fa-triangle-exclamation mt-[2px] shrink-0 text-[10px]"
            aria-hidden="true"
          />
          <span>{t.sidebar.inspector.everyCallWarning}</span>
        </p>
      ) : (
        <p id={hintId} className="text-[11px] leading-snug text-muted-foreground">
          {t.sidebar.inspector.firstCallHint}
        </p>
      )}
      {singleAction ? null : actions}
      {actionSet && !state.appliesLive ? (
        <p className="text-[11px] leading-snug text-muted-foreground">
          {t.sidebar.inspector.reloadNote}
        </p>
      ) : null}
    </div>
  );
};

export const XRayInspectorPanel = ({
  controller,
  showFirefoxHint,
}: {
  controller: XRayInspectorController;
  showFirefoxHint: boolean;
}) => {
  const { state } = controller;
  if (!state) return <PlaceholderPanel loadError={controller.loadError} />;
  if (!state.available) return <UnavailablePanel state={state} />;

  const phase = getInspectorPhase(controller);
  const actionSet = getInspectorActionSet(controller);

  return (
    <div
      className={panelClassName}
      data-xray-inspector-panel
      data-inspector-phase={phase}
      data-inspector-pending-reload={state.pendingReload}
      data-inspector-applies-live={state.appliesLive}
    >
      <p className="text-xs text-muted-foreground">{t.sidebar.inspector.intro}</p>
      <StatusBlock phase={phase} controller={controller} state={state} />
      <Controls actionSet={actionSet} controller={controller} state={state} />
      <div className="flex flex-col gap-1 border-t border-border/50 pt-2">
        <Notice icon="fa-solid fa-stopwatch">{t.sidebar.inspector.pauseNotice}</Notice>
        {showFirefoxHint ? (
          <Notice icon="fa-solid fa-circle-info">
            {t.sidebar.inspector.firefoxNotice}
          </Notice>
        ) : null}
      </div>
      {/* Always mounted so screen readers announce the apply result; the status
          dot and the panel already show it visually. */}
      <div
        role="status"
        className="sr-only"
        data-inspector-result={controller.result?.kind}
      >
        {controller.result ? resultMessage(controller.result) : null}
      </div>
    </div>
  );
};
