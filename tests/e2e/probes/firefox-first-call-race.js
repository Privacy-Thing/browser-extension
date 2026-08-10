/* global clearTimeout, document, navigator, setTimeout */

globalThis.collectFirefoxFirstCallRaceSnapshot = async () => {
  const race = globalThis.__firefoxFirstCallRace ?? {};

  await new Promise((resolve) => {
    const deadline = Date.now() + 1_500;

    const waitForQueuedCallbacks = () => {
      const firstCurrentSettled =
        race.firstCurrentPosition !== null || race.firstCurrentError !== null;
      const firstWatchSettled =
        race.firstWatchPosition !== null || race.firstWatchError !== null;

      if ((firstCurrentSettled && firstWatchSettled) || Date.now() >= deadline) {
        resolve(undefined);
        return;
      }

      setTimeout(waitForQueuedCallbacks, 25);
    };

    waitForQueuedCallbacks();
  });

  const snapshot = {
    permissionState: race.permissionState ?? null,
    runtimePresent: Boolean(globalThis.__PT_RUNTIME__),
    runtimeInstalled: Boolean(globalThis.__PT_RUNTIME_INSTALLED__),
    earlyRuntimeInstalled: Boolean(globalThis.__PT_RUNTIME_EARLY_INSTALLED__),
    firstCurrentPosition: race.firstCurrentPosition ?? null,
    firstCurrentError: race.firstCurrentError ?? null,
    firstWatchPosition: race.firstWatchPosition ?? null,
    firstWatchError: race.firstWatchError ?? null,
  };

  try {
    snapshot.laterCurrentPosition = await new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error("Timed out waiting for later geolocation"));
      }, 1_500);

      navigator.geolocation.getCurrentPosition(
        (position) => {
          clearTimeout(timeoutId);
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            timestamp: position.timestamp,
          });
        },
        (error) => {
          clearTimeout(timeoutId);
          reject(new Error(error.message));
        },
      );
    });
  } catch (error) {
    snapshot.laterCurrentError = error instanceof Error ? error.message : String(error);
  }

  document.querySelector("#snapshot").textContent = JSON.stringify(snapshot);
  return snapshot;
};
