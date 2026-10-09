import { useId, useMemo, useState } from "react";

import {
  findProviderFeature,
  resolveFeatureView,
  type FeatureSyncStatus,
  type ProviderFeature,
  type ProviderFeatureMatch,
  type ProviderFeatureVariant,
  type ProviderFeatureView,
  type RuleFeatureBinding,
} from "./model";
import {
  providerFeatureCopy,
  type ProviderFeatureMessages,
} from "./provider-feature-copy";

import { cn } from "@/ui/components/lib/utils";
import { Badge, type BadgeProps } from "@/ui/components/ui/badge";
import { Button } from "@/ui/components/ui/button";
import { Combobox } from "@/ui/components/ui/combobox";
import { useUiLocale } from "@/ui/i18n/LocaleRefresh";

export type ProviderFeatureProps = {
  variant?: ProviderFeatureVariant;
  providerName: string;
  /** Host the domain test runs against; the parent resolves it for broad patterns. */
  hostname: string;
  /** Pattern of the local rule, which a binding never widens. */
  rulePattern: string;
  features: readonly ProviderFeature[];
  match: ProviderFeatureMatch | null;
  binding: RuleFeatureBinding | null;
  busy: boolean;
  dismissed: boolean;
  syncStatus: FeatureSyncStatus;
  onRecognize: () => void;
  onConfirm: (feature: ProviderFeature) => void;
  onDismiss: () => void;
  onDetach: () => void;
};

type BadgeVariant = NonNullable<BadgeProps["variant"]>;

const viewTone: Record<ProviderFeatureView, BadgeVariant> = {
  idle: "outline",
  checking: "info",
  suggested: "info",
  unresolved: "warning",
  error: "error",
  dismissed: "outline",
  bound: "info",
};

const syncTone: Record<FeatureSyncStatus, BadgeVariant> = {
  queued: "info",
  syncing: "info",
  synced: "success",
  error: "error",
};

type Context = {
  copy: ProviderFeatureMessages;
  props: ProviderFeatureProps;
  compact: boolean;
  scopeId: string;
};

const summaryText = (
  { copy, props }: Context,
  view: ProviderFeatureView,
  suggestion: ProviderFeature | null,
): string => {
  const { providerName, hostname, binding } = props;
  switch (view) {
    case "bound":
      return copy.summary.bound(binding?.featureName ?? "", providerName);
    case "suggested":
      return copy.summary.suggested(suggestion?.name ?? "", providerName);
    case "dismissed":
      return copy.summary.dismissed(providerName);
    default:
      return copy.summary[view](providerName, hostname);
  }
};

const evidenceText = (
  copy: ProviderFeatureMessages,
  match: ProviderFeatureMatch | null,
) => {
  if (match === null) return copy.evidence.notChecked;
  if (match.status === "overridden") return copy.evidence.overridden;
  if (match.matchSource === "manual") return copy.evidence.manual;
  return copy.evidence.domainTest(match.hostname);
};

const useCheckedAt = (checkedAt: string | undefined): string | null => {
  const locale = useUiLocale();
  return useMemo(() => {
    if (checkedAt === undefined) return null;
    const date = new Date(checkedAt);
    if (Number.isNaN(date.getTime())) return null;
    return new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  }, [checkedAt, locale]);
};

const Fact = ({
  label,
  section,
  compact,
  children,
}: {
  label: string;
  section: "evidence" | "local" | "sync";
  compact: boolean;
  children: React.ReactNode;
}) => (
  <div
    data-provider-feature-section={section}
    className={compact ? "block" : "contents"}
  >
    <dt className="text-muted-foreground">{label}</dt>
    <dd className="min-w-0 text-foreground [overflow-wrap:anywhere]">{children}</dd>
  </div>
);

const Facts = ({ context }: { context: Context }) => {
  const { copy, props, compact } = context;
  const checkedAt = useCheckedAt(props.match?.checkedAt);
  const syncState = props.binding === null ? "none" : props.syncStatus;
  return (
    <dl
      className={cn(
        compact
          ? "space-y-1.5 text-xs"
          : "grid grid-cols-[minmax(0,auto)_minmax(0,1fr)] gap-x-3 gap-y-1.5 text-sm",
      )}
    >
      <Fact label={copy.evidence.label} section="evidence" compact={compact}>
        <span data-provider-feature-match-source={props.match?.matchSource ?? "none"}>
          {evidenceText(copy, props.match)}
        </span>
        {checkedAt !== null && props.match ? (
          <time
            dateTime={props.match.checkedAt}
            className="block text-xs text-muted-foreground"
          >
            {copy.evidence.checkedAt(checkedAt)}
          </time>
        ) : null}
      </Fact>
      <Fact label={copy.local.label} section="local" compact={compact}>
        <span data-provider-feature-rule-pattern={props.rulePattern}>
          {copy.local.value(props.rulePattern)}
        </span>
      </Fact>
      <Fact
        label={copy.sync.label(props.providerName)}
        section="sync"
        compact={compact}
      >
        <span data-provider-feature-sync={syncState}>
          {syncState === "none" ? copy.sync.none : copy.sync[syncState]}
        </span>
      </Fact>
    </dl>
  );
};

