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

import { SettingsControlCard } from "@/ui/components/SettingsControlCard";
import { SettingsSectionCard } from "@/ui/components/SettingsSectionCard";
import { SettingsSubcard } from "@/ui/components/SettingsSubcard";
import { Badge } from "@/ui/components/ui/badge";
import { Button } from "@/ui/components/ui/button";
import { Checkbox } from "@/ui/components/ui/checkbox";
import { Input } from "@/ui/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/components/ui/select";
import { Separator } from "@/ui/components/ui/separator";
import { Switch } from "@/ui/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/ui/components/ui/table";

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

type StatusVariant = "outline" | "success" | "warning" | "error" | "info";

const statusPresentation = (
  state: ControlDPublicState | null,
): { label: string; variant: StatusVariant } => {
  if (!state) return { label: "Loading", variant: "outline" };
  const states: Record<
    ControlDPublicState["status"],
    { label: string; variant: StatusVariant }
  > = {
    disconnected: { label: "Not connected", variant: "outline" },
    ready: { label: "Connected", variant: "success" },
    syncing: { label: "Synchronizing", variant: "info" },
    conflict: { label: "Needs attention", variant: "warning" },
    "auth-error": { label: "Authorization failed", variant: "error" },
    error: { label: "Sync error", variant: "error" },
  };
  return states[state.status];
};

const mappingBadgeVariant = (
  status: ControlDMapping["status"],
): "outline" | "success" | "warning" => {
  if (status === "approximate") return "warning";
  if (status === "skipped") return "outline";
  return "success";
};

const ruleCountLabel = (count: number): string =>
  `${count} ${count === 1 ? "rule" : "rules"}`;

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
    <SettingsControlCard
      title={
        <span className="flex flex-wrap items-center gap-2">
          <span>Control D integration</span>
          <Badge variant="warning">Beta / local</Badge>
        </span>
      }
      description="Show a separate Control D section for one-way regional DNS synchronization."
      focusControlOnTitleClick
      action={
        <Switch
          aria-label="Enable Control D integration"
          checked={state?.enabled ?? false}
          disabled={!state || busy}
          onCheckedChange={(enabled) => void toggle(enabled)}
        />
      }
    />
  );
};

const DiffSummary = ({ diff }: { diff: ControlDDiff }) => (
  <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
    {[
      ["Folders to create", diff.createFolders],
      ["Rules to add", diff.addRules],
      ["Rules to update", diff.updateRules],
      ["Unchanged rules", diff.unchangedRules],
    ].map(([label, value]) => (
      <div key={label}>
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="mt-0.5 font-medium text-foreground">{value}</dd>
      </div>
    ))}
  </dl>
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
    <SettingsSubcard
      title={
        <span className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold">Browser DNS</h3>
          <Badge variant="outline">Manual setup</Badge>
        </span>
      }
      description="Secure DNS remains a browser setting. Privacy Thing cannot change it automatically."
    >
      <div className="flex flex-wrap items-center gap-2">
        <code className="max-w-full truncate rounded-md bg-muted px-2.5 py-1.5 text-xs text-foreground">
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
          onClick={() => void openExternal("open-status", CONTROL_D_STATUS_URL)}
        >
          Check status
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => void openExternal("open-guide", CONTROL_D_GUIDE_URL)}
        >
          Instructions
        </Button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Disconnecting the integration does not revert your browser DNS setting.
      </p>
    </SettingsSubcard>
  );
};

