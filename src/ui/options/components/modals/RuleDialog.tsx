import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { matchTrustedSite } from "@/shared/rule-resolution";
import { Button } from "@/ui/components/ui/button";
import { FormDialogShell } from "@/ui/components/ui/form-dialog-shell";
import { Input } from "@/ui/components/ui/input";
import { Switch } from "@/ui/components/ui/switch";
import { t } from "@/ui/i18n";
import {
  DialogIdentitySection,
  DialogFieldRow,
  DialogToggleRow,
} from "@/ui/options/components/modals/dialog-primitives";
import {
  LocationFormFields,
  UNASSIGNED_VALUE,
} from "@/ui/options/components/modals/LocationFormFields";
import { RuleSettingsDialog } from "@/ui/options/components/modals/RuleAdvancedSettingsDialog";
import { SurfaceOverridesControls } from "@/ui/options/components/modals/surface-overrides-controls";
import { SECTION_ANCHORS, getRuleModalAnchor } from "@/ui/options/navigation";
import { useSettings } from "@/ui/options/state/SettingsContext";
import { ProviderFeatureHost } from "@/ui/shared/ProviderFeatureHost";
import { RuleAdditionalHosts } from "@/ui/shared/RuleHosts";
import {
  useRuleEditorJoin,
  type ProviderFeatureJoin,
  type RuleDraftSettings,
} from "@/ui/shared/use-provider-feature-join";

const InheritedSettings = ({
  locked,
  children,
}: {
  locked: boolean;
  children: ReactNode;
}) => (
  <div
    {...(locked ? { inert: true } : {})}
    className={locked ? "text-muted-foreground" : undefined}
  >
    {children}
  </div>
);

const useAdvancedDialog = (parentOpen: boolean) => {
  const [open, setOpen] = useState(false);
  const closingRef = useRef(false);
  const timerRef = useRef<number | null>(null);
  const changeOpen = useCallback((next: boolean) => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (!next) {
      closingRef.current = true;
      timerRef.current = window.setTimeout(() => {
        closingRef.current = false;
        timerRef.current = null;
      }, 0);
    } else {
      closingRef.current = false;
    }
    setOpen(next);
  }, []);
  useEffect(() => {
    if (!parentOpen) changeOpen(false);
  }, [changeOpen, parentOpen]);
  useEffect(
    () => () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    },
    [],
  );
  return { changeOpen, closingRef, open };
};

