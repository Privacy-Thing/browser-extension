import { installFxWorkers } from "@privacy-brand/refract-core";
import type { RuntimeSnapshot } from "@privacy-brand/refract-core";
import { describe, expect, it, vi } from "vitest";

import { LOG_EVENT_TYPE } from "@/shared/build-id-test-values";

const buildRuntimeSnapshot = (
  overrides: Partial<RuntimeSnapshot> = {},
): RuntimeSnapshot => ({
  geo: {
    latitude: 52.2297,
    longitude: 21.0122,
    accuracy: 25,
    noiseRadius: 50,
  },
  locale: {
    language: "pl",
    languages: ["pl"],
    timeZone: "Europe/Warsaw",
    acceptLanguage: "pl",
  },
  date: {
    baseEpochMs: Date.parse("2026-01-15T12:00:00.000Z"),
    offsetMs: 0,
    timeZone: "Europe/Warsaw",
  },
  debugMode: true,
  logEventName: "evt123",
  watchPositionDelay: [60, 500],
  ...overrides,
});

describe("installFxWorkers relay", () => {
  it("keeps worker runtime debug payloads off the page message channel", () => {
    const originalWorker = globalThis.Worker;
    const originalSharedWorker = globalThis.SharedWorker;
    const nativeServiceWorker = globalThis.ServiceWorkerContainer;
    const nativeNavigatorDesc = Object.getOwnPropertyDescriptor(
      globalThis,
      "navigator",
    );
    const nativeLocationDesc = Object.getOwnPropertyDescriptor(globalThis, "location");
    const originalCreateObjectURL = URL.createObjectURL;
    const originalBlob = globalThis.Blob;
    const nativePostMessageDesc = Object.getOwnPropertyDescriptor(
      globalThis,
      "postMessage",
    );

    const dedicatedListeners = new Map<string, Array<(event: Event) => void>>();
    const sharedPortListeners = new Map<string, Array<(event: Event) => void>>();
    const sharedPortStart = vi.fn();
    const postMessage = vi.fn();
    const appendListener = (
      registry: Map<string, Array<(event: Event) => void>>,
      type: string,
      handler: (event: Event) => void,
    ): void => {
      const existing = registry.get(type) ?? [];
      existing.push(handler);
      registry.set(type, existing);
    };

    class MockWorker {
      constructor(_: string | URL, __?: WorkerOptions) {}

      addEventListener(type: string, handler: (event: Event) => void): void {
        appendListener(dedicatedListeners, type, handler);
      }

      terminate(): void {}
    }

    class MockSharedWorker {
      readonly port = {
        addEventListener: (type: string, handler: (event: Event) => void): void => {
          appendListener(sharedPortListeners, type, handler);
        },
        start: sharedPortStart,
      };

      constructor(_: string | URL, __?: string | WorkerOptions) {}

      addEventListener(): void {}
    }

    class MockServiceWorker {}

    try {
      vi.stubGlobal("Worker", MockWorker);
      vi.stubGlobal("SharedWorker", MockSharedWorker);
      vi.stubGlobal("ServiceWorkerContainer", MockServiceWorker);
      vi.stubGlobal("Blob", class MockBlob {});
      Object.defineProperty(URL, "createObjectURL", {
        configurable: true,
        value: vi.fn(() => "blob:mock"),
      });
      Object.defineProperty(globalThis, "navigator", {
        configurable: true,
        value: {},
      });
      Object.defineProperty(globalThis, "location", {
        configurable: true,
        value: {
          href: "https://example.com/page",
        },
      });
      Object.defineProperty(globalThis, "postMessage", {
        configurable: true,
        value: postMessage,
      });

      installFxWorkers({
        buildRuntimeSnapshot: () => buildRuntimeSnapshot(),
        syncBootstrapState: () => {},
        shouldBlockServiceWorker: () => false,
        emitWorkerCompatSignal: () => {},
        resolveWorkerMode: () => "spoof",
        markWorkerSurfaceFailed: () => {},
      });

      expect(globalThis.SharedWorker).toBe(MockSharedWorker);

      const dedicatedWorker = new Worker("/dedicated.js");
      const sharedWorker = new SharedWorker("/shared.js");
      const dedicatedPageHandler = vi.fn();
      const sharedPageHandler = vi.fn();

      dedicatedWorker.addEventListener("message", dedicatedPageHandler);
      sharedWorker.port.addEventListener("message", sharedPageHandler);

      const dedicatedStop = vi.fn();
      const dedicatedEvent = {
        data: {
          type: LOG_EVENT_TYPE,
          eventName: "evt123",
          detail: '{"component":"Locale","method":"install"}',
        },
        stopImmediatePropagation: dedicatedStop,
      } as unknown as Event;
      for (const listener of dedicatedListeners.get("message") ?? []) {
        listener(dedicatedEvent);
        if (dedicatedStop.mock.calls.length > 0) {
          break;
        }
      }

      expect(sharedPortStart).not.toHaveBeenCalled();
      expect(postMessage).toHaveBeenCalledTimes(1);
      expect(dedicatedPageHandler).not.toHaveBeenCalled();
      expect(sharedPortListeners.get("message")).toEqual([sharedPageHandler]);
      expect(sharedPageHandler).not.toHaveBeenCalled();
    } finally {
      if (nativeNavigatorDesc) {
        Object.defineProperty(globalThis, "navigator", nativeNavigatorDesc);
      } else {
        delete (globalThis as { navigator?: Navigator }).navigator;
      }

      if (nativeLocationDesc) {
        Object.defineProperty(globalThis, "location", nativeLocationDesc);
      } else {
        delete (globalThis as typeof globalThis & { location?: Location }).location;
      }

      if (originalCreateObjectURL) {
        Object.defineProperty(URL, "createObjectURL", {
          configurable: true,
          value: originalCreateObjectURL,
        });
      } else {
        Reflect.deleteProperty(URL as unknown as object, "createObjectURL");
      }

      if (nativePostMessageDesc) {
        Object.defineProperty(globalThis, "postMessage", nativePostMessageDesc);
      } else {
        delete (globalThis as typeof globalThis & { postMessage?: typeof postMessage })
          .postMessage;
      }

      vi.stubGlobal("Blob", originalBlob);
      vi.stubGlobal("ServiceWorkerContainer", nativeServiceWorker);
      vi.stubGlobal("Worker", originalWorker);
      vi.stubGlobal("SharedWorker", originalSharedWorker);
    }
  });
});
