/**
 * Deterministic WebGL readback perturbation for `readPixels()`.
 *
 * The native WebGL call remains authoritative for validation, GL errors, and
 * filling the destination buffer. This helper only mutates the successfully
 * populated array view afterwards using a tiny, seed-based budget.
 */

const WEBGL_VALUES_PER_CHANGE = 512;
const WEBGL_MIN_BUDGET = 1;
const WEBGL_MAX_BUDGET = 12;
const WEBGL_MAX_CAPTURE_BYTES = 65_536;
const WEBGL_STATE_FALLBACK = 0x9e3779b9;
const WEBGL_ZERO_FALLBACK = 0x85ebca6b;
const FLOAT_DELTA = 1 / 65_536;

type ReadPixelsCallShape = {
  x: number;
  y: number;
  width: number;
  height: number;
  format: number;
  type: number;
};

type MutableNumericArray =
  | Uint8Array
  | Uint8ClampedArray
  | Int8Array
  | Uint16Array
  | Int16Array
  | Uint32Array
  | Int32Array
  | Float32Array
  | Float64Array;

type MutableNumericArrayName =
  | "Uint8Array"
  | "Uint8ClampedArray"
  | "Int8Array"
  | "Uint16Array"
  | "Int16Array"
  | "Uint32Array"
  | "Int32Array"
  | "Float32Array"
  | "Float64Array";

type NumericArrayConstructor = new (
  buffer: ArrayBufferLike,
  byteOffset: number,
  length: number,
) => MutableNumericArray;

type SafeArrayBufferViewInfo = {
  buffer: ArrayBufferLike;
  byteLength: number;
  byteOffset: number;
  bytesPerElement: number;
  kind: MutableNumericArrayName | "DataView";
  length: number;
};

const typedArrayPrototype = Object.getPrototypeOf(Uint8Array.prototype) as object;
const typedArrayBufferGetter = Object.getOwnPropertyDescriptor(
  typedArrayPrototype,
  "buffer",
)!.get!;
const typedArrayByteLength = Object.getOwnPropertyDescriptor(
  typedArrayPrototype,
  "byteLength",
)!.get!;
const typedArrayOffsetGetter = Object.getOwnPropertyDescriptor(
  typedArrayPrototype,
  "byteOffset",
)!.get!;
const typedArrayLengthGetter = Object.getOwnPropertyDescriptor(
  typedArrayPrototype,
  "length",
)!.get!;
const typedArrayTagGetter = Object.getOwnPropertyDescriptor(
  typedArrayPrototype,
  Symbol.toStringTag,
)!.get!;
const dataViewBufferGetter = Object.getOwnPropertyDescriptor(
  DataView.prototype,
  "buffer",
)!.get!;
const dataViewByteLengthGetter = Object.getOwnPropertyDescriptor(
  DataView.prototype,
  "byteLength",
)!.get!;
const dataViewByteOffsetGetter = Object.getOwnPropertyDescriptor(
  DataView.prototype,
  "byteOffset",
)!.get!;

const numericArrayConstructors: Readonly<
  Record<MutableNumericArrayName, NumericArrayConstructor>
> = {
  Uint8Array,
  Uint8ClampedArray,
  Int8Array,
  Uint16Array,
  Int16Array,
  Uint32Array,
  Int32Array,
  Float32Array,
  Float64Array,
};

const numericBytesPerElement: Readonly<Record<MutableNumericArrayName, number>> = {
  Uint8Array: Uint8Array.BYTES_PER_ELEMENT,
  Uint8ClampedArray: Uint8ClampedArray.BYTES_PER_ELEMENT,
  Int8Array: Int8Array.BYTES_PER_ELEMENT,
  Uint16Array: Uint16Array.BYTES_PER_ELEMENT,
  Int16Array: Int16Array.BYTES_PER_ELEMENT,
  Uint32Array: Uint32Array.BYTES_PER_ELEMENT,
  Int32Array: Int32Array.BYTES_PER_ELEMENT,
  Float32Array: Float32Array.BYTES_PER_ELEMENT,
  Float64Array: Float64Array.BYTES_PER_ELEMENT,
};

const isMutableArrayName = (value: unknown): value is MutableNumericArrayName =>
  typeof value === "string" && Object.hasOwn(numericArrayConstructors, value);

