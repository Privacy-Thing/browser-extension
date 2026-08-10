import { BUILD_BROWSER_TARGET } from "@/shared/build-flags";
import type {
  ResolutionExplanation,
  RuleResolutionStep,
  RuleResolutionStepStatus,
} from "@/shared/rule-resolution-explanation";
import { cn } from "@/ui/components/lib/utils";
import { t } from "@/ui/i18n";

// ── Display-layer source type ─────────────────────────────────────────────────
// exact-rule and suffix-rule are merged into a single "domain-rule" node here.
type DisplaySource = "trusted-site" | "domain-rule" | "container" | "fallback" | "none";

interface DisplayStep {
  source: DisplaySource;
  status: RuleResolutionStepStatus;
  pattern: string | undefined;
  tooltip: string;
}

// ── Status priority (higher = better) ────────────────────────────────────────
const STATUS_PRIORITY: Record<RuleResolutionStepStatus, number> = {
  won: 4,
  skipped: 3,
  disabled: 2,
  "no-match": 1,
};

const bestStatus = (steps: RuleResolutionStep[]): RuleResolutionStep =>
  steps.reduce((best, curr) =>
    STATUS_PRIORITY[curr.status] > STATUS_PRIORITY[best.status] ? curr : best,
  );

// ── Merge exact-rule + suffix-rule → domain-rule ─────────────────────────────
function toDisplaySteps(steps: RuleResolutionStep[]): DisplayStep[] {
  const result: DisplayStep[] = [];
  const domainSteps = steps.filter(
    (s) => s.source === "exact-rule" || s.source === "suffix-rule",
  );
  let domainAdded = false;

  for (const step of steps) {
    // Containers are a Firefox-only feature; skip the step on other builds.
    if (step.source === "container" && BUILD_BROWSER_TARGET !== "firefox") {
      continue;
    }

    if (step.source === "exact-rule" || step.source === "suffix-rule") {
      if (!domainAdded) {
        const rep = bestStatus(domainSteps);
        const label = t.sidebar.why.sourcesShort.domainRule;
        result.push({
          source: "domain-rule",
          status: rep.status,
          pattern: rep.pattern,
          tooltip: rep.pattern ? `${label}: ${rep.pattern}` : label,
        });
        domainAdded = true;
      }
      continue;
    }

    const label = SHORT_LABELS[step.source as DisplaySource];
    result.push({
      source: step.source as DisplaySource,
      status: step.status,
      pattern: step.pattern,
      tooltip: step.pattern ? `${label}: ${step.pattern}` : label,
    });
  }

  // Won node is always rightmost
  return result.reverse();
}

// ── Label maps ────────────────────────────────────────────────────────────────
const SHORT_LABELS: Record<DisplaySource, string> = {
  "trusted-site": t.sidebar.why.sourcesShort.trustedSite,
  "domain-rule": t.sidebar.why.sourcesShort.domainRule,
  container: t.sidebar.why.sourcesShort.container,
  fallback: t.sidebar.why.sourcesShort.fallback,
  none: t.sidebar.why.sourcesShort.none,
};

// ── Visual styles ─────────────────────────────────────────────────────────────
const CIRCLE_STYLE: Record<RuleResolutionStepStatus, string> = {
  won: "border-[hsl(var(--tone-success-border))] bg-[hsl(var(--tone-success-bg))]",
  skipped: "border-border bg-muted/40",
  "no-match": "border-border/40 bg-transparent opacity-40",
  disabled: "border-border/40 bg-transparent opacity-30",
};

const LABEL_STYLE: Record<RuleResolutionStepStatus, string> = {
  won: "text-[hsl(var(--tone-success-text))] font-semibold",
  skipped: "text-muted-foreground",
  "no-match": "text-muted-foreground",
  disabled: "text-muted-foreground line-through",
};

// ── Component ─────────────────────────────────────────────────────────────────
export const XRayWhySection = ({
  explanation,
}: {
  explanation: ResolutionExplanation;
}) => {
  const displaySteps = toDisplaySteps(explanation.steps);

  return (
    <section className="flex flex-col gap-1" data-xray-section="rule-explanation">
      <h3 className="text-xs font-semibold uppercase tracking-wide mb-2">
        {t.sidebar.why.title}
      </h3>

      <div
        className="flex items-start justify-center gap-0 flex-wrap"
        role="list"
        aria-label={t.sidebar.why.title}
      >
        {displaySteps.map((step, i) => {
          const isLast = i === displaySteps.length - 1;

          return (
            <div
              // eslint-disable-next-line react/no-array-index-key -- display steps are derived + reversed; index is stable
              key={`${step.source}-${i}`}
              className="flex items-start"
              role="listitem"
            >
              {/* Step node */}
              <div
                className="flex flex-col items-center gap-1 shrink-0 w-16"
                title={step.tooltip}
              >
                {/* Circle */}
                <div
                  className={cn(
                    "w-3.5 h-3.5 rounded-full border-2 shrink-0 mt-0.5",
                    CIRCLE_STYLE[step.status],
                  )}
                  aria-hidden="true"
                />
                {/* Label */}
                <span
                  className={cn(
                    "text-[10px] leading-tight text-center break-words w-full px-0.5",
                    LABEL_STYLE[step.status],
                  )}
                >
                  {SHORT_LABELS[step.source]}
                </span>
              </div>

              {/* Arrow connector */}
              {!isLast && (
                <div className="flex items-start pt-[5px] shrink-0 px-0.5 text-muted-foreground/30 text-xs select-none">
                  →
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};
