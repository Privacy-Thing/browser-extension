import { runInNewContext } from "node:vm";

import {
  captureReadPixelsCall,
  getReadPixelsCallShape,
  normalizeReadPixelsArgs,
  perturbCapturedPixels,
  perturbReadPixelsView,
} from "@privacy-brand/refract-core";
import { describe, expect, it } from "vitest";

const SHAPE = {
  x: 1,
  y: 2,
  width: 3,
  height: 4,
  format: 0x1908,
  type: 0x1401,
} as const;

const FLOAT_DELTA = 1 / 65_536;

describe("captured readPixels destinations", () => {
  it("coerces Number objects and valueOf arguments exactly once", () => {
    let widthCoercions = 0;
    let offsetCoercions = 0;
    const destination = new Uint8Array(64).fill(0xaa);
    const normalized = normalizeReadPixelsArgs([
      0,
      0,
      {
        valueOf: () => {
          widthCoercions += 1;
          return 2;
        },
      },
      new Number(2),
      0x1908,
      0x1401,
      destination,
      {
        valueOf: () => {
          offsetCoercions += 1;
          return 4;
        },
      },
    ]);

    expect(widthCoercions).toBe(1);
    expect(offsetCoercions).toBe(1);
    expect(normalized.slice(2, 4)).toEqual([2, 2]);
    expect(normalized[7]).toBe(4);

    const captured = captureReadPixelsCall(normalized);
    expect(perturbCapturedPixels(captured!, 42, SHAPE)).toBe(true);
    expect(widthCoercions).toBe(1);
    expect(offsetCoercions).toBe(1);
    expect(destination.slice(0, 4)).toEqual(new Uint8Array(4).fill(0xaa));
    expect(destination.slice(20)).toEqual(new Uint8Array(44).fill(0xaa));
  });

  it("perturbs the computed native write region without touching its tail", () => {
    const destination = new Uint8Array(64).fill(0xaa);
    const captured = captureReadPixelsCall([0, 0, 2, 2, 0x1908, 0x1401, destination]);
    expect(captured).not.toBeNull();

    destination.fill(0x11, 0, 16);
    expect(perturbCapturedPixels(captured!, 42, SHAPE)).toBe(true);
    expect(destination.slice(16)).toEqual(new Uint8Array(48).fill(0xaa));
    expect(destination.slice(0, 16)).not.toEqual(new Uint8Array(16).fill(0x11));
  });

  it("respects WebGL2 dstOffset without cloning or touching the heap tail", () => {
    const heap = new Uint8Array(256 * 1024).fill(0xaa);
    const captured = captureReadPixelsCall([0, 0, 2, 2, 0x1908, 0x1401, heap, 4096]);
    expect(captured).not.toBeNull();
    expect(captured?.destination.byteLength).toBeLessThan(heap.byteLength);

    heap.fill(0x11, 4096, 4112);
    expect(perturbCapturedPixels(captured!, 42, SHAPE)).toBe(true);
    expect(heap.slice(0, 4096)).toEqual(new Uint8Array(4096).fill(0xaa));
    expect(heap.slice(4112)).toEqual(new Uint8Array(heap.length - 4112).fill(0xaa));
  });

  it("applies WebIDL integer conversion to string dimensions and dstOffset", () => {
    const destination = new Uint8Array(64).fill(0xaa);
    const captured = captureReadPixelsCall([
      0,
      0,
      "2",
      "2",
      0x1908,
      0x1401,
      destination,
      "4",
    ]);

    expect(captured).not.toBeNull();
    expect(perturbCapturedPixels(captured!, 42, SHAPE)).toBe(true);
    expect(destination.slice(0, 4)).toEqual(new Uint8Array(4).fill(0xaa));
    expect(destination.slice(20)).toEqual(new Uint8Array(44).fill(0xaa));
  });

  it("uses intrinsic metadata for a foreign typed array and never calls its subarray", () => {
    const destination = runInNewContext(
      "new Float32Array(16).fill(0.5)",
    ) as Float32Array;
    const actualBuffer = destination.buffer;
    Object.defineProperties(destination, {
      buffer: { value: new ArrayBuffer(0) },
      byteLength: { value: 0 },
      byteOffset: { value: 4096 },
      BYTES_PER_ELEMENT: { value: 1 },
      subarray: {
        value: () => {
          throw new Error("page-controlled subarray must not run");
        },
      },
    });

    const captured = captureReadPixelsCall([0, 0, 2, 2, 0x1908, 0x1406, destination]);

    expect(captured?.destination).toBeInstanceOf(Float32Array);
    expect(
      perturbCapturedPixels(captured!, 42, {
        ...SHAPE,
        type: 0x1406,
      }),
    ).toBe(true);
    const values = new Float32Array(actualBuffer);
    const changed = values.filter((value) => value !== 0.5);
    expect(changed.length).toBeGreaterThan(0);
    for (const value of changed) {
      expect(Math.abs(value - 0.5)).toBeCloseTo(FLOAT_DELTA);
    }
  });

  it("perturbs a successful zero readback even when native writes identical bytes", () => {
    const destination = new Uint8Array(16);
    const captured = captureReadPixelsCall([0, 0, 2, 2, 0x1908, 0x1401, destination]);

    expect(perturbCapturedPixels(captured!, 42, SHAPE)).toBe(true);
    expect(destination).not.toEqual(new Uint8Array(16));
  });

  it("preserves Float32Array element semantics in the bounded window", () => {
    const destination = new Float32Array(16).fill(0.5);
    const captured = captureReadPixelsCall([0, 0, 2, 2, 0x1908, 0x1406, destination]);

    expect(captured?.destination).toBeInstanceOf(Float32Array);
    expect(
      perturbCapturedPixels(captured!, 42, {
        ...SHAPE,
        type: 0x1406,
      }),
    ).toBe(true);
    const changed = destination.filter((value) => value !== 0.5);
    expect(changed.length).toBeGreaterThan(0);
    for (const value of changed) {
      expect(Math.abs(value - 0.5)).toBeCloseTo(FLOAT_DELTA);
    }
  });

  it("skips row padding derived from WebGL pack alignment", () => {
    const destination = new Uint8Array(16).fill(0xaa);
    const captured = captureReadPixelsCall([0, 0, 1, 2, 0x1907, 0x1401, destination]);

    destination.set([0x11, 0x11, 0x11], 0);
    destination.set([0x11, 0x11, 0x11], 4);
    expect(perturbCapturedPixels(captured!, 42, SHAPE)).toBe(true);
    expect(destination[3]).toBe(0xaa);
    expect(destination.slice(7)).toEqual(new Uint8Array(9).fill(0xaa));
  });

  it("respects WebGL2 row length, skips and dstOffset together", () => {
    const destination = new Uint8Array(32).fill(0xaa);
    const captured = captureReadPixelsCall(
      [0, 0, 1, 2, 0x1907, 0x1401, destination, 2],
      { alignment: 4, rowLength: 2, skipPixels: 1, skipRows: 1 },
    );

    destination.set([0x11, 0x11, 0x11], 13);
    destination.set([0x11, 0x11, 0x11], 21);
    expect(perturbCapturedPixels(captured!, 42, SHAPE)).toBe(true);
    expect(destination.slice(0, 13)).toEqual(new Uint8Array(13).fill(0xaa));
    expect(destination.slice(16, 21)).toEqual(new Uint8Array(5).fill(0xaa));
    expect(destination.slice(24)).toEqual(new Uint8Array(8).fill(0xaa));
  });
});

