/* eslint-disable max-lines */
import React, { useCallback, useEffect, useMemo, useState } from "react";

import {
  CONTROL_D_API_GUIDE_URL,
  CONTROL_D_API_ORIGIN,
  CONTROL_D_COMMANDS,
  CONTROL_D_GUIDE_URL,
  CONTROL_D_STATUS_URL,
  type ControlDDiff,
  type ControlDMapping,
  type ControlDPreparedSnapshot,
  type ControlDPublicState,
  type ControlDRecoveryCandidate,
} from "./contracts";
import { controlDText as t } from "./ui-copy";
import { ControlDRegionalRoute } from "./ui-regional-route";

import { cn } from "@/ui/components/lib/utils";
import { SettingsControlCard } from "@/ui/components/SettingsControlCard";
import { SettingsHelpCard } from "@/ui/components/SettingsHelpCard";
import { Button } from "@/ui/components/ui/button";
import { Checkbox } from "@/ui/components/ui/checkbox";
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
import { SETTINGS_SUBPAGE_ANCHORS, PAGE_ANCHORS } from "@/ui/options/navigation";
import { AppSubpageHeader } from "@/ui/shared/AppSubpageHeader";

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
const formatTime = (value: string | null): string =>
  value ? new Date(value).toLocaleString() : t.common.notYet;

const inferStep = (state: ControlDPublicState | null): FlowStep => {
  if (!state?.connected) return 0;
  if (state.setupStatus === "unselected") return 1;
  return state.lastSuccessAt ? 3 : 2;
};

