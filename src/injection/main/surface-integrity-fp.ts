import {
  privateOwnDescriptor,
  privateReflectApply,
  privateReflectConstruct,
} from "@privacy-brand/refract-core/runtime/primordials";

import {
  findPropertyOwner,
  registerDescriptor,
  type RuntimeIntegrityContext,
} from "./surface-integrity-base";

import type { SpoofingSurfaceKey } from "@/shared/spoofing-surfaces";
import type { SpoofingSurfaceMethodId } from "@/shared/types";

type DescriptorTarget = {
  target: object | null | undefined;
  receiver?: object | undefined;
  resolveReceiver?: (() => object | null) | undefined;
  methods: ReadonlyArray<{
    key: PropertyKey;
    methodId?: SpoofingSurfaceMethodId;
  }>;
};

export type FingerprintReceivers = {
  htmlCanvas?: (() => object | null) | undefined;
  canvas2D?: (() => object | null) | undefined;
  offscreenCanvas?: (() => object | null) | undefined;
  offscreenCanvas2D?: (() => object | null) | undefined;
  webGL?: (() => object | null) | undefined;
  webGL2?: (() => object | null) | undefined;
  analyserNode?: (() => object | null) | undefined;
  audioBuffer?: (() => object | null) | undefined;
};

export type CanvasIntegrityOwnership = {
  htmlCanvas: boolean;
  context2D: boolean;
  offscreenCanvas: boolean;
  offscreenContext2D: boolean;
};

export type AudioIntegrityOwnership = {
  analyserNode: boolean;
  audioBuffer: boolean;
};

export type WebGLIntegrityOwnership = {
  webGL1Common: boolean;
  webGL1ReadPixels: boolean;
  webGL2Common: boolean;
  webGL2ReadPixels: boolean;
};

export type WebRTCIntegrityOwnership = {
  standardConstructor: boolean;
  webkitConstructor: boolean;
  createOffer: boolean;
  createAnswer: boolean;
  setConfiguration: boolean;
};

export type FingerprintOwnership =
  | { surfaceId: "canvas"; ownership: CanvasIntegrityOwnership }
  | { surfaceId: "audio"; ownership: AudioIntegrityOwnership }
  | { surfaceId: "webGL"; ownership: WebGLIntegrityOwnership }
  | { surfaceId: "webRTC"; ownership: WebRTCIntegrityOwnership };

type RuntimeMediaGlobal = typeof globalThis & Record<string, any>;

const createRetryingReceiver = (
  factory: () => object | null,
): (() => object | null) => {
  let receiver: object | null = null;
  return () => {
    if (receiver) return receiver;
    try {
      receiver = factory();
    } catch {
      receiver = null;
    }
    return receiver;
  };
};

const captureCanvasReceivers = (
  targetGlobal: typeof globalThis,
  runtimeGlobal: RuntimeMediaGlobal,
  receivers: FingerprintReceivers,
): void => {
  const documentObject = targetGlobal.document;
  const createElement = documentObject?.createElement;
  const htmlCanvasPrototype = runtimeGlobal.HTMLCanvasElement?.prototype;
  const canvasGetContext = htmlCanvasPrototype
    ? privateOwnDescriptor(htmlCanvasPrototype, "getContext")?.value
    : undefined;
  if (documentObject && typeof createElement === "function") {
    receivers.htmlCanvas = createRetryingReceiver(
      () => privateReflectApply(createElement, documentObject, ["canvas"]) as object,
    );
    if (typeof canvasGetContext === "function") {
      receivers.canvas2D = createRetryingReceiver(() => {
        const canvas = privateReflectApply(createElement, documentObject, ["canvas"]);
        return privateReflectApply(canvasGetContext, canvas, ["2d"]) as object | null;
      });
    }
  }
  const OffscreenCanvasCtor = runtimeGlobal.OffscreenCanvas;
  const offscreenGetContext =
    typeof OffscreenCanvasCtor === "function"
      ? privateOwnDescriptor(OffscreenCanvasCtor.prototype, "getContext")?.value
      : undefined;
  if (typeof OffscreenCanvasCtor !== "function") return;
  receivers.offscreenCanvas = createRetryingReceiver(() =>
    privateReflectConstruct(OffscreenCanvasCtor, [1, 1]),
  );
  if (typeof offscreenGetContext === "function") {
    receivers.offscreenCanvas2D = createRetryingReceiver(() => {
      const canvas = privateReflectConstruct<object>(OffscreenCanvasCtor, [1, 1]);
      return privateReflectApply(offscreenGetContext, canvas, ["2d"]) as object | null;
    });
  }
};

