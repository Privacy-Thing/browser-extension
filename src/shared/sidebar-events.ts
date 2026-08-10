import type {
  SurfaceMethodQueryCounts,
  SurfaceQueryCounts,
} from "@privacy-brand/xray-protocol";

import type { XRaySurfaceCategory } from "@/shared/types";

/**
 * Name of the long-lived port opened by the sidebar to the background service
 * worker. A stable string is fine here — this channel is extension-internal
 * and never visible to page scripts.
 */
export const SIDEBAR_PORT_NAME = "pt-sidebar-events";

/**
 * Events the background pushes to all connected sidebar instances.
 *
 * - `surface-usage-updated` — page accessed a new spoofing surface; sidebar
 *   can patch `accessedCategories` in place without a full re-fetch.
 * - `doctor-state-invalidated` — page navigated, rule changed, or snapshot
 *   refreshed; sidebar must re-fetch the full XRay state. The event
 *   literal remains legacy for compatibility with already-running contexts.
 */
export type SidebarPushEvent =
  | {
      type: "surface-usage-updated";
      tabId: number;
      categories: XRaySurfaceCategory[];
      queryCounts?: SurfaceQueryCounts;
      methodCounts?: SurfaceMethodQueryCounts;
    }
  | { type: "doctor-state-invalidated"; tabId: number };
