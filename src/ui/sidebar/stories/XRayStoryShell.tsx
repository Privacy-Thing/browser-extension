import type { GetXRayStateResponse } from "@privacy-brand/xray-protocol";
import { useState } from "react";

import type { InspectorApi } from "../modules/xray/inspector/inspector-api";
import { XRayModule } from "../modules/xray/XRayModule";

import type { SpoofingBrowserTarget } from "@/shared/spoofing-surfaces";
import { Button } from "@/ui/components/ui/button";
import { t } from "@/ui/i18n";
import { MadeWithLoveBadge } from "@/ui/shared/MadeWithLoveBadge";

const SHELL_WIDTHS = {
  360: "w-[360px]",
  400: "w-[400px]",
  720: "w-[720px]",
} as const;

export const XRayStoryShell = ({
  state,
  loading = false,
  surfaceSyncPending = false,
  width = 360,
  inspectorApi,
  browserTarget,
}: {
  state: GetXRayStateResponse | null;
  loading?: boolean;
  surfaceSyncPending?: boolean;
  /** Popup (360), sidebar (400) or sidecar (720) width in pixels. */
  width?: keyof typeof SHELL_WIDTHS;
  inspectorApi?: InspectorApi;
  browserTarget?: SpoofingBrowserTarget;
}) => {
  const [lastAction, setLastAction] = useState<string | null>(null);
  const hostname = state?.ok ? state.hostname : null;
  const rulePattern = state?.ok ? state.rulePattern : null;
  const locationId = state?.ok ? state.locationId : null;
  const reportAction = (action: string) => setLastAction(action);

  return (
    <div
      className={`relative flex min-h-[720px] ${SHELL_WIDTHS[width]} flex-col overflow-hidden rounded-[calc(var(--radius)+8px)] border border-border/70 bg-background text-foreground shadow-2xl shadow-foreground/10`}
    >
      <header className="flex items-center justify-between gap-2 border-b border-border/60 px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-2 overflow-hidden">
          <span className="truncate text-sm font-medium text-foreground/80">
            {t.sidebar.xRayTitle}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => reportAction(t.sidebar.openLogs)}
            title={t.sidebar.openLogs}
          >
            <i className="fa-solid fa-wave-square text-xs" aria-hidden="true" />
            <span className="sr-only">{t.sidebar.openLogs}</span>
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => reportAction(t.sidebar.openSettings)}
            title={t.sidebar.openSettings}
          >
            <i className="fa-solid fa-gear text-xs" aria-hidden="true" />
            <span className="sr-only">{t.sidebar.openSettings}</span>
          </Button>
        </div>
      </header>

      {hostname ? (
        <div className="flex min-w-0 items-center gap-1 border-b border-border/40 px-4 py-2">
          <p
            className="min-w-0 flex-1 truncate text-center font-mono text-sm font-semibold"
            title={hostname}
          >
            {hostname}
          </p>
          {rulePattern || hostname ? (
            <Button
              variant="ghost"
              size="icon-sm"
              className="h-6 w-6 shrink-0"
              onClick={() => reportAction(t.sidebar.openRule)}
              title={t.sidebar.openRule}
            >
              <i
                className="fa-solid fa-arrow-up-right-from-square text-[9px]"
                aria-hidden="true"
              />
              <span className="sr-only">{t.sidebar.openRule}</span>
            </Button>
          ) : null}
        </div>
      ) : null}

      <main className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-4 py-4">
        <XRayModule
          tabId={inspectorApi ? 1 : undefined}
          xRayState={state}
          xRayLoading={loading}
          xRaySurfaceSyncPending={surfaceSyncPending}
          refreshXRayState={() => undefined}
          locationId={locationId}
          onOpenLocation={(id) => reportAction(`${t.sidebar.openLocation}: ${id}`)}
          {...(inspectorApi ? { xRayInspectorApi: inspectorApi } : {})}
          {...(browserTarget ? { browserTarget } : {})}
        />
      </main>

      {lastAction ? (
        <div
          className="absolute inset-x-3 bottom-12 flex items-center justify-between gap-3 rounded-lg border border-primary/30 bg-background/95 px-3 py-2 text-xs shadow-lg backdrop-blur"
          role="status"
        >
          <span className="min-w-0 truncate">{lastAction}</span>
          <Button
            variant="ghost"
            size="icon-sm"
            className="h-6 w-6 shrink-0"
            onClick={() => setLastAction(null)}
            title="Dismiss"
          >
            <i className="fa-solid fa-xmark text-[10px]" aria-hidden="true" />
            <span className="sr-only">Dismiss</span>
          </Button>
        </div>
      ) : null}

      <footer className="flex shrink-0 justify-center px-4 py-3 opacity-60">
        <MadeWithLoveBadge />
      </footer>
    </div>
  );
};