const RuleDialogFooter = ({
  openAdvanced,
  advancedDisabled,
  saveDisabled,
}: {
  openAdvanced: () => void;
  advancedDisabled: boolean;
  saveDisabled: boolean;
}) => {
  const {
    closeRuleDialog,
    editingRulePattern,
    handleDeleteRule,
    ruleDialogMode,
    rulePattern,
  } = useSettings();
  return (
    <>
      <div className="flex items-center gap-2">
        <Button
          id="close-rule-dialog"
          type="button"
          variant="ghost"
          onClick={closeRuleDialog}
        >
          {t.common.actions.cancel}
        </Button>
        {ruleDialogMode === "edit" && editingRulePattern ? (
          <Button
            type="button"
            variant="ghost"
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={async () => {
              if (
                await handleDeleteRule(
                  editingRulePattern,
                  rulePattern.trim() || editingRulePattern,
                )
              ) {
                closeRuleDialog();
              }
            }}
          >
            {t.common.actions.delete}
          </Button>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        <Button
          id="open-rule-advanced-dialog"
          type="button"
          variant="ghost"
          className="text-foreground hover:text-foreground"
          disabled={advancedDisabled}
          onClick={openAdvanced}
        >
          {t.rules.dialog.advancedModal.trigger}
        </Button>
        <Button id="save-rule-dialog" type="submit" disabled={saveDisabled}>
          {ruleDialogMode === "edit"
            ? t.rules.dialog.submitEdit
            : t.rules.dialog.submitAdd}
        </Button>
      </div>
    </>
  );
};

const RuleScopeFeatures = ({
  join,
  onAdditionalPatterns,
}: {
  join: ProviderFeatureJoin;
  onAdditionalPatterns: (patterns: readonly string[]) => void;
}) => {
  const {
    editingRulePattern,
    rules,
    rulePattern,
    setRulePattern,
    ruleProfileId,
    ruleEnabled,
  } = useSettings();
  return (
    <>
      <RuleAdditionalHosts
        key={editingRulePattern ?? "new"}
        rules={rules}
        sourcePattern={editingRulePattern}
        onPatternsChange={onAdditionalPatterns}
        renderPrimary={(addControl) => (
          <DialogFieldRow
            htmlFor="dialog-rule-pattern"
            label={t.rules.dialog.patternLabel}
            labelInfo={
              <span dangerouslySetInnerHTML={{ __html: t.rules.dialog.patternInfo }} />
            }
            labelInfoAriaLabel={t.rules.dialog.patternInfoAriaLabel}
          >
            <div data-rule-pattern-row className="flex min-w-0 items-center gap-2">
              <Input
                className="min-w-0 flex-1"
                id="dialog-rule-pattern"
                name="pattern"
                placeholder={t.rules.dialog.patternPlaceholder}
                value={rulePattern}
                onChange={(event) => setRulePattern(event.currentTarget.value)}
              />
              {addControl}
            </div>
          </DialogFieldRow>
        )}
      />
      <ProviderFeatureHost
        key={`feature:${editingRulePattern ?? "new"}`}
        scopeKey={join.scopeKey}
        rulePattern={rulePattern}
        locationId={ruleProfileId || null}
        ruleEnabled={ruleEnabled}
        onDecisionChange={join.onDecisionChange}
        onJoinOfferChange={join.onJoinOfferChange}
        {...(editingRulePattern ? { savedRulePattern: editingRulePattern } : {})}
      />
    </>
  );
};

const RuleFields = ({
  join,
  shown,
  onAdditionalPatterns,
}: {
  join: ProviderFeatureJoin;
  shown: RuleDraftSettings;
  onAdditionalPatterns: (patterns: readonly string[]) => void;
}) => {
  const {
    closeRuleDialog,
    editingRulePattern,
    editingRuleSeedKey,
    rotateRuleIdentity,
    ruleDialogMode,
    rulePattern,
    ruleProfileOptions,
    setRuleEnabled,
    setRuleProfileId,
  } = useSettings();
  const limitationsHref = `${chrome.runtime.getURL("src/ui/options/index.html")}#${SECTION_ANCHORS.about.limitations}`;
  const options = [
    { value: UNASSIGNED_VALUE, label: t.rules.globalFallback.noPresetLabel },
    ...ruleProfileOptions.map((option) =>
      typeof option === "string"
        ? { value: option, label: option }
        : { value: option.value, label: option.label },
    ),
  ];
  return (
    <section className="rounded-xl border border-border/70 bg-card/35 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
      <div className="space-y-3 [&_[data-provider-feature-host]]:border-b [&_[data-provider-feature-host]]:border-border/70 [&_[data-provider-feature-host]]:pb-3">
        {ruleDialogMode === "edit" ? (
          <InheritedSettings locked={join.locked}>
            <DialogToggleRow
              htmlFor="dialog-rule-enabled"
              label={t.rules.dialog.enabledLabel}
              hint={t.rules.dialog.enabledHint}
              control={
                <Switch
                  id="dialog-rule-enabled"
                  checked={shown.enabled}
                  disabled={join.locked}
                  onCheckedChange={setRuleEnabled}
                  aria-label={t.rules.dialog.enabledAriaLabel(
                    rulePattern || t.rules.dialog.titleEdit,
                  )}
                />
              }
            />
            <div className="border-t border-border/70" />
          </InheritedSettings>
        ) : null}
        <RuleScopeFeatures join={join} onAdditionalPatterns={onAdditionalPatterns} />
        <InheritedSettings locked={join.locked}>
          <div data-rule-preset className="space-y-3 pt-3">
            <LocationFormFields
              sectionLabel={t.rules.dialog.locationProfileLabel}
              sectionHint={t.rules.dialog.locationProfileHint}
              warning={
                <>
                  {t.rules.globalFallback.dialog.locationProfileWarningPrefix}
                  <a
                    href={limitationsHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-foreground underline underline-offset-4"
                  >
                    {t.rules.globalFallback.dialog.locationProfileWarningLinkLabel}
                  </a>
                  {t.rules.globalFallback.dialog.locationProfileWarningSuffix}
                </>
              }
              selectId="dialog-rule-profile"
              selectLabel={t.rules.dialog.locationLabel}
              selectPlaceholder={t.rules.globalFallback.noPresetLabel}
              selectDisabled={join.locked}
              selectValue={shown.locationId || UNASSIGNED_VALUE}
              selectOptions={options}
              onSelectValueChange={(value) =>
                setRuleProfileId(value === UNASSIGNED_VALUE ? "" : value)
              }
            />
          </div>
        </InheritedSettings>
        {ruleDialogMode === "edit" && editingRulePattern && editingRuleSeedKey ? (
          <>
            <div className="border-t border-border/70" />
            <InheritedSettings locked={join.locked}>
              <DialogIdentitySection
                title={t.rules.dialog.identity.sectionTitle}
                description={t.rules.dialog.identity.sectionDescription}
                actionDescription={t.rules.dialog.identity.actionDescription}
                actionLabel={t.rules.dialog.identity.actionLabel}
                actionDisabled={join.locked}
                onAction={async () => {
                  const rotated = await rotateRuleIdentity(editingRulePattern);
                  if (rotated) closeRuleDialog();
                }}
              />
            </InheritedSettings>
          </>
        ) : null}
      </div>
    </section>
  );
};

const RuleDialogBody = ({
  join,
  shown,
  onAdditionalPatterns,
}: {
  join: ProviderFeatureJoin;
  shown: RuleDraftSettings;
  onAdditionalPatterns: (patterns: readonly string[]) => void;
}) => {
  const { rulePattern, setRuleSurfaceOverrides, trustedSites } = useSettings();
  const trustedPattern = useMemo(() => {
    const raw = rulePattern.trim();
    if (!raw) return null;
    const hostname = raw.startsWith("*") ? raw.slice(1).replace(/^\.*/, "") : raw;
    return matchTrustedSite(hostname, trustedSites)?.pattern ?? null;
  }, [rulePattern, trustedSites]);
  return (
    <>
      {trustedPattern ? (
        <div className="mb-4 flex items-start gap-3 rounded-lg border border-tone-warning-border bg-tone-warning-bg px-4 py-3 text-sm text-tone-warning-text">
          <svg
            className="mt-0.5 h-4 w-4 shrink-0"
            viewBox="0 0 16 16"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M8 1.5L14.5 13H1.5L8 1.5Z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            <path
              d="M8 6v3.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            <circle cx="8" cy="11.5" r="0.75" fill="currentColor" />
          </svg>
          <span>{t.rules.dialog.trustedSiteOverrideWarning(trustedPattern)}</span>
        </div>
      ) : null}
      <div className="grid gap-4 md:grid-cols-[minmax(0,1.15fr)_minmax(19rem,0.95fr)] md:items-start">
        <div className="space-y-4">
          <RuleFields
            join={join}
            shown={shown}
            onAdditionalPatterns={onAdditionalPatterns}
          />
        </div>
        <section className="rounded-xl border border-border/70 bg-card/35 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.02)]">
          <div>
            <h3 className="text-sm font-semibold">
              {t.rules.dialog.surfaceOverrides.title}
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {t.rules.dialog.surfaceOverrides.description}
            </p>
          </div>
          <InheritedSettings locked={join.locked}>
            <div className="mt-4">
              <SurfaceOverridesControls
                value={shown.surfaceOverrides}
                onChange={setRuleSurfaceOverrides}
                disabled={join.locked}
                labelClassName="text-sm"
              />
            </div>
          </InheritedSettings>
        </section>
      </div>
    </>
  );
};

export const RuleDialog = () => {
  const {
    ruleDialogOpened,
    closeRuleDialog,
    ruleDialogMode,
    handleRuleSubmit,
    rulePattern,
    editingRulePattern,
    rules,
    ruleProfileId,
    ruleEnabled,
    ruleSurfaceOverrides,
    ruleRelaxCsp,
  } = useSettings();
  const { join, shown, onAdditionalPatterns } = useRuleEditorJoin(
    rules,
    editingRulePattern,
    rulePattern,
    {
      draft: {
        locationId: ruleProfileId,
        enabled: ruleEnabled,
        surfaceOverrides: ruleSurfaceOverrides,
        relaxCspForWorkers: ruleRelaxCsp,
      },
      lockOnOffer: ruleDialogMode === "add",
    },
  );
  const {
    changeOpen,
    closingRef,
    open: advancedDialogOpen,
  } = useAdvancedDialog(ruleDialogOpened);
  const modalAnchorId = getRuleModalAnchor(rulePattern);
  const advancedTargetLabel =
    rulePattern.trim() || t.rules.dialog.advancedModal.patternFallback;
  const focusPrimaryControl = () => {
    document.getElementById("dialog-rule-pattern")?.focus();
  };
  return (
    <>
      <FormDialogShell
        open={ruleDialogOpened}
        onOpenChange={(open) => {
          if (open) {
            return;
          }
          if (advancedDialogOpen) {
            changeOpen(false);
            return;
          }
          if (closingRef.current) {
            closingRef.current = false;
            return;
          }
          closeRuleDialog();
        }}
        id="rule-dialog"
        title={
          <span id="rule-dialog-title" data-mode={ruleDialogMode}>
            {ruleDialogMode === "edit"
              ? t.rules.dialog.titleEdit
              : t.rules.dialog.titleAdd}
          </span>
        }
        description={t.rules.dialog.description}
        closeLabel={t.common.actions.close}
        contentClassName="sm:max-w-[58rem]"
        headerProps={{
          id: modalAnchorId,
          "data-anchor-id": modalAnchorId,
        }}
        headerClassName="gw-anchor-target"
        formProps={{
          id: "rule-dialog-form",
          onSubmit: (event) => {
            if (join.saveDisabled) event.preventDefault();
            else handleRuleSubmit(event);
          },
        }}
        footerClassName="sm:justify-between"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          queueMicrotask(focusPrimaryControl);
        }}
        footer={
          <RuleDialogFooter
            openAdvanced={() => changeOpen(true)}
            advancedDisabled={join.locked}
            saveDisabled={join.saveDisabled}
          />
        }
      >
        <div
          className="contents"
          data-join-lock={join.locked ? "locked" : "open"}
          data-join-source={join.source}
        >
          <RuleDialogBody
            join={join}
            shown={shown}
            onAdditionalPatterns={onAdditionalPatterns}
          />
        </div>
      </FormDialogShell>
      <RuleSettingsDialog
        open={advancedDialogOpen && ruleDialogOpened}
        onOpenChange={changeOpen}
        targetLabel={advancedTargetLabel}
        relaxCsp={shown.relaxCspForWorkers}
        settingsLocked={join.locked}
      />
    </>
  );
};
