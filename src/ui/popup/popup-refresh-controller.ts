export type PopupRefreshContext = {
  shouldApply: () => boolean;
};

export type PopupRefreshController = {
  refresh: () => Promise<void>;
};

export const createRefreshController = (
  runRefresh: (context: PopupRefreshContext) => Promise<void>,
): PopupRefreshController => {
  let inFlight = false;
  let queued = false;
  let generation = 0;

  const refresh = async (): Promise<void> => {
    if (inFlight) {
      queued = true;
      return;
    }

    inFlight = true;
    const refreshGeneration = generation + 1;
    generation = refreshGeneration;

    try {
      await runRefresh({
        shouldApply: () => refreshGeneration === generation && !queued,
      });
    } finally {
      inFlight = false;
      if (queued) {
        queued = false;
        await refresh();
      }
    }
  };

  return {
    refresh,
  };
};
