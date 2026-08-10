/** Audio analyser and AudioBuffer fingerprint-noise patch. */

import {
  createLogger,
  createOnceLogger,
} from "@privacy-brand/refract-browser/common/debug-logger";
import { markSurfaceUsed } from "@privacy-brand/refract-browser/common/surface-usage-emitter";
import {
  perturbAnalyserByteData,
  perturbAnalyserFloatData,
  perturbAudioChannelCopy,
  perturbAudioChannelData,
  perturbAudioRange,
} from "@privacy-brand/refract-core/fingerprint/audio-noise";
import { isFpSurfaceEnabled } from "@privacy-brand/refract-core/fingerprint/surface-guards";
import {
  createNativeSource,
  maskAsNative,
} from "@privacy-brand/refract-core/native/native-mask";
import {
  inspectPatchAnchors,
  markPatchAnchor,
} from "@privacy-brand/refract-core/runtime/patch-marker";

import type { AudioIntegrityOwnership } from "@/injection/main/surface-integrity";
import type { RuntimeSnapshot, SpoofingSurfaceMethodId } from "@/shared/types";

const AUDIO_PATCH_MARKER_KEY = `${__PT_SHIM_GUARD_KEY__}:audio`;
type AudioLogger = ReturnType<typeof createOnceLogger>;

const noAudioOwnership = (): AudioIntegrityOwnership => ({
  analyserNode: false,
  audioBuffer: false,
});

const readAnalyserSize = (
  analyser: AnalyserNode,
  nativeGetter: (() => number) | undefined,
  fallback: () => number,
): number => (nativeGetter ? Reflect.apply(nativeGetter, analyser, []) : fallback());

type AnalyserPatchInput<TArray extends Float32Array | Uint8Array> = {
  analyserProto: AnalyserNode;
  key:
    | "getFloatFrequencyData"
    | "getByteFrequencyData"
    | "getFloatTimeDomainData"
    | "getByteTimeDomainData";
  nativeSizeGetter: (() => number) | undefined;
  fallbackSize: (analyser: AnalyserNode) => number;
  perturb: (data: TArray, count: number, seed: number) => void;
  seed: number;
  methodId: SpoofingSurfaceMethodId;
  logOnce: AudioLogger;
  markAnchor?: boolean;
};

const installAnalyserMethod = <TArray extends Float32Array | Uint8Array>({
  analyserProto,
  key,
  nativeSizeGetter,
  fallbackSize,
  perturb,
  seed,
  methodId,
  logOnce,
  markAnchor = false,
}: AnalyserPatchInput<TArray>): void => {
  const nativeMethod = analyserProto[key] as (
    this: AnalyserNode,
    array: TArray,
  ) => void;
  const patchedMethod = function (this: AnalyserNode, array: TArray): void {
    Reflect.apply(nativeMethod, this, [array]);
    const mutated = Math.min(
      array.length,
      readAnalyserSize(this, nativeSizeGetter, () => fallbackSize(this)),
    );
    perturb(array, mutated, seed);
    markSurfaceUsed("audio", methodId);
    logOnce(key, [{ length: array.length }], { mutated });
  };
  const maskedMethod = maskAsNative(patchedMethod, createNativeSource(key), 1);
  if (markAnchor) markPatchAnchor(maskedMethod, AUDIO_PATCH_MARKER_KEY, key);
  Object.defineProperty(analyserProto, key, {
    configurable: true,
    writable: true,
    value: maskedMethod,
  });
};

