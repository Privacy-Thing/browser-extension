export const createControlDSyncQueue = <T>() => {
  let active: Promise<T> | null = null;

  const run = async (operation: () => Promise<T>): Promise<T> => {
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
