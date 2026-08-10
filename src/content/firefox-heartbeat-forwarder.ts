import { isCurrentWindowSource } from "@/content/page-world-message";
import { safeSendMessage } from "@/content/safe-messaging";
import { BUILD_BROWSER_TARGET } from "@/shared/build-flags";
import { CMD_LOG_EVENT } from "@/shared/extension-contract";
import {
  drainPagePayloads,
  markPageBufferReady,
} from "@/shared/firefox-page-world-buffer";
import { normalizeLogLevel } from "@/shared/logging-types";

const HEARTBEAT_CACHE_LIMIT = 16;

const rememberHeartbeat = (
  recentHeartbeats: string[],
  fingerprint: string,
): boolean => {
  if (recentHeartbeats.includes(fingerprint)) {
    return false;
  }

  recentHeartbeats.push(fingerprint);
  if (recentHeartbeats.length > HEARTBEAT_CACHE_LIMIT) {
    recentHeartbeats.shift();
  }

  return true;
};

export const forwardHeartbeatPayload = (
  payload: {
    type?: unknown;
    heartbeat?: unknown;
    detail?: unknown;
  } | null,
  recentHeartbeats?: string[],
): void => {
  try {
    if (
      !payload ||
      payload.type !== __PT_LOG_EVENT_TYPE__ ||
      payload.heartbeat !== true
    ) {
      return;
    }

    const detailString = payload.detail;
    if (typeof detailString !== "string") {
      return;
    }

    if (
      recentHeartbeats &&
      !rememberHeartbeat(recentHeartbeats, `${payload.type}:${detailString}`)
    ) {
      return;
    }

    const detail = JSON.parse(detailString) as Record<string, unknown> | null;
    if (
      !detail ||
      typeof detail.component !== "string" ||
      typeof detail.method !== "string"
    ) {
      return;
    }

    const eventName = `${detail.component}.${detail.method}`;
    safeSendMessage({
      type: CMD_LOG_EVENT,
      heartbeat: true,
      event: eventName,
      level: normalizeLogLevel(detail.level),
      details: detail,
    });
  } catch {
    // Ignore invalid payloads.
  }
};

export const registerHeartbeatRelay = (): void => {
  if (BUILD_BROWSER_TARGET !== "firefox") {
    return;
  }

  const recentHeartbeats: string[] = [];

  const drainBufferedHeartbeats = (): void => {
    const bufferedPayloads = drainPagePayloads("bootstrap-heartbeat");
    for (const payload of bufferedPayloads) {
      forwardHeartbeatPayload(
        payload as {
          type?: unknown;
          heartbeat?: unknown;
          detail?: unknown;
        } | null,
        recentHeartbeats,
      );
    }
  };

  globalThis.addEventListener("message", (event) => {
    if (!isCurrentWindowSource(event.source)) {
      return;
    }

    forwardHeartbeatPayload(
      event.data as {
        type?: unknown;
        heartbeat?: unknown;
        detail?: unknown;
      } | null,
      recentHeartbeats,
    );
  });

  markPageBufferReady("bootstrap-heartbeat");
  drainBufferedHeartbeats();

  const observerTarget = document.head ?? document.documentElement ?? document.body;
  if (!observerTarget) {
    return;
  }

  const observer = new MutationObserver(() => {
    drainBufferedHeartbeats();
  });
  observer.observe(observerTarget, {
    childList: true,
  });
};
