import {
  perturbAudioChannelData,
  perturbAudioRange,
} from "@privacy-brand/refract-core";
import { installWorkerAudioPatch } from "@privacy-brand/refract-worker/worker-audio";
import { afterEach, describe, expect, it } from "vitest";

/**
 * The worker keeps a *local* copy of the budgeted `getChannelData` mutation
 * because importing the shared `perturbAudioChannelData` destabilizes esbuild's
 * deterministic minification of the worker bundle (see the NOTE in
 * `packages/refract-worker/src/worker-audio.ts`). These tests drive the real
 * `installWorkerAudioPatch` against a mocked `AudioBuffer` and assert byte-for-byte
 * parity with the canonical helper, so any drift between the two copies fails CI.
 */

const SEED = 0x1357_9bdf;
const LENGTH = 5_000; // > AUDIO_MUTATION_BUDGET so the stride/offset path runs

const makeSamples = (): Float32Array => {
  const data = new Float32Array(LENGTH);
  for (let index = 0; index < LENGTH; index += 1) {
    data[index] = Math.sin(index) * 0.5;
  }
  return data;
};

const originalAudioBuffer = Object.getOwnPropertyDescriptor(globalThis, "AudioBuffer");

afterEach(() => {
  if (originalAudioBuffer) {
    Object.defineProperty(globalThis, "AudioBuffer", originalAudioBuffer);
  } else {
    delete (globalThis as { AudioBuffer?: unknown }).AudioBuffer;
  }
});

const installWithMockAudio = (
  samples: Float32Array,
): {
  instance: {
    readonly length: number;
    getChannelData(channel: number): Float32Array;
    copyFromChannel(destination: Float32Array, channel: number, start?: number): void;
    copyToChannel(source: Float32Array, channel: number, start?: number): void;
  };
} => {
  class FakeAudioBuffer {
    constructor(private readonly channel0: Float32Array) {}
    get length(): number {
      return this.channel0.length;
    }
    getChannelData(_channel: number): Float32Array {
      return this.channel0;
    }
    copyFromChannel(destination: Float32Array, _channel: number, start = 0): void {
      const normalizedStart = Number(start) >>> 0;
      destination.set(
        this.channel0.subarray(
          normalizedStart,
          Math.min(this.length, normalizedStart + destination.length),
        ),
      );
    }
    copyToChannel(source: Float32Array, _channel: number, start = 0): void {
      const normalizedStart = Number(start) >>> 0;
      this.channel0.set(
        source.subarray(0, Math.max(0, this.length - normalizedStart)),
        normalizedStart,
      );
    }
  }

  Object.defineProperty(globalThis, "AudioBuffer", {
    configurable: true,
    writable: true,
    value: FakeAudioBuffer,
  });

  installWorkerAudioPatch({ fingerprint: { audioNoiseSeed: SEED } }, () => {});

  return { instance: new FakeAudioBuffer(samples) };
};

describe("worker AudioBuffer.getChannelData patch", () => {
  it("produces byte-identical output to the canonical perturbAudioChannelData", () => {
    const workerSamples = makeSamples();
    const { instance } = installWithMockAudio(workerSamples);
    const workerResult = instance.getChannelData(0);

    const expected = makeSamples();
    perturbAudioChannelData(expected, SEED);

    expect(Array.from(workerResult)).toEqual(Array.from(expected));
  });

  it("mutates each channel only once", () => {
    const workerSamples = makeSamples();
    const { instance } = installWithMockAudio(workerSamples);

    const firstRead = Array.from(instance.getChannelData(0));
    const secondRead = Array.from(instance.getChannelData(0));

    expect(secondRead).toEqual(firstRead);
  });

  it("keeps copyFromChannel byte-identical to the canonical full-channel output", () => {
    const workerSamples = makeSamples();
    const { instance } = installWithMockAudio(workerSamples);
    const copied = new Float32Array(600);
    instance.copyFromChannel(copied, 0, 1_000);

    const expected = makeSamples();
    perturbAudioChannelData(expected, SEED);
    expect(copied).toEqual(expected.slice(1_000, 1_600));
  });

  it("converts copyFromChannel startInChannel only once", () => {
    const workerSamples = makeSamples();
    const { instance } = installWithMockAudio(workerSamples);
    const copied = new Float32Array(600);
    let reads = 0;
    const start = {
      valueOf(): number {
        reads += 1;
        return reads === 1 ? 1_000 : 2_000;
      },
    } as unknown as number;

    instance.copyFromChannel(copied, 0, start);

    const expected = makeSamples();
    perturbAudioChannelData(expected, SEED);
    expect(reads).toBe(1);
    expect(copied).toEqual(expected.slice(1_000, 1_600));
  });

  it("reapplies the canonical noise schedule after copyToChannel overwrites", () => {
    const workerSamples = makeSamples();
    const { instance } = installWithMockAudio(workerSamples);
    const expected = instance.getChannelData(0).slice();
    const source = new Float32Array(600);
    source.fill(0.25);
    expected.set(source, 1_000);
    perturbAudioRange(expected, SEED, 1_000, 1_600);

    instance.copyToChannel(source, 0, 1_000);

    expect(instance.getChannelData(0)).toEqual(expected);
  });

  it("does not reapply noise when copyToChannel receives the same live range", () => {
    const workerSamples = makeSamples();
    const { instance } = installWithMockAudio(workerSamples);
    const live = instance.getChannelData(0);
    const before = live.slice();

    instance.copyToChannel(live, 0);
    instance.copyToChannel(live.subarray(1_000, 1_600), 0, 1_000);

    expect(live).toEqual(before);
  });

  it("converts copyToChannel startInChannel only once", () => {
    const workerSamples = makeSamples();
    const { instance } = installWithMockAudio(workerSamples);
    const live = instance.getChannelData(0);
    const before = live.slice();
    let reads = 0;
    const start = {
      valueOf(): number {
        reads += 1;
        return reads === 1 ? 0 : 1_000;
      },
    } as unknown as number;

    instance.copyToChannel(live, 0, start);

    expect(reads).toBe(1);
    expect(live).toEqual(before);
  });
});
