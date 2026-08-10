import { useEffect, useMemo, useRef, useState, type RefObject } from "react";

import { withFallbackSeed } from "@/shared/rule-seed";
import type {
  DomainRule,
  SurfaceOverrides,
  GlobalFallbackRule,
  Location,
  TrustedSite,
} from "@/shared/types";
import { notify } from "@/ui/components/ui/toast";
import { t } from "@/ui/i18n";
import { countLocationRuleUsage } from "@/ui/options/location-usage";
import {
  SECTION_ANCHORS,
  getFallbackModalAnchor,
  getRuleAnchor,
} from "@/ui/options/navigation";
import { getVisibleSelectionState } from "@/ui/options/rule-selection";
import {
  buildRuleViewModels,
  deleteRulesByIndex,
  reassignRulesToLocation,
  resolveRulePreview,
  upsertRule,
} from "@/ui/options/rule-utils";
import { useLatestRef } from "@/ui/options/state/use-latest-ref";
import type { ConfirmDialogConfig } from "@/ui/options/state/use-settings-confirm-dialog";
import type { PersistSettingsOptions } from "@/ui/options/state/use-settings-persistence-runtime";
import type { RuleDialogMode } from "@/ui/options/utils";
import { normalizeRulePattern } from "@/ui/options/utils";

type NavigateToAnchor = (
  anchorId: string,
  options?: { replace?: boolean; highlight?: boolean },
) => void;

export const useRuleState = (
  profiles: readonly Location[],
  globalFallbackRuleRef: RefObject<GlobalFallbackRule | undefined>,
) => {
  const [rules, setRules] = useState<DomainRule[]>([]);
  const [selectedRulePatterns, setSelectedRulePatterns] = useState<Set<string>>(
    new Set(),
  );
  const [rulesFilter, setRulesFilter] = useState("");
  const [previewHostname, setPreviewHostname] = useState("");
  const [ruleDialogOpened, setRuleDialogOpened] = useState(false);
  const [ruleDialogMode, setRuleDialogMode] = useState<RuleDialogMode>("add");
  const [editingRulePattern, setEditingRulePattern] = useState<string | null>(null);
  const [rulePattern, setRulePattern] = useState("");
  const [ruleProfileId, setRuleProfileId] = useState("");
  const [ruleEnabled, setRuleEnabled] = useState(true);
  const [ruleRelaxCsp, setRuleRelaxCsp] = useState(false);
  const [ruleSurfaceOverrides, setRuleSurfaceOverrides] = useState<
    SurfaceOverrides | undefined
  >(undefined);
  const [isFallbackDialogOpen, setFallbackDialogOpen] = useState(false);
  const [isFallbackEnabled, setFallbackEnabled] = useState(true);
  const [fallbackLocationId, setFallbackLocationId] = useState("");
  const [fallbackSurfaceOverrides, setFallbackSurfaces] = useState<
    SurfaceOverrides | undefined
  >(undefined);
  const [onboardingOptions, setOnboardingOptions] = useState<
    { value: string; label: string }[] | null
  >(null);
  const suppressedRuleDialogRef = useRef<string | null>(null);
  const rulesRef = useLatestRef(rules);

  useEffect(() => {
    if (!profiles[0]) {
      setRuleProfileId("");
      setFallbackLocationId("");
      return;
    }
    setRuleProfileId((current) =>
      current && profiles.some((profile) => profile.id === current) ? current : "",
    );
    setFallbackLocationId((current) => {
      if (current && profiles.some((profile) => profile.id === current)) {
        return current;
      }
      const fallbackLocationId = globalFallbackRuleRef.current?.locationId;
      return fallbackLocationId &&
        profiles.some((profile) => profile.id === fallbackLocationId)
        ? fallbackLocationId
        : "";
    });
  }, [profiles, globalFallbackRuleRef]);

  return {
    editingRulePattern,
    isFallbackDialogOpen,
    isFallbackEnabled,
    fallbackSurfaceOverrides,
    fallbackLocationId,
    onboardingOptions,
    previewHostname,
    ruleDialogMode,
    ruleDialogOpened,
    ruleEnabled,
    ruleSurfaceOverrides,
    rulePattern,
    ruleProfileId,
    ruleRelaxCsp,
    rules,
    rulesFilter,
    rulesRef,
    selectedRulePatterns,
    setEditingRulePattern,
    setFallbackDialogOpen,
    setFallbackEnabled,
    setFallbackSurfaces,
    setFallbackLocationId,
    setOnboardingOptions,
    setPreviewHostname,
    setRuleDialogMode,
    setRuleDialogOpened,
    setRuleEnabled,
    setRuleSurfaceOverrides,
    setRulePattern,
    setRuleProfileId,
    setRuleRelaxCsp,
    setRules,
    setRulesFilter,
    setSelectedRulePatterns,
    suppressedRuleDialogRef,
  };
};