const connectedStep = (state: ControlDPublicState): FlowStep => {
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

const statusTone = (label: string): string => {
  if (label === t.status.active)
    return "border-tone-success-border bg-tone-success-bg text-tone-success-text";
  if (label.includes("failed") || label.includes("error"))
    return "border-tone-error-border bg-tone-error-bg text-tone-error-text";
  if (label.includes("attention") || label.includes("not verified"))
    return "border-tone-warning-border bg-tone-warning-bg text-tone-warning-text";
  return "border-border bg-muted/60 text-foreground";
};

const StatusBadge = ({ label }: { label: string }) => (
  <span
    className={cn(
      "inline-flex rounded-full border px-2.5 py-1 text-xs font-medium",
      statusTone(label),
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
      if (response.ok) onEnabledChange(enabled);
    } finally {
      setBusy(false);
    }
  };

  const openIntegration = () => {
    window.location.hash = SETTINGS_SUBPAGE_ANCHORS.experimentalIntegration;
  };

  return (
    <SettingsControlCard
      title={settingTitle(t.featureTitle)}
      description={t.featureDescription}
      focusControlOnTitleClick
      action={
        <Switch
          aria-label={t.enableLabel}
          checked={state?.enabled ?? false}
          disabled={!state || busy}
          onCheckedChange={(enabled) => void toggle(enabled)}
        />
      }
    >
      {state?.enabled ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <StatusBadge label={stateLabel(state)} />
          <Button type="button" size="sm" variant="outline" onClick={openIntegration}>
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
  dnsVerified,
  onSelect,
}: {
  current: FlowStep;
  furthest: FlowStep;
  dnsVerified: boolean;
  onSelect: (step: FlowStep) => void;
}) => (
  <ol
    className="grid gap-1 rounded-lg border bg-muted/20 p-1 sm:grid-cols-2 lg:grid-cols-4"
    aria-label={t.progressLabel}
    data-control-d-step-rail
  >
    {t.steps.map((label, index) => {
      const step = index as FlowStep;
      const active = current === step;
      const complete = step < furthest || (step === 3 && dnsVerified);
      return (
        <li key={label}>
          <button
            type="button"
            disabled={step > furthest}
            aria-current={active ? "step" : undefined}
            onClick={() => onSelect(step)}
            className={cn(
              "flex min-h-9 w-full items-center gap-2 rounded-md border border-transparent px-2.5 py-1.5 text-left text-xs transition-colors",
              active && "border-primary/50 bg-background text-foreground shadow-sm",
              !active && complete && "bg-tone-success-bg/35 text-foreground",
              !active && !complete && "text-muted-foreground",
              step <= furthest && "hover:bg-background/70",
            )}
          >
            <span
              className={cn(
                "flex size-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold",
                complete && "border-tone-success-border text-tone-success-text",
                active && "border-primary bg-primary text-primary-foreground",
              )}
            >
              {complete && !active ? "✓" : index + 1}
            </span>
            <span className="min-w-0 font-medium">{label}</span>
          </button>
        </li>
      );
    })}
  </ol>
);

const ChangeSummary = ({ diff }: { diff: ControlDDiff }) => {
  const values = [
    [t.summary.profiles, diff.createProfile ? 1 : 0],
    [t.summary.endpoints, diff.createEndpoint ? 1 : 0],
    [t.summary.folders, diff.createFolders],
    [t.summary.add, diff.addRules],
    [t.summary.update, diff.updateRules],
    [t.summary.remove, diff.deleteRules],
  ] as const;
  return (
    <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {values.map(([label, value]) => (
        <div key={label} className="rounded-lg border bg-background/70 px-3 py-2">
          <dt className="text-xs text-muted-foreground">{label}</dt>
          <dd className="mt-0.5 text-lg font-semibold tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  );
};

// eslint-disable-next-line max-lines-per-function -- Coordinates the complete experimental setup flow.
export const ControlDSubpage = () => {
  const [state, setState] = useState<ControlDPublicState | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [candidates, setCandidates] = useState<ControlDRecoveryCandidate[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<ControlDPreparedSnapshot | null>(null);
  const [confirmApproximate, setConfirmApproximate] = useState(false);
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
        setNotice(response.error);
        return response;
      }
      if (response.snapshot) setSnapshot(response.snapshot);
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
    void (async () => {
      const response = await run({ type: CONTROL_D_COMMANDS.getState });
      if (
        response?.ok &&
        response.state.connected &&
        response.state.setupStatus === "unselected"
      ) {
        await run({ type: CONTROL_D_COMMANDS.discover });
      } else if (
        response?.ok &&
        response.state.connected &&
        response.state.setupStatus === "selected" &&
        (!response.state.lastSuccessAt || response.state.status === "conflict")
      ) {
        await run({ type: CONTROL_D_COMMANDS.preview });
      }
    })();
  }, [run]);

  const inferredStep = inferStep(state);
  const currentStep = stepOverride ?? inferredStep;
  const syncing = busy || state?.status === "syncing";
  const active = Boolean(state?.lastSuccessAt && state.dnsStatus === "verified");
  const selectedCandidate = candidates.find(
    (candidate) => candidate.profileId === selectedProfileId,
  );
  const proxies = snapshot?.proxies ?? EMPTY_PROXIES;
  const proxyByPk = useMemo(
    () => new Map(proxies.map((proxy) => [proxy.pk, proxy])),
    [proxies],
  );

  const connect = async () => {
    if (!(await requestApiAccess())) {
      setNotice(t.account.permissionDenied);
      return;
    }
    const response = await run({ type: CONTROL_D_COMMANDS.connect, apiKey });
    if (response?.ok) {
      setApiKey("");
      setStepOverride(connectedStep(response.state));
    }
  };

  const chooseNew = async () => {
    const response = await run({ type: CONTROL_D_COMMANDS.selectNew });
    if (!response?.ok) return;
    await run({ type: CONTROL_D_COMMANDS.preview });
    setStepOverride(2);
  };

  const adopt = async (candidate: ControlDRecoveryCandidate) => {
    const response = await run({
      type: CONTROL_D_COMMANDS.adopt,
      profileId: candidate.profileId,
      endpointId: candidate.endpointId,
      code: candidate.code,
    });
    if (!response?.ok) return;
    await run({ type: CONTROL_D_COMMANDS.preview });
    setStepOverride(2);
  };

  const updateMapping = async (mapping: ControlDMapping, proxyPk: string) => {
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
    const type =
      state?.status === "conflict"
        ? CONTROL_D_COMMANDS.repair
        : CONTROL_D_COMMANDS.apply;
    const response = await run(
      type === CONTROL_D_COMMANDS.apply ? { type, confirmApproximate } : { type },
    );
    if (response?.ok) setStepOverride(3);
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
        setCandidates([]);
        setStepOverride(0);
      }
    }
  };

  const renderAccount = () => (
    <SettingsControlCard
      title={settingTitle(
        state?.connected ? t.account.connectedTitle : t.account.title,
      )}
      description={
        state?.connected ? t.account.connectedDescription : t.account.description
      }
    >
      {state?.connected ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <StatusBadge label={t.account.connectedTitle} />
          <Button type="button" size="sm" onClick={() => setStepOverride(null)}>
            {t.common.continue}
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex max-w-2xl flex-col gap-2 sm:flex-row">
            <Input
              type="password"
              autoComplete="off"
              value={apiKey}
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
      )}
    </SettingsControlCard>
  );

  const renderSetup = () => (
    <SettingsControlCard
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
    </SettingsControlCard>
  );

  // eslint-disable-next-line sonarjs/cognitive-complexity
  const renderRules = () => {
    const diff = snapshot?.diff;
    const blockingWarnings =
      diff?.warnings.filter(
        (warning) =>
          warning.code === "unsupported-pattern" || warning.code === "missing-location",
      ) ?? [];
    const mappings = showRoutes
      ? (diff?.mappings ?? [])
      : (diff?.mappings.filter((mapping) => mapping.status === "approximate") ?? []);
    let applyLabel: string = t.rules.apply;
    if (syncing) applyLabel = t.common.working;
    else if (state?.status === "conflict") applyLabel = t.rules.repair;
    return (
      <div className="space-y-4">
        <SettingsControlCard
          title={settingTitle(t.rules.title)}
          description={t.rules.description}
        >
          {diff ? (
            <div className="space-y-4">
              <ChangeSummary diff={diff} />
              {diff.addRules + diff.updateRules + diff.deleteRules === 0 &&
              !diff.createProfile &&
              !diff.createEndpoint ? (
                <p className="text-sm text-tone-success-text">{t.rules.upToDate}</p>
              ) : null}
              {diff.warnings.length > 0 ? (
                <ul className="space-y-1 rounded-lg border border-tone-warning-border bg-tone-warning-bg px-3 py-2 text-xs text-tone-warning-text">
                  {diff.warnings.map((warning, index) => (
                    <li
                      key={`${warning.code}-${warning.locationId ?? warning.pattern ?? index}`}
                    >
                      {warning.message}
                    </li>
                  ))}
                </ul>
              ) : null}
              {diff.requiresApproximationConfirmation ? (
                <label className="flex items-start gap-2 text-sm">
                  <Checkbox
                    checked={confirmApproximate}
                    onChange={(event) => setConfirmApproximate(event.target.checked)}
                  />
                  <span>{t.rules.acceptApproximate}</span>
                </label>
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
                  disabled={
                    syncing ||
                    blockingWarnings.length > 0 ||
                    (diff.requiresApproximationConfirmation && !confirmApproximate)
                  }
                  onClick={() => void apply()}
                >
                  {applyLabel}
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
        </SettingsControlCard>
        {mappings.length > 0 ? (
          <SettingsControlCard
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
          </SettingsControlCard>
        ) : null}
      </div>
    );
  };

  const renderDns = () => (
    <SettingsControlCard
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
    </SettingsControlCard>
  );

  const renderOverview = () => (
    <div className="space-y-4">
      <SettingsControlCard
        title={settingTitle(t.overview.title)}
        description={t.overview.setupLabel(state?.resourceCode ?? "")}
      >
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
            onClick={() => setStepOverride(2)}
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
            onClick={() => void run({ type: CONTROL_D_COMMANDS.syncNow })}
          >
            {syncing ? t.common.working : t.rules.sync}
          </Button>
        </div>
      </SettingsControlCard>
      <Separator />
      <div className="flex justify-end">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="border-tone-error-border text-tone-error-text hover:bg-tone-error-bg hover:text-tone-error-text"
          onClick={() => setConfirmState({ kind: "disconnect" })}
        >
          {t.disconnect.action}
        </Button>
      </div>
    </div>
  );

  let content = renderDns();
  if (active && stepOverride === null) content = renderOverview();
  else if (currentStep === 0) content = renderAccount();
  else if (currentStep === 1) content = renderSetup();
  else if (currentStep === 2) content = renderRules();

  const help =
    active && stepOverride === null
      ? t.help.overview
      : ([t.help.account, t.help.setup, t.help.rules, t.help.dns] as const)[
          currentStep
        ];

  return (
    <div data-control-d-state={state?.status ?? "loading"} className="space-y-5">
      <AppSubpageHeader
        title={t.title}
        lead={t.lead}
        backLabel={t.back}
        backAriaLabel={t.back}
        backIconOnly
        backHref={`#${PAGE_ANCHORS.advanced}`}
        actions={<StatusBadge label={stateLabel(state)} />}
      />
      <div className="grid grid-cols-12 gap-5">
        <div className="col-span-12 space-y-4 lg:col-span-8">
          <StepRail
            current={currentStep}
            furthest={inferredStep}
            dnsVerified={state?.dnsStatus === "verified"}
            onSelect={setStepOverride}
          />
          {(notice ?? state?.lastError) ? (
            <div
              role="alert"
              className="rounded-lg border border-tone-error-border bg-tone-error-bg px-3 py-2 text-sm text-tone-error-text"
            >
              {notice ?? state?.lastError}
            </div>
          ) : null}
          <div aria-live="polite" className="sr-only">
            {syncing ? t.common.working : stateLabel(state)}
          </div>
          {content}
        </div>
        <div className="col-span-12 lg:col-span-4">
          <SettingsHelpCard title={help.title} collapsible defaultOpen={false}>
            <p>{help.body}</p>
            <p>{t.help.retention}</p>
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
