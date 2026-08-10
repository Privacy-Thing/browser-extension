import { perturbAudioRange } from "@privacy-brand/refract-core/fingerprint/audio-noise";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { installAudioPatch } from "@/injection/main/audio-patch";
import type { RuntimeSnapshot } from "@/shared/types";

class MockAnalyserNode {
  private nativeFrequencyBinCount = 256;
  private nativeFftSize = 256;

  get frequencyBinCount(): number {
    return this.nativeFrequencyBinCount;
  }

  set frequencyBinCount(value: number) {
    this.nativeFrequencyBinCount = value;
  }

  get fftSize(): number {
    return this.nativeFftSize;
  }

  set fftSize(value: number) {
    this.nativeFftSize = value;
  }

  getFloatFrequencyData(array: Float32Array): void {
    for (let i = 0; i < Math.min(array.length, this.nativeFrequencyBinCount); i++)
      array[i] = -30.0;
  }

  getByteFrequencyData(array: Uint8Array): void {
    for (let i = 0; i < Math.min(array.length, this.nativeFrequencyBinCount); i++)
      array[i] = 128;
  }

  getFloatTimeDomainData(array: Float32Array): void {
    for (let i = 0; i < Math.min(array.length, this.nativeFftSize); i++) array[i] = 0.5;
  }

  getByteTimeDomainData(array: Uint8Array): void {
    for (let i = 0; i < Math.min(array.length, this.nativeFftSize); i++) array[i] = 128;
  }
}

class MockAudioBuffer {
  private channels: Float32Array[];

  constructor(numChannels: number, length: number) {
    this.channels = Array.from({ length: numChannels }, () => {
      const arr = new Float32Array(length);
      arr.fill(0.5);
      return arr;
    });
  }

  getChannelData(channel: number): Float32Array {
    return this.channels[channel]!;
  }

  get length(): number {
    return this.channels[0]?.length ?? 0;
  }

  copyFromChannel(
    destination: Float32Array,
    channel: number,
    startInChannel = 0,
  ): void {
    const normalizedStart = Number(startInChannel) >>> 0;
    destination.set(
      this.channels[channel]!.subarray(
        normalizedStart,
        Math.min(this.length, normalizedStart + destination.length),
      ),
    );
  }

  copyToChannel(source: Float32Array, channel: number, startInChannel = 0): void {
    const normalizedStart = Number(startInChannel) >>> 0;
    this.channels[channel]!.set(
      source.subarray(0, Math.max(0, this.length - normalizedStart)),
      normalizedStart,
    );
  }
}

const buildSnapshot = (
  overrides?: Partial<RuntimeSnapshot["fingerprint"]>,
): RuntimeSnapshot => ({
  geo: { latitude: 0, longitude: 0, accuracy: 10, noiseRadius: 50 },
  locale: { language: "en", languages: ["en"], timeZone: "UTC", acceptLanguage: "en" },
  date: { baseEpochMs: 0, offsetMs: 0, timeZone: "UTC" },
  debugMode: false,
  watchPositionDelay: [100, 500],
  fingerprint: {
    audioNoiseSeed: 12345,
    ...overrides,
  },
});

