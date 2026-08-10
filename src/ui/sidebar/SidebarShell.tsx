import { useEffect, useState } from "react";

import { SIDEBAR_MODULES } from "./modules/registry";
import { useXRayState } from "./useXRayState";

import { Button } from "@/ui/components/ui/button";
import { t } from "@/ui/i18n";
import {
  getFallbackModalAnchor,
  getLogsPageUrl,
  getRuleModalAnchor,
} from "@/ui/options/navigation";
import { MadeWithLoveBadge } from "@/ui/shared/MadeWithLoveBadge";

// ─── Hooks ─────────────────────────────────────────────────────────────────────

const useActiveTabId = (): number | undefined => {
  const [tabId, setTabId] = useState<number | undefined>(undefined);

  useEffect(() => {
    const query = () => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (chrome.runtime.lastError) return;
        setTabId(tabs[0]?.id);
      });
    };

    query();

    const onActivated = () => {
      query();
    };
    const onFocusChanged = () => {
      query();
    };

    chrome.tabs.onActivated.addListener(onActivated);
    chrome.windows.onFocusChanged.addListener(onFocusChanged);

    return () => {
      chrome.tabs.onActivated.removeListener(onActivated);
      chrome.windows.onFocusChanged.removeListener(onFocusChanged);
    };
  }, []);

  return tabId;
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

const openOptionsAnchor = async (anchorId: string): Promise<void> => {
  await chrome.tabs.create({
    url: chrome.runtime.getURL(`src/ui/options/index.html#${anchorId}`),
  });
};

const openLogsPage = async (hostFilter?: string | null): Promise<void> => {
  await chrome.tabs.create({
    url: chrome.runtime.getURL(getLogsPageUrl(hostFilter ?? undefined)),
  });
};

// ─── Shell ─────────────────────────────────────────────────────────────────────

export const SidebarShell = () => {
  const tabId = useActiveTabId();
  const { state, loading, refresh, surfaceSyncPending } = useXRayState(tabId);

  const rulePattern = state?.ok ? (state.rulePattern ?? null) : null;
  const hostname = state?.ok ? (state.hostname ?? null) : null;
  const locationId = state?.ok ? (state.locationId ?? null) : null;

  const handleOpenDomainRule = () => {
    if (rulePattern) {
      void openOptionsAnchor(getRuleModalAnchor(rulePattern));
    } else if (hostname) {
      void openOptionsAnchor(getFallbackModalAnchor());
    }
  };

  const activeModule = SIDEBAR_MODULES[0];

  if (!activeModule) return null;

  const { Component } = activeModule;

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground overflow-x-hidden">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between gap-2 px-3 py-2.5 border-b border-border/60 shrink-0 min-w-0">
        <div className="flex items-center gap-2 min-w-0 overflow-hidden">
          <span className="text-sm font-medium text-foreground/80 select-none truncate">
            {activeModule.title}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => void openLogsPage(hostname)}
            title={t.sidebar.openLogs}
          >
            <i className="fa-solid fa-wave-square text-xs" aria-hidden="true" />
            <span className="sr-only">{t.sidebar.openLogs}</span>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => chrome.runtime.openOptionsPage()}
            title={t.sidebar.openSettings}
          >
            <i className="fa-solid fa-gear text-xs" aria-hidden="true" />
            <span className="sr-only">{t.sidebar.openSettings}</span>
          </Button>
        </div>
      </header>

      {/* ── Domain subheader ──────────────────────────────────────────────── */}
      {hostname && (
        <div className="flex items-center gap-1 px-4 py-2 border-b border-border/40 shrink-0 min-w-0">
          <p
            className="flex-1 text-sm font-semibold font-mono text-center truncate min-w-0"
            title={hostname}
          >
            {hostname}
          </p>
          {(rulePattern !== null || hostname !== null) && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0"
              onClick={handleOpenDomainRule}
              title={t.sidebar.openRule}
            >
              <i
                className="fa-solid fa-arrow-up-right-from-square text-[9px]"
                aria-hidden="true"
              />
              <span className="sr-only">{t.sidebar.openRule}</span>
            </Button>
          )}
        </div>
      )}

      {/* ── Content ───────────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-4 min-w-0">
        <Component
          tabId={tabId}
          xRayState={state}
          xRayLoading={loading}
          xRaySurfaceSyncPending={surfaceSyncPending}
          refreshXRayState={refresh}
          locationId={locationId}
        />
      </main>

      <footer className="shrink-0 flex justify-center px-4 py-3 opacity-60 pointer-events-none">
        <MadeWithLoveBadge />
      </footer>
    </div>
  );
};
