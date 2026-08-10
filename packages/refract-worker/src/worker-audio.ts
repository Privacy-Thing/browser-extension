import { isFpSurfaceEnabled } from "@privacy-brand/refract-core/fingerprint/surface-guards";
import {
  createNativeSource,
  maskAsNative,
} from "@privacy-brand/refract-core/native/native-mask";

// This local helper intentionally mirrors audio-noise.ts. Importing it into the
// self-referential minified worker graph makes generation alternate between two
// outputs. worker-audio.target.test.ts protects parity with the canonical helper.
const AUDIO_MUTATION_BUDGET = 256;

const xorshift32 = (value: number): number => {
  let next = value >>> 0;
  next ^= next << 13;
  next ^= next >>> 17;
  next ^= next << 5;
  return next >>> 0;
};

const computeFloatDelta = (seed: number, index: number): number => {
  const rng = xorshift32(seed ^ (index * 2654435761));
  return ((rng >>> 16) / 65536 - 0.5) * 0.0002;
};

type IndexConversion = readonly [argument: number, normalized: () => number];

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
  return [argument, () => normalizedValue];
};

class WorkerAudioPatch {
  readonly #nativeCopyFrom: typeof AudioBuffer.prototype.copyFromChannel;
  readonly #nativeCopyTo: typeof AudioBuffer.prototype.copyToChannel;
  readonly #nativeGet: typeof AudioBuffer.prototype.getChannelData;
  readonly #perturbed = new WeakMap<AudioBuffer, Set<number>>();
  readonly #proto = AudioBuffer.prototype;
  readonly #seed: number;

  constructor(seed: number) {
    this.#seed = seed;
    this.#nativeGet = this.#proto.getChannelData;
    this.#nativeCopyFrom = this.#proto.copyFromChannel;
    this.#nativeCopyTo = this.#proto.copyToChannel;
  }

  install(): void {
    this.#installChannelData();
    this.#installCopyFrom();
    this.#installCopyTo();
  }

  #getChannels(buffer: AudioBuffer): Set<number> {
    const existing = this.#perturbed.get(buffer);
    if (existing) return existing;
    const channels = new Set<number>();
    this.#perturbed.set(buffer, channels);
    return channels;
  }

  #forEachMutation(
    channelLength: number,
    range: readonly [start: number, end: number],
    mutate: (index: number) => void,
  ): void {
    if (channelLength <= 0) return;
    const start = Math.max(0, Math.min(channelLength, Math.trunc(range[0])));
    const end = Math.max(start, Math.min(channelLength, Math.trunc(range[1])));
    const budget = Math.min(channelLength, AUDIO_MUTATION_BUDGET);
    const stride = Math.max(1, Math.ceil(channelLength / budget));
    const offset = stride > 1 ? this.#seed % stride : 0;
    const first =
      offset < start ? offset + Math.ceil((start - offset) / stride) * stride : offset;
    for (let index = first; index < end; index += stride) mutate(index);
  }

  #perturbRange(data: Float32Array, start: number, end: number): void {
    this.#forEachMutation(data.length, [start, end], (index) => {
      data[index] = data[index]! + computeFloatDelta(this.#seed, index);
    });
  }

  #installChannelData(): void {
    const patch = this;
    Object.defineProperty(this.#proto, "getChannelData", {
      configurable: true,
      writable: true,
      value: maskAsNative(
        {
          getChannelData(this: AudioBuffer, channel: number) {
            const conversion = captureIndexConversion(channel);
            const data = Reflect.apply(patch.#nativeGet, this, [conversion[0]]);
            const channelIndex = conversion[1]();
            const channels = patch.#getChannels(this);
            if (!channels.has(channelIndex)) {
              patch.#perturbRange(data, 0, data.length);
              channels.add(channelIndex);
            }
            return data;
          },
        }.getChannelData,
        createNativeSource("getChannelData"),
      ),
    });
  }

  #installCopyFrom(): void {
    if (typeof this.#nativeCopyFrom !== "function") return;
    const patch = this;
    Object.defineProperty(this.#proto, "copyFromChannel", {
      configurable: true,
      writable: true,
      value: maskAsNative(
        {
          copyFromChannel(
            this: AudioBuffer,
            destination: Float32Array,
            channel: number,
            startInChannel = 0,
          ): void {
            const channelConversion = captureIndexConversion(channel);
            const startConversion = captureIndexConversion(startInChannel);
            Reflect.apply(patch.#nativeCopyFrom, this, [
              destination,
              channelConversion[0],
              startConversion[0],
            ]);
            if (!patch.#getChannels(this).has(channelConversion[1]())) {
              const start = startConversion[1]();
              const copiedLength = Math.min(
                destination.length,
                Math.max(0, this.length - start),
              );
              patch.#forEachMutation(
                this.length,
                [start, start + copiedLength],
                (sourceIndex) => {
                  const destinationIndex = sourceIndex - start;
                  destination[destinationIndex] =
                    destination[destinationIndex]! +
                    computeFloatDelta(patch.#seed, sourceIndex);
                },
              );
            }
          },
        }.copyFromChannel,
        createNativeSource("copyFromChannel"),
        2,
      ),
    });
  }

  #installCopyTo(): void {
    if (typeof this.#nativeCopyTo !== "function") return;
    const patch = this;
    Object.defineProperty(this.#proto, "copyToChannel", {
      configurable: true,
      writable: true,
      value: maskAsNative(
        {
          copyToChannel(
            this: AudioBuffer,
            source: Float32Array,
            channel: number,
            startInChannel = 0,
          ): void {
            const channelConversion = captureIndexConversion(channel);
            const startConversion = captureIndexConversion(startInChannel);
            Reflect.apply(patch.#nativeCopyTo, this, [
              source,
              channelConversion[0],
              startConversion[0],
            ]);
            if (patch.#getChannels(this).has(channelConversion[1]())) {
              const data = Reflect.apply(patch.#nativeGet, this, [
                channelConversion[0],
              ]);
              const start = startConversion[1]();
              const sourceIsTargetRange =
                source.buffer === data.buffer &&
                source.byteOffset ===
                  data.byteOffset + start * Float32Array.BYTES_PER_ELEMENT;
              if (!sourceIsTargetRange) {
                patch.#perturbRange(
                  data,
                  start,
                  Math.min(data.length, start + source.length),
                );
              }
            }
          },
        }.copyToChannel,
        createNativeSource("copyToChannel"),
        2,
      ),
    });
  }
}

export const installWorkerAudioPatch = (snapshot: any, logger: any): void => {
  const audioSeed = snapshot.fingerprint?.audioNoiseSeed;
  if (
    audioSeed === undefined ||
    !isFpSurfaceEnabled(snapshot.fingerprint, "audio") ||
    typeof AudioBuffer === "undefined"
  ) {
    return;
  }
  logger("install", [], { seed: audioSeed });
  new WorkerAudioPatch(audioSeed).install();
};
