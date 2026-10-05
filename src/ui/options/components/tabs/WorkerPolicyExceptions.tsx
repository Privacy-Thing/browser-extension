import { useEffect, useState } from "react";

import {
  EXTENSION_COMMAND_TYPES,
  EXTENSION_STORAGE_KEYS,
} from "@/shared/extension-contract";
import { DEFAULT_PREFERENCES, normalizePreferences } from "@/shared/settings-defaults";
import type { GetSettingsResponse, SaveSettingsResponse } from "@/shared/types";
import { Button } from "@/ui/components/ui/button";
import { t } from "@/ui/i18n";
import { sendMessageOrThrow } from "@/ui/shared/runtime-messaging";
export const WorkerPolicyExceptions = () => {
  const [exceptions, setExceptions] = useState(
    DEFAULT_PREFERENCES.workerPolicyExceptions,
  );
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (typeof chrome === "undefined" || !chrome.storage?.onChanged) return;
    let mounted = true;
    const load = async () => {
      try {
        const settings = await sendMessageOrThrow<GetSettingsResponse>({
          type: EXTENSION_COMMAND_TYPES.getSettings,
        });
        if (mounted)
          setExceptions(normalizePreferences(settings).workerPolicyExceptions);
      } catch {
        if (mounted) setError(t.sidebar.troubleshooter.error);
      }
    };
    void load();
    const changed: Parameters<typeof chrome.storage.onChanged.addListener>[0] = (
      changes,
    ) => {
      if (EXTENSION_STORAGE_KEYS.preferences in changes) void load();
    };
    chrome.storage.onChanged.addListener(changed);
    return () => {
      mounted = false;
      chrome.storage.onChanged.removeListener(changed);
    };
  }, []);
  const remove = async (host: string) => {
    setPending(host);
    setError(null);
    try {
      const result = await sendMessageOrThrow<SaveSettingsResponse>({
        type: EXTENSION_COMMAND_TYPES.saveSimpleSettings,
        removeWorkerPolicyException: host,
      });
      if (!result.ok) throw new Error("save-failed");
    } catch {
      setError(t.sidebar.troubleshooter.error);
    } finally {
      setPending(null);
    }
  };
  if (Object.keys(exceptions).length === 0 && !error) return null;
  return (
    <section
      data-worker-policy-exceptions
      className="rounded-md border border-border p-4"
    >
      <h3 className="font-semibold">{t.sidebar.troubleshooter.savedExceptions}</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        {t.sidebar.troubleshooter.savedHint}
      </p>
      {error ? <p role="alert">{error}</p> : null}
      {Object.entries(exceptions).map(([host, policy]) => (
        <div
          key={host}
          data-worker-policy-host={host}
          className="mt-3 flex flex-wrap items-center justify-between gap-2"
        >
          <div className="min-w-0">
            <p className="font-mono text-sm break-all">{host}</p>
            <p className="text-xs text-muted-foreground">
              {[
                policy.serviceWorker === false
                  ? t.sidebar.troubleshooter.kinds.serviceWorker
                  : null,
                policy.sharedWorker === "native"
                  ? t.sidebar.troubleshooter.kinds.sharedWorker
                  : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            disabled={pending !== null}
            data-worker-policy-remove
            onClick={() => void remove(host)}
          >
            {t.common.actions.delete}
          </Button>
        </div>
      ))}
    </section>
  );
};
