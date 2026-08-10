import { useEffect, useRef } from "react";

import { SIDEBAR_PORT_NAME } from "@/shared/sidebar-events";
import type { SidebarPushEvent } from "@/shared/sidebar-events";

/**
 * Opens a long-lived port to the background service worker and delivers push
 * events to `onEvent`. Automatically reconnects when the service worker
 * restarts (MV3 SW can cycle at any time, which disconnects all ports).
 *
 * The hook owns the full port lifecycle: connect on mount, disconnect on
 * unmount, reconnect on involuntary disconnect.
 */
export const useSidebarEvents = (onEvent: (event: SidebarPushEvent) => void): void => {
  // Use a ref so the reconnect closure always sees the latest callback without
  // re-running the effect on every render.
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    let port: chrome.runtime.Port | null = null;
    let unmounted = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = (): void => {
      if (unmounted) return;

      try {
        port = chrome.runtime.connect({ name: SIDEBAR_PORT_NAME });
      } catch {
        // SW not yet running — retry shortly
        reconnectTimer = setTimeout(connect, 300);
        return;
      }

      const messageListener = (event: SidebarPushEvent): void => {
        onEventRef.current(event);
      };

      port.onMessage.addListener(messageListener);

      port.onDisconnect.addListener(() => {
        port = null;
        if (!unmounted) {
          // Involuntary disconnect (SW restart) — reconnect after a short delay
          reconnectTimer = setTimeout(connect, 150);
        }
      });
    };

    connect();

    return () => {
      unmounted = true;
      if (reconnectTimer !== null) {
        clearTimeout(reconnectTimer);
      }
      port?.disconnect();
      port = null;
    };
  }, []); // stable — onEvent changes go through the ref
};