const getSafeViewInfo = (value: unknown): SafeArrayBufferViewInfo | null => {
  try {
    const kind = Reflect.apply(typedArrayTagGetter, value, []) as unknown;
    if (isMutableArrayName(kind)) {
      return {
        buffer: Reflect.apply(typedArrayBufferGetter, value, []) as ArrayBufferLike,
        byteLength: Reflect.apply(typedArrayByteLength, value, []) as number,
        byteOffset: Reflect.apply(typedArrayOffsetGetter, value, []) as number,
        bytesPerElement: numericBytesPerElement[kind],
        kind,
        length: Reflect.apply(typedArrayLengthGetter, value, []) as number,
      };
    }
  } catch {
    // DataView does not carry TypedArray internal slots; try its intrinsic getters below.
  }

  try {
    const byteLength = Reflect.apply(dataViewByteLengthGetter, value, []) as number;
    return {
      buffer: Reflect.apply(dataViewBufferGetter, value, []) as ArrayBufferLike,
      byteLength,
      byteOffset: Reflect.apply(dataViewByteOffsetGetter, value, []) as number,
      bytesPerElement: 1,
      kind: "DataView",
      length: byteLength,
    };
  } catch {
    return null;
  }
};

const createSafeView = (
  info: SafeArrayBufferViewInfo,
  relativeByteOffset: number,
  byteLength: number,
): ArrayBufferView => {
  const byteOffset = info.byteOffset + relativeByteOffset;
  if (info.kind === "DataView") {
    return new DataView(info.buffer, byteOffset, byteLength);
  }

  const Constructor = numericArrayConstructors[info.kind];
  return new Constructor(info.buffer, byteOffset, byteLength / info.bytesPerElement);
};

const xorshift32 = (value: number): number => {
  let next = value >>> 0;
  next ^= next << 13;
  next ^= next >>> 17;
  next ^= next << 5;
  return next >>> 0;
};

const stepNoiseState = (state: number): number => {
  const next = xorshift32(state || WEBGL_STATE_FALLBACK);
  return next === 0 ? WEBGL_ZERO_FALLBACK : next;
};

const mixNoiseState = (
  seed: number,
  shape: ReadPixelsCallShape,
  length: number,
  bytesPerElement: number,
): number => {
  const mixed =
    (seed ^
      Math.imul(shape.x | 0, 0x85ebca6b) ^
      Math.imul(shape.y | 0, 0xc2b2ae35) ^
      Math.imul(shape.width | 0, 0x27d4eb2f) ^
      Math.imul(shape.height | 0, 0x165667b1) ^
      Math.imul(shape.format | 0, 0xd3a2646c) ^
      Math.imul(shape.type | 0, 0xfd7046c5) ^
      Math.imul(length | 0, 0xb55a4f09) ^
      Math.imul(bytesPerElement | 0, 0x94d049bb)) >>>
    0;

  return stepNoiseState(mixed);
};

const getMutationBudget = (length: number): number => {
  if (length <= 0) {
    return 0;
  }

  return Math.min(
    WEBGL_MAX_BUDGET,
    Math.max(WEBGL_MIN_BUDGET, Math.ceil(length / WEBGL_VALUES_PER_CHANGE)),
  );
};

const chooseIntegerDelta = (
  value: number,
  minValue: number,
  maxValue: number,
  state: number,
): number => {
  if (value <= minValue) {
    return 1;
  }

  if (value >= maxValue) {
    return -1;
  }

  return (state & 1) === 0 ? -1 : 1;
};

const chooseFloatDelta = (value: number, state: number): number => {
  if (!Number.isFinite(value)) {
    return 0;
  }

  if (value <= 0) {
    return FLOAT_DELTA;
  }

  if (value >= 1) {
    return -FLOAT_DELTA;
  }

  return (state & 1) === 0 ? -FLOAT_DELTA : FLOAT_DELTA;
};

const isMutableNumericArray = (value: ArrayBufferView): value is MutableNumericArray =>
  value instanceof Uint8Array ||
  value instanceof Uint8ClampedArray ||
  value instanceof Int8Array ||
  value instanceof Uint16Array ||
  value instanceof Int16Array ||
  value instanceof Uint32Array ||
  value instanceof Int32Array ||
  value instanceof Float32Array ||
  value instanceof Float64Array;

