export const createControlDSyncQueue = <T>() => {
  let active: Promise<unknown> | null = null;

  const run = async <R = T>(operation: () => Promise<R>): Promise<R> => {
    while (active) {
      try {
        await active;
      } catch {
        // A failed operation still releases the queue for the newest snapshot.
      }
    }

    const current = operation();
    active = current;
    try {
      return await current;
    } finally {
      if (active === current) active = null;
    }
  };

  return {
    run,
    isBusy: () => active !== null,
  };
};
