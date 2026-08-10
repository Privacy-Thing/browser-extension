import { xorshift32 } from "./canvas-noise";

export const AUDIO_MUTATION_BUDGET = 256;

export const computeFloatDelta = (seed: number, index: number): number => {
  const rng = xorshift32(seed ^ (index * 2654435761));
  return ((rng >>> 16) / 65536 - 0.5) * 0.0002;
};

export const perturbFloat = (value: number, index: number, seed: number): number => {
  if (!Number.isFinite(value)) {
    return value;
  }

  const delta = computeFloatDelta(seed, index);
  return value + (delta === 0 ? 0.000001 : delta);
};

export const perturbByte = (value: number, index: number, seed: number): number => {
  const rng = xorshift32(seed ^ (index * 2654435761));
  let delta: number;
  if (value === 0) {
    delta = 1;
  } else if (value === 255) {
    delta = -1;
  } else {
    delta = (rng & 1) === 0 ? -1 : 1;
  }
  return value + delta;
};

export const perturbAnalyserFloatData = (
  data: Float32Array,
  sampleCount: number,
  seed: number,
): void => {
  const limit = Math.min(data.length, Math.max(0, Math.trunc(sampleCount)));
  for (let index = 0; index < limit; index += 1) {
    const original = data[index]!;
    data[index] = perturbFloat(original, index, seed);
    if (Number.isFinite(original) && data[index] === original) {
      const direction = computeFloatDelta(seed, index) < 0 ? -1 : 1;
      data[index] = original + direction * 0.00001;
    }
  }
};

export const perturbAnalyserByteData = (
  data: Uint8Array,
  sampleCount: number,
  seed: number,
): void => {
  const limit = Math.min(data.length, Math.max(0, Math.trunc(sampleCount)));
  for (let index = 0; index < limit; index += 1) {
    data[index] = perturbByte(data[index]!, index, seed);
  }
};

type AudioMutationInput = {
  channelLength: number;
  seed: number;
  startIndex: number;
  endIndex: number;
  mutate: (index: number) => void;
};

const forEachAudioMutation = ({
  channelLength,
  seed,
  startIndex,
  endIndex,
  mutate,
}: AudioMutationInput): void => {
  if (channelLength <= 0) {
    return;
  }

  const start = Math.max(0, Math.min(channelLength, Math.trunc(startIndex)));
  const end = Math.max(start, Math.min(channelLength, Math.trunc(endIndex)));
  const budget = Math.min(channelLength, AUDIO_MUTATION_BUDGET);
  const stride = Math.max(1, Math.ceil(channelLength / budget));
  const offset = stride > 1 ? seed % stride : 0;
  const firstIndex =
    offset < start ? offset + Math.ceil((start - offset) / stride) * stride : offset;

  for (let index = firstIndex; index < end; index += stride) {
    mutate(index);
  }
};

/**
 * In-place perturb an `AudioBuffer` channel's PCM samples. The mutation count is
 * hard-capped at {@link AUDIO_MUTATION_BUDGET}: a seed-offset, evenly
 * strided subset of samples is nudged so the cost stays bounded even for very
 * large buffers (multi-second audio). Single-sourced here and consumed by every
 * runtime that patches `AudioBuffer.getChannelData` (main world + worker), so the
 * spoofed sample fingerprint stays byte-for-byte identical across surfaces.
 */
export const perturbAudioChannelData = (data: Float32Array, seed: number): void => {
  perturbAudioRange(data, seed, 0, data.length);
};

export const perturbAudioRange = (
  data: Float32Array,
  seed: number,
  startIndex: number,
  endIndex: number,
): void => {
  forEachAudioMutation({
    channelLength: data.length,
    seed,
    startIndex,
    endIndex,
    mutate: (index) => {
      data[index] = data[index]! + computeFloatDelta(seed, index);
    },
  });
};

type AudioChannelCopyInput = {
  destination: Float32Array;
  seed: number;
  channelLength: number;
  startInChannel: number;
  copiedLength: number;
};

export const perturbAudioChannelCopy = ({
  destination,
  seed,
  channelLength,
  startInChannel,
  copiedLength,
}: AudioChannelCopyInput): void => {
  const copyEnd = Math.min(
    channelLength,
    startInChannel + Math.min(destination.length, Math.max(0, copiedLength)),
  );
  forEachAudioMutation({
    channelLength,
    seed,
    startIndex: startInChannel,
    endIndex: copyEnd,
    mutate: (channelIndex) => {
      const destinationIndex = channelIndex - startInChannel;
      destination[destinationIndex] =
        destination[destinationIndex]! + computeFloatDelta(seed, channelIndex);
    },
  });
};

export const AUDIO_NOISE_SOURCE = [
  "      const computeFloatDelta = (seed, index) => {",
  "        const rng = xorshift(seed ^ (index * 2654435761));",
  "        return ((rng >>> 16) / 65536 - 0.5) * 0.0002;",
  "      };",
  "      const perturbFloat = (value, index, seed) => {",
  "        if (!Number.isFinite(value)) {",
  "          return value;",
  "        }",
  "        const delta = computeFloatDelta(seed, index);",
  "        return value + (delta === 0 ? 0.000001 : delta);",
  "      };",
  "      const perturbByte = (value, index, seed) => {",
  "        const rng = xorshift(seed ^ (index * 2654435761));",
  "        const delta = value === 0 ? 1 : value === 255 ? -1 : (rng & 1) === 0 ? -1 : 1;",
  "        return value + delta;",
  "      };",
  `      const AUDIO_MUTATION_BUDGET = ${AUDIO_MUTATION_BUDGET};`,
].join("\n");

export const WORKER_AUDIO_SOURCE = [
  '    if (audioSeed !== undefined && isFpSurfaceEnabled(snapshot.fingerprint, "audio")) {',
  AUDIO_NOISE_SOURCE,
  "",
  '      if (typeof AudioBuffer !== "undefined") {',
  "        const nativeGetChannelData = AudioBuffer.prototype.getChannelData;",
  "        const perturbedBuffers = new WeakSet();",
  '        Object.defineProperty(AudioBuffer.prototype, "getChannelData", {',
  "          configurable: true,",
  "          writable: true,",
  "          value: maskAsNative({ getChannelData(channel) {",
  "            const data = Reflect.apply(nativeGetChannelData, this, [channel]);",
  "            if (!perturbedBuffers.has(data)) {",
  "              perturbedBuffers.add(data);",
  "              if (data.length > 0) {",
  "                const budget = Math.min(data.length, AUDIO_MUTATION_BUDGET);",
  "                const stride = Math.max(1, Math.ceil(data.length / budget));",
  "                const offset = stride > 1 ? audioSeed % stride : 0;",
  "                for (",
  "                  let index = offset, mutations = 0;",
  "                  index < data.length && mutations < budget;",
  "                  index += stride, mutations++",
  "                ) {",
  "                  data[index] = data[index] + computeFloatDelta(audioSeed, index);",
  "                }",
  "              }",
  "            }",
  "            return data;",
  '          } }.getChannelData, createNativeSource("getChannelData"))',
  "        });",
  "      }",
  "    }",
].join("\n");
