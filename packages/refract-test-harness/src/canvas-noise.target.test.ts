import {
  MAX_SYNC_EXPORT_PIXELS,
  createExportMutation,
  getCanvasMutationBudget,
  getCanvasRgbaOffsets,
  isImageDataTransparent,
  perturbCanvasImageData,
  shouldPerturbSyncExport,
} from "@privacy-brand/refract-core";
import { describe, expect, it } from "vitest";

const CANVAS_MAX_BUDGET = 12;

const createImageData = (
  width: number,
  height: number,
  fill: (offset: number) => number,
): ImageData => {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let offset = 0; offset < data.length; offset += 1) {
    data[offset] = fill(offset);
  }
  return { data, width, height } as unknown as ImageData;
};

describe("canvas-noise budget", () => {
  it("caps the mutation budget at 12 regardless of canvas size", () => {
    expect(getCanvasMutationBudget(1, 1)).toBe(1);
    // 64x64 = 4096px -> ceil(4096/1024) = 4 mutations (still well under the cap).
    expect(getCanvasMutationBudget(64, 64)).toBe(4);
    // Large canvases saturate the hard ceiling of 12.
    expect(getCanvasMutationBudget(128, 128)).toBe(CANVAS_MAX_BUDGET);
    expect(getCanvasMutationBudget(4096, 4096)).toBe(CANVAS_MAX_BUDGET);
    expect(getCanvasMutationBudget(0, 0)).toBe(0);
  });

  it("selects a bounded set of mutated offsets even for a huge canvas", () => {
    const offsets = getCanvasRgbaOffsets(2048, 2048, 0x1234_5678);

    // At most 12 RGB channels are nudged, each contributing its own alpha byte,
    // so the distinct mutated-offset set never exceeds 24.
    expect(offsets.length).toBeLessThanOrEqual(CANVAS_MAX_BUDGET * 2);
    expect(offsets.length).toBeGreaterThan(0);
  });

  it("mutates only a bounded number of bytes on a large opaque canvas", () => {
    const width = 1000;
    const height = 1000;
    // Fully opaque mid-gray canvas (alpha = 255) so perturbation is not skipped.
    const original = createImageData(width, height, (offset) =>
      offset % 4 === 3 ? 255 : 128,
    );
    const before = Uint8ClampedArray.from(original.data);

    perturbCanvasImageData(original, 0xabcd_ef01);

    let mutatedBytes = 0;
    for (let offset = 0; offset < original.data.length; offset += 1) {
      if (original.data[offset] !== before[offset]) {
        mutatedBytes += 1;
      }
    }

    // No full live-canvas rewrite: at most 12 RGB + 12 alpha bytes change out of
    // 4,000,000, never the whole buffer.
    expect(mutatedBytes).toBeGreaterThan(0);
    expect(mutatedBytes).toBeLessThanOrEqual(CANVAS_MAX_BUDGET * 2);
  });

  it("skips synchronous export perturbation above the pixel safety cap", () => {
    expect(shouldPerturbSyncExport(1024, 1024)).toBe(true);
    expect(shouldPerturbSyncExport(MAX_SYNC_EXPORT_PIXELS + 1, 1)).toBe(false);
    expect(shouldPerturbSyncExport(0, 0)).toBe(false);
  });

  it("treats a fully transparent canvas as zero-entropy and leaves it untouched", () => {
    const blank = createImageData(32, 32, () => 0);

    expect(isImageDataTransparent(blank)).toBe(true);
  });

  it("keeps a known-blank large export native without any readback", () => {
    const readAreas: number[] = [];
    const readImageData = (_x: number, _y: number, width: number, height: number) => {
      readAreas.push(width * height);
      return createImageData(width, height, () => 0);
    };

    expect(
      createExportMutation({
        width: MAX_SYNC_EXPORT_PIXELS + 1,
        height: 1,
        seed: 42,
        readImageData,
        sourceKnownBlank: true,
      }),
    ).toBeNull();
    expect(readAreas).toEqual([]);
  });

  it("noises a dirty large export without deterministic sampling gaps", () => {
    const readRequests: Array<[number, number, number, number]> = [];
    const mutation = createExportMutation({
      width: MAX_SYNC_EXPORT_PIXELS + 1,
      height: 1,
      seed: 42,
      readImageData: (x, y, width, height) => {
        readRequests.push([x, y, width, height]);
        return createImageData(width, height, () => 0);
      },
    });

    expect(mutation).not.toBeNull();
    expect(readRequests).toEqual([[42, 0, 1, 1]]);
    expect(Array.from(mutation!.imageData.data)).toEqual([16, 16, 16, 255]);
  });
});
