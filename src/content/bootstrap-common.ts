import type {
  SurfaceMethodQueryCounts,
  SurfaceQueryCounts,
} from "@privacy-brand/xray-protocol";

import { isCurrentWindowSource } from "@/content/page-world-message";
import { safeSendMessage } from "@/content/safe-messaging";
import { isWorkerCspViolation } from "@/content/worker-csp-listener";
import {
  CMD_LOG_EVENT,
  CMD_GET_SURFACE_USAGE,
  CMD_SURFACE_ERROR,
  CMD_SURFACE_USAGE,
} from "@/shared/extension-contract";
import type {
  XRaySurfaceCategory,
  RuntimeSnapshot,
  SpoofingSurfaceMethodId,
} from "@/shared/types";
import { WORKER_CSP_BLOCKED_EVENT } from "@/shared/worker-compatibility";

export type TargetBootstrapContext = {
  setCurrentAuthKey(authKey: string | undefined): void;
  registerLogListener(snapshot: RuntimeSnapshot, options?: LogListenerOptions): void;
  registerWorkerCsp(): void;
};

type LogListenerOptions = {
  drainBufferedPayloads?: () => unknown[];
};

export const registerLogListener = (
  snapshot: RuntimeSnapshot,
  options: LogListenerOptions = {},
): void => {
  if (!snapshot.logEventName) {
    return;
  }

  const forwardLogPayload = (
    payload: {
      type?: unknown;
      eventName?: unknown;
      detail?: unknown;
    } | null,
  ): void => {
    try {
      const payloadEventName = payload?.eventName;
      const matchesCurrentLogStream =
        typeof payloadEventName === "string" &&
        payloadEventName === snapshot.logEventName;
      if (
        !payload ||
        payload.type !== __PT_LOG_EVENT_TYPE__ ||
        (!matchesCurrentLogStream && !snapshot.debugMode)
      ) {
        return;
      }

      const detailString = payload.detail;
      if (typeof detailString !== "string") {
        return;
      }

      const detail = JSON.parse(detailString);
      if (!detail || !detail.component || !detail.method) {
        return;
      }

      const eventName = `${detail.component}.${detail.method}`;
      const isWorkerCspSignal = eventName === WORKER_CSP_BLOCKED_EVENT;
      if (!snapshot.debugMode && !isWorkerCspSignal) {
        return;
      }

      safeSendMessage({
        type: CMD_LOG_EVENT,
        event: eventName,
        // Forwarded raw; the background message router normalizes the level.
        level: detail.level,
        details: detail,
      });
    } catch {
      // Ignore invalid event detail
    }
  };

  window.addEventListener("message", (event) => {
    if (!isCurrentWindowSource(event.source)) {
      return;
    }

    forwardLogPayload(
      event.data as {
        type?: unknown;
        eventName?: unknown;
        detail?: unknown;
      } | null,
    );
  });

  const bufferedPayloads = options.drainBufferedPayloads?.() ?? [];
  for (const payload of bufferedPayloads) {
    forwardLogPayload(
      payload as {
        type?: unknown;
        eventName?: unknown;
        detail?: unknown;
      } | null,
    );
  }
};

export const registerWorkerCsp = (): void => {
  document.addEventListener("securitypolicyviolation", (event) => {
    if (!event.isTrusted || !isWorkerCspViolation(event)) {
      return;
    }

    const blockedUri = event.blockedURI ?? "";

    safeSendMessage({
      type: CMD_LOG_EVENT,
      event: "Worker.compatibility-csp-blocked",
      details: {
        blockedUri,
        effectiveDirective: event.effectiveDirective,
        violatedDirective: event.violatedDirective,
        originalPolicy: event.originalPolicy,
      },
    });
  });
};

const parseSurfaceCategories = (raw: unknown): XRaySurfaceCategory[] | null => {
  if (!Array.isArray(raw)) {
    return null;
  }

  const categories = raw.filter((c): c is XRaySurfaceCategory => typeof c === "string");

  return categories.length > 0 ? categories : null;
};

export const readSurfaceCategories = (event: Event): XRaySurfaceCategory[] | null => {
  if (!(event instanceof CustomEvent)) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(event.detail as string);
  } catch {
    return null;
  }

  if (typeof parsed !== "object" || parsed === null) {
    return null;
  }

  return parseSurfaceCategories((parsed as { categories?: unknown }).categories);
};

