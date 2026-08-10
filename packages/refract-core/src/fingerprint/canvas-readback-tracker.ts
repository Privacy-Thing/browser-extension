import { getCanvasRgbaOffsets } from "./canvas-noise";

type CanvasLike = {
  height: number;
  width: number;
};

type Rect = readonly [sx: number, sy: number, width: number, height: number];

type WrittenRectState = readonly [
  canvasGeneration: number,
  canvasHeight: number,
  canvasWidth: number,
  mutatedPixels: ReadonlyMap<number, number>,
  stateVersion: number,
  rect: Rect,
];

type ReadMetadata<TCanvas extends CanvasLike> = readonly [
  canvas: TCanvas,
  canvasGeneration: number,
  signature: number,
  stateVersion: number,
  sx: number,
  sy: number,
];

type ReadInput<TCanvas extends CanvasLike> = readonly [
  canvas: TCanvas,
  imageData: ImageData,
  sx: number,
  sy: number,
  ...unused: readonly unknown[],
];

type WriteInput<TCanvas extends CanvasLike> = readonly [
  canvas: TCanvas,
  imageData: ImageData,
  sx: number,
  sy: number,
  dirtyX?: number | undefined,
  dirtyY?: number | undefined,
  dirtyWidth?: number | undefined,
  dirtyHeight?: number | undefined,
];

type CanvasBounds = readonly [
  endX: number,
  endY: number,
  startX: number,
  startY: number,
];

export type CanvasReadbackTracker<TCanvas extends CanvasLike> = readonly [
  canPromote: (input: WriteInput<TCanvas>) => boolean,
  invalidate: (canvas: TCanvas | null | undefined) => void,
  isFresh: (input: ReadInput<TCanvas>) => boolean,
  markRead: (input: ReadInput<TCanvas>) => void,
  promote: (input: ReadInput<TCanvas>) => void,
];

const getImageDataSignature = (imageData: ImageData): number => {
  let signature = 2166136261;
  signature = Math.imul(signature ^ imageData.width, 16777619);
  signature = Math.imul(signature ^ imageData.height, 16777619);

  for (let index = 0; index < imageData.data.length; index += 1) {
    signature = Math.imul(signature ^ imageData.data[index]!, 16777619);
  }

  return signature >>> 0;
};

const getStateKey = (input: ReadInput<CanvasLike>): string =>
  [input[2], input[3], input[1].width, input[1].height].join(":");

const getCanvasBounds = (canvas: CanvasLike, rect: Rect): CanvasBounds => [
  Math.min(canvas.width, rect[0] + rect[2]),
  Math.min(canvas.height, rect[1] + rect[3]),
  Math.max(0, rect[0]),
  Math.max(0, rect[1]),
];

const boundsOverlap = (first: CanvasBounds, second: CanvasBounds): boolean =>
  first[2] < second[0] &&
  first[0] > second[2] &&
  first[3] < second[1] &&
  first[1] > second[3];

const matchesWrittenPixels = (
  imageData: ImageData,
  mutatedPixels: ReadonlyMap<number, number>,
): boolean => {
  for (const [rgbaOffset, expectedValue] of mutatedPixels) {
    if (imageData.data[rgbaOffset] !== expectedValue) {
      return false;
    }
  }
  return true;
};

