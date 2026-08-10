import { SIDEBAR_PORT_NAME } from "@/shared/sidebar-events";
import type { SidebarPushEvent } from "@/shared/sidebar-events";

const connectedPorts = new Set<chrome.runtime.Port>();

/**
 * Registers the `chrome.runtime.onConnect` listener that accepts sidebar
 * ports. Must be called once during background service-worker startup.
 */
export const registerSidebarEventHub = (): void => {
  chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== SIDEBAR_PORT_NAME) {
      return;
    }

    connectedPorts.add(port);

    port.onDisconnect.addListener(() => {
      connectedPorts.delete(port);
    });
  });
};

/**
 * Pushes an event to every connected sidebar instance. Silently drops
 * ports that have already disconnected between the Set iteration and the
 * send attempt.
 */
export const publishSidebarEvent = (event: SidebarPushEvent): void => {
  for (const port of connectedPorts) {
    try {
      port.postMessage(event);
    } catch {
      connectedPorts.delete(port);
    }
  }
};
