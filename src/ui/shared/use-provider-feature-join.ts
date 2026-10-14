import { useCallback, useLayoutEffect, useRef, useState } from "react";

import type { FeatureDecision } from "@/shared/provider-feature";
import { getRuleGroupPatterns } from "@/shared/rule-groups";
import type {
  DomainRule,
  SharedWorkerHandlingMode,
  SurfaceOverrides,
} from "@/shared/types";

/** One-argument calls stay valid. `configuration` is present for an explicit join. */
export type FeatureDecisionChange = (
  decision: FeatureDecision | undefined,
  configuration?: DomainRule,
) => void;

/** `open` is the editable draft. `canonical` shows the joined rule. `pending` is locked with no rule yet. */
export type JoinSource = "open" | "canonical" | "pending";
export type JoinOffer = { configuration?: DomainRule };
export type JoinOfferChange = (offer: JoinOffer | undefined) => void;

export type ProviderFeatureJoin = {
  decision: FeatureDecision | undefined;
  configuration: DomainRule | undefined;
  locked: boolean;
  saveDisabled: boolean;
  source: JoinSource;
  scopeKey: string;
  onDecisionChange: FeatureDecisionChange;
  onJoinOfferChange: JoinOfferChange;
};

const isJoin = (
  decision: FeatureDecision | undefined,
): decision is FeatureDecision & { featureId: string; joinExisting: true } =>
  decision?.joinExisting === true && typeof decision.featureId === "string";

const joinSource = (
  locked: boolean,
  configuration: DomainRule | undefined,
): JoinSource => {
  if (!locked) return "open";
  return configuration ? "canonical" : "pending";
};

export const providerFeatureScopeKey = (
  primary: string,
  additional: readonly string[] = [],
): string => [primary, ...additional].join("\0");

export const useProviderFeatureJoin = (
  scopeKey: string,
  onDecisionChange?: FeatureDecisionChange,
  lockOnOffer = false,
): ProviderFeatureJoin => {
  const notify = useRef(onDecisionChange);
  notify.current = onDecisionChange;
  const [seenScope, setSeenScope] = useState(scopeKey);
  const [decision, setDecision] = useState<FeatureDecision | undefined>(undefined);
  const [configuration, setConfiguration] = useState<DomainRule | undefined>(undefined);
  const [offer, setOffer] = useState<JoinOffer | undefined>(undefined);
  if (seenScope !== scopeKey) {
    setSeenScope(scopeKey);
    setDecision(undefined);
    setConfiguration(undefined);
    setOffer(undefined);
  }
  const reported = useRef(scopeKey);
  useLayoutEffect(() => {
    if (reported.current === scopeKey) return;
    reported.current = scopeKey;
    notify.current?.(undefined);
  }, [scopeKey]);
  const report = useCallback<FeatureDecisionChange>((next, nextConfiguration) => {
    const joining = isJoin(next);
    setDecision(next);
    setConfiguration(joining ? nextConfiguration : undefined);
    if (joining) notify.current?.(next, nextConfiguration);
    else notify.current?.(next);
  }, []);
  const reportOffer = useCallback<JoinOfferChange>((next) => setOffer(next), []);
  const joining = isJoin(decision);
  const hasCollision = lockOnOffer && offer !== undefined;
  const locked = joining || hasCollision;
  const offeredConfiguration = hasCollision ? offer?.configuration : undefined;
  const resolved = joining ? configuration : offeredConfiguration;
  return {
    decision,
    configuration: resolved,
    locked,
    saveDisabled: (hasCollision && !joining) || (locked && resolved === undefined),
    source: joinSource(locked, resolved),
    scopeKey,
    onDecisionChange: report,
    onJoinOfferChange: reportOffer,
  };
};

export type RuleDraftSettings = {
  locationId: string;
  enabled: boolean;
  surfaceOverrides: SurfaceOverrides | undefined;
  relaxCspForWorkers: boolean;
};

/** Display fields for a joined rule. Location uses the dialog's empty-string unassigned value. */
export const shownRuleSettings = (
  draft: RuleDraftSettings,
  join: Pick<ProviderFeatureJoin, "source" | "configuration">,
): RuleDraftSettings => {
  const rule = join.source === "canonical" ? join.configuration : undefined;
  if (!rule) return draft;
  return {
    locationId: rule.locationId ?? "",
    enabled: rule.enabled,
    surfaceOverrides: rule.fingerprintSurfaceOverrides,
    relaxCspForWorkers:
      typeof rule.relaxCspForWorkers === "boolean"
        ? rule.relaxCspForWorkers
        : draft.relaxCspForWorkers,
  };
};

const patternsBesideSource = (
  rules: readonly DomainRule[],
  sourcePattern: string | null,
): string[] =>
  (sourcePattern ? getRuleGroupPatterns(rules, sourcePattern) : []).filter(
    (pattern) => pattern !== sourcePattern,
  );

export const useRuleEditorJoin = (
  rules: readonly DomainRule[],
  sourcePattern: string | null,
  primary: string,
  { draft, lockOnOffer = false }: { draft: RuleDraftSettings; lockOnOffer?: boolean },
) => {
  const sourceKey = sourcePattern ?? "";
  const [trackedSource, setTrackedSource] = useState(sourceKey);
  const [additionalPatterns, setAdditionalPatterns] = useState<readonly string[]>(() =>
    patternsBesideSource(rules, sourcePattern),
  );
  if (trackedSource !== sourceKey) {
    setTrackedSource(sourceKey);
    setAdditionalPatterns(patternsBesideSource(rules, sourcePattern));
  }
  const onAdditionalPatterns = useCallback((patterns: readonly string[]) => {
    setAdditionalPatterns((current) =>
      current.length === patterns.length &&
      current.every((pattern, index) => pattern === patterns[index])
        ? current
        : patterns,
    );
  }, []);
  const join = useProviderFeatureJoin(
    providerFeatureScopeKey(primary, additionalPatterns),
    undefined,
    lockOnOffer,
  );
  return { join, shown: shownRuleSettings(draft, join), onAdditionalPatterns };
};

export type PopupRuleDraft = {
  selectedLocationId: string | null;
  regionalPresetEnabled: boolean;
  serviceWorkerOverride: boolean | undefined;
  workerHandlingOverride: SharedWorkerHandlingMode | undefined;
  relaxCspForWorkers: boolean;
};

export const applyJoinToPopupDraft = (
  draft: PopupRuleDraft,
  join: Pick<ProviderFeatureJoin, "source" | "configuration" | "locked">,
): PopupRuleDraft & { settingsLocked: boolean } => {
  const rule = join.source === "canonical" ? join.configuration : undefined;
  if (!rule) return { ...draft, settingsLocked: join.locked };
  return {
    settingsLocked: true,
    selectedLocationId: rule.locationId ?? null,
    regionalPresetEnabled: rule.locationId !== undefined,
    serviceWorkerOverride: rule.fingerprintSurfaceOverrides?.serviceWorker,
    workerHandlingOverride: rule.fingerprintSurfaceOverrides?.sharedWorker,
    relaxCspForWorkers:
      typeof rule.relaxCspForWorkers === "boolean"
        ? rule.relaxCspForWorkers
        : draft.relaxCspForWorkers,
  };
};
