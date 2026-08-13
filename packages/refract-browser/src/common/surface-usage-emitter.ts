import {
  createPrivateMap,
  createPrivateSet,
  privateMapGet,
  privateMapSet,
  privateSetAdd,
} from "@privacy-brand/refract-core/runtime/primordials";

import type { XRaySurfaceCategory, SpoofingSurfaceMethodId } from "@/shared/types";

export type SurfaceUsageSnapshot = {
  sourceId: string;
  categories: readonly XRaySurfaceCategory[];
  counts: Partial<Record<XRaySurfaceCategory, number>>;
  methodCounts: Partial<Record<SpoofingSurfaceMethodId, number>>;
};

/**
 * Module-scope accumulator for surface categories accessed by the page.
 * Kept in a closure — never attached to `window` — to avoid observable globals.
 *
 * Categories are de-duplicated for the "accessed" state, while aggregate
 * category and method counters are dispatched so an already-open XRay sidebar
 * can update live.
 *
 * Emission is coalesced AND rate-bounded. A synchronous burst (e.g. a
 * fingerprinting script reading `Date` methods in a tight loop) collapses into a
 * single microtask-deferred dispatch carrying the latest absolute counters. But
 * fingerprinters also spread tens of thousands of reads across `await`/timer
 * boundaries; per-microtask coalescing alone would then dispatch one event — and
 * one background `sendMessage` — per microtask checkpoint, flooding the
 * background. So after each flush a cooldown window suppresses further
 * dispatches; accumulated changes are emitted once by a single trailing flush
 * when the window ends. Because every flush sends the **full** absolute snapshot
 * and the background tracker stores counts absolutely (`map.set`), dropping
 * intermediate flushes is lossless. This keeps the diagnostic channel off the
 * per-call hot path and bounds its background traffic — see the Performance
 * invariants in CLAUDE.md.
 *
 * Transport: `document.dispatchEvent(new CustomEvent(...))` is the proven
 * cross-world channel in both Firefox and Chromium.  Unlike `window.postMessage`,
 * CustomEvents on `document` reliably cross the userScript-sandbox boundary in
 * Firefox MV3, and work identically in Chromium MAIN world.
 */
const usedCategories = createPrivateSet<XRaySurfaceCategory>();

/** Per-category call counts. Incremented on every intercepted API call. */
const callCounts = createPrivateMap<XRaySurfaceCategory, number>();
/** Per-method call counts. Method IDs are stable diagnostic keys, not UI text. */
const methodCallCounts = createPrivateMap<SpoofingSurfaceMethodId, number>();
let surfaceUsageSourceId = "runtime";

/**
 * Minimum interval between dispatched surface-usage events. Bounds background
 * message volume under high-frequency, async-spread fingerprinting probes while
 * keeping XRay responsive (the first access in any quiet period flushes on the
 * next microtask).
 */
const FLUSH_WINDOW_MS = 250;

/** A microtask flush is queued. */
let flushQueued = false;
/** Within the post-flush cooldown window; new accesses defer to a trailing flush. */
let cooldownActive = false;
/** Counters changed since the last dispatch — a flush still owes an emit. */
let dirty = false;

const emitSurfaceUsage = (): void => {
  if (typeof document === "undefined") {
    return;
  }

  try {
    document.dispatchEvent(
      new CustomEvent(__PT_SURFACE_USAGE_TYPE__, {
        detail: JSON.stringify({
          sourceId: surfaceUsageSourceId,
          categories: [...usedCategories],
          counts: Object.fromEntries(callCounts),
          methodCounts: Object.fromEntries(methodCallCounts),
        }),
      }),
    );
  } catch {
    // Ignore dispatch errors — non-critical diagnostic channel
  }
};

/** Relays a full absolute counter snapshot produced by another runtime realm. */
export const emitSurfaceUsageSnapshot = ({
  sourceId,
  categories,
  counts,
  methodCounts,
}: SurfaceUsageSnapshot): void => {
  if (typeof document === "undefined") return;
  try {
    document.dispatchEvent(
      new CustomEvent(__PT_SURFACE_USAGE_TYPE__, {
        detail: JSON.stringify({ sourceId, categories, counts, methodCounts }),
      }),
    );
  } catch {
    // Ignore dispatch errors — non-critical diagnostic channel.
  }
};