export const createCanvasReadTracker = <TCanvas extends CanvasLike>(
  getSeed: () => number | undefined,
  getStateVersion: () => number,
): CanvasReadbackTracker<TCanvas> => {
  const writtenStates = new WeakMap<TCanvas, Map<string, WrittenRectState>>();
  const canvasGenerations = new WeakMap<TCanvas, number>();
  const perturbedReads = new WeakMap<ImageData, ReadMetadata<TCanvas>>();
  let nextGeneration = 1;

  const getGeneration = (canvas: TCanvas): number => {
    const generation = canvasGenerations.get(canvas);
    if (generation !== undefined) return generation;
    const next = nextGeneration++;
    canvasGenerations.set(canvas, next);
    return next;
  };

  const invalidate = (canvas: TCanvas | null | undefined): void => {
    if (!canvas) return;
    writtenStates.delete(canvas);
    canvasGenerations.set(canvas, nextGeneration++);
  };

  const markRead = (input: ReadInput<TCanvas>): void => {
    const [canvas, imageData, sx, sy] = input;
    perturbedReads.set(imageData, [
      canvas,
      getGeneration(canvas),
      getImageDataSignature(imageData),
      getStateVersion(),
      sx,
      sy,
    ]);
  };

  const isFresh = (input: ReadInput<TCanvas>): boolean => {
    const [canvas, imageData, sx, sy] = input;
    const state = writtenStates.get(canvas)?.get(getStateKey(input));
    if (!state) return false;
    if (state[4] !== getStateVersion()) return false;
    if (state[0] !== getGeneration(canvas)) return false;
    const rect = state[5];
    if (
      state[2] !== canvas.width ||
      state[1] !== canvas.height ||
      rect[0] !== sx ||
      rect[1] !== sy ||
      rect[2] !== imageData.width ||
      rect[3] !== imageData.height
    ) {
      return false;
    }
    return matchesWrittenPixels(imageData, state[3]);
  };

  const canPromote = (input: WriteInput<TCanvas>): boolean => {
    const [canvas, imageData, sx, sy, dirtyX, dirtyY, dirtyWidth, dirtyHeight] = input;
    const read = perturbedReads.get(imageData);
    if (!read || read[0] !== canvas) return false;
    if (read[3] !== getStateVersion()) return false;
    if (read[1] !== getGeneration(canvas)) return false;
    if (read[2] !== getImageDataSignature(imageData)) return false;
    return (
      sx === read[4] &&
      sy === read[5] &&
      (dirtyX ?? 0) === 0 &&
      (dirtyY ?? 0) === 0 &&
      (dirtyWidth ?? imageData.width) === imageData.width &&
      (dirtyHeight ?? imageData.height) === imageData.height
    );
  };

  const makePixelMap = (input: ReadInput<TCanvas>): ReadonlyMap<number, number> => {
    const [canvas, imageData, sx, sy] = input;
    const seed = getSeed();
    const pixels = new Map<number, number>();
    if (seed === undefined) return pixels;
    for (const offset of getCanvasRgbaOffsets(
      imageData.width,
      imageData.height,
      seed,
    )) {
      const pixel = Math.floor(offset / 4);
      const canvasX = sx + (pixel % imageData.width);
      const canvasY = sy + Math.floor(pixel / imageData.width);
      if (
        canvasX >= 0 &&
        canvasX < canvas.width &&
        canvasY >= 0 &&
        canvasY < canvas.height
      ) {
        pixels.set(offset, imageData.data[offset]!);
      }
    }
    return pixels;
  };

  const promote = (input: ReadInput<TCanvas>): void => {
    const [canvas, imageData, sx, sy] = input;
    const states = writtenStates.get(canvas) ?? new Map();
    const rect: Rect = [sx, sy, imageData.width, imageData.height];
    const bounds = getCanvasBounds(canvas, rect);
    if (bounds[2] >= bounds[0] || bounds[3] >= bounds[1]) return;
    for (const [key, state] of states) {
      if (boundsOverlap(getCanvasBounds(canvas, state[5]), bounds)) {
        states.delete(key);
      }
    }
    const mutatedPixels = makePixelMap(input);
    if (mutatedPixels.size === 0) return;
    states.set(getStateKey(input), [
      getGeneration(canvas),
      canvas.height,
      canvas.width,
      mutatedPixels,
      getStateVersion(),
      rect,
    ]);
    writtenStates.set(canvas, states);
  };

  return [canPromote, invalidate, isFresh, markRead, promote];
};