const perturbNumericArray = (
  values: MutableNumericArray,
  seed: number,
  shape: ReadPixelsCallShape,
  eligibleIndexes?: readonly number[],
): void => {
  const candidates =
    eligibleIndexes ?? Array.from({ length: values.length }, (_, index) => index);
  const mutationBudget = Math.min(getMutationBudget(values.length), candidates.length);
  if (mutationBudget <= 0) {
    return;
  }

  const mutatedIndexes = new Set<number>();
  let state = mixNoiseState(seed, shape, values.length, values.BYTES_PER_ELEMENT);

  while (mutatedIndexes.size < mutationBudget) {
    const index = candidates[state % candidates.length]!;
    if (!mutatedIndexes.has(index)) {
      if (values instanceof Float32Array || values instanceof Float64Array) {
        values[index] = values[index]! + chooseFloatDelta(values[index]!, state);
      } else if (values instanceof Uint8ClampedArray) {
        values[index] =
          values[index]! + chooseIntegerDelta(values[index]!, 0, 255, state);
      } else if (values instanceof Uint8Array) {
        values[index] =
          (values[index]! + chooseIntegerDelta(values[index]!, 0, 255, state)) & 0xff;
      } else if (values instanceof Int8Array) {
        values[index] =
          values[index]! + chooseIntegerDelta(values[index]!, -128, 127, state);
      } else if (values instanceof Uint16Array) {
        values[index] =
          values[index]! + chooseIntegerDelta(values[index]!, 0, 65535, state);
      } else if (values instanceof Int16Array) {
        values[index] =
          values[index]! + chooseIntegerDelta(values[index]!, -32768, 32767, state);
      } else if (values instanceof Uint32Array) {
        values[index] =
          values[index]! + chooseIntegerDelta(values[index]!, 0, 0xffffffff, state);
      } else if (values instanceof Int32Array) {
        values[index] =
          values[index]! +
          chooseIntegerDelta(values[index]!, -2147483648, 2147483647, state);
      }
      mutatedIndexes.add(index);
    }

    state = stepNoiseState(state);
  }
};

const perturbByteView = (
  value: ArrayBufferView,
  seed: number,
  shape: ReadPixelsCallShape,
  eligibleIndexes?: readonly number[],
): void => {
  const bytes = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  const candidates =
    eligibleIndexes ?? Array.from({ length: bytes.length }, (_, index) => index);
  const mutationBudget = Math.min(getMutationBudget(bytes.length), candidates.length);
  if (mutationBudget <= 0) {
    return;
  }

  const mutatedIndexes = new Set<number>();
  let state = mixNoiseState(seed, shape, bytes.length, 1);

  while (mutatedIndexes.size < mutationBudget) {
    const index = candidates[state % candidates.length]!;
    if (!mutatedIndexes.has(index)) {
      bytes[index] =
        (bytes[index]! + chooseIntegerDelta(bytes[index]!, 0, 255, state)) & 0xff;
      mutatedIndexes.add(index);
    }

    state = stepNoiseState(state);
  }
};

const toWebIDLInteger = (value: unknown, signed: boolean): number => {
  // Unary plus follows WebIDL's ToNumber coercion, including Number objects,
  // valueOf()/toString(), and native TypeErrors for Symbol/BigInt. Wrappers
  // replace the numeric arguments with these primitives before invoking WebGL,
  // so page-controlled coercion runs exactly once.
  const number = +(value as number);
  if (!Number.isFinite(number) || number === 0) {
    return 0;
  }

  const integer = Math.trunc(number);
  const modulo = ((integer % 0x1_0000_0000) + 0x1_0000_0000) % 0x1_0000_0000;
  return signed && modulo >= 0x8000_0000 ? modulo - 0x1_0000_0000 : modulo;
};

const toWebIDLInt32 = (value: unknown): number => toWebIDLInteger(value, true);
const toWebIDLUint32 = (value: unknown): number => toWebIDLInteger(value, false);

/**
 * Converts WebGL numeric arguments once and returns the exact array that must
 * be passed to the native binding. Unsupported destination overloads are left
 * untouched so native validation and coercion order remain authoritative.
 */
export const normalizeReadPixelsArgs = (args: readonly unknown[]): unknown[] => {
  const candidate = args[6];
  if (args.length < 7 || getSafeViewInfo(candidate) === null) {
    return Array.from(args);
  }

  const normalized = Array.from(args);
  normalized[0] = toWebIDLInt32(args[0]);
  normalized[1] = toWebIDLInt32(args[1]);
  normalized[2] = toWebIDLInt32(args[2]);
  normalized[3] = toWebIDLInt32(args[3]);
  normalized[4] = toWebIDLUint32(args[4]);
  normalized[5] = toWebIDLUint32(args[5]);
  if (args.length > 7) {
    normalized[7] = toWebIDLUint32(args[7]);
  }
  return normalized;
};

