import { cn } from "@/ui/components/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogCloseButton,
  useDialogLayout,
} from "@/ui/components/ui/dialog";
import { t } from "@/ui/i18n";
import { useWorkerTroubleshooter } from "@/ui/shared/useWorkerTroubleshooter";
import { WORKER_TEST_WINDOW_PATH } from "@/ui/shared/worker-test-window";
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
  const fill = useDialogLayout() === "fill";
  const show = async () => {
    if (!launchInWindow) return open();
    try {
      const tab =
        tabId === undefined
          ? (await chrome.tabs.query({ active: true, currentWindow: true }))[0]
          : await chrome.tabs.get(tabId);
      if (tab?.id === undefined || !tab.url || !/^https?:/.test(tab.url))
        throw new Error("unsupported");
      await chrome.windows.create({
        url: chrome.runtime.getURL(`${WORKER_TEST_WINDOW_PATH}?tabId=${tab.id}`),
        type: "popup",
        width: 560,
        // Initial estimate only; the window view fits its height to the content.
        height: 640,
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
          className={cn(
            "max-h-[92vh] max-w-lg min-w-0 p-4",
            fill ? "grid-rows-[auto_minmax(0,1fr)]" : "overflow-y-auto",
          )}
          data-worker-troubleshooter
        >
          <DialogCloseButton label={t.common.actions.close} />
          <DialogHeader>
            <DialogTitle>{t.sidebar.troubleshooter.title}</DialogTitle>
            <DialogDescription>{t.sidebar.troubleshooter.intro}</DialogDescription>
          </DialogHeader>
          {/* A dialog that fills the panel keeps its header in view and scrolls the body. */}
          <div className={cn("grid min-w-0 gap-4", fill && "min-h-0 overflow-y-auto")}>
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
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
