import {
  AUDIO_MUTATION_BUDGET,
  AUDIO_NOISE_SOURCE,
  WORKER_AUDIO_SOURCE,
  computeFloatDelta,
  perturbAnalyserByteData,
  perturbAnalyserFloatData,
  perturbAudioChannelCopy,
  perturbAudioChannelData,
  perturbAudioRange,
  perturbByte,
  perturbFloat,
} from "@privacy-brand/refract-core";
import { describe, expect, it } from "vitest";

describe("audio-noise", () => {
  it("computes deterministic float deltas for the same seed and index", () => {
    expect(computeFloatDelta(12345, 7)).toBe(computeFloatDelta(12345, 7));
    expect(computeFloatDelta(12345, 7)).not.toBe(computeFloatDelta(12345, 8));
  });

  it("keeps byte perturbations inside the Uint8 range", () => {
    expect(perturbByte(0, 0, 1)).toBeGreaterThanOrEqual(0);
    expect(perturbByte(255, 0, 1)).toBeLessThanOrEqual(255);
  });

  it("perturbs every finite analyser value deterministically", () => {
    expect(perturbFloat(0.5, 1, 12345)).not.toBe(0.5);
    expect(perturbFloat(0.5, 0, 12345)).not.toBe(0.5);
    expect(perturbByte(128, 1, 12345)).not.toBe(128);
    expect(perturbByte(128, 0, 12345)).not.toBe(128);
    expect(perturbFloat(Number.NEGATIVE_INFINITY, 0, 12345)).toBe(
      Number.NEGATIVE_INFINITY,
    );
  });

  it("leaves analyser destination tails outside the native write count untouched", () => {
    const floats = new Float32Array(8);
    floats.fill(0.5);
    const bytes = new Uint8Array(8);
    bytes.fill(128);

    perturbAnalyserFloatData(floats, 3, 7);
    perturbAnalyserByteData(bytes, 5, 7);

    expect(Array.from(floats.subarray(0, 3)).every((value) => value !== 0.5)).toBe(
      true,
    );
    expect(Array.from(floats.subarray(3))).toEqual(Array(5).fill(0.5));
    expect(Array.from(bytes.subarray(0, 5)).every((value) => value !== 128)).toBe(true);
    expect(Array.from(bytes.subarray(5))).toEqual(Array(3).fill(128));
  });

  it("caps AudioBuffer.getChannelData mutations at the shared budget for huge buffers", () => {
    // Exercises the real shared helper consumed by both the main-world and worker
    // getChannelData patches: a 1M-sample buffer must mutate at most
    // AUDIO_MUTATION_BUDGET samples, never the whole buffer.
    const data = new Float32Array(1_000_000);
    data.fill(0.25);

    perturbAudioChannelData(data, 0x1357_9bdf);

    let mutated = 0;
    for (let index = 0; index < data.length; index += 1) {
      if (data[index] !== 0.25) {
        mutated += 1;
      }
    }

    expect(mutated).toBeGreaterThan(0);
    expect(mutated).toBeLessThanOrEqual(AUDIO_MUTATION_BUDGET);
  });

  it("perturbs a sub-budget buffer without engaging the cap", () => {
    const length = 64;
    const data = new Float32Array(length);
    data.fill(0.5);

    perturbAudioChannelData(data, 7);

    let mutated = 0;
    for (let index = 0; index < length; index += 1) {
      if (data[index] !== 0.5) {
        mutated += 1;
      }
    }

    // Below the budget the stride is 1; the helper touches the buffer and stays
    // bounded by its length (never exceeds it).
    expect(mutated).toBeGreaterThan(0);
    expect(mutated).toBeLessThanOrEqual(length);
  });

  it("leaves an empty channel buffer untouched", () => {
    const data = new Float32Array(0);

    expect(() => perturbAudioChannelData(data, 7)).not.toThrow();
    expect(data).toHaveLength(0);
  });

  it("uses the full-channel mutation schedule for ranges and copied slices", () => {
    const seed = 0x1357_9bdf;
    const full = new Float32Array(5_000);
    full.fill(0.5);
    const ranged = full.slice();
    const copied = new Float32Array(600);
    copied.fill(0.5);

    perturbAudioChannelData(full, seed);
    perturbAudioRange(ranged, seed, 1_000, 1_600);
    perturbAudioChannelCopy({
      destination: copied,
      seed,
      channelLength: full.length,
      startInChannel: 1_000,
      copiedLength: copied.length,
    });

    expect(ranged.subarray(1_000, 1_600)).toEqual(full.subarray(1_000, 1_600));
    expect(copied).toEqual(full.slice(1_000, 1_600));
    expect(ranged.subarray(0, 1_000)).toEqual(new Float32Array(1_000).fill(0.5));
  });

  it("keeps the getChannelData patch bounded and once-per-buffer in the worker source", () => {
    // Regression guard: the mutation cap and the one-shot per-buffer guard must
    // stay in the build-generated worker patch.
    expect(WORKER_AUDIO_SOURCE).toContain(
      "const budget = Math.min(data.length, AUDIO_MUTATION_BUDGET);",
    );
    expect(WORKER_AUDIO_SOURCE).toContain("index < data.length && mutations < budget;");
    expect(WORKER_AUDIO_SOURCE).toContain("const perturbedBuffers = new WeakSet();");
    expect(WORKER_AUDIO_SOURCE).toContain("if (!perturbedBuffers.has(data)) {");
  });

  it("builds the worker inline source from the shared audio helper shape", () => {
    expect(AUDIO_MUTATION_BUDGET).toBe(256);
    expect(AUDIO_NOISE_SOURCE).toContain(
      "const computeFloatDelta = (seed, index) => {",
    );
    expect(AUDIO_NOISE_SOURCE).toContain(
      "const perturbFloat = (value, index, seed) => {",
    );
    expect(AUDIO_NOISE_SOURCE).toContain(
      "const perturbByte = (value, index, seed) => {",
    );
    expect(AUDIO_NOISE_SOURCE).toContain("const AUDIO_MUTATION_BUDGET = 256;");
  });

  it("builds the worker AudioBuffer patch inline source around the shared helper", () => {
    expect(WORKER_AUDIO_SOURCE).toContain(
      'if (audioSeed !== undefined && isFpSurfaceEnabled(snapshot.fingerprint, "audio")) {',
    );
    expect(WORKER_AUDIO_SOURCE).toContain(
      'Object.defineProperty(AudioBuffer.prototype, "getChannelData", {',
    );
    expect(WORKER_AUDIO_SOURCE).toContain(
      '} }.getChannelData, createNativeSource("getChannelData"))',
    );
  });
});
