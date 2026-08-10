import { cn } from "@/ui/components/lib/utils";
import { SettingsSectionCard } from "@/ui/components/SettingsSectionCard";
import { Input } from "@/ui/components/ui/input";
import { t } from "@/ui/i18n";
import { useSettings } from "@/ui/options/state/SettingsContext";
import { icon } from "@/ui/options/utils";

const PROPER_NOUNS = [
  "Privacy Thing",
  "Trusted Sites",
  "Trusted Site",
  "Default Rule",
  "Rule",
];

type RuleInspectorCardProps = {
  anchorId: string;
  copyLabel: string;
  highlighted: boolean;
  inputId: string;
};

type InspectorDetailRow = {
  label: string;
  value: string | null;
  actionLabel?: string;
  onAction?: () => void;
};

type RuleInspectorPreview = ReturnType<typeof useSettings>["preview"];

const compactInspectorRows = (
  rows: InspectorDetailRow[],
): Array<InspectorDetailRow & { value: string }> =>
  rows.filter(
    (row): row is InspectorDetailRow & { value: string } => row.value !== null,
  );

const renderHighlighted = (text: string) => {
  let parts: Array<string | React.ReactElement> = [text];
  for (const noun of PROPER_NOUNS) {
    const next: Array<string | React.ReactElement> = [];
    for (const part of parts) {
      if (typeof part !== "string") {
        next.push(part);
        continue;
      }
      const split = part.split(noun);
      split.forEach((chunk, i) => {
        next.push(chunk);
        if (i < split.length - 1) {
          next.push(
            // eslint-disable-next-line react/no-array-index-key -- i-th occurrence of noun in the text; position is the identity
            <span key={`${noun}-${i}`} className="gw-proper-noun">
              {noun}
            </span>,
          );
        }
      });
    }
    parts = next;
  }
  return parts;
};

const getPreviewToneClass = (
  winningSource: RuleInspectorPreview["winningSource"],
): string => {
  switch (winningSource) {
    case "trusted-site":
      return "border-tone-success-border bg-tone-success-bg text-tone-success-text";
    case "rule":
      return "border-tone-warning-border bg-tone-warning-bg text-tone-warning-text";
    case "fallback":
      return "border-border bg-muted/60 text-foreground";
    default:
      return "border-border/70 bg-muted/40";
  }
};

const getResultCopy = ({
  preview,
  hasResolvedRule,
  hasResolvedFallback,
  resolvedLocationLabel,
}: {
  preview: RuleInspectorPreview;
  hasResolvedRule: boolean;
  hasResolvedFallback: boolean;
  resolvedLocationLabel: string | null;
}): { description: string; title: string } => {
  if (preview.winningSource === "trusted-site") {
    return hasResolvedRule
      ? {
          title: t.rules.inspector.trustedSiteOverridesRuleTitle,
          description: t.rules.inspector.trustedSiteOverridesRuleDescription,
        }
      : {
          title: t.rules.inspector.trustedSiteWinsTitle,
          description: t.rules.inspector.trustedSiteWinsDescription,
        };
  }

  if (hasResolvedRule && resolvedLocationLabel) {
    return {
      title: t.rules.inspector.ruleMatchTitle(resolvedLocationLabel),
      description: t.rules.inspector.ruleMatchDescription,
    };
  }

  if (hasResolvedFallback) {
    return {
      title: t.rules.inspector.fallbackWinsTitle,
      description: t.rules.inspector.fallbackWinsDescription,
    };
  }

  return {
    title: t.rules.inspector.noMatchTitle,
    description: t.rules.inspector.noMatchDescription,
  };
};

const getGeoDetailValue = (
  hasLocation: boolean,
  locationProfileActive: boolean,
): string | null => {
  if (!hasLocation) {
    return null;
  }

  return locationProfileActive
    ? t.rules.inspector.geolocationOn
    : t.rules.inspector.geolocationOff;
};

