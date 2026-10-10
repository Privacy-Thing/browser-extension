import "@/ui/plugins/feature-registration";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

import { BUILD_CHANNEL } from "@/shared/build-flags";
import {
  bindingPatterns,
  type FeatureDecision,
  type ProviderFeature,
  type ProviderFeatureState,
} from "@/shared/provider-feature";
import {
  featureNotice,
  initialsFromState,
  joinInfo,
  otherGroup,
  recognitionHost,
  resolveSlot,
  type FeatureNotice,
  type JoinInfo,
  type ProviderFeatureVariant,
} from "@/ui/components/provider-feature";
import {
  featurePendingCopy,
  type ProviderFeatureMessages,
} from "@/ui/components/provider-feature/provider-feature-copy";
import {
  ProviderFeaturePending,
  ProviderFeatureSlot,
  type RequestPending,
} from "@/ui/components/provider-feature/ProviderFeatureSlot";
import { useUiLocale } from "@/ui/i18n/LocaleRefresh";
import { featureUiFor } from "@/ui/plugins/feature-presentations";
import { openInBackground } from "@/ui/plugins/navigation";
import {
  useProviderFeature,
  type ProviderFeaturePending as FeatureRead,
  type ProviderFeatureQuery,
} from "@/ui/shared/use-provider-feature";

export type HostSchedule = (run: () => void) => () => void;

export type ProviderFeatureHostProps = {
  /** Current draft pattern, including an unsaved rule. */
  rulePattern: string;
  /** Saved pattern. Keeps the existing group while the draft is edited. */
  savedRulePattern?: string;
  /** Fixed representative host, such as the popup's current tab. */
  hostname?: string | null;
  variant?: ProviderFeatureVariant;
  onDecisionChange?: (decision: FeatureDecision | undefined) => void;
  /** Trailing debounce for typed patterns. Tests inject a fake scheduler. */
  schedule?: HostSchedule;
  locationId?: string | null;
  ruleEnabled?: boolean;
};

const DEBOUNCE_MS = 500;

const debounceHost: HostSchedule = (run) => {
  const id = setTimeout(run, DEBOUNCE_MS);
  return () => clearTimeout(id);
};

type SettledDraft = { pattern: string; host: string };

const useSettledDraft = (
  pattern: string,
  fixed: string | null,
  schedule: HostSchedule | undefined,
): SettledDraft => {
  const host = recognitionHost(pattern, fixed);
  const [settled, setSettled] = useState<SettledDraft>({ pattern, host });
  const patternRef = useRef(pattern);
  const scheduleRef = useRef(schedule);
  scheduleRef.current = schedule;
  useEffect(() => {
    const apply = () => setSettled({ pattern, host });
    if (fixed !== null || patternRef.current === pattern) {
      patternRef.current = pattern;
      apply();
      return;
    }
    patternRef.current = pattern;
    return (scheduleRef.current ?? debounceHost)(apply);
  }, [fixed, host, pattern]);
  return settled;
};

const useFeatureDecision = (
  rulePattern: string,
  onDecisionChange: ProviderFeatureHostProps["onDecisionChange"],
) => {
  const [seenPattern, setSeenPattern] = useState(rulePattern);
  const [decision, setDecision] = useState<FeatureDecision | undefined>(undefined);
  if (seenPattern !== rulePattern) {
    setSeenPattern(rulePattern);
    setDecision(undefined);
  }
  const notify = useRef(onDecisionChange);
  notify.current = onDecisionChange;
  const reported = useRef(rulePattern);
  useEffect(() => {
    if (reported.current === rulePattern) return;
    reported.current = rulePattern;
    notify.current?.(undefined);
  }, [rulePattern]);
  const stage = useCallback((next: FeatureDecision | undefined) => {
    setDecision(next);
    notify.current?.(next);
  }, []);
  return { decision, stage };
};

const identityOf = (rulePattern: string, saved: string | undefined): string => {
  const trimmed = saved?.trim();
  return trimmed ? trimmed : rulePattern;
};

