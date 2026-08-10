import { resolveChromiumSnapshot } from "@privacy-brand/refract-browser/chromium";
import { readRuntimeConfigElement } from "@privacy-brand/refract-browser/common/runtime-config";

import type { TargetBootstrapContext } from "@/content/bootstrap-common";
import {
  type ChromiumFallbackResult,
  type BootstrapSnapshotChannel,
  reportBootstrapChannel,
  resolveChromiumFallback,
} from "@/content/bootstrap-resolver";
import { clearRuntimeConfig, injectRuntimeConfig } from "@/content/sync-config";
import { fireAndForget } from "@/shared/async";

export const runTargetBootstrap = ({
  setCurrentAuthKey,
  registerLogListener,
  registerWorkerCsp,
}: TargetBootstrapContext): void => {
  // Chromium bootstrap: adapter-based resolution.
  //
  // Priority (content/isolated-world path):
  //   1. DOM Handoff  - script[type="application/json"] element (sync)
  //   2. Runtime msg  - session storage preload -> background message (async, bounded)
  //
  // Hash transport (window.name seed) is intentionally omitted here.
  // The MAIN world early script (main-world-early.js) owns that channel.
  // Reading window.name from the isolated world would consume it before the
  // MAIN world script can, leaving main-world-early.js with nothing to install.
  //
  // cleanupDomHandoff is a no-op here: the element stays for the MAIN world
  // runtime to consume. Cleanup is the MAIN world's responsibility (spec 1.7).
  fireAndForget(
    (() => {
      let backgroundFallbackResult: ChromiumFallbackResult = {
        snapshot: null,
        channel: "background-fallback-miss",
      };

      return resolveChromiumSnapshot(window.location.hostname, {
        readHashSnapshot: () => null,
        readDomHandoffSnapshot: readRuntimeConfigElement,
        cleanupDomHandoff: () => undefined,
        resolveBgSnapshot: async (hostname) => {
          backgroundFallbackResult = await resolveChromiumFallback(hostname);
          return backgroundFallbackResult.snapshot;
        },
      }).then(({ snapshot, channel }) => {
        let bootstrapChannel: BootstrapSnapshotChannel;
        if (channel === "dom-handoff") {
          bootstrapChannel = "dom-runtime-config";
        } else if (
          channel === "runtime-message" &&
          backgroundFallbackResult.channel === "preloaded-state"
        ) {
          bootstrapChannel = "preloaded-state";
        } else if (
          channel === "runtime-message" &&
          backgroundFallbackResult.channel === "background-message"
        ) {
          bootstrapChannel = "background-message";
        } else {
          bootstrapChannel = "background-fallback-miss";
        }
        reportBootstrapChannel(bootstrapChannel, snapshot);

        setCurrentAuthKey(snapshot?.authKey);

        if (!snapshot) {
          clearRuntimeConfig();
          return;
        }

        registerLogListener(snapshot);
        registerWorkerCsp();

        // DOM handoff: element already in DOM, no re-inject needed.
        // Runtime-message: write snapshot so the MAIN world can find it (fallback
        // for when main-world-early.js also missed the window.name seed).
        // The MAIN runtime keeps a cleanup listener after installation, so a late
        // fallback handoff is consumed without changing the active snapshot.
        if (channel !== "dom-handoff") {
          injectRuntimeConfig(snapshot);
        }
      });
    })(),
  );
};