// eslint-disable-next-line max-lines-per-function, sonarjs/cognitive-complexity -- The container coordinates the experimental control plane.
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
  const presentation = statusPresentation(state);
  const visibleError = notice ?? state?.lastError ?? null;
  const hasAppliedSync = Boolean(state?.lastSuccessAt);
  let syncModeLabel = "Manual";
  let syncDescription =
    "Preview and apply the first synchronization to activate automatic updates.";
  if (state?.autoSyncEnabled) {
    syncModeLabel = "Automatic";
    syncDescription = `Automatic sync is active · Last successful sync: ${formatTime(state.lastSuccessAt)}`;
  } else if (hasAppliedSync) {
    syncModeLabel = "Paused";
    syncDescription = `Automatic sync is paused · Last successful sync: ${formatTime(state?.lastSuccessAt ?? null)}`;
  }

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
      ? { ...shared, proxyPk, status: "approximate", confirmed: false }
      : { ...shared, proxyPk: null, status: "skipped", confirmed: true };
    const response = await run({
      type: CONTROL_D_COMMANDS.updateMapping,
      mapping: next,
    });
    if (response?.ok) await run({ type: CONTROL_D_COMMANDS.preview });
  };

  return (
    <SettingsSectionCard
      title={
        <span className="flex flex-wrap items-center gap-2">
          <h2 className="text-xl font-semibold">Control D</h2>
          <Badge variant="warning">Experimental</Badge>
        </span>
      }
      description="Publish compatible regional rules to an isolated Control D profile. Synchronization is one-way."
      headerActions={<Badge variant={presentation.variant}>{presentation.label}</Badge>}
      data-control-d-state={state?.status ?? "loading"}
    >
      {!state?.connected ? (
        <SettingsSubcard
          title={<h3 className="text-sm font-semibold">Connect your account</h3>}
          description="Use a write-enabled API key. It stays in local extension storage and is excluded from export and browser sync."
        >
          <div className="flex max-w-2xl flex-col gap-2 sm:flex-row">
            <Input
              type="password"
              autoComplete="off"
              value={apiKey}
              placeholder="Control D API key"
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
        </SettingsSubcard>
      ) : (
        <>
          <SettingsSubcard
            title={
              <span className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-semibold">Synchronization</h3>
                <Badge variant={state.autoSyncEnabled ? "success" : "outline"}>
                  {syncModeLabel}
                </Badge>
              </span>
            }
            description={syncDescription}
          >
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => void run({ type: CONTROL_D_COMMANDS.preview })}
              >
                Preview changes
              </Button>
              {state.autoSyncEnabled ? (
                <Button
                  type="button"
                  size="sm"
                  disabled={busy}
                  onClick={() => void run({ type: CONTROL_D_COMMANDS.syncNow })}
                >
                  Sync now
                </Button>
              ) : null}
              {state.status === "conflict" ? (
                <Button
                  type="button"
                  size="sm"
                  variant="destructive-outline"
                  disabled={busy}
                  onClick={() => void run({ type: CONTROL_D_COMMANDS.repair })}
                >
                  Repair managed rules
                </Button>
              ) : null}
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Last attempt: {formatTime(state.lastAttemptAt)}
            </p>
          </SettingsSubcard>

          {visibleError ? (
            <div
              role="status"
              className="rounded-lg border border-tone-error-border bg-tone-error-bg px-3 py-2 text-sm text-tone-error-text"
            >
              {visibleError}
            </div>
          ) : null}

          {diff ? (
            <SettingsSubcard
              title={<h3 className="text-sm font-semibold">Pending changes</h3>}
              description="This preview is read-only. Review all routes before applying."
            >
              <DiffSummary diff={diff} />
            </SettingsSubcard>
          ) : null}

          {diff?.mappings.length ? (
            <SettingsSubcard
              title={<h3 className="text-sm font-semibold">Regional routes</h3>}
              description="Each Privacy Thing location maps to one Control D exit."
            >
              <div className="rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Privacy Thing profile</TableHead>
                      <TableHead className="w-[55%]">Control D exit</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {diff.mappings.map((mapping) => (
                      <TableRow key={mapping.locationId}>
                        <TableCell>
                          <div className="font-medium">
                            {mapping.locationLabel ?? mapping.locationId}
                          </div>
                          <div className="mt-1 flex flex-wrap gap-1.5">
                            <Badge variant="secondary">
                              {ruleCountLabel(mapping.ruleCount ?? 0)}
                            </Badge>
                            <Badge variant={mappingBadgeVariant(mapping.status)}>
                              {mapping.status}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={mapping.proxyPk ?? "skip"}
                            onValueChange={(value) =>
                              void updateMapping(mapping, value === "skip" ? "" : value)
                            }
                          >
                            <SelectTrigger
                              aria-label={`Control D exit for ${mapping.locationLabel ?? mapping.locationId}`}
                            >
                              <SelectValue placeholder="Select an exit" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="skip">Skip this profile</SelectItem>
                              {proxies.map((proxy) => (
                                <SelectItem key={proxy.pk} value={proxy.pk}>
                                  {proxy.city}, {proxy.countryName} ({proxy.pk})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </SettingsSubcard>
          ) : null}

          {diff?.warnings.length ? (
            <SettingsSubcard
              title={
                <span className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-semibold">Review required</h3>
                  <Badge variant="warning">{diff.warnings.length}</Badge>
                </span>
              }
              description="Some rules or locations could not be mapped exactly."
            >
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                {diff.warnings.map((warning, index) => (
                  <li
                    key={`${warning.code}-${warning.pattern ?? warning.locationId ?? index}`}
                  >
                    • {warning.message}
                  </li>
                ))}
              </ul>
            </SettingsSubcard>
          ) : null}

          {diff && !state.autoSyncEnabled ? (
            <SettingsSubcard
              title={
                <h3 className="text-sm font-semibold">Apply first synchronization</h3>
              }
              description="The first write is always explicit. Later valid settings changes synchronize automatically."
            >
              {diff.requiresApproximationConfirmation ? (
                <label className="flex items-start gap-2 text-sm">
                  <Checkbox
                    checked={confirmApproximate}
                    onChange={(event) => setConfirmApproximate(event.target.checked)}
                  />
                  <span>
                    I accept every approximate cross-country mapping shown above.
                  </span>
                </label>
              ) : null}
              <Button
                className="mt-3"
                type="button"
                size="sm"
                disabled={
                  busy ||
                  (diff.requiresApproximationConfirmation && !confirmApproximate)
                }
                onClick={() =>
                  void run({ type: CONTROL_D_COMMANDS.apply, confirmApproximate })
                }
              >
                Apply synchronization
              </Button>
            </SettingsSubcard>
          ) : null}

          {state.resolverDoh ? <ResolverSetup resolver={state.resolverDoh} /> : null}

          <Separator />
          <SettingsSubcard
            title={<h3 className="text-sm font-semibold">Connection</h3>}
            description="Disconnecting forgets the API key and stops synchronization. Remote resources and browser DNS remain unchanged."
          >
            <div>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() => void run({ type: CONTROL_D_COMMANDS.disconnect })}
              >
                Disconnect
              </Button>
            </div>
          </SettingsSubcard>
        </>
      )}

      {!state?.connected && visibleError ? (
        <div
          role="status"
          className="rounded-lg border border-tone-error-border bg-tone-error-bg px-3 py-2 text-sm text-tone-error-text"
        >
          {visibleError}
        </div>
      ) : null}
    </SettingsSectionCard>
  );
};
