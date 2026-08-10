import { createNativeSource, maskAsNative } from "../native/native-mask";
import {
  createPrivateWeakMap,
  createPrivateWeakSet,
  createPrivateRecord,
  privateObjectCreate,
  privateDefineProperty,
  privateOwnDescriptor,
  privateReflectApply,
  privateWeakMapGet,
  privateWeakMapSet,
  privateWeakSetAdd,
  privateWeakSetHas,
} from "../runtime/primordials";

type ErrorValues = Pick<GeolocationPositionError, "code" | "message">;
type ErrorProperty = keyof ErrorValues;

const errorValues = createPrivateWeakMap<object, ErrorValues>();
const patchedPrototypes = createPrivateWeakSet<object>();
const fallbackPrototypes = createPrivateWeakMap<object, object>();

const tryReadGetter = (
  getter: (() => unknown) | undefined,
  receiver: object,
  nativeGetter: () => unknown,
  wrapperGetter: (() => unknown) | undefined,
): { value: number | string } | undefined => {
  if (!getter || getter === nativeGetter || getter === wrapperGetter) return undefined;
  try {
    return { value: privateReflectApply(getter, receiver, []) as number | string };
  } catch {
    return undefined;
  }
};

const readNativeErrorPrototype = (
  targetGlobal: typeof globalThis,
): object | undefined => {
  try {
    return (
      targetGlobal as typeof globalThis & {
        GeolocationPositionError?: { prototype?: object };
      }
    ).GeolocationPositionError?.prototype;
  } catch {
    return undefined;
  }
};

const getErrorPrototype = (targetGlobal: typeof globalThis): object => {
  const nativePrototype = readNativeErrorPrototype(targetGlobal);
  if (nativePrototype) return nativePrototype;
  const existingFallback = privateWeakMapGet(fallbackPrototypes, targetGlobal);
  if (existingFallback) return existingFallback;

  const fallback = createPrivateRecord();
  const defineFallback = (property: ErrorProperty): void => {
    const getter = privateOwnDescriptor(
      {
        get [property](): number | string {
          const value = privateWeakMapGet(errorValues, this)?.[property];
          if (value !== undefined) return value;
          throw new TypeError("Illegal invocation");
        },
      },
      property,
    )?.get;
    if (!getter) return;
    privateDefineProperty(fallback, property, {
      configurable: true,
      enumerable: true,
      get: maskAsNative(getter, createNativeSource(property, "get"), getter.length),
    });
  };
  defineFallback("code");
  defineFallback("message");
  privateWeakMapSet(fallbackPrototypes, targetGlobal, fallback);
  return fallback;
};

const patchPrototype = (prototype: object, delegatePrototype?: object): void => {
  if (privateWeakSetHas(patchedPrototypes, prototype)) return;

  const patch = (property: ErrorProperty): void => {
    const descriptor = privateOwnDescriptor(prototype, property);
    const nativeGetter = descriptor?.get;
    if (typeof nativeGetter !== "function" || descriptor?.configurable === false)
      return;
    const getter = privateOwnDescriptor(
      {
        get [property](): number | string {
          if (
            (typeof this !== "object" && typeof this !== "function") ||
            this === null
          ) {
            return privateReflectApply(nativeGetter, this, []) as number | string;
          }

          const localValue = privateWeakMapGet(errorValues, this)?.[property];
          if (localValue !== undefined) return localValue;

          try {
            return privateReflectApply(nativeGetter, this, []) as number | string;
          } catch (nativeError) {
            const delegate = delegatePrototype
              ? privateOwnDescriptor(delegatePrototype, property)?.get
              : undefined;
            const delegatedValue = tryReadGetter(delegate, this, nativeGetter, getter);
            if (delegatedValue) return delegatedValue.value;
            throw nativeError;
          }
        },
      },
      property,
    )?.get;
    if (!getter) return;

    privateDefineProperty(prototype, property, {
      ...descriptor,
      get: maskAsNative(
        getter,
        createNativeSource(property, "get"),
        nativeGetter.length,
      ),
    });
  };
  patch("code");
  patch("message");
  privateWeakSetAdd(patchedPrototypes, prototype);
};

/** Patches only the target realm and delegates reads to an optional producer realm. */
export const installGeoErrorPrototype = (
  targetGlobal: typeof globalThis,
  delegateGlobal?: typeof globalThis,
): void => {
  const targetPrototype = getErrorPrototype(targetGlobal);
  patchPrototype(
    targetPrototype,
    delegateGlobal ? readNativeErrorPrototype(delegateGlobal) : undefined,
  );
};

export const createGeoErrorFactory = (
  targetGlobal: typeof globalThis,
): ((code: number, message: string) => GeolocationPositionError) => {
  const prototype = getErrorPrototype(targetGlobal);
  let delegateGlobal: typeof globalThis | undefined;
  try {
    if (targetGlobal.frameElement) {
      delegateGlobal = targetGlobal.parent as unknown as typeof globalThis;
    }
  } catch {
    // Cross-origin parents cannot provide a producer-realm getter.
  }
  installGeoErrorPrototype(targetGlobal, delegateGlobal);
  return (code, message) => {
    const error = privateObjectCreate<GeolocationPositionError>(prototype);
    const values = createPrivateRecord<ErrorValues>();
    privateDefineProperty(values, "code", { value: code });
    privateDefineProperty(values, "message", { value: message });
    privateWeakMapSet(errorValues, error, values);
    return error;
  };
};

export const createGeoTimeoutReporter = (
  targetGlobal: typeof globalThis,
): ((callback?: PositionErrorCallback | null) => void) => {
  const createError = createGeoErrorFactory(targetGlobal);
  return (callback) => callback?.(createError(3, "Timeout expired"));
};