/**
 * Extracts the optional per-realm evidence payload from a surface-error event
 * (#111). Loosely shaped here — the background revalidates it with
 * `SurfaceErrorSchema` before recording.
 */
export const readSurfaceEvidence = (
  event: Event,
): ({ realmId: string } & Record<string, unknown>) | null => {
  if (!(event instanceof CustomEvent)) {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(event.detail as string);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) {
    return null;
  }
  const evidence = (parsed as { evidence?: unknown }).evidence;
  if (
    typeof evidence !== "object" ||
    evidence === null ||
    typeof (evidence as { realmId?: unknown }).realmId !== "string"
  ) {
    return null;
  }
  return evidence as { realmId: string } & Record<string, unknown>;
};

const parseNumberRecord = <TKey extends string>(
  raw: unknown,
): Partial<Record<TKey, number>> | undefined => {
  if (typeof raw !== "object" || raw === null) {
    return undefined;
  }

  const result: Partial<Record<TKey, number>> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === "number") {
      result[key as TKey] = value;
    }
  }

  return Object.keys(result).length > 0 ? result : undefined;
};

const parseSurfaceSourceId = (raw: unknown): string | undefined => {
  if (typeof raw !== "string") {
    return undefined;
  }

  return /^[a-z0-9:-]{1,64}$/i.test(raw) ? raw : undefined;
};

const parseSurfaceUsageEvent = (
  event: Event,
): {
  categories: XRaySurfaceCategory[];
  counts?: SurfaceQueryCounts;
  methodCounts?: SurfaceMethodQueryCounts;
  sourceId?: string;
} | null => {
  if (!(event instanceof CustomEvent)) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(event.detail as string);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) {
    return null;
  }

  const payload = parsed as Record<string, unknown>;
  const categories = parseSurfaceCategories(payload.categories);
  if (!categories) {
    return null;
  }

  const counts = parseNumberRecord<XRaySurfaceCategory>(payload.counts);
  const methodCounts = parseNumberRecord<SpoofingSurfaceMethodId>(payload.methodCounts);
  const sourceId = parseSurfaceSourceId(payload.sourceId);
  return {
    categories,
    ...(counts ? { counts } : {}),
    ...(methodCounts ? { methodCounts } : {}),
    ...(sourceId ? { sourceId } : {}),
  };
};

export const registerUsageRelay = (): void => {
  document.addEventListener(__PT_SURFACE_USAGE_TYPE__, (event) => {
    // MAIN-world runtime reports through dispatchEvent(), so this event is
    // synthetic by design and Event.isTrusted is always false. The relay uses
    // its randomized per-build event type and strict payload parsing instead.
    const usage = parseSurfaceUsageEvent(event);
    if (!usage) {
      return;
    }

    safeSendMessage({
      type: CMD_SURFACE_USAGE,
      categories: usage.categories,
      ...(usage.sourceId ? { sourceId: usage.sourceId } : {}),
      ...(usage.counts ? { counts: usage.counts } : {}),
      ...(usage.methodCounts ? { methodCounts: usage.methodCounts } : {}),
    });
  });
};

export const registerErrorRelay = (): void => {
  document.addEventListener(__PT_SURFACE_ERROR_TYPE__, (event) => {
    // See registerUsageRelay: runtime error reports use the same
    // synthetic MAIN-world to isolated-world CustomEvent transport.
    const categories = readSurfaceCategories(event);
    if (!categories) {
      return;
    }

    const evidence = readSurfaceEvidence(event);
    safeSendMessage({
      type: CMD_SURFACE_ERROR,
      categories,
      ...(evidence ? { evidence } : {}),
    });
  });
};

export const registerUsageRequest = (
  getCurrentAuthKey: () => string | undefined,
): void => {
  try {
    chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
      if (
        typeof message !== "object" ||
        message === null ||
        (message as { type?: unknown }).type !== CMD_GET_SURFACE_USAGE
      ) {
        return false;
      }

      try {
        const authKey = getCurrentAuthKey();
        if (!authKey) {
          sendResponse({ ok: true });
          return true;
        }

        document.dispatchEvent(
          new CustomEvent(__PT_SURFACE_USAGE_REG_TYPE__, {
            detail: JSON.stringify({
              guard: __PT_SHIM_GUARD_KEY__,
              authKey,
            }),
          }),
        );
      } catch {
        // Ignore dispatch errors - non-critical path
      }

      sendResponse({ ok: true });
      return true;
    });
  } catch {
    // Extension context invalidated or chrome.runtime unavailable
  }
};