type ActionVariant = "default" | "outline" | "ghost" | "destructive-outline";

type ActionProps = {
  action: string;
  label: string;
  onClick: () => void;
  context: Context;
  variant?: ActionVariant;
  ariaLabel?: string;
  describedBy?: boolean;
  disabled?: boolean;
};

const Action = ({
  action,
  label,
  onClick,
  context,
  variant = "outline",
  ariaLabel,
  describedBy = false,
  disabled = false,
}: ActionProps) => (
  <Button
    type="button"
    size="sm"
    variant={variant}
    data-provider-feature-action={action}
    aria-label={ariaLabel}
    aria-describedby={describedBy ? context.scopeId : undefined}
    disabled={context.props.busy || disabled}
    onClick={onClick}
    className={cn(context.compact && variant !== "ghost" && "min-w-0 flex-1")}
  >
    <span className="truncate">{label}</span>
  </Button>
);

const ActionRow = ({
  compact,
  children,
}: {
  compact: boolean;
  children: React.ReactNode;
}) => (
  <div
    className={cn(
      "flex gap-2",
      compact ? "flex-wrap [&>*:first-child]:basis-full" : "flex-wrap",
    )}
  >
    {children}
  </div>
);

const ScopeNote = ({ id, text }: { id: string; text: string | null }) =>
  text === null ? null : (
    <p id={id} data-provider-feature-scope className="text-xs text-muted-foreground">
      {text}
    </p>
  );

type ChooserProps = {
  context: Context;
  onClose: () => void;
};

const Chooser = ({ context, onClose }: ChooserProps) => {
  const { copy, props, compact, scopeId } = context;
  const labelId = useId();
  const [draftId, setDraftId] = useState("");
  const draft = findProviderFeature(props.features, draftId || null);
  const options = useMemo(
    () =>
      props.features.map((feature) => ({
        value: feature.featureId,
        label: feature.name,
      })),
    [props.features],
  );
  const unchanged = draft !== null && draft.featureId === props.binding?.featureId;
  return (
    <div data-provider-feature-chooser className="space-y-2">
      <span id={labelId} className="block text-xs font-medium text-muted-foreground">
        {copy.picker.label(props.providerName)}
      </span>
      <Combobox
        options={options}
        value={draftId}
        onValueChange={setDraftId}
        placeholder={copy.picker.placeholder}
        searchPlaceholder={copy.picker.search}
        emptyMessage={copy.picker.empty}
        size="sm"
        disabled={props.busy}
        aria-labelledby={labelId}
      />
      <ActionRow compact={compact}>
        <Action
          action="confirm-choice"
          variant="default"
          label={draft ? copy.actions.confirmChoice(draft.name) : copy.actions.confirm}
          onClick={() => {
            if (!draft) return;
            props.onConfirm(draft);
            onClose();
          }}
          context={context}
          describedBy={draft !== null}
          disabled={draft === null || unchanged}
        />
        <Action
          action="cancel"
          variant="ghost"
          label={copy.actions.cancel}
          onClick={onClose}
          context={context}
        />
      </ActionRow>
      <ScopeNote
        id={scopeId}
        text={
          draft
            ? copy.scope.confirm(draft.name, props.providerName, props.rulePattern)
            : null
        }
      />
    </div>
  );
};

type ViewActionsProps = {
  context: Context;
  view: ProviderFeatureView;
  suggestion: ProviderFeature | null;
  onChoose: () => void;
};

