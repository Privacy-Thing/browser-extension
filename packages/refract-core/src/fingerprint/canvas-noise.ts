const CANVAS_PIXELS_PER_CHANGE = 1024;
const CANVAS_MIN_BUDGET = 1;
const CANVAS_MAX_BUDGET = 12;
const CANVAS_STATE_FALLBACK = 0x9e3779b9;
const CANVAS_ZERO_FALLBACK = 0x85ebca6b;
export const MAX_SYNC_EXPORT_PIXELS = 1_048_576;
const LARGE_CANVAS_PIXEL_DELTA = 16;

const clampByte = (value: number): number => Math.max(0, Math.min(255, value));

export const xorshift32 = (value: number): number => {
  let next = value >>> 0;
  next ^= next << 13;
  next ^= next >>> 17;
  next ^= next << 5;
  return next >>> 0;
};

const stepCanvasNoiseState = (state: number): number => {
  const next = xorshift32(state || CANVAS_STATE_FALLBACK);
  return next === 0 ? CANVAS_ZERO_FALLBACK : next;
};

const mixCanvasNoiseState = (
  seed: number,
  width: number,
  height: number,
  totalRgbChannels: number,
): number => {
  const mixed =
    (seed ^
      Math.imul(width, 0x85ebca6b) ^
      Math.imul(height, 0xc2b2ae35) ^
      Math.imul(totalRgbChannels, 0x27d4eb2f)) >>>
    0;

  return stepCanvasNoiseState(mixed);
};

const toRgbaOffset = (rgbChannelIndex: number): number => {
  const pixelIndex = Math.floor(rgbChannelIndex / 3);
  const channelOffset = rgbChannelIndex % 3;
  return pixelIndex * 4 + channelOffset;
};

const chooseChannelDelta = (value: number, state: number): number => {
  if (value <= 0) {
    return 1;
  }

  if (value >= 255) {
    return -1;
  }

  return (state & 1) === 0 ? -1 : 1;
};

export const getCanvasMutationBudget = (width: number, height: number): number => {
  const totalPixels = width * height;
  if (totalPixels <= 0) {
    return 0;
  }

  return Math.min(
    CANVAS_MAX_BUDGET,
    Math.max(CANVAS_MIN_BUDGET, Math.ceil(totalPixels / CANVAS_PIXELS_PER_CHANGE)),
  );
};

export const shouldPerturbSyncExport = (width: number, height: number): boolean => {
  const totalPixels = width * height;
  return (
    Number.isSafeInteger(totalPixels) &&
    totalPixels > 0 &&
    totalPixels <= MAX_SYNC_EXPORT_PIXELS
  );
};

export type CanvasExportMutation = {
  imageData: ImageData;
  x: number;
  y: number;
};

const perturbLargeCanvasPixel = (imageData: ImageData, seed: number): ImageData => {
  let state = stepCanvasNoiseState(seed);
  for (let channel = 0; channel < 3; channel += 1) {
    const offset = channel;
    const value = imageData.data[offset]!;
    let delta: number;
    if (value < LARGE_CANVAS_PIXEL_DELTA) {
      delta = LARGE_CANVAS_PIXEL_DELTA;
    } else if (value > 255 - LARGE_CANVAS_PIXEL_DELTA) {
      delta = -LARGE_CANVAS_PIXEL_DELTA;
    } else {
      delta = (state & 1) === 0 ? -LARGE_CANVAS_PIXEL_DELTA : LARGE_CANVAS_PIXEL_DELTA;
    }
    imageData.data[offset] = clampByte(value + delta);
    state = stepCanvasNoiseState(state);
  }
  imageData.data[3] = 255;
  return imageData;
};

/**
 * Reads and perturbs pixels from an export-only canvas copy. Small canvases use
 * the full image. Large canvases use one deterministic 1×1 mutation when the
 * caller knows drawing has occurred. The opaque mutation survives lossy export
 * flattening without scanning for content; known-blank sources stay native.
 */
export type ExportMutationInput = {
  width: number;
  height: number;
  seed: number;
  readImageData: (x: number, y: number, width: number, height: number) => ImageData;
  sourceKnownBlank?: boolean;
};

export const createExportMutation = ({
  width,
  height,
  seed,
  readImageData,
  sourceKnownBlank = false,
}: ExportMutationInput): CanvasExportMutation | null => {
  if (width === 0 || height === 0) {
    return null;
  }

  if (!shouldPerturbSyncExport(width, height)) {
    if (sourceKnownBlank) {
      return null;
    }
    const x = Math.abs(seed) % width;
    const y = Math.abs(Math.floor(seed / width)) % height;
    return {
      imageData: perturbLargeCanvasPixel(readImageData(x, y, 1, 1), seed),
      x,
      y,
    };
  }

  const imageData = readImageData(0, 0, width, height);
  if (isImageDataTransparent(imageData)) {
    return null;
  }

  return {
    imageData: perturbCanvasImageData(imageData, seed),
    x: 0,
    y: 0,
  };
};

