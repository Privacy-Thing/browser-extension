const NativeArray = Array;
const NativeMap = Map;
const NativeSet = Set;
const NativeUint32Array = Uint32Array;
const NativeWeakMap = WeakMap;
const NativeWeakSet = WeakSet;
const nativeCrypto = globalThis.crypto;

const nativeArrayIsArray = Array.isArray;
const nativeArrayPush = Array.prototype.push;
const nativeArrayShift = Array.prototype.shift;
const nativeDateNow = Date.now;
const nativeGetRandomValues = nativeCrypto?.getRandomValues;
const nativeJsonStringify = JSON.stringify;
const nativeMapDelete = Map.prototype.delete;
const nativeMapGet = Map.prototype.get;
const nativeMapForEach = Map.prototype.forEach;
const nativeMapSet = Map.prototype.set;
const nativeDefineProperties = Object.defineProperties;
const nativeDefineProperty = Object.defineProperty;
const nativeObjectCreate = Object.create;
const nativeObjectFreeze = Object.freeze;
const nativeOwnDescriptor = Object.getOwnPropertyDescriptor;
const nativeGetPrototype = Object.getPrototypeOf;
const nativeObjectHasOwn = Object.hasOwn;
const nativeObjectKeys = Object.keys;
const nativeSetPrototype = Object.setPrototypeOf;
const nativeIsSafeInteger = Number.isSafeInteger;
const nativePromiseThen = Promise.prototype.then;
const nativeObjectIsExtensible = Object.isExtensible;
const nativeIsPrototypeOf = Object.prototype.isPrototypeOf;
const nativeReflectApply = Reflect.apply;
const nativeReflectConstruct = Reflect.construct;
const nativeDeleteProperty = Reflect.deleteProperty;
const nativeReflectGet = Reflect.get;
const nativeReflectOwnKeys = Reflect.ownKeys;
const nativeSetAdd = Set.prototype.add;
const nativeSetForEach = Set.prototype.forEach;
const nativeSetHas = Set.prototype.has;
const nativeStringIncludes = String.prototype.includes;
const nativeSymbolFor = Symbol.for;
const nativeWeakMapGet = WeakMap.prototype.get;
const nativeWeakMapHas = WeakMap.prototype.has;
const nativeWeakMapDelete = WeakMap.prototype.delete;
const nativeWeakMapSet = WeakMap.prototype.set;
const nativeWeakSetAdd = WeakSet.prototype.add;
const nativeWeakSetDelete = WeakSet.prototype.delete;
const nativeWeakSetHas = WeakSet.prototype.has;

export const createPrivateMap = <K, V>(): Map<K, V> => new NativeMap<K, V>();
export const createPrivateSet = <T>(): Set<T> => new NativeSet<T>();
export const createPrivateWeakMap = <K extends object, V>(): WeakMap<K, V> =>
  new NativeWeakMap<K, V>();
export const createPrivateWeakSet = <T extends object>(): WeakSet<T> =>
  new NativeWeakSet<T>();

export const createPrivateArray = <T>(length: number): T[] => {
  const array = new NativeArray<T>(length);
  nativeReflectApply(nativeSetPrototype, Object, [array, null]);
  return array;
};

/** Creates an ordinary Array DTO intended to cross back into page code. */
export const createPublicArray = <T>(length: number): T[] => new NativeArray<T>(length);

/** Defines an own public-array element without consulting Array.prototype. */
export const privateArraySet = <T>(target: T[], index: number, value: T): void => {
  nativeReflectApply(nativeDefineProperty, Object, [
    target,
    index,
    {
      configurable: true,
      enumerable: true,
      writable: true,
      value,
    },
  ]);
};

export const privateArrayIsArray = (value: unknown): value is unknown[] =>
  nativeReflectApply(nativeArrayIsArray, NativeArray, [value]) as boolean;

export const privateArrayPush = <T>(target: T[], value: T): number =>
  nativeReflectApply(nativeArrayPush, target, [value]) as number;

export const privateArrayShift = <T>(target: T[]): T | undefined =>
  nativeReflectApply(nativeArrayShift, target, []) as T | undefined;

export const privateMapGet = <K, V>(target: Map<K, V>, key: K): V | undefined =>
  nativeReflectApply(nativeMapGet, target, [key]) as V | undefined;

export const privateMapDelete = <K, V>(target: Map<K, V>, key: K): boolean =>
  nativeReflectApply(nativeMapDelete, target, [key]) as boolean;

export const privateMapForEach = <K, V>(
  target: Map<K, V>,
  callback: (value: V, key: K) => void,
): void => {
  nativeReflectApply(nativeMapForEach, target, [callback]);
};

export const privateMapSet = <K, V>(target: Map<K, V>, key: K, value: V): void => {
  nativeReflectApply(nativeMapSet, target, [key, value]);
};

export const privateDefineProperty = <T extends object>(
  target: T,
  property: PropertyKey,
  attributes: PropertyDescriptor & ThisType<unknown>,
): T =>
  nativeReflectApply(nativeDefineProperty, Object, [target, property, attributes]) as T;

export const createPrivateRecord = <T extends object>(): T =>
  nativeReflectApply(nativeObjectCreate, Object, [null]) as T;

export const privateObjectCreate = <T extends object>(prototype: object | null): T =>
  nativeReflectApply(nativeObjectCreate, Object, [prototype]) as T;

export const privateObjectFreeze = <T extends object>(target: T): Readonly<T> =>
  nativeReflectApply(nativeObjectFreeze, Object, [target]) as Readonly<T>;

export const privateDefineProperties = <T extends object>(
  target: T,
  properties: PropertyDescriptorMap & ThisType<unknown>,
): T => nativeReflectApply(nativeDefineProperties, Object, [target, properties]) as T;

