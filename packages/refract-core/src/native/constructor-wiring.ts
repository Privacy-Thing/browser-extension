export type NativeSourceFactory = (name: string, kind?: "function" | "get") => string;

export type NativeMasker = <TFunction extends Function>(
  fn: TFunction,
  source?: string,
  length?: number,
) => TFunction;

type NativeMasking = {
  maskAsNative: NativeMasker;
  createNativeSource: NativeSourceFactory;
};

export const requireNewTarget = (
  nativeConstructor: Function,
  newTarget: Function | undefined,
  args: readonly unknown[],
): Function => {
  if (newTarget) {
    return newTarget;
  }

  // Calling the real Web IDL constructor without `new` lets each engine emit
  // its own native TypeError instead of a Privacy Thing-authored approximation.
  return Reflect.apply(nativeConstructor, undefined, args) as never;
};

export const copyOwnDescriptors = (
  target: object,
  source: object,
  excludedKeys: readonly PropertyKey[] = [],
): void => {
  const excluded = new Set<PropertyKey>(excludedKeys);

  for (const key of Reflect.ownKeys(source)) {
    if (excluded.has(key) || Object.prototype.hasOwnProperty.call(target, key)) {
      continue;
    }

    const descriptor = Object.getOwnPropertyDescriptor(source, key);
    if (!descriptor) {
      continue;
    }

    Object.defineProperty(target, key, descriptor);
  }
};

export const maskOwnMethod = (
  target: object,
  key: PropertyKey,
  sourceName: string,
  masking: NativeMasking,
): void => {
  const descriptor = Object.getOwnPropertyDescriptor(target, key);
  if (!descriptor || typeof descriptor.value !== "function") {
    return;
  }

  Object.defineProperty(target, key, {
    ...descriptor,
    value: masking.maskAsNative(
      descriptor.value,
      masking.createNativeSource(sourceName),
      descriptor.value.length,
    ),
  });
};

export const maskOwnGetter = (
  target: object,
  key: PropertyKey,
  sourceName: string,
  masking: NativeMasking,
): void => {
  const descriptor = Object.getOwnPropertyDescriptor(target, key);
  if (!descriptor || typeof descriptor.get !== "function") {
    return;
  }

  Object.defineProperty(target, key, {
    ...descriptor,
    get: masking.maskAsNative(
      descriptor.get,
      masking.createNativeSource(sourceName, "get"),
      descriptor.get.length,
    ),
  });
};

type FinalizeCtorOptions<TPatched extends Function, TNative extends Function> = {
  patchedConstructor: TPatched;
  patchedPrototype: object;
  nativeConstructor: TNative;
  constructorKey?: PropertyKey;
  excludedConstructorKeys?: readonly PropertyKey[];
  excludedPrototypeKeys?: readonly PropertyKey[];
};

export const finalizePatchedCtor = <
  TPatched extends Function,
  TNative extends Function,
>({
  patchedConstructor,
  patchedPrototype,
  nativeConstructor,
  constructorKey = "constructor",
  excludedConstructorKeys = ["length", "name", "prototype"],
  excludedPrototypeKeys = [],
}: FinalizeCtorOptions<TPatched, TNative>): void => {
  Object.defineProperty(patchedConstructor, "prototype", {
    configurable: false,
    enumerable: false,
    writable: false,
    value: patchedPrototype,
  });
  Object.defineProperty(patchedPrototype, constructorKey, {
    configurable: true,
    value: patchedConstructor,
  });
  Object.setPrototypeOf(patchedConstructor, nativeConstructor);
  copyOwnDescriptors(patchedConstructor, nativeConstructor, excludedConstructorKeys);
  copyOwnDescriptors(patchedPrototype, nativeConstructor.prototype, [
    constructorKey,
    ...excludedPrototypeKeys,
  ]);
};
