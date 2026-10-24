import type { XRayInspectorController } from "./useXRayInspector";
import { getInspectorPhase, type InspectorPhase } from "./XRayInspectorPanel";

import { cn } from "@/ui/components/lib/utils";
import { Button } from "@/ui/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/ui/components/ui/tooltip";
import { t } from "@/ui/i18n";

type InspectorStatus = Extract<InspectorPhase, "idle" | "armed" | "changed">;

const STATUS_DOT: Record<InspectorStatus, string> = {
  idle: "bg-tone-error-text",
  armed: "bg-tone-success-text",
  changed: "bg-tone-warning-text",
};

/** The arming status for the toggle dot; a closed, unarmed Inspector shows none. */
const getInspectorStatus = (
  active: boolean,
  controller: Pick<XRayInspectorController, "state" | "dirty">,
): InspectorStatus | null => {
  const phase = getInspectorPhase(controller);
  if (phase === "loading" || phase === "unavailable") return null;
  return active || phase !== "idle" ? phase : null;
};

const statusText = (
  status: InspectorStatus,
  controller: XRayInspectorController,
): string => {
  if (status === "armed") {
    return t.sidebar.inspector.status.armed(controller.state?.methodIds.length ?? 0);
  }
  return status === "changed"
    ? t.sidebar.inspector.status.changed
    : t.sidebar.inspector.status.idle;
};

export const XRayInspectorToggle = ({
  active,
  onActiveChange,
  controller,
}: {
  active: boolean;
  onActiveChange: (active: boolean) => void;
  controller: XRayInspectorController;
}) => {
  const status = getInspectorStatus(active, controller);
  const label = status ? statusText(status, controller) : null;
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={active ? "secondary" : "ghost"}
            size="sm"
            className="h-7 gap-1.5 px-2 text-xs"
            aria-pressed={active}
            data-xray-inspector-toggle={active ? "on" : "off"}
            data-inspector-armed={controller.state?.armed === true}
            onClick={() => onActiveChange(!active)}
          >
            <i className="fa-solid fa-crosshairs text-[11px]" aria-hidden="true" />
            {t.sidebar.inspector.toggle}
            {status && label ? (
              <>
                <span
                  className={cn("size-2 shrink-0 rounded-full", STATUS_DOT[status])}
                  aria-hidden="true"
                  data-inspector-status={status}
                />
                <span className="sr-only">{`(${label})`}</span>
              </>
            ) : null}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" align="end" className="max-w-64 text-xs">
          {label ? (
            <p className="font-medium" data-inspector-status-tooltip>
              {label}
            </p>
          ) : null}
          <p className={label ? "text-muted-foreground" : undefined}>
            {t.sidebar.inspector.toggleHint}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
