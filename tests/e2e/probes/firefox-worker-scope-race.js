/* global BroadcastChannel, SharedWorker, Worker, document, navigator, setTimeout */

(async () => {
  const snapshotNode = document.getElementById("snapshot");
  const sampleDate = new Date(Date.UTC(2026, 0, 15, 12, 0, 0));
  const serviceChannelName = `pt-worker-scope-${Math.random().toString(36).slice(2)}`;

  const collectScope = () => ({
    language: navigator.language,
    languages: Array.from(navigator.languages ?? []),
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    timezoneOffset: sampleDate.getTimezoneOffset(),
  });

  const writeSnapshot = (payload) => {
    globalThis.__firefoxWorkerScopeRace = payload;
    if (snapshotNode) {
      snapshotNode.textContent = JSON.stringify(payload);
    }
  };

  const withTimeout = (promise, timeoutMs = 5000) =>
    Promise.race([
      promise,
      new Promise((resolve) => {
        setTimeout(() => resolve({ status: "timeout" }), timeoutMs);
      }),
    ]);

  const readDedicatedWorker = () =>
    withTimeout(
      new Promise((resolve) => {
        let worker;
        try {
          worker = new Worker("/worker-scope-race-dedicated.js");
        } catch (error) {
          resolve({
            status: "error",
            name: error instanceof Error ? error.name : "Error",
            message: error instanceof Error ? error.message : String(error),
          });
          return;
        }

        worker.addEventListener(
          "message",
          (event) => {
            worker.terminate();
            resolve({ status: "ok", scope: event.data });
          },
          { once: true },
        );
        worker.addEventListener(
          "error",
          (event) => {
            worker.terminate();
            resolve({
              status: "error",
              name: "WorkerError",
              message: event.message || "Worker bootstrap failed",
            });
          },
          { once: true },
        );
      }),
    );

  const readSharedWorker = () =>
    withTimeout(
      new Promise((resolve) => {
        let worker;
        try {
          worker = new SharedWorker("/worker-scope-race-shared.js");
        } catch (error) {
          resolve({
            status: "error",
            name: error instanceof Error ? error.name : "Error",
            message: error instanceof Error ? error.message : String(error),
          });
          return;
        }

        worker.port.addEventListener(
          "message",
          (event) => {
            worker.port.close();
            resolve({ status: "ok", scope: event.data });
          },
          { once: true },
        );
        worker.port.start();
      }),
    );

  const readServiceWorker = async () => {
    if (!("serviceWorker" in navigator) || typeof BroadcastChannel === "undefined") {
      return { status: "unsupported" };
    }

    let registration = null;
    const channel = new BroadcastChannel(serviceChannelName);

    try {
      registration = await navigator.serviceWorker.register(
        "/worker-scope-race-service.js",
        {
          scope: "/",
        },
      );
      const readyRegistration = await navigator.serviceWorker.ready;
      const activeWorker =
        readyRegistration.active ||
        registration.active ||
        registration.waiting ||
        registration.installing;
      if (!activeWorker) {
        return {
          status: "error",
          name: "NoActiveServiceWorker",
          message: "Service worker became ready without an active worker.",
        };
      }

      const scope = await withTimeout(
        new Promise((resolve) => {
          channel.addEventListener(
            "message",
            (event) => {
              resolve(event.data);
            },
            { once: true },
          );
          activeWorker.postMessage({
            type: "collect",
            channel: serviceChannelName,
          });
        }),
      );

      if (scope && typeof scope === "object" && "status" in scope) {
        return scope;
      }

      return { status: "ok", scope };
    } catch (error) {
      return {
        status: "error",
        name: error instanceof Error ? error.name : "Error",
        message: error instanceof Error ? error.message : String(error),
      };
    } finally {
      channel.close();
      await registration?.unregister().catch(() => {});
    }
  };

  writeSnapshot({
    window: collectScope(),
    dedicated: { status: "pending" },
    shared: { status: "pending" },
    service: { status: "pending" },
  });

  const [dedicated, shared, service] = await Promise.all([
    readDedicatedWorker(),
    readSharedWorker(),
    readServiceWorker(),
  ]);

  writeSnapshot({
    window: collectScope(),
    dedicated,
    shared,
    service,
  });
})();