export const privateOwnDescriptor = (
  target: object,
  property: PropertyKey,
): PropertyDescriptor | undefined =>
  nativeReflectApply(nativeOwnDescriptor, Object, [target, property]) as
    PropertyDescriptor | undefined;

export const privateGetPrototype = (target: object): object | null =>
  nativeReflectApply(nativeGetPrototype, Object, [target]) as object | null;

export const privateObjectHasOwn = (target: object, property: PropertyKey): boolean =>
  nativeReflectApply(nativeObjectHasOwn, Object, [target, property]) as boolean;

export const privateIsPrototypeOf = (prototype: object, value: unknown): boolean =>
  nativeReflectApply(nativeIsPrototypeOf, prototype, [value]) as boolean;

export const privateSetPrototype = <T extends object>(
  target: T,
  prototype: object | null,
): T => nativeReflectApply(nativeSetPrototype, Object, [target, prototype]) as T;

export const privateObjectKeys = (target: object): string[] =>
  nativeReflectApply(nativeObjectKeys, Object, [target]) as string[];

export const privateIsSafeInteger = (value: unknown): boolean =>
  nativeReflectApply(nativeIsSafeInteger, Number, [value]) as boolean;

export const privatePromiseThen = <TValue, TResult>(
  target: Promise<TValue>,
  onFulfilled: (value: TValue) => TResult | PromiseLike<TResult>,
  onRejected?: (reason: unknown) => TResult | PromiseLike<TResult>,
): Promise<TResult> =>
  nativeReflectApply(nativePromiseThen, target, [
    onFulfilled,
    onRejected,
  ]) as Promise<TResult>;
export const privateIsExtensible = (target: object): boolean =>
  nativeReflectApply(nativeObjectIsExtensible, Object, [target]) as boolean;

export const privateJsonStringify = (value: unknown): string | undefined =>
  nativeReflectApply(nativeJsonStringify, JSON, [value]) as string | undefined;

export const privateReflectApply = <TResult>(
  target: (...args: never[]) => TResult,
  thisArgument: unknown,
  argumentsList: readonly unknown[],
): TResult => nativeReflectApply(target, thisArgument, argumentsList) as TResult;

export const privateReflectConstruct = <TResult extends object>(
  target: Function,
  argumentsList: readonly unknown[],
): TResult =>
  nativeReflectApply(nativeReflectConstruct, Reflect, [
    target,
    argumentsList,
  ]) as TResult;

export const privateDeleteProperty = (target: object, property: PropertyKey): boolean =>
  nativeReflectApply(nativeDeleteProperty, Reflect, [target, property]) as boolean;

export const privateReflectGet = (
  target: object,
  property: PropertyKey,
  receiver?: unknown,
): unknown =>
  nativeReflectApply(nativeReflectGet, Reflect, [target, property, receiver ?? target]);

export const privateReflectOwnKeys = (target: object): PropertyKey[] =>
  nativeReflectApply(nativeReflectOwnKeys, Reflect, [target]) as PropertyKey[];

export const privateSetAdd = <T>(target: Set<T>, value: T): void => {
  nativeReflectApply(nativeSetAdd, target, [value]);
};

export const privateSetForEach = <T>(
  target: Set<T>,
  callback: (value: T) => void,
): void => {
  nativeReflectApply(nativeSetForEach, target, [callback]);
};

export const privateSetHas = <T>(target: ReadonlySet<T>, value: T): boolean =>
  nativeReflectApply(nativeSetHas, target, [value]) as boolean;

export const privateStringIncludes = (value: string, search: string): boolean =>
  nativeReflectApply(nativeStringIncludes, value, [search]) as boolean;

export const privateSymbolFor = (key: string): symbol =>
  nativeReflectApply(nativeSymbolFor, Symbol, [key]) as symbol;

export const privateWeakMapGet = <K extends object, V>(
  target: WeakMap<K, V>,
  key: K,
): V | undefined =>
  nativeReflectApply(nativeWeakMapGet, target, [key]) as V | undefined;

export const privateWeakMapHas = <K extends object, V>(
  target: WeakMap<K, V>,
  key: K,
): boolean => nativeReflectApply(nativeWeakMapHas, target, [key]) as boolean;

export const privateWeakMapDelete = <K extends object, V>(
  target: WeakMap<K, V>,
  key: K,
): boolean => nativeReflectApply(nativeWeakMapDelete, target, [key]) as boolean;

export const privateWeakMapSet = <K extends object, V>(
  target: WeakMap<K, V>,
  key: K,
  value: V,
): void => {
  nativeReflectApply(nativeWeakMapSet, target, [key, value]);
};

export const privateWeakSetAdd = <T extends object>(
  target: WeakSet<T>,
  value: T,
): void => {
  nativeReflectApply(nativeWeakSetAdd, target, [value]);
};

export const privateWeakSetDelete = <T extends object>(
  target: WeakSet<T>,
  value: T,
): boolean => nativeReflectApply(nativeWeakSetDelete, target, [value]) as boolean;

export const privateWeakSetHas = <T extends object>(
  target: WeakSet<T>,
  value: T,
): boolean => nativeReflectApply(nativeWeakSetHas, target, [value]) as boolean;

export const privateDateNow = (): number =>
  nativeReflectApply(nativeDateNow, Date, []) as number;

/** Returns a captured Web Crypto sample in the half-open interval [0, 1). */
export const privateCryptoRandomUnit = (): number => {
  if (!nativeCrypto || typeof nativeGetRandomValues !== "function") {
    throw new Error("Web Crypto getRandomValues is unavailable");
  }

  const values = new NativeUint32Array(1);
  nativeReflectApply(nativeGetRandomValues, nativeCrypto, [values]);
  return (values[0] ?? 0) / 0x1_0000_0000;
};