const PACK_ALIGNMENT = 0x0d05;
const PACK_ROW_LENGTH = 0x0d02;
const PACK_SKIP_ROWS = 0x0d03;
const PACK_SKIP_PIXELS = 0x0d04;

export type ReadPixelsPackState = {
  alignment: number;
  rowLength: number;
  skipPixels: number;
  skipRows: number;
};

const readNonNegativeInteger = (value: unknown, fallback: number): number =>
  typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : fallback;

export const getReadPixelsPackState = (
  context: object,
  nativeGetParameter: (pname: number) => unknown,
  webGL2: boolean,
): ReadPixelsPackState => {
  const alignmentValue = Reflect.apply(nativeGetParameter, context, [PACK_ALIGNMENT]);
  const alignment = readNonNegativeInteger(alignmentValue, 4);
  if (!webGL2) {
    return { alignment, rowLength: 0, skipPixels: 0, skipRows: 0 };
  }

  return {
    alignment,
    rowLength: readNonNegativeInteger(
      Reflect.apply(nativeGetParameter, context, [PACK_ROW_LENGTH]),
      0,
    ),
    skipPixels: readNonNegativeInteger(
      Reflect.apply(nativeGetParameter, context, [PACK_SKIP_PIXELS]),
      0,
    ),
    skipRows: readNonNegativeInteger(
      Reflect.apply(nativeGetParameter, context, [PACK_SKIP_ROWS]),
      0,
    ),
  };
};

const getFormatComponentCount = (format: number): number | null => {
  switch (format) {
    case 0x1906: // ALPHA
    case 0x1909: // LUMINANCE
    case 0x1903: // RED
    case 0x8d94: // RED_INTEGER
    case 0x1902: // DEPTH_COMPONENT
      return 1;
    case 0x190a: // LUMINANCE_ALPHA
    case 0x8227: // RG
    case 0x8228: // RG_INTEGER
    case 0x84f9: // DEPTH_STENCIL
      return 2;
    case 0x1907: // RGB
    case 0x8d98: // RGB_INTEGER
      return 3;
    case 0x1908: // RGBA
    case 0x8d99: // RGBA_INTEGER
      return 4;
    default:
      return null;
  }
};

const getReadPixelsBpp = (format: number, type: number): number | null => {
  switch (type) {
    case 0x8363: // UNSIGNED_SHORT_5_6_5
    case 0x8033: // UNSIGNED_SHORT_4_4_4_4
    case 0x8034: // UNSIGNED_SHORT_5_5_5_1
      return 2;
    case 0x8368: // UNSIGNED_INT_2_10_10_10_REV
    case 0x8c3b: // UNSIGNED_INT_10F_11F_11F_REV
    case 0x8c3e: // UNSIGNED_INT_5_9_9_9_REV
    case 0x84fa: // UNSIGNED_INT_24_8
      return 4;
    case 0x8dad: // FLOAT_32_UNSIGNED_INT_24_8_REV
      return 8;
    default:
      break;
  }

  const components = getFormatComponentCount(format);
  if (components === null) {
    return null;
  }

  switch (type) {
    case 0x1400: // BYTE
    case 0x1401: // UNSIGNED_BYTE
      return components;
    case 0x1402: // SHORT
    case 0x1403: // UNSIGNED_SHORT
    case 0x140b: // HALF_FLOAT
    case 0x8d61: // HALF_FLOAT_OES
      return components * 2;
    case 0x1404: // INT
    case 0x1405: // UNSIGNED_INT
    case 0x1406: // FLOAT
      return components * 4;
    default:
      return null;
  }
};

const createReadPixelsWindow = (
  info: SafeArrayBufferViewInfo,
  relativeByteOffset: number,
  byteLength: number,
): ArrayBufferView => createSafeView(info, relativeByteOffset, byteLength);

export type CapturedReadPixelsCall = {
  destination: ArrayBufferView;
  eligibleIndexes: readonly number[];
};

const alignBytes = (value: number, alignment: number): number =>
  Math.ceil(value / alignment) * alignment;