export type RuleState = ReturnType<typeof useRuleState>;

export const useRuleDerivedState = (options: {
  globalFallbackRule: GlobalFallbackRule | undefined;
  linkedRuleLocationId: string | null;
  profiles: readonly Location[];
  state: RuleState;
  trustedSites: readonly TrustedSite[];
}) => {
  const { state } = options;
  const viewModels = buildRuleViewModels(
    state.rules,
    options.profiles,
    state.rulesFilter,
    options.linkedRuleLocationId,
  );
  const allRuleKeys = state.rules.map((rule) => normalizeRulePattern(rule.pattern));
  const visibleRuleKeys = viewModels.map(({ rule }) =>
    normalizeRulePattern(rule.pattern),
  );
  const allRuleKeysSerialized = allRuleKeys.join(":");

  useEffect(() => {
    state.setSelectedRulePatterns((current) => {
      const next = new Set(
        [...current].filter((pattern) => allRuleKeys.includes(pattern)),
      );
      return next.size === current.size ? current : next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- allRuleKeys is derived from rules; serialized form used as stable dep to avoid object identity churn
  }, [allRuleKeysSerialized]);

  const savedRuleProfileOptions = useMemo(
    () =>
      options.profiles.map((profile) => ({
        value: profile.id,
        label: profile.label,
      })),
    [options.profiles],
  );

  return {
    allRuleKeys,
    bulkSelectionState: getVisibleSelectionState(
      visibleRuleKeys,
      state.selectedRulePatterns,
    ),
    editingRuleSeedKey:
      state.editingRulePattern === null
        ? null
        : (state.rules.find(
            (rule) => normalizeRulePattern(rule.pattern) === state.editingRulePattern,
          )?.ruleSeedKey ?? null),
    preview: resolveRulePreview({
      hostname: state.previewHostname,
      cookieStoreId: undefined,
      rules: state.rules,
      locations: options.profiles,
      trustedSites: options.trustedSites,
      globalFallbackRule: options.globalFallbackRule,
    }),
    profileUsage: countLocationRuleUsage(state.rules),
    ruleProfileOptions: state.onboardingOptions ?? savedRuleProfileOptions,
    viewModels,
    visibleRuleKeys,
  };
};

type RuleHandlerOptions = {
  globalFallbackRule: GlobalFallbackRule | undefined;
  globalFallbackRuleRef: RefObject<GlobalFallbackRule | undefined>;
  navigateToAnchor: NavigateToAnchor;
  persistSettings: (options: PersistSettingsOptions) => Promise<boolean>;
  profiles: readonly Location[];
  requestConfirmation: (config: ConfirmDialogConfig) => Promise<boolean>;
  setGlobalFallbackRule: (value: GlobalFallbackRule) => void;
  state: RuleState;
};

const compactSurfaceOverrides = (
  value: SurfaceOverrides | undefined,
): SurfaceOverrides | undefined => {
  if (!value) {
    return undefined;
  }
  const entries = Object.entries(value).filter(([, enabled]) => enabled !== undefined);
  return entries.length > 0
    ? (Object.fromEntries(entries) as SurfaceOverrides)
    : undefined;
};

const reconcileFallbackSeed = (
  options: RuleHandlerOptions,
  nextRule: Omit<GlobalFallbackRule, "ruleSeedKey"> & { ruleSeedKey?: string },
): GlobalFallbackRule => {
  const { ruleSeedKey, ...nextRuleWithoutSeed } = nextRule;
  const resolvedRuleSeedKey =
    ruleSeedKey ?? options.globalFallbackRuleRef.current?.ruleSeedKey;
  return withFallbackSeed({
    ...nextRuleWithoutSeed,
    ...(resolvedRuleSeedKey ? { ruleSeedKey: resolvedRuleSeedKey } : {}),
  });
};

const syncFallbackDraft = (
  options: RuleHandlerOptions,
  source = options.globalFallbackRuleRef.current,
): void => {
  options.state.setFallbackEnabled(source?.enabled ?? true);
  options.state.setFallbackLocationId(source?.locationId ?? "");
  options.state.setFallbackSurfaces(source?.fingerprintSurfaceOverrides);
};

const openRuleDialog = (state: RuleState, rule: DomainRule | undefined): void => {
  state.setRuleDialogMode(rule ? "edit" : "add");
  state.setEditingRulePattern(rule ? normalizeRulePattern(rule.pattern) : null);
  state.setRulePattern(rule?.pattern ?? "");
  state.setRuleProfileId(rule?.locationId ?? "");
  state.setRuleEnabled(rule?.enabled ?? true);
  state.setRuleRelaxCsp(rule?.relaxCspForWorkers ?? false);
  state.setRuleSurfaceOverrides(rule?.fingerprintSurfaceOverrides);
  state.setRuleDialogOpened(true);
};

const closeFallbackDialog = (options: RuleHandlerOptions): void => {
  options.state.setFallbackDialogOpen(false);
  syncFallbackDraft(options);
  if (window.location.hash === `#${getFallbackModalAnchor()}`) {
    options.navigateToAnchor(SECTION_ANCHORS.rules.globalFallback, {
      replace: true,
      highlight: false,
    });
  }
};

const handleRuleSubmit = async (
  options: RuleHandlerOptions,
  event: React.FormEvent<HTMLFormElement>,
): Promise<void> => {
  event.preventDefault();
  const { state } = options;
  const pattern = state.rulePattern.trim();
  if (!pattern) {
    notify.warning("Enter a domain pattern.");
    return;
  }

  const normalizedPattern = normalizeRulePattern(pattern);
  const hadExistingRule = state.rules.some(
    (rule) =>
      normalizeRulePattern(rule.pattern) === normalizedPattern &&
      normalizeRulePattern(rule.pattern) !== state.editingRulePattern,
  );
  const ruleAnchor = getRuleAnchor(pattern);
  if (hadExistingRule) {
    state.suppressedRuleDialogRef.current = ruleAnchor;
    const confirmed = await options.requestConfirmation({
      title: t.rules.dialog.duplicateAlertTitle,
      description: t.rules.dialog.duplicateAlertDescription(pattern),
      confirmLabel: t.rules.dialog.duplicateAlertConfirm,
      cancelLabel: t.rules.dialog.duplicateAlertClose,
      confirmVariant: "ghost",
      cancelVariant: "default",
      confirmClassName:
        "text-destructive hover:bg-destructive/10 hover:text-destructive",
      footerLayout: "split",
      actionOrder: "confirm-cancel",
    });
    if (!confirmed) {
      state.suppressedRuleDialogRef.current = null;
      return;
    }
  }

  const normalizedLocationId = state.ruleProfileId.trim();
  const nextRules = upsertRule(
    state.rules,
    {
      pattern,
      ...(normalizedLocationId ? { locationId: normalizedLocationId } : {}),
      enabled: state.ruleDialogMode === "edit" ? state.ruleEnabled : true,
      relaxCspForWorkers: state.ruleRelaxCsp,
      fingerprintSurfaceOverrides: compactSurfaceOverrides(state.ruleSurfaceOverrides),
    },
    state.editingRulePattern,
  );
  state.setRules(nextRules);
  state.setSelectedRulePatterns(new Set());
  state.setRuleDialogOpened(false);
  state.suppressedRuleDialogRef.current = ruleAnchor;
  options.navigateToAnchor(ruleAnchor, { replace: true });
  await options.persistSettings({
    toast:
      state.ruleDialogMode === "edit" || hadExistingRule
        ? "Rule updated."
        : "Rule added.",
    locations: options.profiles,
    rules: nextRules,
    scopes: ["location-model"],
  });
};

const buildGlobalFallbackRule = (options: RuleHandlerOptions): GlobalFallbackRule =>
  reconcileFallbackSeed(options, {
    enabled: options.state.isFallbackEnabled,
    ...(options.state.fallbackLocationId
      ? { locationId: options.state.fallbackLocationId }
      : {}),
    fingerprintSurfaceOverrides: compactSurfaceOverrides(
      options.state.fallbackSurfaceOverrides,
    ),
  });

const submitGlobalFallbackRule = async (
  options: RuleHandlerOptions,
  persist: boolean,
): Promise<void> => {
  const nextRule = buildGlobalFallbackRule(options);
  options.globalFallbackRuleRef.current = nextRule;
  options.setGlobalFallbackRule(nextRule);
  closeFallbackDialog(options);
  if (persist) {
    await options.persistSettings({
      toast: options.globalFallbackRule
        ? "Default Rule updated."
        : "Default Rule saved.",
      scopes: ["simple-settings"],
    });
  }
};

const handleDeleteRule = async (
  options: RuleHandlerOptions,
  patternKey: string,
  rulePatternText: string,
): Promise<boolean> => {
  const confirmed = await options.requestConfirmation({
    title: "Delete rule?",
    description: `Delete the rule ${rulePatternText}?`,
    confirmLabel: t.common.actions.delete,
    confirmTone: "destructive",
  });
  if (!confirmed) {
    return false;
  }

  const { state } = options;
  const nextRules = deleteRulesByIndex(
    state.rules,
    state.rules
      .map((entry, index) => ({ entry, index }))
      .filter(({ entry }) => normalizeRulePattern(entry.pattern) === patternKey)
      .map(({ index }) => index),
  );
  state.setRules(nextRules);
  state.setSelectedRulePatterns((current) => {
    const next = new Set(current);
    next.delete(patternKey);
    return next;
  });
  return await options.persistSettings({
    toast: "Rule removed.",
    locations: options.profiles,
    rules: nextRules,
    scopes: ["location-model"],
  });
};

const getSelectedRuleIndexes = (state: RuleState): number[] =>
  state.rules.flatMap((rule, index) =>
    state.selectedRulePatterns.has(normalizeRulePattern(rule.pattern)) ? [index] : [],
  );

const assignBulkLocation = async (
  options: RuleHandlerOptions,
  locationId: string,
): Promise<void> => {
  const { state } = options;
  if (!locationId || state.selectedRulePatterns.size === 0) {
    return;
  }
  const nextRules = reassignRulesToLocation(
    state.rules,
    getSelectedRuleIndexes(state),
    locationId,
  );
  state.setRules(nextRules);
  state.setSelectedRulePatterns(new Set());
  await options.persistSettings({
    toast: "Selected rules updated.",
    locations: options.profiles,
    rules: nextRules,
    scopes: ["location-model"],
  });
};

const handleBulkDelete = async (options: RuleHandlerOptions): Promise<void> => {
  const { state } = options;
  if (state.selectedRulePatterns.size === 0) {
    return;
  }
  const confirmed = await options.requestConfirmation({
    title: "Delete selected rules?",
    description: "Delete the selected rules?",
    confirmLabel: t.common.actions.deleteSelected,
    confirmTone: "destructive",
  });
  if (!confirmed) {
    return;
  }

  const nextRules = deleteRulesByIndex(state.rules, getSelectedRuleIndexes(state));
  state.setRules(nextRules);
  state.setSelectedRulePatterns(new Set());
  await options.persistSettings({
    toast: "Selected rules removed.",
    locations: options.profiles,
    rules: nextRules,
    scopes: ["location-model"],
  });
};

export const createRuleHandlers = (options: RuleHandlerOptions) => ({
  closeFallbackDialog: (): void => closeFallbackDialog(options),
  closeRuleDialog: (): void => options.state.setRuleDialogOpened(false),
  assignBulkLocation: (locationId: string) => assignBulkLocation(options, locationId),
  handleBulkDelete: () => handleBulkDelete(options),
  handleDeleteRule: (patternKey: string, rulePatternText: string) =>
    handleDeleteRule(options, patternKey, rulePatternText),
  submitFallbackRule: async (
    event: React.FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    event.preventDefault();
    await submitGlobalFallbackRule(options, true);
  },
  submitOnboardingFallback: (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    void submitGlobalFallbackRule(options, false);
  },
  handleRuleSubmit: (event: React.FormEvent<HTMLFormElement>) =>
    handleRuleSubmit(options, event),
  openFallbackDialog: (): void => {
    syncFallbackDraft(options);
    options.state.setFallbackDialogOpen(true);
  },
  openRuleDialog: (rule?: DomainRule): void => openRuleDialog(options.state, rule),
});
