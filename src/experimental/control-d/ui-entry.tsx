import React, { useCallback, useEffect, useMemo, useState } from "react";

import {
  CONTROL_D_API_ORIGIN,
  CONTROL_D_COMMANDS,
  CONTROL_D_GUIDE_URL,
  CONTROL_D_STATUS_URL,
  type ControlDDiff,
  type ControlDMapping,
  type ControlDPreparedSnapshot,
  type ControlDPublicState,
} from "./contracts";
import { ControlDRegionalRoute } from "./ui-regional-route";

import { SettingsControlCard } from "@/ui/components/SettingsControlCard";
import { Button } from "@/ui/components/ui/button";
import { Card, CardContent } from "@/ui/components/ui/card";
import { Checkbox } from "@/ui/components/ui/checkbox";
import { Input } from "@/ui/components/ui/input";
import { Separator } from "@/ui/components/ui/separator";
import { Switch } from "@/ui/components/ui/switch";

type UiResponse =
  | {
      ok: true;
      state: ControlDPublicState;
      snapshot?: ControlDPreparedSnapshot;
    }
  | { ok: false; error: string; state?: ControlDPublicState };

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

const formatTime = (value: string | null): string =>
  value ? new Date(value).toLocaleString() : "Not yet";

const statusLabel = (state: ControlDPublicState | null): string => {
  if (!state) return "Loading";
  const states: Record<ControlDPublicState["status"], string> = {
    disconnected: "Not connected",
    ready: "Connected",
    syncing: "Synchronizing",
    conflict: "Needs attention",
    "auth-error": "Authorization failed",
    error: "Sync error",
  };
  return states[state.status];
};

const previewSummary = (diff: ControlDDiff): string => {
  const changedRuleCount = diff.addRules + diff.updateRules + diff.deleteRules;
  if (changedRuleCount === 0 && !diff.createProfile && !diff.createEndpoint) {
    return "Control D is up to date.";
  }
  return "Changes are ready to synchronize.";
};

const settingTitle = (text: string) => (
  <h3 className="text-sm font-semibold">{text}</h3>
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
    <SettingsControlCard
      title={settingTitle("Control D integration")}
      description="Enable the separate Control D section for one-way regional DNS synchronization. Available in beta and local builds."
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
    <SettingsControlCard
      title={settingTitle("Browser DNS")}
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
    </SettingsControlCard>
  );
};

