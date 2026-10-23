import type { GetXRayStateResponse } from "@privacy-brand/xray-protocol";
import { forwardRef, useEffect, useRef, useState } from "react";

import type { WorkerTestState } from "@/shared/worker-test";
import { Button } from "@/ui/components/ui/button";
import { t } from "@/ui/i18n";
import { useWorkerTroubleshooter } from "@/ui/shared/useWorkerTroubleshooter";
import {
  WorkerTroubleshooterView,
  type WorkerTestAction,
} from "@/ui/shared/WorkerTroubleshooterView";

const readTabId = () => {
  const value = Number(new URLSearchParams(window.location.search).get("tabId"));
  return Number.isInteger(value) && value >= 0 ? value : undefined;
};

// The launcher cannot know the content height up front, so the window grows or
// shrinks to its content. Only a dedicated popup window is resized: the page opened
// as an ordinary tab must never resize the user's browser window.
const useFitWindowToContent = (content: HTMLElement | null) => {
  useEffect(() => {
    if (!content) return;
    let windowId: number | undefined;
    let applied = 0;
    const fit = () => {
      if (windowId === undefined) return;
      const frame = Math.max(0, window.outerHeight - window.innerHeight);
      const height = Math.min(
        Math.ceil(content.getBoundingClientRect().height) + frame,
        window.screen.availHeight,
      );
      if (height <= frame || height === applied) return;
      applied = height;
      void chrome.windows.update(windowId, { height }).catch(() => undefined);
    };
    const observer = new ResizeObserver(fit);
    observer.observe(content);
    void chrome.windows
      .getCurrent()
      .then((current) => {
        if (current.type !== "popup") return;
        windowId = current.id;
        fit();
      })
      .catch(() => undefined);
    return () => observer.disconnect();
  }, [content]);
};

const closeWindow = async () => {
  const tab = await chrome.tabs.getCurrent();
  if (tab?.id !== undefined) await chrome.tabs.remove(tab.id);
};

type WindowViewProps = {
  data: WorkerTestState | null;
  xray: GetXRayStateResponse | null;
  pending: boolean;
  error: string | null;
  now: number;
  finished: boolean;
  onAction: (action: WorkerTestAction) => void;
  onClose: () => void;
};

export const WorkerTestWindowView = forwardRef<HTMLElement, WindowViewProps>(
  ({ data, xray, pending, error, now, finished, onAction, onClose }, ref) => (
    <main
      ref={ref}
      className="flex min-w-0 flex-col gap-3 bg-card p-4 text-card-foreground"
      data-worker-test-window
      data-worker-test-finished={finished ? "" : undefined}
    >
      <header>
        <h2 className="text-lg font-semibold">{t.sidebar.troubleshooter.title}</h2>
        <p className="text-sm text-muted-foreground">
          {t.sidebar.troubleshooter.intro}
        </p>
      </header>
      {error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
      {data ? (
        <WorkerTroubleshooterView
          data={data}
          xray={xray}
          pending={pending}
          onAction={onAction}
          now={now}
          finished={finished}
        />
      ) : null}
      {!data && !error ? <p role="status">{t.sidebar.loading}</p> : null}
      <footer className="flex justify-end">
        <Button
          size="sm"
          variant={finished ? "default" : "outline"}
          disabled={pending}
          data-worker-test-close
          onClick={onClose}
        >
          {t.common.actions.close}
        </Button>
      </footer>
    </main>
  ),
);
WorkerTestWindowView.displayName = "WorkerTestWindowView";

export const WorkerTestWindow = () => {
  const [tabId] = useState(readTabId);
  const { target, data, xray, pending, error, now, open, action, close } =
    useWorkerTroubleshooter(tabId);
  const [content, setContent] = useState<HTMLElement | null>(null);
  const [savedHere, setSavedHere] = useState(false);
  const opened = useRef(false);
  useEffect(() => {
    if (opened.current) return;
    opened.current = true;
    void open();
  }, [open]);
  useFitWindowToContent(content);
  // A decision saved from this window ends the flow; a saved session found on a
  // later reopen stays a plain result so other candidates remain testable.
  const finished = savedHere && data?.session?.phase === "saved";
  const onClose = async () => {
    // Restore an active test explicitly before closing; `pagehide` stays the
    // fallback for closing the window from the browser frame.
    if (target) await close();
    await closeWindow().catch(() => window.close());
  };
  return (
    <WorkerTestWindowView
      ref={setContent}
      data={data}
      xray={xray}
      pending={pending !== null}
      error={error}
      now={now}
      finished={finished}
      onAction={(value) => {
        if (value === "save") setSavedHere(true);
        void action(value);
      }}
      onClose={() => void onClose()}
    />
  );
};