const buildTrustedSiteRows = ({
  preview,
  resolvedLocation,
  resolvedRule,
  openRuleDialog,
}: {
  preview: RuleInspectorPreview;
  resolvedLocation: RuleInspectorPreview["location"];
  resolvedRule: RuleInspectorPreview["rule"];
  openRuleDialog: (rule: NonNullable<RuleInspectorPreview["rule"]>) => void;
}): InspectorDetailRow[] => [
  { label: t.rules.inspector.hostnameDetailLabel, value: preview.hostname },
  {
    label: t.rules.inspector.trustedSiteDetailLabel,
    value: preview.trustedSite?.pattern ?? null,
  },
  {
    label: t.rules.inspector.ignoredRuleDetailLabel,
    value: resolvedRule?.pattern ?? null,
    ...(resolvedRule
      ? {
          actionLabel: "Open rule",
          onAction: () => {
            openRuleDialog(resolvedRule);
          },
        }
      : {}),
  },
  {
    label: t.rules.inspector.profileDetailLabel,
    value: resolvedLocation?.label ?? null,
  },
  {
    label: t.rules.inspector.geolocationDetailLabel,
    value: getGeoDetailValue(Boolean(resolvedLocation), preview.locationProfileActive),
  },
  {
    label: t.rules.inspector.localeDetailLabel,
    value: resolvedLocation?.language ?? null,
  },
  {
    label: t.rules.inspector.timeZoneDetailLabel,
    value: resolvedLocation?.timeZone ?? null,
  },
];

const buildFallbackRows = ({
  preview,
  resolvedLocation,
  openFallbackDialog,
}: {
  preview: RuleInspectorPreview;
  resolvedLocation: RuleInspectorPreview["location"];
  openFallbackDialog: () => void;
}): InspectorDetailRow[] => [
  { label: t.rules.inspector.hostnameDetailLabel, value: preview.hostname },
  {
    label: t.rules.inspector.defaultRuleDetailLabel,
    value: t.rules.globalFallback.title,
    actionLabel: t.rules.globalFallback.editTitle,
    onAction: () => {
      openFallbackDialog();
    },
  },
  {
    label: t.rules.inspector.profileDetailLabel,
    value: resolvedLocation?.label ?? t.rules.globalFallback.noPresetLabel,
  },
  {
    label: t.rules.inspector.geolocationDetailLabel,
    value: preview.locationProfileActive
      ? t.rules.inspector.geolocationOn
      : t.rules.inspector.geolocationOff,
  },
  {
    label: t.rules.inspector.localeDetailLabel,
    value: resolvedLocation?.language ?? null,
  },
  {
    label: t.rules.inspector.timeZoneDetailLabel,
    value: resolvedLocation?.timeZone ?? null,
  },
];

const buildResolvedRuleRows = ({
  preview,
  resolvedLocation,
  resolvedRule,
  openRuleDialog,
}: {
  preview: RuleInspectorPreview;
  resolvedLocation: NonNullable<RuleInspectorPreview["location"]>;
  resolvedRule: NonNullable<RuleInspectorPreview["rule"]>;
  openRuleDialog: (rule: NonNullable<RuleInspectorPreview["rule"]>) => void;
}): InspectorDetailRow[] => [
  { label: t.rules.inspector.hostnameDetailLabel, value: preview.hostname },
  {
    label: t.rules.inspector.ruleDetailLabel,
    value: resolvedRule.pattern,
    actionLabel: "Open rule",
    onAction: () => {
      openRuleDialog(resolvedRule);
    },
  },
  { label: t.rules.inspector.profileDetailLabel, value: resolvedLocation.label },
  {
    label: t.rules.inspector.geolocationDetailLabel,
    value: preview.locationProfileActive
      ? t.rules.inspector.geolocationOn
      : t.rules.inspector.geolocationOff,
  },
  { label: t.rules.inspector.localeDetailLabel, value: resolvedLocation.language },
  { label: t.rules.inspector.timeZoneDetailLabel, value: resolvedLocation.timeZone },
];

const buildDetailRows = ({
  preview,
  resolvedFallbackRule,
  resolvedLocation,
  resolvedRule,
  openRuleDialog,
  openFallbackDialog,
}: {
  preview: RuleInspectorPreview;
  resolvedFallbackRule: RuleInspectorPreview["fallbackRule"];
  resolvedLocation: RuleInspectorPreview["location"];
  resolvedRule: RuleInspectorPreview["rule"];
  openRuleDialog: (rule: NonNullable<RuleInspectorPreview["rule"]>) => void;
  openFallbackDialog: () => void;
}): InspectorDetailRow[] => {
  if (!preview.hostname) {
    return [];
  }

  if (preview.winningSource === "trusted-site") {
    return buildTrustedSiteRows({
      preview,
      resolvedLocation,
      resolvedRule,
      openRuleDialog,
    });
  }

  if (preview.winningSource === "fallback" && resolvedFallbackRule) {
    return buildFallbackRows({
      preview,
      resolvedLocation,
      openFallbackDialog,
    });
  }

  if (resolvedRule && resolvedLocation) {
    return buildResolvedRuleRows({
      preview,
      resolvedLocation,
      resolvedRule,
      openRuleDialog,
    });
  }

  return [{ label: t.rules.inspector.hostnameDetailLabel, value: preview.hostname }];
};