const captureWebGLReceivers = (
  targetGlobal: typeof globalThis,
  runtimeGlobal: RuntimeMediaGlobal,
  receivers: FingerprintReceivers,
): void => {
  const documentObject = targetGlobal.document;
  const createElement = documentObject?.createElement;
  const htmlCanvasPrototype = runtimeGlobal.HTMLCanvasElement?.prototype;
  const canvasGetContext = htmlCanvasPrototype
    ? privateOwnDescriptor(htmlCanvasPrototype, "getContext")?.value
    : undefined;
  if (
    !documentObject ||
    typeof createElement !== "function" ||
    typeof canvasGetContext !== "function"
  ) {
    return;
  }
  const registerContextFactory = (
    key: "webGL" | "webGL2",
    contextId: "webgl" | "webgl2",
    constructorKey: "WebGLRenderingContext" | "WebGL2RenderingContext",
  ): void => {
    const ContextConstructor = runtimeGlobal[constructorKey];
    if (typeof ContextConstructor !== "function") return;
    const nativeGetExtension = privateOwnDescriptor(
      ContextConstructor.prototype,
      "getExtension",
    )?.value;
    receivers[key] = createRetryingReceiver(() => {
      const canvas = privateReflectApply(createElement, documentObject, ["canvas"]);
      const context = privateReflectApply(canvasGetContext, canvas, [contextId]) as
        object | null;
      if (context && typeof nativeGetExtension === "function") {
        releaseWebGLContext(context, nativeGetExtension);
      }
      return context;
    });
  };
  registerContextFactory("webGL", "webgl", "WebGLRenderingContext");
  registerContextFactory("webGL2", "webgl2", "WebGL2RenderingContext");
};

const releaseWebGLContext = (
  context: object,
  nativeGetExtension: (...args: any[]) => any,
): void => {
  const extension = privateReflectApply(nativeGetExtension, context, [
    "WEBGL_lose_context",
  ]) as object | null;
  const extensionOwner = extension
    ? findPropertyOwner(extension, "loseContext")
    : undefined;
  const loseContext = extensionOwner
    ? privateOwnDescriptor(extensionOwner, "loseContext")?.value
    : undefined;
  if (typeof loseContext === "function") {
    privateReflectApply(loseContext, extension, []);
  }
};

const captureAudioReceivers = (
  runtimeGlobal: RuntimeMediaGlobal,
  receivers: FingerprintReceivers,
): void => {
  if (typeof runtimeGlobal.OfflineAudioContext !== "function") return;
  const OfflineAudioCtor = runtimeGlobal.OfflineAudioContext;
  const basePrototype = runtimeGlobal.BaseAudioContext?.prototype;
  const createAnalyser = basePrototype
    ? privateOwnDescriptor(basePrototype, "createAnalyser")?.value
    : undefined;
  const createBuffer = basePrototype
    ? privateOwnDescriptor(basePrototype, "createBuffer")?.value
    : undefined;
  const createContext = (): object =>
    privateReflectConstruct(OfflineAudioCtor, [1, 1, 8_000]);
  if (typeof createAnalyser === "function") {
    receivers.analyserNode = createRetryingReceiver(
      () => privateReflectApply(createAnalyser, createContext(), []) as object,
    );
  }
  if (typeof createBuffer === "function") {
    receivers.audioBuffer = createRetryingReceiver(
      () => privateReflectApply(createBuffer, createContext(), [1, 1, 8_000]) as object,
    );
  }
};

