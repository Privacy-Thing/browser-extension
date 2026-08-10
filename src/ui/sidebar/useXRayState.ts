import type { GetXRayStateResponse } from "@privacy-brand/xray-protocol";
import { useCallback, useEffect, useRef, useState } from "react";

import { useSidebarEvents } from "./useSidebarEvents";

import { fireAndForget } from "@/shared/async";
import { EXTENSION_COMMAND_TYPES } from "@/shared/extension-contract";
import type { SidebarPushEvent } from "@/shared/sidebar-events";
import { getSurfaceDefinition } from "@/shared/spoofing-surfaces";
import { deriveLegacyXRayActivity } from "@/shared/surface-assessments";
import { sendRuntimeMessage } from "@/ui/shared/runtime-messaging";

/** How long to stay in "connecting" state if no surface-usage dump arrives. */
const SURFACE_SYNC_TIMEOUT_MS = 1500;

export const useXRayState = (tabId: number | undefined) => {
  const [state, setState] = useState<GetXRayStateResponse | null>(null);
  const [loading, setLoading] = useState(true);
  /** True from mount until the first surface-usage-updated push event arrives (or
   *  the fallback timeout fires). Starts true so the accordion never briefly shows
   *  "Waiting" before the first getXRayState round-trip completes. */
  const [surfaceSyncPending, setSurfaceSyncPending] = useState(true);
  const tabIdRef = useRef(tabId);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  tabIdRef.current = tabId;

  const startSurfaceSync = useCallback(() => {
    if (syncTimerRef.current !== null) clearTimeout(syncTimerRef.current);
    setSurfaceSyncPending(true);
    syncTimerRef.current = setTimeout(() => {
      syncTimerRef.current = null;
      setSurfaceSyncPending(false);
    }, SURFACE_SYNC_TIMEOUT_MS);
  }, []);

  // Clean up timer on unmount.
  useEffect(
    () => () => {
      if (syncTimerRef.current !== null) clearTimeout(syncTimerRef.current);
    },
    [],
  );

  const refresh = useCallback(() => {
    setLoading(true);
    startSurfaceSync();
    fireAndForget(
      sendRuntimeMessage<GetXRayStateResponse>({
        type: EXTENSION_COMMAND_TYPES.getXRayState,
        tabId: tabIdRef.current,
      }).then((response) => {
        if (!response) {
          setState({ ok: false, error: "Extension context unavailable." });
          setSurfaceSyncPending(false);
          if (syncTimerRef.current !== null) {
            clearTimeout(syncTimerRef.current);
            syncTimerRef.current = null;
          }
        } else {
          setState(response);
          // If the background already has cached surface data, no need to wait for the dump.
          const hasCachedData =
            response.ok && Object.keys(response.accessedCategories ?? {}).length > 0;
          if (hasCachedData) {
            setSurfaceSyncPending(false);
            if (syncTimerRef.current !== null) {
              clearTimeout(syncTimerRef.current);
              syncTimerRef.current = null;
            }
          }
        }
        setLoading(false);
      }),
    );
  }, [startSurfaceSync]);

  // Full re-fetch whenever the active tab changes.
  // Skip when tabId is still unknown — sending the message with undefined
  // causes the background to fall back to currentWindow (unreliable in SW
  // context) and return hostname:null, showing the "can't be spoofed" state.
  useEffect(() => {
    if (tabId === undefined) return;
    refresh();
  }, [tabId, refresh]);

  // Re-fetch when the active tab finishes loading.
  //
  // Background sends `doctor-state-invalidated` synchronously inside
  // onBeforeNavigate — before the async snapshot-cache update completes.
  // The sidebar receives the push and refreshes too early, getting
  // hostname=null.  By the time onUpdated(status=complete) fires the cache
  // is ready, so a second refresh here gets the correct hostname.
  // This also covers the case where tabId never changes (same tab navigates)
  // so the useEffect above would not re-run.
  useEffect(() => {
    const onUpdated: Parameters<typeof chrome.tabs.onUpdated.addListener>[0] = (
      updatedTabId,
      changeInfo,
    ) => {
      if (changeInfo.status === "complete" && updatedTabId === tabIdRef.current) {
        refresh();
      }
    };
    chrome.tabs.onUpdated.addListener(onUpdated);
    return () => {
      chrome.tabs.onUpdated.removeListener(onUpdated);
    };
  }, [refresh]);

  // Push events from the background via the long-lived sidebar port.
  const handlePushEvent = useCallback(
    (event: SidebarPushEvent) => {
      const currentTabId = tabIdRef.current;
      if (currentTabId === undefined) return;

      if (event.type === "surface-usage-updated" && event.tabId === currentTabId) {
        // Surface dump arrived — end the connecting phase.
        setSurfaceSyncPending(false);
        if (syncTimerRef.current !== null) {
          clearTimeout(syncTimerRef.current);
          syncTimerRef.current = null;
        }
        // Patch accessedCategories and counts in place — no loading spinner, no round-trip.
        setState((prev) => {
          if (!prev?.ok) return prev;
          const accessedSet = new Set(event.categories);
          const assessments = prev.assessments.map((assessment) => {
            const nextMethodCounts = { ...assessment.activity.methodCounts };
            for (const method of getSurfaceDefinition(assessment.key).methods) {
              const count = event.methodCounts?.[method.id];
              if (count !== undefined) nextMethodCounts[method.id] = count;
            }
            return {
              ...assessment,
              activity: {
                ...assessment.activity,
                accessed:
                  assessment.activity.accessed || accessedSet.has(assessment.key),
                queryCount:
                  event.queryCounts?.[assessment.key] ?? assessment.activity.queryCount,
                methodCounts: nextMethodCounts,
              },
            };
          });
          const legacyActivity = deriveLegacyXRayActivity(assessments);
          return {
            ...prev,
            assessments,
            ...legacyActivity,
          };
        });
        return;
      }

      if (event.type === "doctor-state-invalidated" && event.tabId === currentTabId) {
        refresh();
      }
    },
    [refresh],
  );

  useSidebarEvents(handlePushEvent);

  return { state, loading, refresh, surfaceSyncPending };
};
