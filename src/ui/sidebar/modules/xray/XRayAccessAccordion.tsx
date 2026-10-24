import type { SurfaceAssessment } from "@privacy-brand/xray-protocol";

import type { XRayInspectorController } from "./inspector/useXRayInspector";
import { XRayInspectorMethodList } from "./inspector/XRayInspectorMethodList";
import { XRayInspectorPanel } from "./inspector/XRayInspectorPanel";
import { XRayInspectorToggle } from "./inspector/XRayInspectorToggle";
import { XRayStatusDot } from "./XRayRows";

import type {
  SpoofingSurfaceMethodId,
  SurfaceMethodQueryCounts,
} from "@/shared/spoofing-surfaces";
import type { XRaySurfaceCategory } from "@/shared/types";
import { t } from "@/ui/i18n";
import { getSurfaceMethodLabels } from "@/ui/shared/surface-method-labels";

type CategoryStatus = "accessed" | "connecting" | "armed" | "off" | "failed";

const getCategoryStatus = (
  assessment: SurfaceAssessment,
  surfaceSyncPending: boolean,
): CategoryStatus => {
  // `activity` overlays (a real access or failure) win over the derived
  // protection status, exactly as before. `surfaceSyncPending` is the
  // sidebar's local "activity counters not synced yet" flag — unrelated to
  // the background Installation axis, but both surface as "connecting".
  if (assessment.activity.failed) return "failed";
  if (assessment.activity.accessed) return "accessed";
  switch (assessment.presentation) {
    case "unrecoverable":
    case "degraded":
      return "failed";
    case "protected":
    case "browser-enforced":
    case "repaired":
      return surfaceSyncPending ? "connecting" : "armed";
    case "pending":
      return "connecting";
    default:
      // native-by-policy, not-applicable, unknown
      return assessment.presentation === "unknown" && surfaceSyncPending
        ? "connecting"
        : "off";
  }
};

const categoryLabel = (category: XRaySurfaceCategory): string => {
  switch (category) {
    case "geolocation":
      return t.sidebar.accessed.categories.geolocation;
    case "timeLocale":
      return t.sidebar.accessed.categories.timeLocale;
    case "canvas":
      return t.sidebar.accessed.categories.canvas;
    case "webGL":
      return t.sidebar.accessed.categories.webGL;
    case "audio":
      return t.sidebar.accessed.categories.audio;
    case "navigator":
      return t.sidebar.accessed.categories.navigator;
    case "screen":
      return t.sidebar.accessed.categories.screen;
    case "clientHints":
      return t.sidebar.accessed.categories.clientHints;
    case "battery":
      return t.sidebar.accessed.categories.battery;
    case "webRTC":
      return t.sidebar.accessed.categories.webRTC;
    case "worker":
      return t.sidebar.accessed.categories.worker;
    case "serviceWorker":
      return t.sidebar.accessed.categories.serviceWorker;
    case "sharedWorker":
      return t.sidebar.accessed.categories.sharedWorker;
  }
};

const STATUS_DOT: Record<CategoryStatus, string> = {
  failed: "bg-red-500/80",
  accessed: "bg-yellow-500",
  connecting: "bg-green-500/50 animate-pulse",
  armed: "bg-green-500",
  off: "bg-muted-foreground/30",
};

const statusLabel = (status: CategoryStatus): string => {
  switch (status) {
    case "failed":
      return t.sidebar.accessed.failed;
    case "accessed":
      return t.sidebar.accessed.accessed;
    case "connecting":
      return t.sidebar.accessed.connecting;
    case "armed":
      return t.sidebar.accessed.armed;
    case "off":
      return t.sidebar.accessed.off;
  }
};

export interface XRayInspectorBinding {
  active: boolean;
  onActiveChange: (active: boolean) => void;
  controller: XRayInspectorController;
  showFirefoxHint: boolean;
}