export const captureFpReceivers = (
  targetGlobal: typeof globalThis,
  surfaceId: "audio" | "canvas" | "webGL",
): FingerprintReceivers => {
  const runtimeGlobal = targetGlobal as RuntimeMediaGlobal;
  const receivers: FingerprintReceivers = {};
  try {
    if (surfaceId === "canvas") {
      captureCanvasReceivers(targetGlobal, runtimeGlobal, receivers);
    } else if (surfaceId === "webGL") {
      captureWebGLReceivers(targetGlobal, runtimeGlobal, receivers);
    } else {
      captureAudioReceivers(runtimeGlobal, receivers);
    }
  } catch {
    // Descriptor anchors still report unavailable receivers.
  }
  return receivers;
};

const registerTargets = (
  integrity: RuntimeIntegrityContext,
  surfaceId: SpoofingSurfaceKey,
  targets: readonly DescriptorTarget[],
): void => {
  for (const { methods, receiver, resolveReceiver, target } of targets) {
    if (!target) continue;
    for (const { key, methodId } of methods) {
      registerDescriptor({
        integrity,
        target,
        key,
        anchor: {
          surfaceId,
          ...(methodId ? { methodId } : {}),
          ...(receiver ? { receiver } : {}),
          ...(resolveReceiver
            ? { resolveReceiver, unavailableReason: "target-not-ready" as const }
            : {}),
        },
      });
    }
  }
};

const unavailableFpReceiver = (): null => null;

const registerCanvasIntegrity = (
  integrity: RuntimeIntegrityContext,
  runtimeGlobal: RuntimeMediaGlobal,
  ownership: CanvasIntegrityOwnership,
  receivers: FingerprintReceivers,
): void => {
  registerTargets(integrity, "canvas", [
    {
      target: ownership.htmlCanvas
        ? runtimeGlobal.HTMLCanvasElement?.prototype
        : undefined,
      resolveReceiver: receivers.htmlCanvas ?? unavailableFpReceiver,
      methods: [
        { key: "getContext" },
        { key: "height" },
        { key: "toBlob", methodId: "canvas.toBlob" },
        { key: "toDataURL", methodId: "canvas.toDataURL" },
        { key: "width" },
      ],
    },
    {
      target: ownership.context2D
        ? runtimeGlobal.CanvasRenderingContext2D?.prototype
        : undefined,
      resolveReceiver: receivers.canvas2D ?? unavailableFpReceiver,
      methods: [
        { key: "getImageData", methodId: "canvas.getImageData" },
        { key: "putImageData" },
      ],
    },
    {
      target: ownership.offscreenCanvas
        ? runtimeGlobal.OffscreenCanvas?.prototype
        : undefined,
      resolveReceiver: receivers.offscreenCanvas ?? unavailableFpReceiver,
      methods: [
        { key: "convertToBlob" },
        { key: "getContext" },
        { key: "height" },
        { key: "width" },
      ],
    },
    {
      target: ownership.offscreenContext2D
        ? runtimeGlobal.OffscreenCanvasRenderingContext2D?.prototype
        : undefined,
      resolveReceiver: receivers.offscreenCanvas2D ?? unavailableFpReceiver,
      methods: [
        { key: "getImageData", methodId: "canvas.getImageData" },
        { key: "putImageData" },
      ],
    },
  ]);
};

const registerWebGLIntegrity = (
  integrity: RuntimeIntegrityContext,
  runtimeGlobal: RuntimeMediaGlobal,
  ownership: WebGLIntegrityOwnership,
  receivers: FingerprintReceivers,
): void => {
  const commonMethods = [
    { key: "getError" },
    { key: "getExtension", methodId: "webGL.getExtension" },
    { key: "getSupportedExtensions", methodId: "webGL.getSupportedExtensions" },
    { key: "getParameter", methodId: "webGL.getParameter" },
  ] as const;
  registerTargets(integrity, "webGL", [
    {
      target: ownership.webGL1Common
        ? runtimeGlobal.WebGLRenderingContext?.prototype
        : undefined,
      resolveReceiver: receivers.webGL ?? unavailableFpReceiver,
      methods: commonMethods,
    },
    {
      target: ownership.webGL1ReadPixels
        ? runtimeGlobal.WebGLRenderingContext?.prototype
        : undefined,
      resolveReceiver: receivers.webGL ?? unavailableFpReceiver,
      methods: [{ key: "readPixels", methodId: "webGL.readPixels" }],
    },
    {
      target: ownership.webGL2Common
        ? runtimeGlobal.WebGL2RenderingContext?.prototype
        : undefined,
      resolveReceiver: receivers.webGL2 ?? unavailableFpReceiver,
      methods: commonMethods,
    },
    {
      target: ownership.webGL2ReadPixels
        ? runtimeGlobal.WebGL2RenderingContext?.prototype
        : undefined,
      resolveReceiver: receivers.webGL2 ?? unavailableFpReceiver,
      methods: [{ key: "readPixels", methodId: "webGL.readPixels" }],
    },
  ]);
};

