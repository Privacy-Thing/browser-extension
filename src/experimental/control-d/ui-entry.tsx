/* eslint-disable max-lines */
import React, { useCallback, useEffect, useMemo, useState } from "react";

import { controlDAutoApply } from "./auto-apply";
import { isConflictEntered } from "./conflict-transition";
import {
  CONTROL_D_API_GUIDE_URL,
  CONTROL_D_API_ORIGIN,
  CONTROL_D_COMMANDS,
  CONTROL_D_NEEDS_REVIEW,
  CONTROL_D_GUIDE_URL,
  CONTROL_D_STATUS_URL,
  type ControlDDiff,
  type ControlDMapping,
  type ControlDPreparedSnapshot,
  type ControlDPublicState,
  type ControlDRecoveryCandidate,
} from "./contracts";
import { controlDText as t } from "./ui-copy";
import { featureText } from "./ui-feature-copy";
import { ControlDRegionalRoute } from "./ui-regional-route";

import { cn } from "@/ui/components/lib/utils";
import { SettingsControlCard } from "@/ui/components/SettingsControlCard";
import { SettingsHelpCard } from "@/ui/components/SettingsHelpCard";
import { Button } from "@/ui/components/ui/button";
import { Card } from "@/ui/components/ui/card";
import {
  Dialog,
  DialogCloseButton,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/ui/components/ui/dialog";
import { Input } from "@/ui/components/ui/input";
import { Separator } from "@/ui/components/ui/separator";
import { Switch } from "@/ui/components/ui/switch";
import { SetupProgress } from "@/ui/options/components/onboarding/setup-progress";
import { SETTINGS_SUBPAGE_ANCHORS, PAGE_ANCHORS } from "@/ui/options/navigation";
import type { PluginUiContribution } from "@/ui/plugins/contracts";
import { AppSubpageHeader } from "@/ui/shared/AppSubpageHeader";

export { controlDFeatureUi } from "./ui-rule-feature-presentation";

type UiResponse =
  | {
      ok: true;
      state: ControlDPublicState;
      snapshot?: ControlDPreparedSnapshot;
      candidates?: ControlDRecoveryCandidate[];
    }
  | { ok: false; error: string; state?: ControlDPublicState };

type FlowStep = 0 | 1 | 2 | 3;
type ConfirmState =
  | { kind: "adopt"; candidate: ControlDRecoveryCandidate }
  | { kind: "disconnect" }
  | null;

const CONTROL_D_PRIVACY_URL = "https://controld.com/privacy";

const EMPTY_PROXIES: ControlDPreparedSnapshot["proxies"] = [];
const send = async (message: unknown): Promise<UiResponse> =>
  (await chrome.runtime.sendMessage(message)) as UiResponse;

const requestApiAccess = async (): Promise<boolean> => {
  const permission = { origins: [CONTROL_D_API_ORIGIN] };
  if (await chrome.permissions.contains(permission)) return true;
  return chrome.permissions.request(permission);
};

export const isIntegrationAvailable = (): boolean =>
  (chrome.runtime.getManifest().optional_host_permissions ?? []).includes(
    CONTROL_D_API_ORIGIN,
  );

const settingTitle = (text: string) => (
  <h3 className="text-sm font-semibold">{text}</h3>
);

const privacyPolicyLink = () => (
  <Button
    asChild
    size="sm"
    variant="link"
    className="h-auto max-w-full whitespace-normal px-0 py-0 text-left text-xs"
  >
    <a href={CONTROL_D_PRIVACY_URL} target="_blank" rel="noopener noreferrer">
      {t.privacyPolicy}
      <span
        className="fa-solid fa-arrow-up-right-from-square shrink-0"
        aria-hidden="true"
      />
    </a>
  </Button>
);

const StepSection = ({
  alert,
  children,
  ...props
}: React.ComponentProps<typeof SettingsControlCard> & {
  alert?: React.ReactNode;
}) => (
  <SettingsControlCard
    {...props}
    className={cn(
      "rounded-none border-0 bg-transparent shadow-none dark:shadow-none",
      props.className,
    )}
    contentClassName={cn("p-0", props.contentClassName)}
  >
    {alert ? <div className="mb-4">{alert}</div> : null}
    {children}
  </SettingsControlCard>
);
const formatTime = (value: string | null): string =>
  value ? new Date(value).toLocaleString() : t.common.notYet;

const inferStep = (state: ControlDPublicState | null): FlowStep => {
  if (!state?.connected) return 0;
  if (state.setupStatus === "unselected") return 1;
  return state.lastSuccessAt ? 3 : 2;
};

const stateLabel = (state: ControlDPublicState | null): string => {
  if (!state) return t.status.loading;
  if (!state.connected) return t.status.disconnected;
  if (state.status === "auth-error") return t.status.authError;
  if (state.status === "conflict") return t.status.conflict;
  if (state.status === "error") return t.status.syncError;
  if (state.status === "syncing") return t.status.syncing;
  if (state.setupStatus === "unselected") return t.status.chooseSetup;
  if (!state.lastSuccessAt) return t.status.review;
  if (state.dnsStatus !== "verified") return t.status.dnsPending;
  return t.status.active;
};

type StatusTone = "neutral" | "success" | "error" | "warning";

const stateTone = (state: ControlDPublicState | null): StatusTone => {
  if (!state?.connected || state.status === "syncing") return "neutral";
  if (state.status === "auth-error" || state.status === "error") return "error";
  if (state.status === "conflict") return "warning";
  if (state.setupStatus === "unselected" || !state.lastSuccessAt) return "neutral";
  return state.dnsStatus === "verified" ? "success" : "warning";
};

const toneClasses: Record<StatusTone, string> = {
  success: "border-tone-success-border bg-tone-success-bg text-tone-success-text",
  error: "border-tone-error-border bg-tone-error-bg text-tone-error-text",
  warning: "border-tone-warning-border bg-tone-warning-bg text-tone-warning-text",
  neutral: "border-border bg-muted/60 text-foreground",
};

const StatusBadge = ({ label, tone }: { label: string; tone: StatusTone }) => (
  <span
    data-control-d-tone={tone}
    className={cn(
      "inline-flex rounded-full border px-2.5 py-1 text-xs font-medium",
      toneClasses[tone],
    )}
  >
    {label}
  </span>
);

export const ControlDFeatureToggle = ({
  onEnabledChange,
}: {
  onEnabledChange: (enabled: boolean) => void;
}) => {
  const [state, setState] = useState<ControlDPublicState | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void send({ type: CONTROL_D_COMMANDS.getState }).then((response) => {
      if (!response.state) return;
      setState(response.state);
      onEnabledChange(response.state.enabled);
    });
  }, [onEnabledChange]);

  const toggle = async (enabled: boolean) => {
    setBusy(true);
    try {
      const response = await send({ type: CONTROL_D_COMMANDS.setEnabled, enabled });
      if (response.state) setState(response.state);
      if (response.ok) {
        onEnabledChange(enabled);
        if (enabled) openIntegration();
      }
    } finally {
      setBusy(false);
    }
  };

  const openIntegration = () => {
    window.location.hash = SETTINGS_SUBPAGE_ANCHORS.experimentalIntegration;
  };

  return (
    <SettingsControlCard
      title={
        <div className="flex flex-wrap items-center gap-2">
          {settingTitle(t.featureTitle)}
          <StatusBadge label={t.beta} tone="neutral" />
        </div>
      }
      description={t.featureDescription}
      focusControlOnTitleClick
      action={
        <Switch
          data-control-d-toggle
          aria-label={t.enableLabel}
          checked={state?.enabled ?? false}
          disabled={!state || busy}
          onCheckedChange={(enabled) => void toggle(enabled)}
        />
      }
    >
      {state?.enabled ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <StatusBadge label={stateLabel(state)} tone={stateTone(state)} />
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={openIntegration}
            data-control-d-open
          >
            {t.open}
            <span className="fa-solid fa-arrow-right" aria-hidden="true" />
          </Button>
        </div>
      ) : null}
    </SettingsControlCard>
  );
};

