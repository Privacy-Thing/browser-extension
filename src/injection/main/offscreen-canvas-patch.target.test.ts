import { installOffscreenNoise } from "@privacy-brand/refract-core";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Focused coverage for the main-thread OffscreenCanvas patch. The deep
 * state-tracking behaviour is exercised by the worker harness
 * (`packages/refract-test-harness/src/worker-bootstrap.target.test.ts`), which now runs
 * through the same shared `installOffscreenNoise`. These tests assert the
 * surface is wired (getImageData perturbs, transparent canvases rotate) and that
 * re-installing on the same realm is a no-op.
 *
 * `installOffscreenNoise` keeps a module-level set of already-patched
 * prototypes, so every test builds a FRESH set of mock classes (distinct
 * prototypes) to stay independent.
 */

class MockImageData {
  data: Uint8ClampedArray;
  width: number;
  height: number;
  colorSpace: PredefinedColorSpace = "srgb";

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    // Fully transparent (every channel 0) — the case where RGB-only noise used
    // to be discarded by premultiplied alpha.
    this.data = new Uint8ClampedArray(width * height * 4);
  }
}

type MockEnv = {
  OffscreenCanvas: new (
    width: number,
    height: number,
  ) => {
    width: number;
    height: number;
    getContext(type: string): {
      getImageData(sx: number, sy: number, sw: number, sh: number): MockImageData;
      fillRect(): void;
    } | null;
    convertToBlob(): Promise<Blob>;
  };
  OffscreenCanvasRenderingContext2D: {
    prototype: { getImageData: (...args: number[]) => MockImageData };
  };
};

const createMockEnv = (): MockEnv => {
  class MockCtx {
    canvas: MockCanvas;
    stored: MockImageData;

    constructor(canvas: MockCanvas) {
      this.canvas = canvas;
      this.stored = new MockImageData(canvas.width, canvas.height);
    }

    getImageData(_sx: number, _sy: number, _sw: number, _sh: number): MockImageData {
      const copy = new MockImageData(this.canvas.width, this.canvas.height);
      copy.data.set(this.stored.data);
      return copy;
    }

    putImageData(imageData: MockImageData): void {
      const next = new MockImageData(this.canvas.width, this.canvas.height);
      next.data.set(imageData.data);
      this.stored = next;
    }

    drawImage(source: MockCanvas): void {
      const sourceContext = source.getContext("2d");
      if (sourceContext) {
        this.stored = sourceContext.getImageData(0, 0, source.width, source.height);
      }
    }

    fillRect(): void {
      // Simulate drawing opaque content so the canvas is no longer blank.
      const next = new MockImageData(this.canvas.width, this.canvas.height);
      next.data.fill(255);
      this.stored = next;
    }
  }

  class MockCanvas {
    width: number;
    height: number;
    private readonly ctx: MockCtx;

    constructor(width: number, height: number) {
      this.width = width;
      this.height = height;
      this.ctx = new MockCtx(this);
    }

    getContext(type: string): MockCtx | null {
      return type === "2d" ? this.ctx : null;
    }

    async convertToBlob(): Promise<Blob> {
      return new Blob([Array.from(this.ctx.stored.data).join(",")]);
    }
  }

  return { OffscreenCanvas: MockCanvas, OffscreenCanvasRenderingContext2D: MockCtx };
};

const stub = (env: MockEnv): void => {
  vi.stubGlobal("OffscreenCanvas", env.OffscreenCanvas);
  vi.stubGlobal(
    "OffscreenCanvasRenderingContext2D",
    env.OffscreenCanvasRenderingContext2D,
  );
};

describe("installOffscreenNoise (main thread)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("leaves a fully transparent OffscreenCanvas native (skips zero-entropy blank)", () => {
    const env = createMockEnv();
    stub(env);
    installOffscreenNoise(4242);

    const imageData = new env.OffscreenCanvas(32, 32)
      .getContext("2d")!
      .getImageData(0, 0, 32, 32);

    // A blank/transparent OffscreenCanvas must read back native (all zeros) so
    // every realm agrees; noise is skipped.
    expect(Array.from(imageData.data)).toEqual(
      Array.from(new Uint8ClampedArray(32 * 32 * 4)),
    );
  });

  it("produces different output for different identity seeds (drawn canvas)", () => {
    const envA = createMockEnv();
    stub(envA);
    installOffscreenNoise(1);
    const ctxA = new envA.OffscreenCanvas(16, 16).getContext("2d")!;
    ctxA.fillRect();
    const first = ctxA.getImageData(0, 0, 16, 16);
    vi.unstubAllGlobals();

    const envB = createMockEnv();
    stub(envB);
    installOffscreenNoise(999);
    const ctxB = new envB.OffscreenCanvas(16, 16).getContext("2d")!;
    ctxB.fillRect();
    const second = ctxB.getImageData(0, 0, 16, 16);

    expect(Array.from(second.data)).not.toEqual(Array.from(first.data));
  });

  it("exports a stable noised copy without changing source pixels", async () => {
    const env = createMockEnv();
    stub(env);
    installOffscreenNoise(4242);

    const canvas = new env.OffscreenCanvas(16, 16);
    const context = canvas.getContext("2d")!;
    context.fillRect();
    const before = context.getImageData(0, 0, 16, 16).data.slice();

    const first = await (await canvas.convertToBlob()).text();
    const second = await (await canvas.convertToBlob()).text();
    const after = context.getImageData(0, 0, 16, 16).data;

    expect(first).toEqual(second);
    expect(first).not.toBe(Array.from(before).join(","));
    expect(after).toEqual(before);
  });

  it("is idempotent across re-installs (does not re-wrap)", () => {
    const env = createMockEnv();
    stub(env);
    installOffscreenNoise(7);
    const patchedGetImageData =
      env.OffscreenCanvasRenderingContext2D.prototype.getImageData;

    installOffscreenNoise(7);
    expect(env.OffscreenCanvasRenderingContext2D.prototype.getImageData).toBe(
      patchedGetImageData,
    );
  });

  it("masks the patched getImageData as native", () => {
    const env = createMockEnv();
    stub(env);
    installOffscreenNoise(7);

    expect(
      env.OffscreenCanvasRenderingContext2D.prototype.getImageData.toString(),
    ).toContain("[native code]");
  });
});