const scheduleFlush = (): void => {
  if (typeof document === "undefined" || cooldownActive || flushQueued) {
    return;
  }
  flushQueued = true;
  queueMicrotask(runFlush);
};

function runFlush(): void {
  flushQueued = false;
  if (!dirty) {
    return;
  }
  dirty = false;
  emitSurfaceUsage();

  // Open a cooldown so async-spread accesses don't dispatch per microtask; a
  // single trailing flush at the window's end carries whatever accumulated.
  cooldownActive = true;
  setTimeout(() => {
    cooldownActive = false;
    if (dirty) {
      scheduleFlush();
    }
  }, FLUSH_WINDOW_MS);
}

const parseRegistrationDetail = (
  detail: unknown,
): { guard: string; authKey: string } | null => {
  if (typeof detail !== "string") {
    return null;
  }

  try {
    const parsed = JSON.parse(detail) as unknown;
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      (parsed as { guard?: unknown }).guard === __PT_SHIM_GUARD_KEY__
    ) {
      const authKey = (parsed as { authKey?: unknown }).authKey;
      if (typeof authKey !== "string" || authKey.length === 0) {
        return null;
      }

      return {
        guard: __PT_SHIM_GUARD_KEY__,
        authKey,
      };
    }
  } catch {
    return null;
  }

  return null;
};

/**
 * Records one spoofed surface access and emits the XRay diagnostic event.
 *
 * The category counter is always incremented. When `methodId` is supplied, the
 * corresponding method counter is incremented too. Method IDs are stable
 * diagnostic identifiers from the spoofing-surface catalog, not localized UI
 * labels.
 */
export const markSurfaceUsed = (
  category: XRaySurfaceCategory,
  methodId?: SpoofingSurfaceMethodId,
): void => {
  privateMapSet(callCounts, category, (privateMapGet(callCounts, category) ?? 0) + 1);
  if (methodId) {
    privateMapSet(
      methodCallCounts,
      methodId,
      (privateMapGet(methodCallCounts, methodId) ?? 0) + 1,
    );
  }

  privateSetAdd(usedCategories, category);
  dirty = true;

  scheduleFlush();
};

export const setSurfaceUsageSourceId = (sourceId: string): void => {
  const normalized = sourceId.trim();
  if (/^[a-z0-9:-]{1,64}$/i.test(normalized)) {
    surfaceUsageSourceId = normalized;
  }
};

/**
 * Installs a one-time listener for the pub/sub registration request.
 *
 * When the sidebar connects or reconnects, the background sends
 * `requestSurfaceUsage` to the content script, which dispatches a
 * `CustomEvent(SURFACE_USAGE_REG_TYPE, { detail })` on `document`. This
 * listener picks that up and responds with a full dump of the currently
 * accumulated `usedCategories` via the normal `SURFACE_USAGE_TYPE` channel.
 *
 * `SHIM_GUARD_KEY` validation ensures only requests from Privacy Thing's own content
 * script (which knows the build-time key) trigger the dump. The auth key binds
 * the request to the current runtime snapshot, preventing a stale sidebar
 * request from collecting counters from a different snapshot.
 */
export const installUsageListener = (getAuthKey: () => string | undefined): void => {
  if (typeof document === "undefined") {
    return;
  }

  document.addEventListener(__PT_SURFACE_USAGE_REG_TYPE__, (event) => {
    if (!(event instanceof CustomEvent)) {
      return;
    }

    const registration = parseRegistrationDetail(event.detail);
    if (!registration) {
      return;
    }

    const authKey = getAuthKey();
    if (!authKey || registration.authKey !== authKey) {
      return;
    }

    const cats = [...usedCategories];
    if (cats.length === 0) {
      return;
    }

    const counts = Object.fromEntries(callCounts);
    const methodCounts = Object.fromEntries(methodCallCounts);

    try {
      document.dispatchEvent(
        new CustomEvent(__PT_SURFACE_USAGE_TYPE__, {
          detail: JSON.stringify({
            sourceId: surfaceUsageSourceId,
            categories: cats,
            counts,
            methodCounts,
          }),
        }),
      );
    } catch {
      // Ignore dispatch errors — non-critical diagnostic channel
    }
  });
};