const installAnalyserPatch = (seed: number, logOnce: AudioLogger): void => {
  if (typeof AnalyserNode === "undefined") return;
  const analyserProto = AnalyserNode.prototype;
  const binCountGetter = Object.getOwnPropertyDescriptor(
    analyserProto,
    "frequencyBinCount",
  )?.get;
  const fftSizeGetter = Object.getOwnPropertyDescriptor(analyserProto, "fftSize")?.get;
  installAnalyserMethod({
    analyserProto,
    key: "getFloatFrequencyData",
    nativeSizeGetter: binCountGetter,
    fallbackSize: (analyser) => analyser.frequencyBinCount,
    perturb: perturbAnalyserFloatData,
    seed,
    methodId: "audio.getFloatFrequencyData",
    logOnce,
    markAnchor: true,
  });
  installAnalyserMethod({
    analyserProto,
    key: "getByteFrequencyData",
    nativeSizeGetter: binCountGetter,
    fallbackSize: (analyser) => analyser.frequencyBinCount,
    perturb: perturbAnalyserByteData,
    seed,
    methodId: "audio.getByteFrequencyData",
    logOnce,
  });
  installAnalyserMethod({
    analyserProto,
    key: "getFloatTimeDomainData",
    nativeSizeGetter: fftSizeGetter,
    fallbackSize: (analyser) => analyser.fftSize,
    perturb: perturbAnalyserFloatData,
    seed,
    methodId: "audio.getFloatTimeDomainData",
    logOnce,
  });
  installAnalyserMethod({
    analyserProto,
    key: "getByteTimeDomainData",
    nativeSizeGetter: fftSizeGetter,
    fallbackSize: (analyser) => analyser.fftSize,
    perturb: perturbAnalyserByteData,
    seed,
    methodId: "audio.getByteTimeDomainData",
    logOnce,
  });
};

type IndexConversion = {
  argument: number;
  normalized: () => number;
};

const captureIndexConversion = (value: number): IndexConversion => {
  let converted = false;
  let numberValue = 0;
  let normalizedValue = 0;
  const argument = {
    [Symbol.toPrimitive](): number {
      if (!converted) {
        numberValue = +value;
        normalizedValue = numberValue >>> 0;
        converted = true;
      }
      return numberValue;
    },
  } as unknown as number;
  return { argument, normalized: () => normalizedValue };
};

type AudioBufferContext = {
  proto: AudioBuffer;
  nativeGet: typeof AudioBuffer.prototype.getChannelData;
  nativeCopyFrom: typeof AudioBuffer.prototype.copyFromChannel;
  nativeCopyTo: typeof AudioBuffer.prototype.copyToChannel;
  perturbedChannels: WeakMap<AudioBuffer, Set<number>>;
  seed: number;
  logOnce: AudioLogger;
};

const getPerturbedChannels = (
  context: AudioBufferContext,
  buffer: AudioBuffer,
): Set<number> => {
  const existing = context.perturbedChannels.get(buffer);
  if (existing) return existing;
  const channels = new Set<number>();
  context.perturbedChannels.set(buffer, channels);
  return channels;
};

const installChannelData = (context: AudioBufferContext): void => {
  const patchedGetChannelData = {
    getChannelData(this: AudioBuffer, channel: number): Float32Array {
      const conversion = captureIndexConversion(channel);
      const data = Reflect.apply(context.nativeGet, this, [conversion.argument]);
      const channelIndex = conversion.normalized();
      const channels = getPerturbedChannels(context, this);
      if (!channels.has(channelIndex)) {
        perturbAudioChannelData(data, context.seed);
        channels.add(channelIndex);
        markSurfaceUsed("audio", "audio.getChannelData");
        context.logOnce("getChannelData", [channel], { length: data.length });
      }
      return data;
    },
  }.getChannelData;
  const maskedMethod = maskAsNative(
    patchedGetChannelData,
    createNativeSource("getChannelData"),
    1,
  );
  markPatchAnchor(maskedMethod, AUDIO_PATCH_MARKER_KEY, "getChannelData");
  Object.defineProperty(context.proto, "getChannelData", {
    configurable: true,
    writable: true,
    value: maskedMethod,
  });
};

const installCopyFromChannel = (context: AudioBufferContext): void => {
  if (typeof context.nativeCopyFrom !== "function") return;
  const patchedMethod = {
    copyFromChannel(
      this: AudioBuffer,
      destination: Float32Array,
      channel: number,
      startInChannel = 0,
    ): void {
      const channelConversion = captureIndexConversion(channel);
      const startConversion = captureIndexConversion(startInChannel);
      Reflect.apply(context.nativeCopyFrom, this, [
        destination,
        channelConversion.argument,
        startConversion.argument,
      ]);
      const channelIndex = channelConversion.normalized();
      if (!getPerturbedChannels(context, this).has(channelIndex)) {
        const start = startConversion.normalized();
        perturbAudioChannelCopy({
          destination,
          seed: context.seed,
          channelLength: this.length,
          startInChannel: start,
          copiedLength: Math.min(destination.length, Math.max(0, this.length - start)),
        });
      }
      markSurfaceUsed("audio");
      context.logOnce("copyFromChannel", [channel, startInChannel], {
        length: destination.length,
      });
    },
  }.copyFromChannel;
  Object.defineProperty(context.proto, "copyFromChannel", {
    configurable: true,
    writable: true,
    value: maskAsNative(patchedMethod, createNativeSource("copyFromChannel"), 2),
  });
};

