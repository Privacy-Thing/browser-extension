import { useEffect, useRef } from "react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogCloseButton,
} from "@/ui/components/ui/dialog";
import { t } from "@/ui/i18n";
import { useWorkerTroubleshooter } from "@/ui/shared/useWorkerTroubleshooter";
import { WorkerTroubleshooterView } from "@/ui/shared/WorkerTroubleshooterView";

export const WorkerTroubleshooter = ({
  tabId,
  entryClassName,
  launchInWindow,
}: {
  tabId?: number | undefined;
  entryClassName?: string;
  launchInWindow?: boolean;
}) => {
  const { target, data, xray, pending, error, now, open, action, close, setError } =
    useWorkerTroubleshooter(tabId);
  const persistent = new URLSearchParams(window.location.search).has("workerTest");
  const opened = useRef(false);
  useEffect(() => {
    if (!persistent || opened.current) return;
    opened.current = true;
    void open();
  }, [persistent, open]);
  const show = async () => {
    if (!launchInWindow || persistent) return open();
    try {
      const tab =
        tabId === undefined
          ? (await chrome.tabs.query({ active: true, currentWindow: true }))[0]
          : await chrome.tabs.get(tabId);
      if (tab?.id === undefined || !tab.url || !/^https?:/.test(tab.url))
        throw new Error("unsupported");
      await chrome.windows.create({
        url: chrome.runtime.getURL(
          `src/ui/popup/index.html?tabId=${tab.id}&workerTest=1`,
        ),
        type: "popup",
        width: 560,
        height: 760,
      });
    } catch {
      setError(t.sidebar.troubleshooter.error);
    }
  };
  return (
    <>
      <button
        type="button"
        data-worker-test-open
        className={
          entryClassName ??
          "mb-3 w-full rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
        }
        onClick={() => void show()}
        disabled={pending !== null}
      >
        {t.sidebar.troubleshooter.title}
      </button>
      {!target && error ? (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
      <Dialog
        open={target !== null}
        onOpenChange={(next) => {
          if (!next) void close();
        }}
      >
        <DialogContent
          className="max-h-[92vh] w-[calc(100%-1.5rem)] max-w-lg min-w-0 overflow-y-auto p-4"
          data-worker-troubleshooter
        >
          <DialogCloseButton label={t.common.actions.close} />
          <DialogHeader className="pr-7">
            <DialogTitle>{t.sidebar.troubleshooter.title}</DialogTitle>
            <DialogDescription>{t.sidebar.troubleshooter.intro}</DialogDescription>
          </DialogHeader>
          {error ? (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          ) : null}
          {data ? (
            <WorkerTroubleshooterView
              data={data}
              xray={xray}
              pending={pending !== null}
              onAction={(value) => void action(value)}
              now={now}
            />
          ) : (
            <p role="status">{t.sidebar.loading}</p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};