const StepRail = ({
  current,
  furthest,
  onSelect,
}: {
  current: FlowStep;
  furthest: FlowStep;
  onSelect: (step: FlowStep) => void;
}) => (
  <div data-control-d-step-rail className="space-y-2">
    <SetupProgress
      active={current + 1}
      label={t.progressLabel}
      stepLabels={t.steps}
      selectableUntil={furthest}
      onSelect={(step) => onSelect(step as FlowStep)}
    />
    <div
      className="mx-auto grid w-full max-w-[340px] grid-cols-4 text-center text-xs text-muted-foreground"
      aria-hidden="true"
    >
      {t.steps.map((label) => (
        <span key={label}>{label}</span>
      ))}
    </div>
  </div>
);

const ChangeSummary = ({
  diff,
  completed,
}: {
  diff: ControlDDiff;
  completed?: boolean;
}) => {
  return (
    <div
      data-control-d-change-summary
      className="space-y-2 rounded-lg border bg-background/70 px-3 py-2 text-sm"
    >
      <p>
        {(completed ? t.summary.created : t.summary.willCreate)(
          diff.createProfile ? 1 : 0,
          diff.createEndpoint ? 1 : 0,
          diff.createFolders,
        )}
      </p>
      <p>{t.summary.ruleChanges(diff.addRules, diff.updateRules, diff.deleteRules)}</p>
    </div>
  );
};

