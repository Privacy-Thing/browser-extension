import {
  buildFirefoxShimState,
  dispatchFxStateEvent,
  injectFxEphemeralState,
} from "@privacy-brand/refract-browser/common/firefox-shim-state";
import {
  checkFxUserScriptsReady,
  resolveFirefoxSnapshot,
} from "@privacy-brand/refract-browser/firefox";

import type { TargetBootstrapContext } from "@/content/bootstrap-common";
import {
  reportBootstrapChannel,
  queryUserScriptsStatus,
  resolveFirefoxBgSnapshot,
  resolveFirefoxPreload,
} from "@/content/bootstrap-resolver";
import { registerHeartbeatRelay } from "@/content/firefox-heartbeat-forwarder";
import { registerFxTestBridge } from "@/content/firefox-test-bridge";
import { readPreloadedState } from "@/content/preloaded-runtime";
import { safeSendMessage } from "@/content/safe-messaging";
import {
  clearRuntimeConfig,
  injectMainWorldScript,
  injectRuntimeConfig,
} from "@/content/sync-config";
import { isParentOwnedRealm } from "@/injection/main/iframe-realm-ownership";
import { fireAndForget } from "@/shared/async";
import { FX_RUNTIME_TEST_HOST } from "@/shared/build-flags";
import {
  CMD_LOG_EVENT,
  CMD_WORKER_REWRITE,
  FIREFOX_BRIDGE_ATTR,
} from "@/shared/extension-contract";
import {
  drainPagePayloads,
  markPageBufferReady,
} from "@/shared/firefox-page-world-buffer";
import type { RuntimeSnapshot } from "@/shared/types";
import { SW_STRICT_BLOCKED_EVENT } from "@/shared/worker-compatibility";

let activeAuthKey: string | undefined;

const syncFirefoxShimState = (snapshot: RuntimeSnapshot | null): void => {
  const state = buildFirefoxShimState(snapshot);

  // Seed the ephemeral DOM bootstrap element so the geo-shim can read it
  // synchronously even if this event fires after the shim evaluates.
  injectFxEphemeralState(document, state);

  // Also dispatch a CustomEvent for late listeners / subsequent updates.
  dispatchFxStateEvent(state);
};

const finishFirefoxBootstrap = (
  snapshot: RuntimeSnapshot,
  injectShim: boolean,
): void => {
  injectRuntimeConfig(snapshot);
  if (injectShim && !isParentOwnedRealm(globalThis)) {
    injectMainWorldScript("main-world-early.js");
  }
};

const parseWorkerRewriteEvent = (
  event: Event,
): {
  url: string;
  name: string;
  workerType: "classic" | "module";
  origin: string;
  attemptId: string;
} | null => {
  if (!(event instanceof CustomEvent) || typeof event.detail !== "string") {
    return null;
  }

  try {
    const parsed = JSON.parse(event.detail) as unknown;
    if (typeof parsed !== "object" || parsed === null) {
      return null;
    }

    const detail = parsed as Record<string, unknown>;
    if (
      typeof detail.url !== "string" ||
      typeof detail.name !== "string" ||
      (detail.workerType !== "classic" && detail.workerType !== "module") ||
      typeof detail.origin !== "string" ||
      typeof detail.attemptId !== "string" ||
      detail.guard !== __PT_SHIM_GUARD_KEY__ ||
      detail.authKey !== activeAuthKey
    ) {
      return null;
    }

    return {
      url: detail.url,
      name: detail.name,
      workerType: detail.workerType,
      origin: detail.origin,
      attemptId: detail.attemptId,
    };
  } catch {
    return null;
  }
};

const relayWorkerStrictIssue = (): void => {
  document.addEventListener(__PT_SW_STRICT_ISSUE_TYPE__, (event) => {
    if (!(event instanceof CustomEvent) || typeof event.detail !== "string") {
      return;
    }

    try {
      const detail = JSON.parse(event.detail) as Record<string, unknown>;
      if (
        detail.guard !== __PT_SHIM_GUARD_KEY__ ||
        detail.authKey !== activeAuthKey ||
        detail.workerKind !== "SharedWorker" ||
        typeof detail.reason !== "string" ||
        typeof detail.url !== "string" ||
        typeof detail.attemptId !== "string"
      ) {
        return;
      }

      safeSendMessage({
        type: CMD_LOG_EVENT,
        event: SW_STRICT_BLOCKED_EVENT,
        details: { result: detail },
      });
    } catch {
      // Page-authored malformed events are not diagnostic evidence.
    }
  });
};

const relayWorkerRewrite = (): void => {
  document.addEventListener(__PT_SW_REWRITE_TYPE__, (event) => {
    const candidate = parseWorkerRewriteEvent(event);
    if (!candidate) {
      return;
    }

    safeSendMessage({
      type: CMD_WORKER_REWRITE,
      ...candidate,
    });
  });
};

export const runTargetBootstrap = ({
  setCurrentAuthKey,
  registerLogListener,
  registerWorkerCsp,
}: TargetBootstrapContext): void => {
  registerHeartbeatRelay();
  relayWorkerRewrite();
  relayWorkerStrictIssue();

  if (FX_RUNTIME_TEST_HOST && window.location.hostname === FX_RUNTIME_TEST_HOST) {
    document.documentElement?.removeAttribute(FIREFOX_BRIDGE_ATTR);
    registerFxTestBridge();
  }

  fireAndForget(
    resolveFirefoxSnapshot(window.location.hostname, {
      readPreloadedState: readPreloadedState,
      resolvePreloadedSnapshot: resolveFirefoxPreload,
      resolveBgSnapshot: resolveFirefoxBgSnapshot,
      queryUserScriptsReady: queryUserScriptsStatus,
    }).then(async ({ snapshot, channel }) => {
      reportBootstrapChannel(channel, snapshot);

      activeAuthKey = snapshot?.authKey;
      setCurrentAuthKey(activeAuthKey);

      try {
        syncFirefoxShimState(snapshot);
      } catch {
        // Geo shim will fall back to its timeout; full runtime must still load.
      }

      if (!snapshot) {
        clearRuntimeConfig();
        return;
      }

      const readiness = await checkFxUserScriptsReady({
        queryUserScriptsReady: queryUserScriptsStatus,
      });

      markPageBufferReady("bootstrap-log");
      registerLogListener(snapshot, {
        drainBufferedPayloads: () => drainPagePayloads("bootstrap-log"),
      });
      registerWorkerCsp();
      finishFirefoxBootstrap(snapshot, !readiness.ready);
    }),
  );
};
