import type { SurfaceAssessment } from "@privacy-brand/xray-protocol";

import { XRayStatusDot } from "./XRayRows";

import type { SpoofingSurfaceMethodId } from "@/shared/spoofing-surfaces";
import type { XRaySurfaceCategory } from "@/shared/types";
import { t } from "@/ui/i18n";
import { SURFACE_METHOD_LABELS } from "@/ui/shared/surface-method-labels";

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

const CATEGORY_LABELS: Record<XRaySurfaceCategory, string> = {
  geolocation: t.sidebar.accessed.categories.geolocation,
  timeLocale: t.sidebar.accessed.categories.timeLocale,
  canvas: t.sidebar.accessed.categories.canvas,
  webGL: t.sidebar.accessed.categories.webGL,
  audio: t.sidebar.accessed.categories.audio,
  navigator: t.sidebar.accessed.categories.navigator,
  screen: t.sidebar.accessed.categories.screen,
  clientHints: t.sidebar.accessed.categories.clientHints,
  battery: t.sidebar.accessed.categories.battery,
  webRTC: t.sidebar.accessed.categories.webRTC,
  worker: t.sidebar.accessed.categories.worker,
  serviceWorker: t.sidebar.accessed.categories.serviceWorker,
  sharedWorker: t.sidebar.accessed.categories.sharedWorker,
};

const STATUS_DOT: Record<CategoryStatus, string> = {
  failed: "bg-red-500/80",
  accessed: "bg-yellow-500",
  connecting: "bg-green-500/50 animate-pulse",
  armed: "bg-green-500",
  off: "bg-muted-foreground/30",
};

const STATUS_LABEL: Record<CategoryStatus, string> = {
  failed: t.sidebar.accessed.failed,
  accessed: t.sidebar.accessed.accessed,
  connecting: t.sidebar.accessed.connecting,
  armed: t.sidebar.accessed.armed,
  off: t.sidebar.accessed.off,
};

export const XRayAccessAccordion = ({
  assessments,
  surfaceSyncPending,
}: {
  assessments: SurfaceAssessment[];
  surfaceSyncPending: boolean;
}) => (
  <section className="flex flex-col gap-1" data-xray-section="page-activity">
    <h3 className="text-xs font-semibold uppercase tracking-wide mb-1">
      {t.sidebar.accessed.title}
    </h3>
    <p className="text-xs text-muted-foreground mb-2">
      {t.sidebar.accessed.description}
    </p>
    <div className="flex flex-col gap-0.5">
      {assessments
        .filter((assessment) => assessment.applicability === "applicable")
        .map((assessment) => {
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
                {CATEGORY_LABELS[cat]}
              </span>
              <div className="flex items-center gap-1.5 shrink-0">
                <XRayStatusDot className={STATUS_DOT[status]} />
                <span className="text-xs text-muted-foreground">
                  {status === "accessed" && cat === "serviceWorker"
                    ? t.sidebar.accessed.blocked
                    : STATUS_LABEL[status]}
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
                      {SURFACE_METHOD_LABELS[method.id as SpoofingSurfaceMethodId]}
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
  </section>
);