const ServiceChangeSummary = ({ diff }: { diff: ControlDDiff }) => {
  if (diff.addServices === undefined) return null;
  const values = [
    [featureText.add, diff.addServices],
    [featureText.update, diff.updateServices],
    [featureText.remove, diff.deleteServices],
  ] as const;
  return (
    <section data-control-d-service-diff className="space-y-2">
      <h4 className="text-sm font-medium">{featureText.serviceChanges}</h4>
      <dl className="grid grid-cols-3 gap-2">
        {values.map(([label, value]) => (
          <div key={label} className="rounded-lg border bg-background/70 px-3 py-2">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="mt-0.5 text-lg font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      {diff.serviceErrors?.map((conflict) => (
        <p
          key={`${conflict.code}:${conflict.servicePk}`}
          role="alert"
          className="text-xs text-tone-error-text"
        >
          {conflict.message}
        </p>
      ))}
    </section>
  );
};

const isControlDPlanEmpty = (diff: ControlDDiff): boolean =>
  !diff.createProfile &&
  !diff.createEndpoint &&
  diff.createFolders +
    diff.addRules +
    diff.updateRules +
    diff.deleteRules +
    (diff.addServices ?? 0) +
    (diff.updateServices ?? 0) +
    (diff.deleteServices ?? 0) ===
    0;

const hasBlockingChanges = (diff: ControlDDiff): boolean =>
  diff.warnings.some(
    (warning) =>
      warning.code === "unsupported-pattern" || warning.code === "missing-location",
  ) ||
  (diff.serviceErrors?.some((conflict) => conflict.code !== "remote-service-changed") ??
    false);

const requiresRepair = (
  diff: ControlDDiff | undefined,
  state: ControlDPublicState | null,
): boolean =>
  (state?.status === "conflict" && state.lastError !== CONTROL_D_NEEDS_REVIEW) ||
  (diff?.serviceErrors?.some(
    (conflict) => conflict.code === "remote-service-changed",
  ) ??
    false);

const applyButtonLabel = (
  busy: boolean,
  diff: ControlDDiff | undefined,
  state: ControlDPublicState | null,
): string => {
  if (busy) return t.common.working;
  if (diff?.requiresApproximationConfirmation) return t.rules.applyApproximate;
  if (requiresRepair(diff, state)) return t.rules.repair;
  return t.rules.apply;
};

const PlanWarnings = ({ diff }: { diff: ControlDDiff }) => (
  <>
    {diff.warnings.length > 0 ? (
      <ul className="space-y-1 rounded-lg border border-tone-warning-border bg-tone-warning-bg px-3 py-2 text-xs text-tone-warning-text">
        {diff.warnings.map((warning, index) => (
          <li key={`${warning.code}-${warning.locationId ?? warning.pattern ?? index}`}>
            {warning.message}
          </li>
        ))}
      </ul>
    ) : null}
  </>
);

const ApproximateApplyLabel = ({
  label,
  diff,
  proxyByPk,
}: {
  label: string;
  diff: ControlDDiff;
  proxyByPk: ReadonlyMap<string, ControlDPreparedSnapshot["proxies"][number]>;
}) => (
  <span>
    {label}
    {diff.requiresApproximationConfirmation ? (
      <span className="mt-1 block text-xs font-normal">
        {diff.mappings
          .filter((mapping) => mapping.status === "approximate" && !mapping.confirmed)
          .map((mapping) => {
            const proxy = mapping.proxyPk ? proxyByPk.get(mapping.proxyPk) : undefined;
            const exit = proxy
              ? `${proxy.city}, ${proxy.countryName}`
              : t.route.unavailable;
            return `${mapping.locationLabel ?? mapping.locationId} → ${exit}`;
          })
          .join("; ")}
      </span>
    ) : null}
  </span>
);