describe("getReadPixelsCallShape", () => {
  it("applies side-effect-free WebIDL conversion and defaults unsupported values", () => {
    expect(
      getReadPixelsCallShape([1, Number.NaN, "3", Infinity, -5, undefined]),
    ).toEqual({
      x: 1,
      y: 0,
      width: 3,
      height: 0,
      format: 0xffff_fffb,
      type: 0,
    });
  });
});

describe("perturbReadPixelsView", () => {
  it("leaves zero-length views untouched", () => {
    const values = new Uint8Array(0);

    perturbReadPixelsView(values, 42, SHAPE);

    expect(values).toHaveLength(0);
  });

  it("perturbs integer typed arrays across all supported element types", () => {
    const uint8 = new Uint8Array([123]);
    const clamped = new Uint8ClampedArray([0]);
    const int8 = new Int8Array([127]);
    const uint16 = new Uint16Array([0]);
    const int16 = new Int16Array([-32768]);
    const uint32 = new Uint32Array([0xffffffff]);
    const int32 = new Int32Array([2147483647]);

    perturbReadPixelsView(uint8, 42, SHAPE);
    perturbReadPixelsView(clamped, 42, SHAPE);
    perturbReadPixelsView(int8, 42, SHAPE);
    perturbReadPixelsView(uint16, 42, SHAPE);
    perturbReadPixelsView(int16, 42, SHAPE);
    perturbReadPixelsView(uint32, 42, SHAPE);
    perturbReadPixelsView(int32, 42, SHAPE);

    expect(Math.abs(uint8[0]! - 123)).toBe(1);
    expect(clamped[0]).toBe(1);
    expect(int8[0]).toBe(126);
    expect(uint16[0]).toBe(1);
    expect(int16[0]).toBe(-32767);
    expect(uint32[0]).toBe(0xfffffffe);
    expect(int32[0]).toBe(2147483646);
  });

  it("perturbs float arrays while preserving finite and non-finite guards", () => {
    const zero = new Float32Array([0]);
    const one = new Float64Array([1]);
    const middle = new Float64Array([0.5]);
    const notFinite = new Float32Array([Number.NaN]);

    perturbReadPixelsView(zero, 42, SHAPE);
    perturbReadPixelsView(one, 42, SHAPE);
    perturbReadPixelsView(middle, 42, SHAPE);
    perturbReadPixelsView(notFinite, 42, SHAPE);

    expect(zero[0]).toBeCloseTo(FLOAT_DELTA);
    expect(one[0]).toBeCloseTo(1 - FLOAT_DELTA);
    expect(Math.abs(middle[0]! - 0.5)).toBeCloseTo(FLOAT_DELTA);
    expect(Number.isNaN(notFinite[0]!)).toBe(true);
  });

  it("falls back to byte-wise perturbation for other ArrayBufferView implementations", () => {
    const buffer = new Uint8Array([0]);
    const view = new DataView(buffer.buffer);

    perturbReadPixelsView(view, 42, SHAPE);

    expect(buffer[0]).toBe(1);
  });

  const WEBGL_MAX_BUDGET = 12;

  it("mutates at most the readback budget on a large integer view", () => {
    const length = 100_000;
    const values = new Uint16Array(length);
    values.fill(1000);
    const before = Uint16Array.from(values);

    perturbReadPixelsView(values, 0x2bad_c0de, {
      ...SHAPE,
      width: 250,
      height: 100,
    });

    let mutated = 0;
    for (let index = 0; index < length; index += 1) {
      if (values[index] !== before[index]) {
        mutated += 1;
      }
    }

    // No full-buffer readback rewrite: a tiny seeded budget is applied even on a
    // 100k-element view.
    expect(mutated).toBeGreaterThan(0);
    expect(mutated).toBeLessThanOrEqual(WEBGL_MAX_BUDGET);
  });
});
