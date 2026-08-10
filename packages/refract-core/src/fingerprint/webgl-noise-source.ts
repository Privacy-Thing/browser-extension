export const WEBGL_NOISE_SOURCE = `    const WEBGL_VALUES_PER_CHANGE = 512;
    const WEBGL_MIN_BUDGET = 1;
    const WEBGL_MAX_BUDGET = 12;
    const WEBGL_STATE_FALLBACK = 0x9e3779b9;
    const WEBGL_ZERO_FALLBACK = 0x85ebca6b;
    const FLOAT_DELTA = 1 / 65536;
    const typedArrayPrototype = Object.getPrototypeOf(Uint8Array.prototype);
    const typedArrayBufferGetter = Object.getOwnPropertyDescriptor(
      typedArrayPrototype,
      "buffer"
    ).get;
    const typedArrayByteLength = Object.getOwnPropertyDescriptor(
      typedArrayPrototype,
      "byteLength"
    ).get;
    const typedArrayOffsetGetter = Object.getOwnPropertyDescriptor(
      typedArrayPrototype,
      "byteOffset"
    ).get;
    const typedArrayLengthGetter = Object.getOwnPropertyDescriptor(
      typedArrayPrototype,
      "length"
    ).get;
    const typedArrayTagGetter = Object.getOwnPropertyDescriptor(
      typedArrayPrototype,
      Symbol.toStringTag
    ).get;
    const dataViewBufferGetter = Object.getOwnPropertyDescriptor(DataView.prototype, "buffer").get;
    const dataViewByteLengthGetter = Object.getOwnPropertyDescriptor(
      DataView.prototype,
      "byteLength"
    ).get;
    const dataViewByteOffsetGetter = Object.getOwnPropertyDescriptor(
      DataView.prototype,
      "byteOffset"
    ).get;
    const numericArrayConstructors = {
      Uint8Array,
      Uint8ClampedArray,
      Int8Array,
      Uint16Array,
      Int16Array,
      Uint32Array,
      Int32Array,
      Float32Array,
      Float64Array
    };
    const numericBytesPerElement = {
      Uint8Array: Uint8Array.BYTES_PER_ELEMENT,
      Uint8ClampedArray: Uint8ClampedArray.BYTES_PER_ELEMENT,
      Int8Array: Int8Array.BYTES_PER_ELEMENT,
      Uint16Array: Uint16Array.BYTES_PER_ELEMENT,
      Int16Array: Int16Array.BYTES_PER_ELEMENT,
      Uint32Array: Uint32Array.BYTES_PER_ELEMENT,
      Int32Array: Int32Array.BYTES_PER_ELEMENT,
      Float32Array: Float32Array.BYTES_PER_ELEMENT,
      Float64Array: Float64Array.BYTES_PER_ELEMENT
    };

    const getSafeViewInfo = (value) => {
      try {
        const kind = Reflect.apply(typedArrayTagGetter, value, []);
        if (typeof kind === "string" && Object.hasOwn(numericArrayConstructors, kind)) {
          return {
            buffer: Reflect.apply(typedArrayBufferGetter, value, []),
            byteLength: Reflect.apply(typedArrayByteLength, value, []),
            byteOffset: Reflect.apply(typedArrayOffsetGetter, value, []),
            bytesPerElement: numericBytesPerElement[kind],
            kind,
            length: Reflect.apply(typedArrayLengthGetter, value, [])
          };
        }
      } catch {}
      try {
        const byteLength = Reflect.apply(dataViewByteLengthGetter, value, []);
        return {
          buffer: Reflect.apply(dataViewBufferGetter, value, []),
          byteLength,
          byteOffset: Reflect.apply(dataViewByteOffsetGetter, value, []),
          bytesPerElement: 1,
          kind: "DataView",
          length: byteLength
        };
      } catch {
        return null;
      }
    };

    const createSafeView = (info, relativeByteOffset, byteLength) => {
      const byteOffset = info.byteOffset + relativeByteOffset;
      if (info.kind === "DataView") return new DataView(info.buffer, byteOffset, byteLength);
      const Constructor = numericArrayConstructors[info.kind];
      return new Constructor(info.buffer, byteOffset, byteLength / info.bytesPerElement);
    };

    const stepNoiseState = (state) => {
      let next = (state || WEBGL_STATE_FALLBACK) >>> 0;
      next ^= next << 13;
      next ^= next >>> 17;
      next ^= next << 5;
      next >>>= 0;
      return next === 0 ? WEBGL_ZERO_FALLBACK : next;
    };

    const mixNoiseState = (shape, length, bytesPerElement) => {
      const mixed =
        (readPixelsNoiseSeed ^
          Math.imul(shape.x | 0, 0x85ebca6b) ^
          Math.imul(shape.y | 0, 0xc2b2ae35) ^
          Math.imul(shape.width | 0, 0x27d4eb2f) ^
          Math.imul(shape.height | 0, 0x165667b1) ^
          Math.imul(shape.format | 0, 0xd3a2646c) ^
          Math.imul(shape.type | 0, 0xfd7046c5) ^
          Math.imul(length | 0, 0xb55a4f09) ^
          Math.imul(bytesPerElement | 0, 0x94d049bb)) >>> 0;

      return stepNoiseState(mixed);
    };

    const getMutationBudget = (length) => {
      if (length <= 0) {
        return 0;
      }

      return Math.min(
        WEBGL_MAX_BUDGET,
        Math.max(
          WEBGL_MIN_BUDGET,
          Math.ceil(length / WEBGL_VALUES_PER_CHANGE)
        )
      );
    };

    const chooseIntegerDelta = (value, minValue, maxValue, state) => {
      if (value <= minValue) {
        return 1;
      }

      if (value >= maxValue) {
        return -1;
      }

      return (state & 1) === 0 ? -1 : 1;
    };

    const chooseFloatDelta = (value, state) => {
      if (!Number.isFinite(value)) return 0;
      if (value <= 0) return FLOAT_DELTA;
      if (value >= 1) return -FLOAT_DELTA;
      return (state & 1) === 0 ? -FLOAT_DELTA : FLOAT_DELTA;
    };

    const toWebIDLInteger = (value, signed) => {
      const number = +value;
      if (!Number.isFinite(number) || number === 0) return 0;
      const integer = Math.trunc(number);
      const modulo = ((integer % 0x100000000) + 0x100000000) % 0x100000000;
      return signed && modulo >= 0x80000000 ? modulo - 0x100000000 : modulo;
    };
    const toWebIDLInt32 = (value) => toWebIDLInteger(value, true);
    const toWebIDLUint32 = (value) => toWebIDLInteger(value, false);

    const normalizeReadPixelsArgs = (args) => {
      if (args.length < 7 || getSafeViewInfo(args[6]) === null) {
        return Array.from(args);
      }
      const normalized = Array.from(args);
      normalized[0] = toWebIDLInt32(args[0]);
      normalized[1] = toWebIDLInt32(args[1]);
      normalized[2] = toWebIDLInt32(args[2]);
      normalized[3] = toWebIDLInt32(args[3]);
      normalized[4] = toWebIDLUint32(args[4]);
      normalized[5] = toWebIDLUint32(args[5]);
      if (args.length > 7) normalized[7] = toWebIDLUint32(args[7]);
      return normalized;
    };

    const getReadPixelsCallShape = (args) => ({
      x: toWebIDLInt32(args[0]),
      y: toWebIDLInt32(args[1]),
      width: toWebIDLInt32(args[2]),
      height: toWebIDLInt32(args[3]),
      format: toWebIDLUint32(args[4]),
      type: toWebIDLUint32(args[5])
    });

    const readPackInteger = (value, fallback) =>
      typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : fallback;

    const getReadPixelsPackState = (context, nativeGetParameter, webGL2) => {
      const alignment = readPackInteger(
        Reflect.apply(nativeGetParameter, context, [0x0d05]),
        4
      );
      if (!webGL2) {
        return { alignment, rowLength: 0, skipPixels: 0, skipRows: 0 };
      }
      return {
        alignment,
        rowLength: readPackInteger(Reflect.apply(nativeGetParameter, context, [0x0d02]), 0),
        skipPixels: readPackInteger(Reflect.apply(nativeGetParameter, context, [0x0d04]), 0),
        skipRows: readPackInteger(Reflect.apply(nativeGetParameter, context, [0x0d03]), 0)
      };
    };

    const getFormatComponentCount = (format) => {
      if ([0x1906, 0x1909, 0x1903, 0x8d94, 0x1902].includes(format)) return 1;
      if ([0x190a, 0x8227, 0x8228, 0x84f9].includes(format)) return 2;
      if ([0x1907, 0x8d98].includes(format)) return 3;
      if ([0x1908, 0x8d99].includes(format)) return 4;
      return null;
    };

    const getReadPixelsBpp = (format, type) => {
      if ([0x8363, 0x8033, 0x8034].includes(type)) return 2;
      if ([0x8368, 0x8c3b, 0x8c3e, 0x84fa].includes(type)) return 4;
      if (type === 0x8dad) return 8;
      const components = getFormatComponentCount(format);
      if (components === null) return null;
      if ([0x1400, 0x1401].includes(type)) return components;
      if ([0x1402, 0x1403, 0x140b, 0x8d61].includes(type)) return components * 2;
      if ([0x1404, 0x1405, 0x1406].includes(type)) return components * 4;
      return null;
    };

    const captureReadPixelsCall = (args, packState = {
      alignment: 4,
      rowLength: 0,
      skipPixels: 0,
      skipRows: 0
    }) => {
      const candidate = args[6];
      const viewInfo = getSafeViewInfo(candidate);
      if (viewInfo === null) return null;
      const width = toWebIDLInt32(args[2]);
      const height = toWebIDLInt32(args[3]);
      const format = toWebIDLUint32(args[4]);
      const type = toWebIDLUint32(args[5]);
      const bytesPerPixel = getReadPixelsBpp(format, type);
      if (
        width <= 0 ||
        height <= 0 ||
        bytesPerPixel === null
      ) return null;

      const bytesPerElement = viewInfo.bytesPerElement;
      const rawOffset = args[7] === undefined ? 0 : toWebIDLUint32(args[7]);
      const rowLength = packState.rowLength > 0 ? packState.rowLength : width;
      if (
        ![1, 2, 4, 8].includes(packState.alignment) ||
        rowLength < width ||
        packState.skipPixels + width > rowLength ||
        bytesPerPixel % bytesPerElement !== 0
      ) return null;

      const rowStride = Math.ceil(rowLength * bytesPerPixel / packState.alignment) *
        packState.alignment;
      const relativeByteOffset = rawOffset * bytesPerElement +
        packState.skipRows * rowStride +
        packState.skipPixels * bytesPerPixel;
      const requiredEnd = relativeByteOffset +
        (height - 1) * rowStride +
        width * bytesPerPixel;
      if (
        !Number.isSafeInteger(relativeByteOffset) ||
        !Number.isSafeInteger(requiredEnd) ||
        relativeByteOffset < 0 ||
        requiredEnd > viewInfo.byteLength ||
        relativeByteOffset % bytesPerElement !== 0
      ) return null;

      const captureBytes = Math.min(requiredEnd - relativeByteOffset, 65536);
      const alignedCaptureBytes = captureBytes - (captureBytes % bytesPerElement);
      const destination = createSafeView(
        viewInfo,
        relativeByteOffset,
        alignedCaptureBytes
      );
      if (alignedCaptureBytes <= 0) return null;

      const eligibleIndexes = [];
      const rowElements = width * bytesPerPixel / bytesPerElement;
      for (let row = 0; row < height; row += 1) {
        const rowByteOffset = row * rowStride;
        if (rowByteOffset >= alignedCaptureBytes || rowByteOffset % bytesPerElement !== 0) break;
        const rowStart = rowByteOffset / bytesPerElement;
        const availableElements = Math.floor(
          (alignedCaptureBytes - rowByteOffset) / bytesPerElement
        );
        for (let index = 0; index < Math.min(rowElements, availableElements); index += 1) {
          eligibleIndexes.push(rowStart + index);
        }
      }
      return eligibleIndexes.length > 0 ? { destination, eligibleIndexes } : null;
    };

    const perturbCapturedPixels = (captured, shape) => {
      const value = captured.destination;
      const candidates = captured.eligibleIndexes;
      const length = value instanceof DataView ? value.byteLength : value.length;
      const bytesPerElement = value instanceof DataView ? 1 : value.BYTES_PER_ELEMENT;
      const mutationBudget = Math.min(getMutationBudget(length), candidates.length);
      if (mutationBudget <= 0) return false;

      const bytes = value instanceof DataView
        ? new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
        : null;
      const mutatedIndexes = new Set();
      let state = mixNoiseState(shape, length, bytesPerElement);
      while (mutatedIndexes.size < mutationBudget) {
        const index = candidates[state % candidates.length];
        if (!mutatedIndexes.has(index)) {
          if (bytes !== null) {
            bytes[index] = (bytes[index] + chooseIntegerDelta(bytes[index], 0, 255, state)) & 0xff;
          } else if (value instanceof Float32Array || value instanceof Float64Array) {
            value[index] += chooseFloatDelta(value[index], state);
          } else if (value instanceof Uint8ClampedArray) {
            value[index] += chooseIntegerDelta(value[index], 0, 255, state);
          } else if (value instanceof Uint8Array) {
            value[index] = (value[index] + chooseIntegerDelta(value[index], 0, 255, state)) & 0xff;
          } else if (value instanceof Int8Array) {
            value[index] += chooseIntegerDelta(value[index], -128, 127, state);
          } else if (value instanceof Uint16Array) {
            value[index] += chooseIntegerDelta(value[index], 0, 65535, state);
          } else if (value instanceof Int16Array) {
            value[index] += chooseIntegerDelta(value[index], -32768, 32767, state);
          } else if (value instanceof Uint32Array) {
            value[index] += chooseIntegerDelta(value[index], 0, 0xffffffff, state);
          } else if (value instanceof Int32Array) {
            value[index] += chooseIntegerDelta(value[index], -2147483648, 2147483647, state);
          }
          mutatedIndexes.add(index);
        }
        state = stepNoiseState(state);
      }
      return true;
    };`;