/**
 * True when every pixel is fully transparent (alpha byte = 0). Such a canvas is
 * blank / never-drawn and carries zero fingerprinting entropy. Callers skip
 * perturbation for these: a blank canvas must read back identically (native)
 * across every realm — including ones the parent runtime cannot reach, such as a
 * detached/foreign `window[n]` (CreepJS's "dead" iframe context) — otherwise the
 * realms disagree and the inconsistency is itself a spoofer tell. Noising a
 * zero-entropy surface adds no privacy, only a detectable mismatch.
 */
export const isImageDataTransparent = (imageData: ImageData): boolean => {
  const { data } = imageData;
  for (let alphaOffset = 3; alphaOffset < data.length; alphaOffset += 4) {
    if (data[alphaOffset] !== 0) {
      return false;
    }
  }
  return true;
};

/** Alpha byte offset for the pixel that owns the given RGBA byte offset. */
const alphaOffsetForRgbaOffset = (rgbaOffset: number): number =>
  rgbaOffset - (rgbaOffset % 4) + 3;

/**
 * Deterministically walk the seed-selected RGB channel mutations. Each selected
 * RGB channel is visited exactly once with the RNG state at selection time; both
 * the offset enumeration and the in-place perturbation drive off this same walk
 * so they stay byte-for-byte consistent.
 */
const forEachCanvasMutation = (
  width: number,
  height: number,
  seed: number,
  visit: (rgbaOffset: number, state: number) => void,
): void => {
  const totalRgbChannels = width * height * 3;
  if (totalRgbChannels <= 0) {
    return;
  }

  const mutationBudget = Math.min(
    getCanvasMutationBudget(width, height),
    totalRgbChannels,
  );
  if (mutationBudget <= 0) {
    return;
  }

  const selectedRgbOffsets = new Set<number>();
  let state = mixCanvasNoiseState(seed, width, height, totalRgbChannels);

  while (selectedRgbOffsets.size < mutationBudget) {
    const rgbaOffset = toRgbaOffset(state % totalRgbChannels);
    if (!selectedRgbOffsets.has(rgbaOffset)) {
      selectedRgbOffsets.add(rgbaOffset);
      visit(rgbaOffset, state);
    }
    state = stepCanvasNoiseState(state);
  }
};

export const getCanvasRgbaOffsets = (
  width: number,
  height: number,
  seed: number,
): number[] => {
  const mutatedOffsets = new Set<number>();

  forEachCanvasMutation(width, height, seed, (rgbaOffset) => {
    mutatedOffsets.add(rgbaOffset);
    // The pixel's alpha byte is also nudged (see perturbCanvasImageData), so it
    // must be reported as a mutated offset to keep idempotency tracking consistent.
    mutatedOffsets.add(alphaOffsetForRgbaOffset(rgbaOffset));
  });

  return [...mutatedOffsets];
};

/**
 * Perturb a NON-blank canvas's pixels. Callers must first skip fully transparent
 * canvases via {@link isImageDataTransparent} (a blank canvas must stay
 * native across all realms — see that helper). For drawn canvases this nudges
 * R/G/B plus the pixel's alpha channel; the alpha nudge keeps noise effective on
 * semi-transparent regions where an RGB-only change would be discarded by the
 * canvas's premultiplied-alpha backing store.
 */
export const perturbCanvasImageData = (
  imageData: ImageData,
  seed: number,
): ImageData => {
  const { data, width, height } = imageData;
  const mutatedAlphaOffsets = new Set<number>();

  forEachCanvasMutation(width, height, seed, (rgbaOffset, state) => {
    const currentValue = data[rgbaOffset]!;
    data[rgbaOffset] = clampByte(
      currentValue + chooseChannelDelta(currentValue, state),
    );

    const alphaOffset = alphaOffsetForRgbaOffset(rgbaOffset);
    if (!mutatedAlphaOffsets.has(alphaOffset)) {
      mutatedAlphaOffsets.add(alphaOffset);
      const currentAlpha = data[alphaOffset]!;
      data[alphaOffset] = clampByte(
        currentAlpha + chooseChannelDelta(currentAlpha, state),
      );
    }
  });

  return imageData;
};