const decisionFor = (
  providerId: string,
  feature: ProviderFeature,
  join: boolean,
): FeatureDecision =>
  join
    ? { providerId, featureId: feature.featureId, joinExisting: true }
    : { providerId, featureId: feature.featureId };

const requestKind = (
  state: ProviderFeatureState,
  busy: boolean,
  pending: FeatureRead | null,
  errorCode: string | null,
): RequestPending | null => {
  const status = state.recognitionStatus;
  if (status === "unavailable" || status === "blocked") return busy ? "status" : null;
  if (status === "preparing") return "preparing";
  if (errorCode === "recognition-preparing") return "preparing";
  if (!busy) return null;
  return pending ?? "status";
};

const noticeText = (
  copy: ProviderFeatureMessages,
  kind: FeatureNotice,
  provider: string,
  service: string,
): string => {
  switch (kind) {
    case "blocked":
    case "paused":
      return copy.errorBlocked(provider);
    case "connect":
      return copy.errorConnect(provider);
    case "catalogue":
      return copy.errorCatalogue(provider);
    case "sync":
      return copy.errorSync(provider, service);
    case "generic":
      return copy.errorGeneric;
  }
};

const listedPatterns = (
  state: ProviderFeatureState,
  identity: string,
  decision: FeatureDecision | undefined,
): readonly string[] => {
  const featureId = decision?.joinExisting ? decision.featureId : null;
  if (featureId) {
    const joined = otherGroup(
      state.bindings ?? [],
      state.providerId,
      featureId,
      identity,
    );
    if (joined) return bindingPatterns(joined);
  }
  if (state.groupPatterns && state.groupPatterns.length > 0) return state.groupPatterns;
  if (state.binding) return bindingPatterns(state.binding);
  return [];
};

const sharedHostsFor = (
  state: ProviderFeatureState,
  identity: string,
  decision: FeatureDecision | undefined,
): string[] =>
  listedPatterns(state, identity, decision).filter((pattern) => pattern !== identity);

const ProviderFeatureHostBody = ({
  rulePattern,
  savedRulePattern,
  hostname,
  variant = "default",
  onDecisionChange,
  schedule,
  locationId,
  ruleEnabled,
}: ProviderFeatureHostProps) => {
  const locale = useUiLocale();
  const pendingCopy = featurePendingCopy[locale];
  const fixed = hostname ? hostname : null;
  const settled = useSettledDraft(rulePattern, fixed, schedule);
  const { decision, stage } = useFeatureDecision(rulePattern, onDecisionChange);
  const query: ProviderFeatureQuery = {
    rulePattern: settled.pattern,
    hostname: settled.host,
    recognize: settled.host.length > 0,
    ...(savedRulePattern ? { savedRulePattern } : {}),
    ...(locationId !== undefined ? { locationId } : {}),
    ...(ruleEnabled !== undefined ? { ruleEnabled } : {}),
    ...(decision?.joinExisting && decision.featureId
      ? { contextFeatureId: decision.featureId }
      : {}),
  };
  const { state, busy, pending, failed, errorCode } = useProviderFeature(query);
  if (!state) {
    if (!busy) return null;
    return (
      <div data-provider-feature-host aria-busy="true">
        <ProviderFeaturePending kind="status" copy={pendingCopy} />
      </div>
    );
  }
  if (!state.available) return null;
  const presentation = featureUiFor(state.providerId);
  if (!presentation) return null;
  const copy = presentation.messages[locale];
  return (
    <ReadyFeatureHost
      rulePattern={rulePattern}
      {...(savedRulePattern ? { savedRulePattern } : {})}
      variant={variant}
      settledHost={settled.host}
      state={state}
      busy={busy}
      pending={pending}
      failed={failed}
      errorCode={errorCode}
      decision={decision}
      stage={stage}
      copy={copy}
      contextNotice={presentation.renderStatus?.({
        state,
        locale,
        ...(variant === "compact" ? { openSettings: openInBackground } : {}),
      })}
      renderExplanation={(feature) =>
        presentation.renderExplanation({
          feature,
          state,
          locale,
          ...(variant === "compact" ? { openSettings: openInBackground } : {}),
        })
      }
    />
  );
};