// eslint-disable-next-line max-lines-per-function, sonarjs/cognitive-complexity -- The container coordinates the experimental control plane.
export const ControlDPanel = () => {
  const [state, setState] = useState<ControlDPublicState | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [snapshot, setSnapshot] = useState<ControlDPreparedSnapshot | null>(null);
  const [confirmApproximate, setConfirmApproximate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [editingLocationId, setEditingLocationId] = useState<string | null>(null);
  const [showRouteOverrides, setShowRouteOverrides] = useState(false);

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
      return response;
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Control D request failed.");
      return null;
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      const response = await run({ type: CONTROL_D_COMMANDS.getState });
      if (response?.ok && response.state.connected && !response.state.autoSyncEnabled) {
        await run({ type: CONTROL_D_COMMANDS.preview });
      }
    })();
  }, [run]);

  const proxies = snapshot?.proxies ?? EMPTY_PROXIES;
  const proxyByPk = useMemo(
    () => new Map(proxies.map((proxy) => [proxy.pk, proxy])),
    [proxies],
  );
  const presentation = statusLabel(state);
  const visibleError = notice ?? state?.lastError ?? null;
  const hasAppliedSync = Boolean(state?.lastSuccessAt);
  let syncDescription =
    "The first write is explicit. Later rule and location changes synchronize automatically after they are saved.";
  if (state?.autoSyncEnabled) {
    syncDescription = `Rule and location changes synchronize automatically after saving. Last successful sync: ${formatTime(state.lastSuccessAt)}.`;
  } else if (hasAppliedSync) {
    syncDescription = `Automatic sync is paused · Last successful sync: ${formatTime(state?.lastSuccessAt ?? null)}`;
  }

  const diff = snapshot?.diff ?? null;
  const blockingWarnings =
    diff?.warnings.filter(
      (warning) =>
        warning.code === "unsupported-pattern" || warning.code === "missing-location",
    ) ?? [];
  const previewDescription = diff ? previewSummary(diff) : null;
  const approximateMappings =
    diff?.mappings.filter((mapping) => mapping.status === "approximate") ?? [];
  const visibleMappings = showRouteOverrides
    ? (diff?.mappings ?? [])
    : approximateMappings;
  const showMappingControls =
    visibleMappings.length > 0 &&
    (showRouteOverrides || Boolean(diff?.requiresApproximationConfirmation));

  const connect = async () => {
    if (!(await requestApiAccess())) {
      setNotice("Access to the Control D API was not granted.");
      return;
    }
    const response = await run({ type: CONTROL_D_COMMANDS.connect, apiKey });
    if (response?.ok) {
      setApiKey("");
      setNotice("API key verified. It is stored only on this device.");
      await run({ type: CONTROL_D_COMMANDS.preview });
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
    if (response?.ok) {
      setEditingLocationId(null);
      await run({ type: CONTROL_D_COMMANDS.preview });
    }
  };

  const revealRouteOverrides = () => {
    setEditingLocationId(null);
    if (showRouteOverrides) {
      setShowRouteOverrides(false);
      return;
    }
    void (async () => {
      if (!snapshot) await run({ type: CONTROL_D_COMMANDS.preview });
      setShowRouteOverrides(true);
    })();
  };

  let syncAction: React.ReactNode;
  if (state?.status === "conflict") {
    syncAction = (
      <Button
        type="button"
        size="sm"
        variant="destructive-outline"
        disabled={busy}
        onClick={() => void run({ type: CONTROL_D_COMMANDS.repair })}
      >
        Repair managed rules
      </Button>
    );
  } else if (state?.autoSyncEnabled) {
    syncAction = (
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={busy}
        onClick={() => void run({ type: CONTROL_D_COMMANDS.syncNow })}
      >
        Sync now
      </Button>
    );
  }

  return (
    <Card data-control-d-state={state?.status ?? "loading"}>
      <CardContent className="flex flex-col gap-6 pt-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-semibold">Control D</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Publish compatible regional rules to an isolated Control D profile.
              Synchronization is one-way.
            </p>
          </div>
          <p className="text-sm text-muted-foreground" role="status">
            {presentation}
          </p>
        </div>
        {!state?.connected ? (
          <SettingsControlCard
            title={settingTitle("Connect your account")}
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
          </SettingsControlCard>
        ) : (
          <>
            <SettingsControlCard
              title={settingTitle("Synchronization")}
              description={syncDescription}
              action={syncAction}
            >
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={revealRouteOverrides}
                >
                  {showRouteOverrides
                    ? "Hide route overrides"
                    : "Manage route overrides"}
                </Button>
              </div>
              {previewDescription ? (
                <p className="mt-2 text-sm text-foreground">{previewDescription}</p>
              ) : null}
              {blockingWarnings.length > 0 ? (
                <ul className="mt-2 space-y-1 text-xs text-tone-error-text">
                  {blockingWarnings.map((warning, index) => (
                    <li
                      key={`${warning.code}-${warning.pattern ?? warning.locationId ?? index}`}
                    >
                      {warning.message}
                    </li>
                  ))}
                </ul>
              ) : null}
              {diff && !state.autoSyncEnabled ? (
                <div className="mt-4 border-t pt-4">
                  {diff.requiresApproximationConfirmation ? (
                    <label className="flex items-start gap-2 text-sm text-foreground">
                      <Checkbox
                        checked={confirmApproximate}
                        onChange={(event) =>
                          setConfirmApproximate(event.target.checked)
                        }
                      />
                      <span>I accept the cross-country fallback shown below.</span>
                    </label>
                  ) : null}
                  <Button
                    className={
                      diff.requiresApproximationConfirmation ? "mt-3" : undefined
                    }
                    type="button"
                    size="sm"
                    disabled={
                      busy ||
                      blockingWarnings.length > 0 ||
                      (diff.requiresApproximationConfirmation && !confirmApproximate)
                    }
                    onClick={() =>
                      void run({ type: CONTROL_D_COMMANDS.apply, confirmApproximate })
                    }
                  >
                    Apply synchronization
                  </Button>
                </div>
              ) : null}
            </SettingsControlCard>

            {visibleError ? (
              <div
                role="status"
                className="rounded-lg border border-tone-error-border bg-tone-error-bg px-3 py-2 text-sm text-tone-error-text"
              >
                {visibleError}
              </div>
            ) : null}

            {showMappingControls ? (
              <SettingsControlCard
                title={settingTitle(
                  showRouteOverrides ? "Route overrides" : "Cross-country fallback",
                )}
                description={
                  showRouteOverrides
                    ? "Automatic choices are shown for reference. Change only the routes you want to override."
                    : "Control D has no exit in the selected country. Confirm the nearest available alternative before the first synchronization."
                }
              >
                <div className="divide-y rounded-lg border">
                  {visibleMappings.map((mapping) => {
                    const selectedProxy = mapping.proxyPk
                      ? proxyByPk.get(mapping.proxyPk)
                      : undefined;
                    const isEditing = editingLocationId === mapping.locationId;
                    return (
                      <ControlDRegionalRoute
                        key={mapping.locationId}
                        busy={busy}
                        editing={isEditing}
                        mapping={mapping}
                        proxies={proxies}
                        proxy={selectedProxy}
                        onEditingChange={(editing) =>
                          setEditingLocationId(editing ? mapping.locationId : null)
                        }
                        onMappingChange={(nextMapping, proxyPk) =>
                          void updateMapping(nextMapping, proxyPk)
                        }
                      />
                    );
                  })}
                </div>
              </SettingsControlCard>
            ) : null}

            {state.resolverDoh ? <ResolverSetup resolver={state.resolverDoh} /> : null}

            <Separator />
            <SettingsControlCard
              title={settingTitle("Connection")}
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
            </SettingsControlCard>
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
      </CardContent>
    </Card>
  );
};
