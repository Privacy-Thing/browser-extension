import {
  createIntegrityRegistry,
  registerInstalledDesc,
} from "@privacy-brand/refract-core/integrity/surface-integrity-registry";
import {
  createPrivateMap,
  createPrivateRecord,
  createPublicArray,
  privateArrayPush,
  privateMapForEach,
  privateMapGet,
  privateMapSet,
  privateSetAdd,
  privateSetForEach,
} from "@privacy-brand/refract-core/runtime/primordials";

import type {
  RuntimeSnapshot,
  SpoofingSurfaceMethodId,
  XRaySurfaceCategory,
} from "@/shared/types";
import {
  createWorkerEvidence,
  createWorkerUsageMessage,
} from "@/shared/worker-bootstrap-ack";

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
  markSurfaceUsed(
    category: XRaySurfaceCategory,
    methodId?: SpoofingSurfaceMethodId,
  ): void;
  register(input: RegisterInput): void;
};

type WorkerSupportChannel = {
  guard: string;
  messageType: string;
  runtimeLogType: string;
};

type WorkerBus = {
  isSharedWorker(): boolean;
  onPort(callback: (port: any) => void): void;
  post(payload: unknown): void;
};

const createWorkerBus = (): WorkerBus => {
  const ports = new Set<any>();
  const isSharedWorker = (): boolean =>
    typeof SharedWorkerGlobalScope !== "undefined" &&
    globalThis instanceof SharedWorkerGlobalScope;
  let onPort: ((port: any) => void) | undefined;

  if (isSharedWorker()) {
    globalThis.addEventListener("connect", (event: any) => {
      const eventPorts = event?.ports;
      for (let index = 0; index < (eventPorts?.length ?? 0); index += 1) {
        const port = eventPorts[index];
        if (!port) continue;
        privateSetAdd(ports, port);
        if (typeof port.start === "function") port.start();
        onPort?.(port);
      }
    });
  }

  return {
    isSharedWorker,
    onPort: (callback) => {
      onPort = callback;
    },
    post: (payload) => {
      if (isSharedWorker()) {
        privateSetForEach(ports, (port) => {
          try {
            port.postMessage(payload);
          } catch {
            // Ignore disconnected ports.
          }
        });
      } else if (typeof globalThis.postMessage === "function") {
        globalThis.postMessage(payload);
      }
    },
  };
};

const createCountRecord = <TKey extends string>(
  counts: Map<TKey, number>,
): Partial<Record<TKey, number>> => {
  const record = createPrivateRecord<Partial<Record<TKey, number>>>();
  privateMapForEach(counts, (count, key) => {
    record[key] = count;
  });
  return record;
};

const createUsageReporter = (
  channel: WorkerSupportChannel,
  bus: WorkerBus,
): WorkerRuntimeSupport["markSurfaceUsed"] => {
  const callCounts = createPrivateMap<XRaySurfaceCategory, number>();
  const methodCounts = createPrivateMap<SpoofingSurfaceMethodId, number>();
  const enqueueMicrotask = globalThis.queueMicrotask.bind(globalThis);
  const scheduleTimeout = globalThis.setTimeout.bind(globalThis);
  let dirty = false;
  let flushQueued = false;
  let cooldownActive = false;
  let hasUsage = false;

  const createPayload = () => {
    const categories = createPublicArray<XRaySurfaceCategory>(0);
    privateMapForEach(callCounts, (_count, category) => {
      privateArrayPush(categories, category);
    });
    return createWorkerUsageMessage({
      guard: channel.guard,
      messageType: channel.messageType,
      categories,
      counts: createCountRecord(callCounts),
      methodCounts: createCountRecord(methodCounts),
    });
  };

  const scheduleFlush = (): void => {
    if (cooldownActive || flushQueued) return;
    flushQueued = true;
    enqueueMicrotask(runFlush);
  };

  function runFlush(): void {
    flushQueued = false;
    if (!dirty) return;
    dirty = false;
    bus.post(createPayload());
    cooldownActive = true;
    scheduleTimeout(() => {
      cooldownActive = false;
      if (dirty) scheduleFlush();
    }, 250);
  }

  bus.onPort((port) => {
    if (!hasUsage) return;
    try {
      port.postMessage(createPayload());
    } catch {
      // Ignore disconnected ports.
    }
  });

  return (category, methodId) => {
    privateMapSet(callCounts, category, (privateMapGet(callCounts, category) ?? 0) + 1);
    if (methodId) {
      privateMapSet(
        methodCounts,
        methodId,
        (privateMapGet(methodCounts, methodId) ?? 0) + 1,
      );
    }
    hasUsage = true;
    dirty = true;
    scheduleFlush();
  };
};

const toSerializable = (value: unknown, fallback: unknown): unknown => {
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return fallback;
  }
};

const createWorkerLoggers = (
  snapshot: RuntimeSnapshot,
  channel: WorkerSupportChannel,
  bus: WorkerBus,
): WorkerRuntimeSupport["loggers"] => {
  const emitLog = (
    component: string,
    method: string,
    args: unknown[],
    result: unknown,
  ): void => {
    if (!snapshot.debugMode || !snapshot.logEventName) return;
    bus.post({
      type: channel.runtimeLogType,
      eventName: snapshot.logEventName,
      detail: JSON.stringify({
        component,
        method,
        level: method === "install" ? "verbose" : "info",
        args: toSerializable(args, ["<Unserializable Arguments>"]),
        result: toSerializable(result, "<Unserializable Result>"),
      }),
    });
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
  };
};

const registerWorkerDesc = (
  integrity: ReturnType<typeof createIntegrityRegistry>,
  { target, key, surfaceId, methodId, receiver }: RegisterInput,
): void => {
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
};

export const createWorkerSupport = (
  snapshot: RuntimeSnapshot,
  channel: WorkerSupportChannel,
): WorkerRuntimeSupport => {
  const integrity = createIntegrityRegistry();
  const bus = createWorkerBus();

  return {
    integrity,
    isSharedWorker: bus.isSharedWorker,
    loggers: createWorkerLoggers(snapshot, channel, bus),
    markSurfaceUsed: createUsageReporter(channel, bus),
    register: (input) => registerWorkerDesc(integrity, input),
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