const ViewActions = ({ context, view, suggestion, onChoose }: ViewActionsProps) => {
  const { copy, props, compact } = context;
  const recognize = (label: string, variant: ActionVariant) => (
    <Action
      action="recognize"
      label={label}
      variant={variant}
      onClick={props.onRecognize}
      context={context}
      describedBy
    />
  );
  const choose = (label: string, variant: ActionVariant = "outline") => (
    <Action
      action="choose"
      label={label}
      variant={variant}
      onClick={onChoose}
      context={context}
    />
  );
  switch (view) {
    case "checking":
      return null;
    case "idle":
      return (
        <ActionRow compact={compact}>
          {recognize(copy.actions.recognize(props.providerName), "default")}
          {choose(copy.actions.chooseManual)}
        </ActionRow>
      );
    case "suggested":
      return (
        <ActionRow compact={compact}>
          <Action
            action="confirm"
            variant="default"
            label={copy.actions.confirm}
            onClick={() => {
              if (suggestion) props.onConfirm(suggestion);
            }}
            context={context}
            describedBy
          />
          {choose(copy.actions.chooseOther)}
          <Action
            action="dismiss"
            variant="ghost"
            label={copy.actions.dismiss}
            ariaLabel={copy.actions.dismissLabel(suggestion?.name ?? "")}
            onClick={props.onDismiss}
            context={context}
          />
        </ActionRow>
      );
    case "unresolved":
      return (
        <ActionRow compact={compact}>
          {choose(copy.actions.chooseManual, "default")}
          {recognize(copy.actions.retry, "outline")}
        </ActionRow>
      );
    case "error":
    case "dismissed":
      return (
        <ActionRow compact={compact}>
          {recognize(copy.actions.retry, view === "error" ? "default" : "outline")}
          {choose(copy.actions.chooseManual)}
        </ActionRow>
      );
    case "bound":
      return (
        <ActionRow compact={compact}>
          {choose(copy.actions.change)}
          <Action
            action="detach"
            variant="destructive-outline"
            label={copy.actions.detach}
            ariaLabel={copy.actions.detachLabel(
              props.binding?.featureName ?? "",
              props.providerName,
            )}
            onClick={props.onDetach}
            context={context}
            describedBy
          />
        </ActionRow>
      );
  }
};

const scopeText = (
  { copy, props }: Context,
  view: ProviderFeatureView,
  suggestion: ProviderFeature | null,
): string | null => {
  const { providerName, rulePattern, hostname, binding } = props;
  if (view === "bound" && binding) {
    return copy.scope.bound(binding.featureName, providerName, rulePattern);
  }
  if (view === "suggested" && suggestion) {
    return copy.scope.confirm(suggestion.name, providerName, rulePattern);
  }
  if (
    view === "idle" ||
    view === "error" ||
    view === "unresolved" ||
    view === "dismissed"
  ) {
    return copy.scope.recognize(providerName, hostname);
  }
  return null;
};

const StatusBadge = ({
  context,
  view,
}: {
  context: Context;
  view: ProviderFeatureView;
}) => {
  const { copy, props } = context;
  const tone = view === "bound" ? syncTone[props.syncStatus] : viewTone[view];
  return (
    <Badge
      variant={tone}
      data-provider-feature-status={view}
      className="shrink-0 font-medium"
    >
      {view === "checking" ? (
        <span className="fa-solid fa-circle-notch fa-spin mr-1.5" aria-hidden="true" />
      ) : null}
      {copy.status[view]}
    </Badge>
  );
};

export const ProviderFeaturePanel = (props: ProviderFeatureProps) => {
  const locale = useUiLocale();
  const headingId = useId();
  const scopeId = useId();
  const [choosing, setChoosing] = useState(false);
  const { view, suggestion } = resolveFeatureView(props);
  const compact = props.variant === "compact";
  const context: Context = {
    copy: providerFeatureCopy[locale],
    props,
    compact,
    scopeId,
  };
  const { copy } = context;
  const showChooser = choosing && view !== "checking";

  return (
    <section
      aria-labelledby={headingId}
      aria-busy={props.busy}
      data-provider-feature
      data-provider-feature-view={view}
      data-provider-feature-variant={compact ? "compact" : "default"}
      data-provider-feature-busy={props.busy ? "true" : "false"}
      data-provider-feature-choosing={showChooser ? "true" : "false"}
      data-provider-feature-match-status={props.match?.status ?? "none"}
      className={cn(
        "rounded-lg border border-border bg-card text-card-foreground",
        compact ? "space-y-2.5 p-3" : "space-y-3 p-4",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-0.5">
          <span
            id={headingId}
            className="block text-xs font-medium uppercase tracking-wide text-muted-foreground"
          >
            {copy.heading}
          </span>
          <p
            data-provider-feature-summary
            className={cn(
              "font-medium text-foreground [overflow-wrap:anywhere]",
              compact ? "text-sm" : "text-base",
            )}
          >
            {summaryText(context, view, suggestion)}
          </p>
        </div>
        <StatusBadge context={context} view={view} />
      </div>
      <Facts context={context} />
      {showChooser ? (
        <Chooser context={context} onClose={() => setChoosing(false)} />
      ) : (
        <>
          <ViewActions
            context={context}
            view={view}
            suggestion={suggestion}
            onChoose={() => setChoosing(true)}
          />
          <ScopeNote id={scopeId} text={scopeText(context, view, suggestion)} />
        </>
      )}
      <p role="status" className="sr-only">
        {props.busy ? copy.busy : ""}
      </p>
    </section>
  );
};