describe("installAudioPatch", () => {
  let originalFloatFrequency: typeof MockAnalyserNode.prototype.getFloatFrequencyData;
  let originalGetByteFrequency: typeof MockAnalyserNode.prototype.getByteFrequencyData;
  let originalFloatTimeDomain: typeof MockAnalyserNode.prototype.getFloatTimeDomainData;
  let originalByteTimeDomain: typeof MockAnalyserNode.prototype.getByteTimeDomainData;
  let originalGetChannelData: typeof MockAudioBuffer.prototype.getChannelData;
  let originalCopyFromChannel: typeof MockAudioBuffer.prototype.copyFromChannel;
  let originalCopyToChannel: typeof MockAudioBuffer.prototype.copyToChannel;

  beforeEach(() => {
    originalFloatFrequency = MockAnalyserNode.prototype.getFloatFrequencyData;
    originalGetByteFrequency = MockAnalyserNode.prototype.getByteFrequencyData;
    originalFloatTimeDomain = MockAnalyserNode.prototype.getFloatTimeDomainData;
    originalByteTimeDomain = MockAnalyserNode.prototype.getByteTimeDomainData;
    originalGetChannelData = MockAudioBuffer.prototype.getChannelData;
    originalCopyFromChannel = MockAudioBuffer.prototype.copyFromChannel;
    originalCopyToChannel = MockAudioBuffer.prototype.copyToChannel;

    vi.stubGlobal("AnalyserNode", MockAnalyserNode);
    vi.stubGlobal("AudioBuffer", MockAudioBuffer);
  });

  afterEach(() => {
    MockAnalyserNode.prototype.getFloatFrequencyData = originalFloatFrequency;
    MockAnalyserNode.prototype.getByteFrequencyData = originalGetByteFrequency;
    MockAnalyserNode.prototype.getFloatTimeDomainData = originalFloatTimeDomain;
    MockAnalyserNode.prototype.getByteTimeDomainData = originalByteTimeDomain;
    MockAudioBuffer.prototype.getChannelData = originalGetChannelData;
    MockAudioBuffer.prototype.copyFromChannel = originalCopyFromChannel;
    MockAudioBuffer.prototype.copyToChannel = originalCopyToChannel;
    vi.unstubAllGlobals();
  });

  it("perturbs float frequency data with subtle noise", () => {
    installAudioPatch(buildSnapshot());

    const analyser = new MockAnalyserNode();
    const array = new Float32Array(256);
    analyser.getFloatFrequencyData(array);

    let perturbedCount = 0;
    for (let i = 0; i < array.length; i++) {
      if (array[i] !== -30.0) {
        perturbedCount++;
        expect(Math.abs(array[i]! - -30.0)).toBeLessThan(0.001);
      }
    }

    expect(perturbedCount).toBe(array.length);
  });

  it("perturbs byte frequency data by ±1", () => {
    installAudioPatch(buildSnapshot());

    const analyser = new MockAnalyserNode();
    const array = new Uint8Array(256);
    analyser.getByteFrequencyData(array);

    let perturbedCount = 0;
    for (let i = 0; i < array.length; i++) {
      if (array[i] !== 128) {
        perturbedCount++;
        expect(Math.abs(array[i]! - 128)).toBeLessThanOrEqual(1);
      }
    }

    expect(perturbedCount).toBe(array.length);
  });

  it("perturbs float time domain data with subtle noise", () => {
    installAudioPatch(buildSnapshot());

    const analyser = new MockAnalyserNode();
    const array = new Float32Array(256);
    analyser.getFloatTimeDomainData(array);

    let perturbedCount = 0;
    for (let i = 0; i < array.length; i++) {
      if (array[i] !== 0.5) {
        perturbedCount++;
        expect(Math.abs(array[i]! - 0.5)).toBeLessThan(0.001);
      }
    }

    expect(perturbedCount).toBe(array.length);
  });

  it("perturbs byte time domain data by ±1", () => {
    installAudioPatch(buildSnapshot());

    const analyser = new MockAnalyserNode();
    const array = new Uint8Array(256);
    analyser.getByteTimeDomainData(array);

    let perturbedCount = 0;
    for (let i = 0; i < array.length; i++) {
      if (array[i] !== 128) {
        perturbedCount++;
        expect(Math.abs(array[i]! - 128)).toBeLessThanOrEqual(1);
      }
    }

    expect(perturbedCount).toBe(array.length);
  });

  it("perturbs only the analyser prefix written by the native methods", () => {
    installAudioPatch(buildSnapshot());

    const analyser = new MockAnalyserNode();
    analyser.frequencyBinCount = 8;
    analyser.fftSize = 16;
    const frequency = new Float32Array(24);
    frequency.fill(77);
    const timeDomain = new Uint8Array(24);
    timeDomain.fill(77);

    analyser.getFloatFrequencyData(frequency);
    analyser.getByteTimeDomainData(timeDomain);

    expect(Array.from(frequency.subarray(0, 8)).every((value) => value !== -30)).toBe(
      true,
    );
    expect(Array.from(frequency.subarray(8))).toEqual(Array(16).fill(77));
    expect(Array.from(timeDomain.subarray(0, 16)).every((value) => value !== 128)).toBe(
      true,
    );
    expect(Array.from(timeDomain.subarray(16))).toEqual(Array(8).fill(77));
  });

  it("uses native analyser sizes when instance properties are shadowed", () => {
    installAudioPatch(buildSnapshot());

    const analyser = new MockAnalyserNode();
    Object.defineProperty(analyser, "frequencyBinCount", { value: 0 });
    Object.defineProperty(analyser, "fftSize", { value: 0 });
    const frequency = new Float32Array(256);
    const timeDomain = new Uint8Array(256);

    analyser.getFloatFrequencyData(frequency);
    analyser.getByteTimeDomainData(timeDomain);

    expect(Array.from(frequency).every((value) => value !== -30)).toBe(true);
    expect(Array.from(timeDomain).every((value) => value !== 128)).toBe(true);
  });

  it("perturbs AudioBuffer.getChannelData and is idempotent", () => {
    installAudioPatch(buildSnapshot());

    const buffer = new MockAudioBuffer(2, 128);
    const channel0 = buffer.getChannelData(0);

    let perturbedCount = 0;
    for (let i = 0; i < channel0.length; i++) {
      if (channel0[i] !== 0.5) perturbedCount++;
    }
    expect(perturbedCount).toBeGreaterThan(0);

    // Second call returns same data (WeakSet idempotency)
    const channel0Again = buffer.getChannelData(0);
    expect(channel0Again).toEqual(channel0);
  });

  it("limits AudioBuffer perturbation to a sparse deterministic budget", () => {
    installAudioPatch(buildSnapshot());

    const buffer = new MockAudioBuffer(1, 10_000);
    const channel0 = buffer.getChannelData(0);

    let perturbedCount = 0;
    for (let i = 0; i < channel0.length; i++) {
      if (channel0[i] !== 0.5) {
        perturbedCount++;
      }
    }

    expect(perturbedCount).toBeGreaterThan(0);
    expect(perturbedCount).toBeLessThanOrEqual(256);
  });

  it("returns coherent noise through copyFromChannel without changing its tail", () => {
    installAudioPatch(buildSnapshot());

    const copied = new Float32Array(140);
    copied.fill(9);
    const buffer = new MockAudioBuffer(1, 128);
    buffer.copyFromChannel(copied, 0);

    const expectedBuffer = new MockAudioBuffer(1, 128);
    const expected = expectedBuffer.getChannelData(0);
    expect(copied.subarray(0, 128)).toEqual(expected);
    expect(Array.from(copied.subarray(128))).toEqual(Array(12).fill(9));
  });

  it("uses absolute channel indices for offset copyFromChannel reads", () => {
    installAudioPatch(buildSnapshot());

    const copied = new Float32Array(16);
    const buffer = new MockAudioBuffer(1, 128);
    buffer.copyFromChannel(copied, 0, 32);

    const expectedBuffer = new MockAudioBuffer(1, 128);
    const expected = expectedBuffer.getChannelData(0).slice(32, 48);
    expect(copied).toEqual(expected);
  });

  it("converts copyFromChannel startInChannel only once", () => {
    installAudioPatch(buildSnapshot());

    const copied = new Float32Array(16);
    const buffer = new MockAudioBuffer(1, 128);
    let reads = 0;
    const start = {
      valueOf(): number {
        reads += 1;
        return reads === 1 ? 32 : 64;
      },
    } as unknown as number;

    buffer.copyFromChannel(copied, 0, start);

    const expectedBuffer = new MockAudioBuffer(1, 128);
    const expected = expectedBuffer.getChannelData(0).slice(32, 48);
    expect(reads).toBe(1);
    expect(copied).toEqual(expected);
  });

  it("reapplies noise only to a range overwritten through copyToChannel", () => {
    installAudioPatch(buildSnapshot());

    const buffer = new MockAudioBuffer(1, 128);
    const before = buffer.getChannelData(0).slice();
    const source = new Float32Array(10);
    source.fill(0.25);
    buffer.copyToChannel(source, 0, 7);
    const after = buffer.getChannelData(0);

    const expectedRange = new Float32Array(128);
    expectedRange.fill(0.25, 7, 17);
    perturbAudioRange(expectedRange, 12345, 7, 17);
    expect(after.subarray(7, 17)).toEqual(expectedRange.subarray(7, 17));
    expect(after.subarray(0, 7)).toEqual(before.subarray(0, 7));
    expect(after.subarray(17)).toEqual(before.subarray(17));
  });

  it("does not reapply noise when copyToChannel receives the same live range", () => {
    installAudioPatch(buildSnapshot());

    const buffer = new MockAudioBuffer(1, 128);
    const live = buffer.getChannelData(0);
    const before = live.slice();

    buffer.copyToChannel(live, 0);
    buffer.copyToChannel(live.subarray(16, 48), 0, 16);

    expect(live).toEqual(before);
  });

  it("converts copyToChannel startInChannel only once", () => {
    installAudioPatch(buildSnapshot());

    const buffer = new MockAudioBuffer(1, 128);
    const live = buffer.getChannelData(0);
    const before = live.slice();
    let reads = 0;
    const start = {
      valueOf(): number {
        reads += 1;
        return reads === 1 ? 0 : 16;
      },
    } as unknown as number;

    buffer.copyToChannel(live, 0, start);

    expect(reads).toBe(1);
    expect(live).toEqual(before);
  });

  it("produces deterministic noise for the same seed", () => {
    installAudioPatch(buildSnapshot());

    const analyser1 = new MockAnalyserNode();
    const arr1 = new Float32Array(256);
    analyser1.getFloatFrequencyData(arr1);

    const analyser2 = new MockAnalyserNode();
    const arr2 = new Float32Array(256);
    analyser2.getFloatFrequencyData(arr2);

    expect(arr1).toEqual(arr2);
  });

  it("skips patching when audio toggle is disabled", () => {
    installAudioPatch(
      buildSnapshot({
        audioNoiseSeed: 12345,
        spoofingToggles: { audio: false },
      }),
    );

    const analyser = new MockAnalyserNode();
    const array = new Float32Array(64);
    analyser.getFloatFrequencyData(array);

    for (let i = 0; i < array.length; i++) {
      expect(array[i]).toBe(-30.0);
    }
  });

  it("skips gracefully when audioNoiseSeed is absent", () => {
    const snapshot = buildSnapshot();
    delete snapshot.fingerprint?.audioNoiseSeed;

    expect(installAudioPatch(snapshot)).toEqual({
      analyserNode: false,
      audioBuffer: false,
    });

    const analyser = new MockAnalyserNode();
    const array = new Float32Array(64);
    analyser.getFloatFrequencyData(array);
    expect(array[0]).toBe(-30.0);
  });

  it("masks patched functions with [native code] toString", () => {
    installAudioPatch(buildSnapshot());

    expect(MockAnalyserNode.prototype.getFloatFrequencyData.toString()).toContain(
      "[native code]",
    );
    expect(MockAnalyserNode.prototype.getByteFrequencyData.toString()).toContain(
      "[native code]",
    );
    expect(MockAnalyserNode.prototype.getFloatTimeDomainData.toString()).toContain(
      "[native code]",
    );
    expect(MockAnalyserNode.prototype.getByteTimeDomainData.toString()).toContain(
      "[native code]",
    );
    expect(MockAudioBuffer.prototype.getChannelData.toString()).toContain(
      "[native code]",
    );
    expect(MockAudioBuffer.prototype.copyFromChannel.toString()).toContain(
      "[native code]",
    );
    expect(MockAudioBuffer.prototype.copyToChannel.toString()).toContain(
      "[native code]",
    );
    expect(MockAudioBuffer.prototype.getChannelData).toHaveLength(1);
    expect(MockAudioBuffer.prototype.copyFromChannel).toHaveLength(2);
    expect(MockAudioBuffer.prototype.copyToChannel).toHaveLength(2);
  });
});