const registerAudioIntegrity = (
  integrity: RuntimeIntegrityContext,
  runtimeGlobal: RuntimeMediaGlobal,
  ownership: AudioIntegrityOwnership,
  receivers: FingerprintReceivers,
): void => {
  registerTargets(integrity, "audio", [
    {
      target: ownership.analyserNode
        ? runtimeGlobal.AnalyserNode?.prototype
        : undefined,
      resolveReceiver: receivers.analyserNode ?? unavailableFpReceiver,
      methods: [
        { key: "getByteFrequencyData", methodId: "audio.getByteFrequencyData" },
        { key: "getByteTimeDomainData", methodId: "audio.getByteTimeDomainData" },
        { key: "getFloatFrequencyData", methodId: "audio.getFloatFrequencyData" },
        { key: "getFloatTimeDomainData", methodId: "audio.getFloatTimeDomainData" },
      ],
    },
    {
      target: ownership.audioBuffer ? runtimeGlobal.AudioBuffer?.prototype : undefined,
      resolveReceiver: receivers.audioBuffer ?? unavailableFpReceiver,
      methods: [
        { key: "copyFromChannel" },
        { key: "copyToChannel" },
        { key: "getChannelData", methodId: "audio.getChannelData" },
      ],
    },
  ]);
};

const registerWebRTCIntegrity = (
  integrity: RuntimeIntegrityContext,
  targetGlobal: typeof globalThis,
  runtimeGlobal: RuntimeMediaGlobal,
  ownership: WebRTCIntegrityOwnership,
): void => {
  const peerConnection =
    runtimeGlobal.RTCPeerConnection ?? runtimeGlobal.webkitRTCPeerConnection;
  registerTargets(integrity, "webRTC", [
    {
      target: targetGlobal,
      methods: [
        ...(ownership.standardConstructor
          ? [{ key: "RTCPeerConnection", methodId: "webRTC.constructor" } as const]
          : []),
        ...(ownership.webkitConstructor
          ? [
              {
                key: "webkitRTCPeerConnection",
                methodId: "webRTC.constructor",
              } as const,
            ]
          : []),
      ],
    },
    {
      target: peerConnection?.prototype,
      methods: [
        ...(ownership.createAnswer
          ? [{ key: "createAnswer", methodId: "webRTC.createAnswer" } as const]
          : []),
        ...(ownership.createOffer
          ? [{ key: "createOffer", methodId: "webRTC.createOffer" } as const]
          : []),
        ...(ownership.setConfiguration ? [{ key: "setConfiguration" } as const] : []),
      ],
    },
  ]);
};

export const registerFpIntegrity = (
  integrity: RuntimeIntegrityContext,
  targetGlobal: typeof globalThis,
  installed: FingerprintOwnership,
  receivers: FingerprintReceivers = {},
): void => {
  const runtimeGlobal = targetGlobal as RuntimeMediaGlobal;
  switch (installed.surfaceId) {
    case "canvas":
      registerCanvasIntegrity(integrity, runtimeGlobal, installed.ownership, receivers);
      return;
    case "webGL":
      registerWebGLIntegrity(integrity, runtimeGlobal, installed.ownership, receivers);
      return;
    case "audio":
      registerAudioIntegrity(integrity, runtimeGlobal, installed.ownership, receivers);
      return;
    case "webRTC":
      registerWebRTCIntegrity(
        integrity,
        targetGlobal,
        runtimeGlobal,
        installed.ownership,
      );
  }
};
