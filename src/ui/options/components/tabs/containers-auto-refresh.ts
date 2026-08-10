type AutoRefreshDocument = Pick<
  Document,
  "visibilityState" | "addEventListener" | "removeEventListener"
>;
type AutoRefreshTimerApi = {
  setInterval: (
    callback: () => void,
    intervalMs: number,
  ) => ReturnType<typeof globalThis.setInterval>;
  clearInterval: (intervalId: ReturnType<typeof globalThis.setInterval>) => void;
};

type AutoRefreshOptions = {
  documentRef?: AutoRefreshDocument;
  timerApi?: AutoRefreshTimerApi;
  intervalMs?: number;
  onRefresh: () => void;
};

const DEFAULT_INTERVAL_MS = 10_000;

export const setupAutoRefresh = ({
  documentRef = document,
  timerApi = globalThis,
  intervalMs = DEFAULT_INTERVAL_MS,
  onRefresh,
}: AutoRefreshOptions): (() => void) => {
  const refreshWhenVisible = () => {
    if (documentRef.visibilityState === "visible") {
      onRefresh();
    }
  };

  documentRef.addEventListener("visibilitychange", refreshWhenVisible);

  const intervalId = timerApi.setInterval(() => {
    if (documentRef.visibilityState === "visible") {
      onRefresh();
    }
  }, intervalMs);

  return () => {
    documentRef.removeEventListener("visibilitychange", refreshWhenVisible);
    timerApi.clearInterval(intervalId);
  };
};