const installCopyToChannel = (context: AudioBufferContext): void => {
  if (typeof context.nativeCopyTo !== "function") return;
  const patchedMethod = {
    copyToChannel(
      this: AudioBuffer,
      source: Float32Array,
      channel: number,
      startInChannel = 0,
    ): void {
      const channelConversion = captureIndexConversion(channel);
      const startConversion = captureIndexConversion(startInChannel);
      Reflect.apply(context.nativeCopyTo, this, [
        source,
        channelConversion.argument,
        startConversion.argument,
      ]);
      const channelIndex = channelConversion.normalized();
      if (getPerturbedChannels(context, this).has(channelIndex)) {
        const data = Reflect.apply(context.nativeGet, this, [
          channelConversion.argument,
        ]);
        const start = startConversion.normalized();
        const sourceIsTargetRange =
          source.buffer === data.buffer &&
          source.byteOffset ===
            data.byteOffset + start * Float32Array.BYTES_PER_ELEMENT;
        if (!sourceIsTargetRange) {
          perturbAudioRange(
            data,
            context.seed,
            start,
            Math.min(data.length, start + source.length),
          );
        }
      }
      context.logOnce("copyToChannel", [channel, startInChannel], {
        length: source.length,
      });
    },
  }.copyToChannel;
  Object.defineProperty(context.proto, "copyToChannel", {
    configurable: true,
    writable: true,
    value: maskAsNative(patchedMethod, createNativeSource("copyToChannel"), 2),
  });
};

const installAudioBufferPatch = (seed: number, logOnce: AudioLogger): void => {
  if (typeof AudioBuffer === "undefined") return;
  const proto = AudioBuffer.prototype;
  const context: AudioBufferContext = {
    proto,
    nativeGet: proto.getChannelData,
    nativeCopyFrom: proto.copyFromChannel,
    nativeCopyTo: proto.copyToChannel,
    perturbedChannels: new WeakMap(),
    seed,
    logOnce,
  };
  installChannelData(context);
  installCopyFromChannel(context);
  installCopyToChannel(context);
};

export const installAudioPatch = (
  snapshot: RuntimeSnapshot,
): AudioIntegrityOwnership => {
  const seed = snapshot.fingerprint?.audioNoiseSeed;
  if (seed === undefined || !isFpSurfaceEnabled(snapshot.fingerprint, "audio")) {
    return noAudioOwnership();
  }
  const anchors = [
    ...(typeof AnalyserNode !== "undefined"
      ? [
          {
            fn: AnalyserNode.prototype.getFloatFrequencyData,
            name: "getFloatFrequencyData",
          },
        ]
      : []),
    ...(typeof AudioBuffer !== "undefined"
      ? [{ fn: AudioBuffer.prototype.getChannelData, name: "getChannelData" }]
      : []),
  ];
  const anchorState = inspectPatchAnchors(AUDIO_PATCH_MARKER_KEY, anchors);
  if (anchorState === "installed") {
    return {
      analyserNode: typeof AnalyserNode !== "undefined",
      audioBuffer: typeof AudioBuffer !== "undefined",
    };
  }
  if (anchorState === "conflict") {
    throw new Error("Conflicting Audio patch anchors");
  }
  const logAudio = createLogger(snapshot, "Audio");
  const logOnce = createOnceLogger(snapshot, "Audio");
  logAudio("install", [], { seed });
  installAnalyserPatch(seed, logOnce);
  installAudioBufferPatch(seed, logOnce);
  return {
    analyserNode: typeof AnalyserNode !== "undefined",
    audioBuffer: typeof AudioBuffer !== "undefined",
  };
};
