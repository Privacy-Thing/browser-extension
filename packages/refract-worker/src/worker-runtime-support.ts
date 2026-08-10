import {
  createIntegrityRegistry,
  registerInstalledDesc,
} from "@privacy-brand/refract-core/integrity/surface-integrity-registry";

import type { RuntimeSnapshot } from "@/shared/types";
import { createWorkerEvidence } from "@/shared/worker-bootstrap-ack";

declare const SharedWorkerGlobalScope: any;

export type WorkerLogger = (method: string, args: unknown[], result?: unknown) => void;

type RegisterInput = {
  key: PropertyKey;
  methodId?: string | undefined;
  receiver?: object | undefined;
  surfaceId: string;
  target: object;
};

export type WorkerRuntimeSupport = {
  integrity: ReturnType<typeof createIntegrityRegistry>;
  isSharedWorker(): boolean;
  loggers: {
    audio: WorkerLogger;
    canvas: WorkerLogger;
    clientHints: WorkerLogger;
    clientHintsOnce: WorkerLogger;
    geolocation: WorkerLogger;
    locale: WorkerLogger;
    localeOnce: WorkerLogger;
    navigator: WorkerLogger;
    navigatorOnce: WorkerLogger;
    webGL: WorkerLogger;
    webGLOnce: WorkerLogger;
  };
  register(input: RegisterInput): void;
};

const toSerializable = (value: unknown, fallback: unknown): unknown => {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return fallback;
  }
};

export const createWorkerSupport = (
  snapshot: RuntimeSnapshot,
  runtimeLogType: string,
): WorkerRuntimeSupport => {
  const integrity = createIntegrityRegistry();
  const workerDebugPorts = new Set<any>();
  const isSharedWorker = (): boolean =>
    typeof SharedWorkerGlobalScope !== "undefined" &&
    globalThis instanceof SharedWorkerGlobalScope;

  if (isSharedWorker()) {
    globalThis.addEventListener("connect", (event: any) => {
      for (const port of event?.ports ?? []) {
        workerDebugPorts.add(port);
        if (typeof port.start === "function") port.start();
      }
    });
  }

  const emitLog = (
    component: string,
    method: string,
    args: unknown[],
    result: unknown,
  ): void => {
    if (!snapshot.debugMode || !snapshot.logEventName) return;
    const payload = {
      type: runtimeLogType,
      eventName: snapshot.logEventName,
      detail: JSON.stringify({
        component,
        method,
        level: method === "install" ? "verbose" : "info",
        args: toSerializable(args, ["<Unserializable Arguments>"]),
        result: toSerializable(result, "<Unserializable Result>"),
      }),
    };
    if (isSharedWorker()) {
      for (const port of workerDebugPorts) {
        try {
          port.postMessage(payload);
        } catch {
          // Ignore disconnected ports.
        }
      }
    } else if (typeof globalThis.postMessage === "function") {
      globalThis.postMessage(payload);
    }
  };

  const createLogger =
    (component: string): WorkerLogger =>
    (method, args, result) => {
      emitLog(component, method, args, result);
    };
  const createOnceLogger = (component: string): WorkerLogger => {
    const emittedMethods = new Set<string>();
    return (method, args, result) => {
      if (emittedMethods.has(method)) return;
      emittedMethods.add(method);
      emitLog(component, method, args, result);
    };
  };

  return {
    integrity,
    isSharedWorker,
    loggers: {
      audio: createLogger("Audio"),
      canvas: createLogger("Canvas"),
      clientHints: createLogger("ClientHints"),
      clientHintsOnce: createOnceLogger("ClientHints"),
      geolocation: createLogger("Geolocation"),
      locale: createLogger("Locale"),
      localeOnce: createOnceLogger("Locale"),
      navigator: createLogger("Navigator"),
      navigatorOnce: createOnceLogger("Navigator"),
      webGL: createLogger("WebGL"),
      webGLOnce: createOnceLogger("WebGL"),
    },
    register: ({ target, key, surfaceId, methodId, receiver }) => {
      const descriptor = Object.getOwnPropertyDescriptor(target, key);
      if (!descriptor) return;
      registerInstalledDesc({
        registrar: integrity,
        target,
        key,
        descriptor,
        anchor: {
          surfaceId,
          ...(methodId ? { methodId } : {}),
          realmId: "worker",
          repairPolicy: "repair",
          criticality: "preview-critical",
          ...(receiver ? { resolveReceiver: () => receiver } : {}),
        },
      });
    },
  };
};

export const finalizeWorkerIntegrity = (
  support: WorkerRuntimeSupport,
  shimGuardKey: string,
  ackType: string,
): void => {
  support.integrity.setResultSink({
    record: (result) => {
      if (
        result.status !== "repaired" &&
        result.status !== "unconfirmed" &&
        result.status !== "unrecoverable"
      ) {
        return;
      }
      try {
        globalThis.postMessage(
          createWorkerEvidence({
            guard: shimGuardKey,
            messageType: ackType,
            surfaceId: result.surfaceId,
            status: result.status,
            realmId: result.realmId,
            ...(result.reason ? { reasonCode: result.reason } : {}),
          }),
        );
      } catch {
        // Missing parent listener means no evidence, not a runtime crash.
      }
    },
  });
  support.integrity.ensureAll();
};