// eslint-disable-next-line max-lines-per-function, sonarjs/cognitive-complexity -- Coordinates the complete experimental setup flow.
export const ControlDSubpage = () => {
  const [state, setState] = useState<ControlDPublicState | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [candidates, setCandidates] = useState<ControlDRecoveryCandidate[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<ControlDPreparedSnapshot | null>(null);
  const [flowBusy, setFlowBusy] = useState(false);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [completedDiff, setCompletedDiff] = useState<ControlDDiff | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [stepOverride, setStepOverride] = useState<FlowStep | null>(null);
  const [showRoutes, setShowRoutes] = useState(false);
  const [editingLocationId, setEditingLocationId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [confirmState, setConfirmState] = useState<ConfirmState>(null);

  const run = useCallback(async (message: unknown) => {
    setBusy(true);
    setNotice(null);
    try {
      const response = await send(message);
      if (response.state) setState(response.state);
      if (!response.ok) {
        setSnapshot(null);
        setNotice(response.error);
        return response;
      }
      if (response.snapshot) {
        setSnapshot(response.snapshot);
      }
      if (response.candidates) {
        setCandidates(response.candidates);
        setSelectedProfileId(null);
      }
      return response;
    } catch (error) {
      setNotice(error instanceof Error ? error.message : t.common.requestFailed);
      return null;
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    const onChange = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string,
    ) => {
      if (area !== "local") return;
      const pending = Object.values(changes).some(isConflictEntered);
      if (pending) {
        setStepOverride(2);
        void run({ type: CONTROL_D_COMMANDS.preview });
      }
    };
    chrome.storage.onChanged.addListener(onChange);
    return () => chrome.storage.onChanged.removeListener(onChange);
  }, [run]);

  const inferredStep = inferStep(state);
  const currentStep = stepOverride ?? inferredStep;
  const syncing = busy || flowBusy || state?.status === "syncing";
  const active = Boolean(state?.lastSuccessAt && state.dnsStatus === "verified");
  const selectedCandidate = candidates.find(
    (candidate) => candidate.profileId === selectedProfileId,
  );
  const proxies = snapshot?.proxies ?? EMPTY_PROXIES;
  const proxyByPk = useMemo(
    () => new Map(proxies.map((proxy) => [proxy.pk, proxy])),
    [proxies],
  );

  const prepareAndAdvance = useCallback(
    async (adoptionNotice?: string) => {
      const prepared = await run({ type: CONTROL_D_COMMANDS.preview });
      if (!prepared?.ok || !prepared.snapshot) {
        setStepOverride(2);
        return;
      }
      const decision = controlDAutoApply(
        prepared.snapshot.diff,
        prepared.snapshot.diff.mappings,
        prepared.state.adoptionKind ?? "owned",
      );
      if (decision.kind === "needs-screen") {
        setStepOverride(2);
        if (adoptionNotice) setSuccessNotice(adoptionNotice);
        return;
      }
      const applied = await run({
        type: CONTROL_D_COMMANDS.apply,
        previewToken: prepared.snapshot.token,
        confirmApproximate: false,
      });
      if (applied?.ok) {
        setStepOverride(3);
        setCompletedDiff(prepared.snapshot.diff);
        setSuccessNotice(adoptionNotice ?? t.rules.appliedAutomatically);
      } else setStepOverride(2);
    },
    [run],
  );

  useEffect(() => {
    void (async () => {
      const response = await run({ type: CONTROL_D_COMMANDS.getState });
      const routeLink = new URLSearchParams(window.location.hash.split("?")[1] ?? "");
      if (
        response?.ok &&
        response.state.connected &&
        response.state.setupStatus === "selected" &&
        routeLink.get("section") === "routes"
      ) {
        const prepared = await run({ type: CONTROL_D_COMMANDS.preview });
        if (prepared?.ok) {
          setShowRoutes(true);
          setStepOverride(2);
          const preset = routeLink.get("preset");
          if (
            preset &&
            prepared.snapshot?.diff.mappings.some(
              (mapping) => mapping.locationId === preset,
            )
          )
            setEditingLocationId(preset);
        }
      } else if (
        response?.ok &&
        response.state.connected &&
        response.state.setupStatus === "unselected"
      ) {
        await run({ type: CONTROL_D_COMMANDS.discover });
      } else if (
        response?.ok &&
        response.state.connected &&
        response.state.setupStatus === "selected" &&
        (!response.state.lastSuccessAt ||
          response.state.lastError ||
          response.state.status === "conflict")
      ) {
        if (
          !response.state.lastSuccessAt &&
          !response.state.lastError &&
          response.state.status !== "conflict"
        ) {
          setFlowBusy(true);
          try {
            await prepareAndAdvance();
          } finally {
            setFlowBusy(false);
          }
        } else {
          setStepOverride(2);
          await run({ type: CONTROL_D_COMMANDS.preview });
        }
      }
    })();
  }, [run, prepareAndAdvance]);

  const chooseNew = async () => {
    setFlowBusy(true);
    try {
      const response = await run({ type: CONTROL_D_COMMANDS.selectNew });
      if (response?.ok) await prepareAndAdvance();
    } finally {
      setFlowBusy(false);
    }
  };

  const adopt = async (candidate: ControlDRecoveryCandidate) => {
    setFlowBusy(true);
    try {
      const response = await run({
        type: CONTROL_D_COMMANDS.adopt,
        profileId: candidate.profileId,
        endpointId: candidate.endpointId,
        code: candidate.code,
      });
      if (response?.ok) await prepareAndAdvance(t.setup.adopted(candidate.profileName));
    } finally {
      setFlowBusy(false);
    }
  };

  const connect = async () => {
    setFlowBusy(true);
    try {
      if (!(await requestApiAccess())) {
        setNotice(t.account.permissionDenied);
        return;
      }
      const response = await run({ type: CONTROL_D_COMMANDS.connect, apiKey });
      if (!response?.ok) return;
      setApiKey("");
      if (response.state.setupStatus === "selected") {
        await prepareAndAdvance();
        return;
      }
      const discovery = await run({ type: CONTROL_D_COMMANDS.discover });
      if (!discovery?.ok) return;
      const found = discovery.candidates ?? [];
      if (found.length === 0) await chooseNew();
      else if (
        found.length === 1 &&
        found[0]?.compatibility === "ready" &&
        !found[0].issue
      )
        await adopt(found[0]);
      else setStepOverride(1);
    } finally {
      setFlowBusy(false);
    }
  };

  const updateMapping = async (mapping: ControlDMapping, proxyPk: string) => {
    setSnapshot(null);
    const proxy = proxyByPk.get(proxyPk);
    const shared = {
      locationId: mapping.locationId,
      ...(mapping.locationLabel ? { locationLabel: mapping.locationLabel } : {}),
      ...(mapping.ruleCount === undefined ? {} : { ruleCount: mapping.ruleCount }),
    };
    const next: ControlDMapping = proxy
      ? { ...shared, proxyPk, status: "approximate", confirmed: false }
      : { ...shared, proxyPk: null, status: "skipped", confirmed: true };
    const response = await run({
      type: CONTROL_D_COMMANDS.updateMapping,
      mapping: next,
    });
    if (response?.ok) {
      setEditingLocationId(null);
      await run({ type: CONTROL_D_COMMANDS.preview });
    }
  };

  const apply = async () => {
    const type = requiresRepair(snapshot?.diff, state)
      ? CONTROL_D_COMMANDS.repair
      : CONTROL_D_COMMANDS.apply;
    const response = await run({
      type,
      confirmApproximate: snapshot?.diff.requiresApproximationConfirmation ?? false,
      previewToken: snapshot?.token ?? "",
    });
    if (response?.ok) {
      setCompletedDiff(snapshot?.diff ?? null);
      setSuccessNotice(t.rules.applied);
      setStepOverride(3);
    }
  };

  const recordDnsAction = (
    action: "copy-resolver" | "open-settings" | "open-status" | "open-guide",
    outcome: "success" | "fallback" | "failure",
  ) => void send({ type: CONTROL_D_COMMANDS.dnsAction, action, outcome });

  const copyResolver = async () => {
    if (!state?.resolverDoh) return;
    try {
      await navigator.clipboard.writeText(state.resolverDoh);
      setCopied(true);
      recordDnsAction("copy-resolver", "success");
    } catch {
      recordDnsAction("copy-resolver", "failure");
      setNotice(t.common.copyFailed);
    }
  };

  const openBrowserDns = async () => {
    const settingsUrl =
      __PT_BROWSER_TARGET__ === "firefox"
        ? "about:preferences#privacy"
        : "chrome://settings/security";
    try {
      await chrome.tabs.create({ url: settingsUrl });
      recordDnsAction("open-settings", "success");
    } catch {
      await chrome.tabs.create({ url: CONTROL_D_GUIDE_URL });
      recordDnsAction("open-settings", "fallback");
    }
  };

  const openExternal = async (action: "open-status" | "open-guide", url: string) => {
    try {
      await chrome.tabs.create({ url });
      recordDnsAction(action, "success");
    } catch {
      recordDnsAction(action, "failure");
    }
  };

  const finishConfirmation = async () => {
    const current = confirmState;
    setConfirmState(null);
    if (current?.kind === "adopt") await adopt(current.candidate);
    if (current?.kind === "disconnect") {
      const response = await run({ type: CONTROL_D_COMMANDS.disconnect });
      if (response?.ok) {
        setSnapshot(null);
        setSuccessNotice(null);
        setCompletedDiff(null);
        setCandidates([]);
        setStepOverride(0);
      }
    }
  };

  const errorText = notice ?? state?.lastError;
  const stepAlert = errorText ? (
    <div
      role="alert"
      className="rounded-lg border border-tone-error-border bg-tone-error-bg px-3 py-2 text-sm text-tone-error-text"
    >
      {errorText === CONTROL_D_NEEDS_REVIEW ? t.status.conflict : errorText}
    </div>
  ) : null;

  const renderAccount = () => (
    <StepSection
      title={settingTitle(
        state?.connected ? t.account.connectedTitle : t.account.title,
      )}
      description={
        state?.connected ? t.account.connectedDescription : t.account.description
      }
    >
      {state?.connected ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <StatusBadge label={t.account.connectedTitle} tone="success" />
          <Button type="button" size="sm" onClick={() => setStepOverride(null)}>
            {t.common.continue}
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <section
            data-control-d-intro
            aria-labelledby="control-d-intro-title"
            className="space-y-3 text-xs leading-relaxed text-muted-foreground"
          >
            <h4 id="control-d-intro-title" className="font-semibold text-foreground">
              {t.intro.title}
            </h4>
            <ul className="list-disc space-y-3 pl-4">
              <li>{t.intro.purpose}</li>
              <li>
                {t.intro.resources}
                <details className="mt-1" data-control-d-resource-names>
                  <summary className="w-fit cursor-pointer font-medium text-foreground">
                    {t.intro.namesTitle}
                  </summary>
                  <p className="mt-1 break-words">{t.intro.names}</p>
                </details>
              </li>
              <li>{t.intro.data}</li>
              <li>{t.intro.limits}</li>
            </ul>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              {privacyPolicyLink()}
              <Button
                asChild
                size="sm"
                variant="link"
                className="h-auto max-w-full whitespace-normal px-0 py-0 text-left text-xs"
              >
                <a
                  href={`#${SETTINGS_SUBPAGE_ANCHORS.privacyPolicy}`}
                  data-control-d-own-privacy
                >
                  {t.ownPrivacyPolicy}
                </a>
              </Button>
            </div>
          </section>
          <p
            data-control-d-connect-consent
            className="max-w-2xl text-xs text-muted-foreground"
          >
            {t.account.consent}
          </p>
          <div className="flex max-w-2xl flex-col gap-2 sm:flex-row">
            <Input
              type="password"
              autoComplete="off"
              value={apiKey}
              data-control-d-api-key
              placeholder={t.account.placeholder}
              aria-label={t.account.placeholder}
              onChange={(event) => setApiKey(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && apiKey.trim() && !syncing) void connect();
              }}
            />
            <Button
              type="button"
              disabled={syncing || !apiKey.trim()}
              onClick={() => void connect()}
            >
              {syncing ? t.common.working : t.account.connect}
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <Button
              type="button"
              size="sm"
              variant="link"
              className="h-auto px-0 py-0 text-xs"
              onClick={() => void openExternal("open-guide", CONTROL_D_API_GUIDE_URL)}
            >
              {t.account.docs}
              <span
                className="fa-solid fa-arrow-up-right-from-square"
                aria-hidden="true"
              />
            </Button>
          </div>
          <div data-control-d-key-feedback aria-live="polite">
            {stepAlert}
          </div>
        </div>
      )}
    </StepSection>
  );

  const renderSetup = () => (
    <StepSection
      alert={stepAlert}
      title={settingTitle(t.setup.title)}
      description={t.setup.description}
    >
      <div className="space-y-4">
        {candidates.length === 0 ? (
          <p className="rounded-lg border border-dashed bg-muted/25 px-3 py-4 text-sm text-muted-foreground">
            {t.setup.none}
          </p>
        ) : (
          <div role="radiogroup" aria-label={t.setup.existing} className="space-y-2">
            {candidates.map((candidate) => {
              const blocked = candidate.compatibility === "ambiguous";
              const selected = selectedProfileId === candidate.profileId;
              return (
                <button
                  key={candidate.profileId}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  disabled={blocked || syncing}
                  onClick={() => setSelectedProfileId(candidate.profileId)}
                  className={cn(
                    "w-full rounded-lg border px-4 py-3 text-left transition-colors",
                    selected
                      ? "border-primary bg-primary/8"
                      : "border-border bg-background hover:bg-muted/35",
                    blocked && "cursor-not-allowed opacity-65",
                  )}
                >
                  <span className="flex flex-wrap items-start justify-between gap-2">
                    <span>
                      <span className="block text-sm font-semibold text-foreground">
                        {candidate.profileName}
                      </span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {candidate.endpointName ?? t.setup.missingEndpoint} ·{" "}
                        {t.setup.folders(candidate.managedFolderCount)}
                      </span>
                    </span>
                    <code className="rounded bg-muted px-2 py-1 text-xs">
                      {candidate.code}
                    </code>
                  </span>
                  {candidate.issue ? (
                    <span className="mt-2 block text-xs text-tone-warning-text">
                      {t.setup.blocked}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        )}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            disabled={syncing}
            onClick={() => void chooseNew()}
          >
            {t.setup.createNew}
          </Button>
          {selectedCandidate ? (
            <Button
              type="button"
              disabled={syncing}
              onClick={() =>
                setConfirmState({ kind: "adopt", candidate: selectedCandidate })
              }
            >
              {t.setup.useExisting}
            </Button>
          ) : null}
        </div>
      </div>
    </StepSection>
  );

  const renderRules = () => {
    const diff = snapshot?.diff;
    const mappings = showRoutes
      ? (diff?.mappings ?? [])
      : (diff?.mappings.filter((mapping) => mapping.status === "approximate") ?? []);
    const applyLabel = applyButtonLabel(syncing, diff, state);
    return (
      <div className="space-y-4">
        <StepSection
          alert={stepAlert}
          title={settingTitle(t.rules.title)}
          description={t.rules.description}
        >
          {diff ? (
            <div className="space-y-4">
              <ChangeSummary diff={diff} />
              <ServiceChangeSummary diff={diff} />
              {isControlDPlanEmpty(diff) ? (
                <p className="text-sm text-tone-success-text">{t.rules.upToDate}</p>
              ) : null}
              <PlanWarnings diff={diff} />
              {diff.requiresApproximationConfirmation ? (
                <p
                  data-control-d-pending-consent
                  className="text-sm text-tone-warning-text"
                >
                  {t.rules.consentRequired}
                </p>
              ) : null}
              {state?.adoptionKind === "foreign" ? (
                <p
                  data-control-d-foreign-review
                  className="text-sm text-tone-warning-text"
                >
                  {t.setup.foreignReview}
                </p>
              ) : null}
              <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowRoutes((value) => !value)}
                >
                  {showRoutes ? t.rules.hideRoutes : t.rules.showRoutes}
                </Button>
                <Button
                  type="button"
                  disabled={syncing || hasBlockingChanges(diff)}
                  data-control-d-apply
                  className="h-auto max-w-full whitespace-normal py-2 text-left"
                  onClick={() => void apply()}
                >
                  <ApproximateApplyLabel
                    label={applyLabel}
                    diff={diff}
                    proxyByPk={proxyByPk}
                  />
                </Button>
              </div>
            </div>
          ) : (
            <Button
              type="button"
              disabled={syncing}
              onClick={() => void run({ type: CONTROL_D_COMMANDS.preview })}
            >
              {syncing ? t.common.working : t.rules.preview}
            </Button>
          )}
        </StepSection>
        {mappings.length > 0 ? (
          <StepSection
            title={settingTitle(t.rules.routes)}
            description={t.rules.routeDescription}
          >
            <div className="divide-y rounded-lg border">
              {mappings.map((mapping) => (
                <ControlDRegionalRoute
                  key={mapping.locationId}
                  busy={syncing}
                  editing={editingLocationId === mapping.locationId}
                  mapping={mapping}
                  proxies={proxies}
                  proxy={mapping.proxyPk ? proxyByPk.get(mapping.proxyPk) : undefined}
                  onEditingChange={(editing) =>
                    setEditingLocationId(editing ? mapping.locationId : null)
                  }
                  onMappingChange={(next, proxyPk) => void updateMapping(next, proxyPk)}
                />
              ))}
            </div>
          </StepSection>
        ) : null}
      </div>
    );
  };

  const renderDns = () => (
    <StepSection
      alert={stepAlert}
      title={settingTitle(
        state?.dnsStatus === "verified" ? t.dns.verified : t.dns.title,
      )}
      description={
        state?.dnsStatus === "verified" ? t.dns.verifiedDescription : t.dns.description
      }
    >
      {state?.resolverDoh ? (
        <div className="space-y-4">
          <code className="block max-w-full truncate rounded-lg border bg-muted px-3 py-2 text-xs">
            {state.resolverDoh.replace(/^(https:\/\/[^/]+\/).+$/, "$1••••••••")}
          </code>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void copyResolver()}
            >
              {copied ? t.dns.copied : t.dns.copy}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void openBrowserDns()}
            >
              {t.dns.settings}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void openExternal("open-status", CONTROL_D_STATUS_URL)}
            >
              {t.dns.verify}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => void openExternal("open-guide", CONTROL_D_GUIDE_URL)}
            >
              {t.dns.guide}
            </Button>
            {privacyPolicyLink()}
          </div>
          {state.dnsStatus === "verified" ? (
            <p className="text-xs text-muted-foreground">
              {t.common.confirmedAt(formatTime(state.dnsVerifiedAt))}
            </p>
          ) : (
            <div className="flex justify-end border-t pt-4">
              <Button
                type="button"
                disabled={syncing}
                onClick={() =>
                  void run({
                    type: CONTROL_D_COMMANDS.confirmDns,
                    verified: true,
                  }).then((response) => {
                    if (response?.ok) setStepOverride(null);
                  })
                }
              >
                {t.dns.confirm}
              </Button>
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{t.common.applyFirst}</p>
      )}
    </StepSection>
  );

  const renderOverview = () => (
    <div className="space-y-4">
      <StepSection alert={stepAlert} title={settingTitle(t.overview.title)}>
        <details className="mb-4 text-xs text-muted-foreground">
          <summary className="w-fit cursor-pointer">{t.overview.codeTitle}</summary>
          <p className="mt-1">
            {t.overview.setupLabel(state?.resourceCode ?? "")} ·{" "}
            {t.overview.codeDescription}
          </p>
        </details>
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">{t.overview.account}</p>
            <p className="mt-1 text-sm font-medium">{t.account.connectedTitle}</p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">{t.overview.rules}</p>
            <p className="mt-1 text-sm font-medium">
              {t.overview.syncedAt(formatTime(state?.lastSuccessAt ?? null))}
            </p>
          </div>
          <div className="rounded-lg border p-3">
            <p className="text-xs text-muted-foreground">{t.overview.dns}</p>
            <p className="mt-1 text-sm font-medium">
              {state?.dnsStatus === "verified"
                ? t.dns.verifiedState
                : t.dns.unverifiedState}
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap justify-end gap-2 border-t pt-4">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              setStepOverride(2);
              void run({ type: CONTROL_D_COMMANDS.preview });
            }}
          >
            {t.overview.review}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => setStepOverride(3)}
          >
            {t.overview.verify}
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={syncing}
            onClick={() => {
              setFlowBusy(true);
              void prepareAndAdvance().finally(() => setFlowBusy(false));
            }}
          >
            {syncing ? t.common.working : t.rules.sync}
          </Button>
        </div>
      </StepSection>
    </div>
  );

  let content = renderDns();
  if (active && stepOverride === null && !state?.lastError) content = renderOverview();
  else if (currentStep === 0) content = renderAccount();
  else if (currentStep === 1) content = renderSetup();
  else if (currentStep === 2 || (active && state?.lastError && stepOverride === null))
    content = renderRules();

  if (flowBusy && state?.connected)
    content = (
      <StepSection title={settingTitle(t.common.working)}>
        <p
          role="status"
          data-control-d-advancing
          className="text-sm text-muted-foreground"
        >
          {t.status.syncing}
        </p>
      </StepSection>
    );

  const help =
    active && stepOverride === null
      ? t.help.overview
      : ([t.help.account, t.help.setup, t.help.rules, t.help.dns] as const)[
          currentStep
        ];

  return (
    <div data-control-d-state={state?.status ?? "loading"} className="space-y-5">
      <AppSubpageHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            {t.title}
            <StatusBadge label={t.beta} tone="neutral" />
          </span>
        }
        lead={t.lead}
        backLabel={t.back}
        backAriaLabel={t.back}
        backIconOnly
        backHref={`#${PAGE_ANCHORS.advanced}`}
      />
      <div className="grid grid-cols-12 gap-5">
        <div className="col-span-12 lg:col-span-8">
          <Card className="space-y-5 p-5">
            <StepRail
              current={currentStep}
              furthest={inferredStep}
              onSelect={setStepOverride}
            />
            <div aria-live="polite" className="sr-only">
              {syncing ? t.common.working : stateLabel(state)}
            </div>
            {successNotice ? (
              <div
                role="status"
                data-control-d-success-notice
                className="flex items-start justify-between gap-2 rounded-lg border border-tone-success-border bg-tone-success-bg px-3 py-2 text-sm text-tone-success-text"
              >
                <div className="min-w-0 space-y-2">
                  <span>{successNotice}</span>
                  {completedDiff ? (
                    <ChangeSummary diff={completedDiff} completed />
                  ) : null}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  aria-label={t.common.dismiss}
                  onClick={() => setSuccessNotice(null)}
                >
                  ×
                </Button>
              </div>
            ) : null}
            {content}
            {state?.connected ? (
              <>
                <Separator />
                <div className="flex justify-end">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="border-tone-error-border text-tone-error-text hover:bg-tone-error-bg hover:text-tone-error-text"
                    disabled={syncing}
                    onClick={() => setConfirmState({ kind: "disconnect" })}
                  >
                    {t.disconnect.action}
                  </Button>
                </div>
              </>
            ) : null}
          </Card>
        </div>
        <div className="col-span-12 lg:col-span-4">
          <SettingsHelpCard
            title={help.title}
            collapsible
            defaultOpen
            data-control-d-help
          >
            <p>{help.body}</p>
            <p>{help.note}</p>
            {state?.connected ? (
              <p data-control-d-domain-matching>{featureText.automaticMatching}</p>
            ) : null}
          </SettingsHelpCard>
        </div>
      </div>
      <Dialog
        open={confirmState !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmState(null);
        }}
      >
        <DialogContent className="max-w-md">
          <DialogCloseButton label={t.common.cancel} />
          <DialogHeader>
            <DialogTitle>
              {confirmState?.kind === "adopt"
                ? t.setup.confirmTitle
                : t.disconnect.title}
            </DialogTitle>
            <DialogDescription>
              {confirmState?.kind === "adopt"
                ? t.setup.confirmDescription
                : t.disconnect.description}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setConfirmState(null)}
            >
              {t.common.cancel}
            </Button>
            <Button
              type="button"
              variant={confirmState?.kind === "disconnect" ? "destructive" : "default"}
              onClick={() => void finishConfirmation()}
            >
              {confirmState?.kind === "adopt"
                ? t.setup.useExisting
                : t.disconnect.confirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export const ControlDPanel = ControlDSubpage;

/** Plugin-owned settings presentation, consumed by the PT composition root. */
export const controlDPluginUi: PluginUiContribution = {
  id: "control-d",
  name: "Control D",
  route: "experimentalIntegration",
  supported: isIntegrationAvailable,
  Toggle: ControlDFeatureToggle,
  Subpage: ControlDSubpage,
};
