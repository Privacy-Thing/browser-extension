import React, { useCallback, useEffect, useMemo, useState } from "react";

import {
  CONTROL_D_API_ORIGIN,
  CONTROL_D_COMMANDS,
  CONTROL_D_GUIDE_URL,
  CONTROL_D_STATUS_URL,
  type ControlDDiff,
  type ControlDMapping,
  type ControlDProxyLocation,
  type ControlDPublicState,
} from "./contracts";

import { Button } from "@/ui/components/ui/button";
import { Card, CardContent } from "@/ui/components/ui/card";
import { Input } from "@/ui/components/ui/input";
import { Switch } from "@/ui/components/ui/switch";

type UiResponse =
  | {
      ok: true;
      state: ControlDPublicState;
      diff?: ControlDDiff;
      proxies?: ControlDProxyLocation[];
    }
  | { ok: false; error: string; state?: ControlDPublicState };

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

const formatTime = (value: string | null): string =>
  value ? new Date(value).toLocaleString() : "Not yet";

const statusLabel = (state: ControlDPublicState | null): string => {
  if (!state) return "Loading";
  const labels: Record<ControlDPublicState["status"], string> = {
    disconnected: "Not connected",
    ready: "Connected",
    syncing: "Synchronizing",
    conflict: "Needs attention",
    "auth-error": "Authorization failed",
    error: "Sync error",
  };
  return labels[state.status];
};

const Metric = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="rounded-lg border border-border/70 bg-background/70 px-3 py-2.5">
    <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
      {label}
    </p>
    <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
  </div>
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
      if (response.state) {
        setState(response.state);
        onEnabledChange(response.state.enabled);
      }
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

  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-border px-4 py-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold">Control D integration</h3>
          <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
            Beta / local
          </span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Show the Control D workspace and enable one-way regional rule sync.
        </p>
      </div>
      <Switch
        aria-label="Enable Control D integration"
        checked={state?.enabled ?? false}
        disabled={!state || busy}
        onCheckedChange={(enabled) => void toggle(enabled)}
      />
    </div>
  );
};

const DiffSummary = ({ diff }: { diff: ControlDDiff }) => (
  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
    <Metric label="Folders" value={diff.createFolders} />
    <Metric label="New rules" value={diff.addRules} />
    <Metric label="Updates" value={diff.updateRules} />
    <Metric label="Unchanged" value={diff.unchangedRules} />
  </div>
);

const ResolverSetup = ({ resolver }: { resolver: string }) => {
  const [copied, setCopied] = useState(false);
  const recordAction = (
    action: "copy-resolver" | "open-settings" | "open-status" | "open-guide",
    outcome: "success" | "fallback" | "failure",
  ) => void send({ type: CONTROL_D_COMMANDS.dnsAction, action, outcome });

  const copyResolver = async () => {
    try {
      await navigator.clipboard.writeText(resolver);
      setCopied(true);
      recordAction("copy-resolver", "success");
    } catch {
      recordAction("copy-resolver", "failure");
    }
  };

  const openBrowserDns = async () => {
    const settingsUrl =
      __PT_BROWSER_TARGET__ === "firefox"
        ? "about:preferences#privacy"
        : "chrome://settings/security";
    try {
      await chrome.tabs.create({ url: settingsUrl });
      recordAction("open-settings", "success");
    } catch {
      await chrome.tabs.create({ url: CONTROL_D_GUIDE_URL });
      recordAction("open-settings", "fallback");
    }
  };

  const openExternal = async (action: "open-status" | "open-guide", url: string) => {
    try {
      await chrome.tabs.create({ url });
      recordAction(action, "success");
    } catch {
      recordAction(action, "failure");
    }
  };

  return (
    <section className="rounded-xl border border-border bg-muted/20 p-4">
      <div className="flex items-start gap-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
          1
        </span>
        <div>
          <h4 className="text-sm font-semibold">Copy your private DoH address</h4>
          <p className="mt-1 text-sm text-muted-foreground">
            The value stays masked here and is never written to debug logs.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <code className="rounded-md bg-background px-2.5 py-1.5 text-xs text-muted-foreground">
              {resolver.replace(/^(https:\/\/[^/]+\/).+$/, "$1••••••••")}
            </code>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void copyResolver()}
            >
              {copied ? "Copied" : "Copy address"}
            </Button>
          </div>
        </div>
      </div>
      <div className="mt-4 flex items-start gap-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-background text-xs font-bold">
          2
        </span>
        <div>
          <h4 className="text-sm font-semibold">Set Secure DNS in your browser</h4>
          <p className="mt-1 text-sm text-muted-foreground">
            Browser extensions cannot change this setting on your behalf.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void openBrowserDns()}
            >
              Open DNS settings
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => void openExternal("open-guide", CONTROL_D_GUIDE_URL)}
            >
              View instructions
            </Button>
          </div>
        </div>
      </div>
      <div className="mt-4 flex items-start gap-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-background text-xs font-bold">
          3
        </span>
        <div>
          <h4 className="text-sm font-semibold">Verify the active resolver</h4>
          <p className="mt-1 text-sm text-muted-foreground">
            Disconnecting Privacy Thing leaves your browser DNS unchanged.
          </p>
          <Button
            className="mt-2"
            type="button"
            size="sm"
            variant="outline"
            onClick={() => void openExternal("open-status", CONTROL_D_STATUS_URL)}
          >
            Check Control D status
          </Button>
        </div>
      </div>
    </section>
  );
};