const ReadyFeatureHost = ({
  rulePattern,
  savedRulePattern,
  variant,
  settledHost,
  state,
  busy,
  pending,
  failed,
  errorCode,
  decision,
  stage,
  copy,
  renderExplanation,
  contextNotice,
}: {
  rulePattern: string;
  savedRulePattern?: string;
  variant: ProviderFeatureVariant;
  settledHost: string;
  state: ProviderFeatureState;
  busy: boolean;
  pending: FeatureRead | null;
  failed: boolean;
  errorCode: string | null;
  decision: FeatureDecision | undefined;
  stage: (next: FeatureDecision | undefined) => void;
  copy: ProviderFeatureMessages;
  renderExplanation: (feature: ProviderFeature) => ReactNode;
  contextNotice?: ReactNode;
}) => {
  const identity = identityOf(rulePattern, savedRulePattern);
  const kind = requestKind(state, busy, pending, errorCode);
  const sharedHosts = sharedHostsFor(state, identity, decision);
  const joinFor = (featureId: string): JoinInfo | null => {
    const group = otherGroup(
      state.bindings ?? [],
      state.providerId,
      featureId,
      identity,
    );
    return group ? joinInfo(group) : null;
  };
  const model = resolveSlot({
    available: state.available,
    providerId: state.providerId,
    providerName: state.providerName,
    initials: initialsFromState(state),
    ...(state.badgeColors ? { badgeColors: state.badgeColors } : {}),
    features: state.features,
    bindings: state.bindings ?? [],
    binding: state.binding,
    match: state.match,
    dismissed: state.dismissed,
    recognizing:
      kind === "lookup" && !state.binding && !decision && settledHost.length > 0,
    identityPattern: identity,
    decision,
    declinedId: null,
  });
  const noticeKind = featureNotice({
    errorCode,
    failed,
    recognitionStatus: state.recognitionStatus,
    syncStatus: state.syncStatus,
    hasBinding: state.binding !== null,
    featureCount: state.features.length,
    hasStateError: state.error !== null && state.error.length > 0,
  });
  const serviceName = state.binding?.featureName ?? model.decorator?.label ?? "";
  const accept = (feature: ProviderFeature, join: boolean) => {
    stage(decisionFor(state.providerId, feature, join));
  };
  return (
    <div data-provider-feature-host aria-busy={kind ? true : undefined}>
      <ProviderFeatureSlot
        variant={variant}
        model={model}
        copy={copy}
        {...(model.feature ? { explanation: renderExplanation(model.feature) } : {})}
        contextNotice={contextNotice}
        features={state.features}
        sharedHosts={sharedHosts}
        removing={decision?.featureId === null && state.binding !== null}
        groupRemoval={sharedHosts.length > 0}
        {...(kind ? { pending: kind } : {})}
        {...(state.binding ? { removalService: state.binding.featureName } : {})}
        {...(noticeKind
          ? { notice: noticeText(copy, noticeKind, state.providerName, serviceName) }
          : {})}
        joinFor={joinFor}
        onAccept={() => {
          if (model.feature) accept(model.feature, false);
        }}
        onDecline={() => {
          if (model.feature) stage({ providerId: state.providerId, featureId: null });
        }}
        onJoin={() => {
          if (model.feature) accept(model.feature, true);
        }}
        onChoose={(feature) => {
          const same =
            state.binding?.providerId === feature.providerId &&
            state.binding.featureId === feature.featureId;
          if (same) {
            stage(undefined);
            return;
          }
          accept(feature, joinFor(feature.featureId) !== null);
        }}
        onDetach={() => stage({ providerId: state.providerId, featureId: null })}
        onClear={() => stage(undefined)}
      />
      {decision ? (
        <input type="hidden" name="featureDecision" value={JSON.stringify(decision)} />
      ) : null}
    </div>
  );
};

/** Compact provider slot. Release builds and a disabled provider render nothing. */
export const ProviderFeatureHost = (props: ProviderFeatureHostProps) =>
  BUILD_CHANNEL === "release" ? null : <ProviderFeatureHostBody {...props} />;