const mergeMethodCounts = (
  assessments: readonly SurfaceAssessment[],
): SurfaceMethodQueryCounts =>
  Object.assign(
    {},
    ...assessments.map((assessment) => assessment.activity.methodCounts),
  );

export const XRayAccessAccordion = ({
  assessments,
  surfaceSyncPending,
  inspector,
}: {
  assessments: SurfaceAssessment[];
  surfaceSyncPending: boolean;
  inspector?: XRayInspectorBinding;
}) => {
  const methodLabels = getSurfaceMethodLabels();
  const applicable = assessments.filter(
    (assessment) => assessment.applicability === "applicable",
  );
  const inspectorState = inspector?.active ? inspector.controller.state : null;
  const selecting = inspectorState?.available === true;
  return (
    <section
      className="flex flex-col gap-1"
      data-xray-section="page-activity"
      data-xray-inspector={inspector?.active ? "on" : "off"}
    >
      <div className="mb-1 flex min-h-7 items-center justify-between gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide">
          {t.sidebar.accessed.title}
        </h3>
        {inspector ? (
          <XRayInspectorToggle
            active={inspector.active}
            onActiveChange={inspector.onActiveChange}
            controller={inspector.controller}
          />
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground mb-2">
        {t.sidebar.accessed.description}
      </p>
      {inspector?.active ? (
        <div className="mb-3">
          <XRayInspectorPanel
            controller={inspector.controller}
            showFirefoxHint={inspector.showFirefoxHint}
          />
        </div>
      ) : null}
      {selecting && inspector ? (
        <XRayInspectorMethodList
          categories={applicable.map((assessment) => assessment.key)}
          categoryLabel={categoryLabel}
          methodCounts={mergeMethodCounts(applicable)}
          trappableMethodIds={inspectorState.trappableMethodIds}
          selection={inspector.controller.selection}
          disabled={inspector.controller.pending !== null}
          onSelectionChange={inspector.controller.setSelection}
        />
      ) : (
        <div className="flex flex-col gap-0.5">
          {applicable.map((assessment) => {
            const cat = assessment.key;
            const status = getCategoryStatus(assessment, surfaceSyncPending);
            const count = assessment.activity.queryCount;
            const visibleMethods = Object.entries(assessment.activity.methodCounts)
              .map(([id, methodCount]) => ({
                id: id as SpoofingSurfaceMethodId,
                count: methodCount,
              }))
              .filter(
                (method): method is { id: SpoofingSurfaceMethodId; count: number } =>
                  typeof method.count === "number" && method.count > 0,
              );
            const row = (
              <div className="flex items-center justify-between gap-2 py-1">
                <span className="text-xs text-muted-foreground">
                  {categoryLabel(cat)}
                </span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <XRayStatusDot className={STATUS_DOT[status]} />
                  <span className="text-xs text-muted-foreground">
                    {status === "accessed" && cat === "serviceWorker"
                      ? t.sidebar.accessed.blocked
                      : statusLabel(status)}
                    {status === "accessed" && count != null && count > 0
                      ? ` (${count})`
                      : ""}
                  </span>
                </div>
              </div>
            );
            if (visibleMethods.length === 0) {
              return <div key={cat}>{row}</div>;
            }
            return (
              <details key={cat} className="group">
                <summary className="list-none cursor-pointer [&::-webkit-details-marker]:hidden">
                  {row}
                </summary>
                <div className="ml-3 border-l border-border/60 pl-3 py-1">
                  {visibleMethods.map((method) => (
                    <div
                      key={method.id}
                      className="flex items-center justify-between gap-2 py-0.5"
                    >
                      <span className="text-[11px] text-muted-foreground/80">
                        {methodLabels[method.id]}
                      </span>
                      <span className="text-[11px] text-muted-foreground/80 tabular-nums">
                        {method.count}
                      </span>
                    </div>
                  ))}
                </div>
              </details>
            );
          })}
        </div>
      )}
    </section>
  );
};