/** Captures a bounded, type-preserving view of only the native write region. */
export const captureReadPixelsCall = (
  args: readonly unknown[],
  packState: ReadPixelsPackState = {
    alignment: 4,
    rowLength: 0,
    skipPixels: 0,
    skipRows: 0,
  },
): CapturedReadPixelsCall | null => {
  const candidate = args[6];
  const viewInfo = getSafeViewInfo(candidate);
  if (viewInfo === null) {
    return null;
  }
  const width = toWebIDLInt32(args[2]);
  const height = toWebIDLInt32(args[3]);
  const format = toWebIDLUint32(args[4]);
  const type = toWebIDLUint32(args[5]);
  const bytesPerPixel = getReadPixelsBpp(format, type);
  if (width <= 0 || height <= 0 || bytesPerPixel === null) {
    return null;
  }

  const bytesPerElement = viewInfo.bytesPerElement;
  const rawOffset = args[7] === undefined ? 0 : toWebIDLUint32(args[7]);
  const rowLength = packState.rowLength > 0 ? packState.rowLength : width;
  if (
    ![1, 2, 4, 8].includes(packState.alignment) ||
    rowLength < width ||
    packState.skipPixels + width > rowLength ||
    bytesPerPixel % bytesPerElement !== 0
  ) {
    return null;
  }

  const rowStride = alignBytes(rowLength * bytesPerPixel, packState.alignment);
  const relativeByteOffset =
    rawOffset * bytesPerElement +
    packState.skipRows * rowStride +
    packState.skipPixels * bytesPerPixel;
  const requiredEnd =
    relativeByteOffset + (height - 1) * rowStride + width * bytesPerPixel;
  if (
    !Number.isSafeInteger(relativeByteOffset) ||
    !Number.isSafeInteger(requiredEnd) ||
    relativeByteOffset < 0 ||
    requiredEnd > viewInfo.byteLength ||
    relativeByteOffset % bytesPerElement !== 0
  ) {
    return null;
  }

  const captureBytes = Math.min(
    requiredEnd - relativeByteOffset,
    WEBGL_MAX_CAPTURE_BYTES,
  );
  const alignedCaptureBytes = captureBytes - (captureBytes % bytesPerElement);
  if (alignedCaptureBytes <= 0) {
    return null;
  }

  const destination = createReadPixelsWindow(
    viewInfo,
    relativeByteOffset,
    alignedCaptureBytes,
  );
  const eligibleIndexes: number[] = [];
  const rowElements = (width * bytesPerPixel) / bytesPerElement;
  for (let row = 0; row < height; row += 1) {
    const rowByteOffset = row * rowStride;
    if (rowByteOffset >= alignedCaptureBytes || rowByteOffset % bytesPerElement !== 0) {
      break;
    }
    const rowStart = rowByteOffset / bytesPerElement;
    const availableElements = Math.floor(
      (alignedCaptureBytes - rowByteOffset) / bytesPerElement,
    );
    for (let index = 0; index < Math.min(rowElements, availableElements); index += 1) {
      eligibleIndexes.push(rowStart + index);
    }
  }

  return eligibleIndexes.length > 0 ? { destination, eligibleIndexes } : null;
};

export const getReadPixelsCallShape = (
  args: readonly unknown[],
): ReadPixelsCallShape => ({
  x: toWebIDLInt32(args[0]),
  y: toWebIDLInt32(args[1]),
  width: toWebIDLInt32(args[2]),
  height: toWebIDLInt32(args[3]),
  format: toWebIDLUint32(args[4]),
  type: toWebIDLUint32(args[5]),
});

export const perturbReadPixelsView = (
  value: ArrayBufferView,
  seed: number,
  shape: ReadPixelsCallShape,
  eligibleIndexes?: readonly number[],
): void => {
  const viewInfo = getSafeViewInfo(value);
  if (viewInfo === null || viewInfo.byteLength <= 0) {
    return;
  }

  const safeValue = createSafeView(viewInfo, 0, viewInfo.byteLength);

  if (isMutableNumericArray(safeValue)) {
    perturbNumericArray(safeValue, seed, shape, eligibleIndexes);
    return;
  }

  perturbByteView(safeValue, seed, shape, eligibleIndexes);
};

export const perturbCapturedPixels = (
  captured: CapturedReadPixelsCall,
  seed: number,
  shape: ReadPixelsCallShape,
): boolean => {
  if (captured.eligibleIndexes.length === 0) {
    return false;
  }

  perturbReadPixelsView(captured.destination, seed, shape, captured.eligibleIndexes);
  return true;
};

export { WEBGL_NOISE_SOURCE } from "./webgl-noise-source";