const HostnameField = ({
  inputId,
  value,
  onChange,
}: {
  inputId: string;
  value: string;
  onChange: (value: string) => void;
}) => (
  <div className="space-y-1.5">
    <label htmlFor={inputId} className="block text-sm font-medium text-foreground">
      {t.rules.inspector.hostnameLabel}
    </label>
    <p className="text-xs leading-relaxed text-muted-foreground">
      {t.rules.inspector.hostnameHint}
    </p>
    <div className="relative">
      <Input
        id={inputId}
        name={inputId}
        placeholder={t.rules.inspector.hostnamePlaceholder}
        className="border-border/70 bg-background/70 pr-8"
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          aria-label={t.common.actions.clear}
          title={t.common.actions.clear}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>
      ) : null}
    </div>
  </div>
);

const InspectorResult = ({
  inputId,
  rows,
  toneClass,
  title,
  description,
}: {
  inputId: string;
  rows: Array<InspectorDetailRow & { value: string }>;
  toneClass: string;
  title: string;
  description: string;
}) => (
  <div
    id={`${inputId}-preview`}
    className={cn("rounded-xl border p-4 text-sm", toneClass)}
  >
    <div className="space-y-3">
      <div className="space-y-1">
        <p className="font-semibold leading-tight">{title}</p>
        <p className="leading-relaxed">{renderHighlighted(description)}</p>
      </div>
      <div className="border-t border-current/15 pt-3">
        <dl className="grid gap-x-3 gap-y-2 sm:grid-cols-[7.5rem_minmax(0,1fr)]">
          {rows.map((row) => (
            <div key={row.label} className="contents">
              <dt className="text-[11px] font-semibold uppercase tracking-[0.08em]">
                {row.label}
              </dt>
              <dd className="flex min-w-0 items-center gap-1.5 break-words font-medium text-foreground">
                <span className="min-w-0 break-words">{row.value}</span>
                {row.onAction ? (
                  <button
                    type="button"
                    title={row.actionLabel}
                    aria-label={row.actionLabel}
                    onClick={row.onAction}
                    className="inline-flex shrink-0 items-center opacity-60 hover:opacity-100 focus-visible:opacity-100"
                  >
                    {icon("fa-arrow-up-right-from-square", "text-[11px]")}
                  </button>
                ) : null}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  </div>
);

export const RuleInspectorCard = ({
  anchorId,
  copyLabel,
  highlighted,
  inputId,
}: RuleInspectorCardProps) => {
  const {
    previewHostname,
    setPreviewHostname,
    preview,
    openRuleDialog,
    openFallbackDialog,
  } = useSettings();
  const resolvedRule = preview.rule;
  const resolvedFallbackRule = preview.fallbackRule;
  const resolvedLocation = preview.location;
  const hasResolvedRule = resolvedRule && resolvedLocation;
  const hasResolvedFallback =
    preview.winningSource === "fallback" && resolvedFallbackRule;
  const previewToneClass = getPreviewToneClass(preview.winningSource);
  const { title: resultTitle, description: resultDescription } = getResultCopy({
    preview,
    hasResolvedRule: Boolean(hasResolvedRule),
    hasResolvedFallback: Boolean(hasResolvedFallback),
    resolvedLocationLabel: resolvedLocation?.label ?? null,
  });
  const detailRows = buildDetailRows({
    preview,
    resolvedFallbackRule,
    resolvedLocation,
    resolvedRule,
    openRuleDialog,
    openFallbackDialog,
  });
  const visibleDetailRows = compactInspectorRows(detailRows);

  return (
    <SettingsSectionCard
      anchorId={anchorId}
      copyLabel={copyLabel}
      title={<h3 className="text-base font-semibold">{t.rules.inspector.title}</h3>}
      description={<p>{t.rules.inspector.hint}</p>}
      highlighted={highlighted}
      contentClassName="gap-4 pt-6"
    >
      <HostnameField
        inputId={inputId}
        value={previewHostname}
        onChange={setPreviewHostname}
      />

      {preview.hostname ? (
        <InspectorResult
          inputId={inputId}
          rows={visibleDetailRows}
          toneClass={previewToneClass}
          title={resultTitle}
          description={resultDescription}
        />
      ) : null}
    </SettingsSectionCard>
  );
};