// eslint-disable-next-line max-lines-per-function, sonarjs/cognitive-complexity -- Progressive disclosure keeps this experimental control plane readable.
export const ControlDPanel = () => {
  const [state, setState] = useState<ControlDPublicState | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [diff, setDiff] = useState<ControlDDiff | null>(null);
  const [proxies, setProxies] = useState<ControlDProxyLocation[]>([]);
  const [confirmApproximate, setConfirmApproximate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

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
      if (response.diff) setDiff(response.diff);
      if (response.proxies) setProxies(response.proxies);
      return response;
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Control D request failed.");
      return null;
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void run({ type: CONTROL_D_COMMANDS.getState });
  }, [run]);

  const proxyByPk = useMemo(
    () => new Map(proxies.map((proxy) => [proxy.pk, proxy])),
    [proxies],
  );

  const connect = async () => {
    if (!(await requestApiAccess())) {
      setNotice("Access to the Control D API was not granted.");
      return;
    }
    const response = await run({ type: CONTROL_D_COMMANDS.connect, apiKey });
    if (response?.ok) {
      setApiKey("");
      setNotice("API key verified. It is stored only on this device.");
    }
  };

  const updateMapping = async (mapping: ControlDMapping, proxyPk: string) => {
    const proxy = proxyByPk.get(proxyPk);
    const shared = {
      locationId: mapping.locationId,
      ...(mapping.locationLabel ? { locationLabel: mapping.locationLabel } : {}),
      ...(mapping.ruleCount === undefined ? {} : { ruleCount: mapping.ruleCount }),
    };
    const next: ControlDMapping = proxy
      ? {
          ...shared,
          proxyPk,
          status: "approximate",
          confirmed: false,
        }
      : {
          ...shared,
          proxyPk: null,
          status: "skipped",
          confirmed: true,
        };
    const response = await run({
      type: CONTROL_D_COMMANDS.updateMapping,
      mapping: next,
    });
    if (response?.ok) await run({ type: CONTROL_D_COMMANDS.preview });
  };

  const activeRoutes =
    diff?.mappings.filter((mapping) => mapping.status !== "skipped").length ??
    state?.locationMappings.filter((mapping) => mapping.status !== "skipped").length ??
    0;

  return (
    <Card className="overflow-hidden border-primary/25 shadow-sm">
      <div className="border-b border-border bg-gradient-to-r from-primary/[0.08] via-background to-background px-6 py-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-semibold tracking-tight">
                Control D regional DNS
              </h2>
              <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
                Experimental
              </span>
            </div>
            <p className="mt-1.5 max-w-2xl text-sm leading-6 text-muted-foreground">
              Publish compatible regional rules to an isolated Control D profile. Sync
              is one-way and never modifies unrelated profiles or rules.
            </p>
          </div>
          <span className="rounded-full border border-border bg-background px-3 py-1 text-xs font-medium">
            {statusLabel(state)}
          </span>
        </div>
      </div>

      <CardContent className="space-y-5 p-6">
        {!state?.connected ? (
          <section className="rounded-xl border border-border bg-muted/20 p-4">
            <div className="max-w-2xl">
              <h3 className="text-sm font-semibold">Connect your Control D account</h3>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                Use a write-enabled API key. Privacy Thing stores it locally and
                excludes it from sync and settings exports.
              </p>
            </div>
            <div className="mt-3 flex max-w-2xl flex-col gap-2 sm:flex-row">
              <Input
                type="password"
                autoComplete="off"
                value={apiKey}
                placeholder="Write API key"
                aria-label="Control D API key"
                onChange={(event) => setApiKey(event.target.value)}
              />
              <Button
                type="button"
                disabled={busy || !apiKey.trim()}
                onClick={() => void connect()}
              >
                Test and connect
              </Button>
            </div>
          </section>
        ) : (
          <>
            <div className="grid gap-2 sm:grid-cols-3">
              <Metric
                label="Last successful sync"
                value={formatTime(state.lastSuccessAt)}
              />
              <Metric label="Regional routes" value={activeRoutes} />
              <Metric
                label="Automatic sync"
                value={state.autoSyncEnabled ? "Active" : "Awaiting first apply"}
              />
            </div>

            <div className="flex flex-wrap gap-2 border-b border-border pb-5">
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => void run({ type: CONTROL_D_COMMANDS.preview })}
              >
                Preview changes
              </Button>
              {state.autoSyncEnabled ? (
                <Button
                  type="button"
                  disabled={busy}
                  onClick={() => void run({ type: CONTROL_D_COMMANDS.syncNow })}
                >
                  Sync now
                </Button>
              ) : null}
              {state.status === "conflict" ? (
                <Button
                  type="button"
                  variant="destructive-outline"
                  disabled={busy}
                  onClick={() => void run({ type: CONTROL_D_COMMANDS.repair })}
                >
                  Repair managed rules
                </Button>
              ) : null}
              <Button
                className="sm:ml-auto"
                type="button"
                variant="ghost"
                disabled={busy}
                onClick={() => void run({ type: CONTROL_D_COMMANDS.disconnect })}
              >
                Disconnect
              </Button>
            </div>

            {diff ? <DiffSummary diff={diff} /> : null}

            {diff?.mappings.length ? (
              <section className="overflow-hidden rounded-xl border border-border">
                <div className="border-b border-border bg-muted/30 px-4 py-3">
                  <h3 className="text-sm font-semibold">Regional routes</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Review every Privacy Thing profile and the Control D exit it will
                    use.
                  </p>
                </div>
                <div className="divide-y divide-border">
                  {diff.mappings.map((mapping) => {
                    const selected = mapping.proxyPk
                      ? proxyByPk.get(mapping.proxyPk)
                      : undefined;
                    return (
                      <div
                        key={mapping.locationId}
                        className="grid gap-3 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(14rem,1fr)] sm:items-center"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium">
                              {mapping.locationLabel ?? mapping.locationId}
                            </span>
                            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                              {mapping.ruleCount ?? 0}{" "}
                              {(mapping.ruleCount ?? 0) === 1 ? "rule" : "rules"}
                            </span>
                            <span
                              className={
                                mapping.status === "approximate"
                                  ? "text-xs font-medium text-amber-700 dark:text-amber-300"
                                  : "text-xs font-medium text-emerald-700 dark:text-emerald-300"
                              }
                            >
                              {mapping.status}
                            </span>
                          </div>
                          <p className="mt-1 truncate text-xs text-muted-foreground">
                            {selected
                              ? `${selected.city}, ${selected.countryName} · ${selected.pk}`
                              : "Excluded from synchronization"}
                          </p>
                        </div>
                        <select
                          aria-label={`Control D exit for ${mapping.locationLabel ?? mapping.locationId}`}
                          className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                          value={mapping.proxyPk ?? ""}
                          onChange={(event) =>
                            void updateMapping(mapping, event.target.value)
                          }
                        >
                          <option value="">Skip this regional profile</option>
                          {proxies.map((proxy) => (
                            <option key={proxy.pk} value={proxy.pk}>
                              {proxy.city}, {proxy.countryName} ({proxy.pk})
                            </option>
                          ))}
                        </select>
                      </div>
                    );
                  })}
                </div>
              </section>
            ) : null}

            {diff?.warnings.length ? (
              <section className="rounded-xl border border-amber-500/35 bg-amber-500/[0.08] p-4 text-sm">
                <h3 className="font-semibold text-amber-900 dark:text-amber-200">
                  Review before syncing
                </h3>
                <ul className="mt-2 space-y-1.5 text-amber-900/80 dark:text-amber-100/80">
                  {diff.warnings.map((warning, index) => (
                    <li
                      key={`${warning.code}-${warning.pattern ?? warning.locationId ?? index}`}
                    >
                      • {warning.message}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {diff && !state.autoSyncEnabled ? (
              <section className="rounded-xl border border-primary/25 bg-primary/[0.04] p-4">
                <h3 className="text-sm font-semibold">
                  Apply the first synchronization
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  After this confirmed apply, Privacy Thing will synchronize the latest
                  valid snapshot automatically.
                </p>
                {diff.requiresApproximationConfirmation ? (
                  <label className="mt-3 flex items-start gap-2 text-sm">
                    <input
                      className="mt-0.5"
                      type="checkbox"
                      checked={confirmApproximate}
                      onChange={(event) => setConfirmApproximate(event.target.checked)}
                    />
                    I accept every approximate cross-country mapping shown above.
                  </label>
                ) : null}
                <Button
                  className="mt-3"
                  type="button"
                  disabled={
                    busy ||
                    (diff.requiresApproximationConfirmation && !confirmApproximate)
                  }
                  onClick={() =>
                    void run({ type: CONTROL_D_COMMANDS.apply, confirmApproximate })
                  }
                >
                  Apply first synchronization
                </Button>
              </section>
            ) : null}

            <p className="text-xs text-muted-foreground">
              Last attempt: {formatTime(state.lastAttemptAt)}
              {state.lastError ? ` · ${state.lastError}` : ""}
            </p>
          </>
        )}

        {state?.resolverDoh ? <ResolverSetup resolver={state.resolverDoh} /> : null}

        {notice ? (
          <p
            role="status"
            className="rounded-lg border border-amber-500/30 bg-amber-500/[0.08] px-3 py-2 text-sm text-amber-800 dark:text-amber-200"
          >
            {notice}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
};
