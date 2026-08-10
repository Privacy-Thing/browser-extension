import { privateOwnDescriptor, privateGetPrototype } from "../runtime/primordials";

const LOCAL_PROMISE_PROTOTYPE = Promise.prototype;
const PROMISE_SPECIES = Symbol.species;

type DescriptorAnchor = {
  target: object;
  descriptor: PropertyDescriptor;
};

export type BatteryPromisePrimitives = {
  promiseConstructor: object;
  promisePrototype: object;
  constructorAnchor: DescriptorAnchor;
  speciesAnchor: DescriptorAnchor;
  thenAnchor: DescriptorAnchor;
};

const findPropertyAnchor = (
  initialTarget: object | null,
  key: PropertyKey,
): DescriptorAnchor | null => {
  let target = initialTarget;
  for (let depth = 0; target && depth < 32; depth += 1) {
    const descriptor = privateOwnDescriptor(target, key);
    if (descriptor) {
      return { target, descriptor };
    }
    target = privateGetPrototype(target);
  }
  return null;
};

const descriptorMatches = (
  actual: PropertyDescriptor | undefined,
  expected: PropertyDescriptor,
): boolean =>
  actual?.configurable === expected.configurable &&
  actual?.enumerable === expected.enumerable &&
  actual?.get === expected.get &&
  actual?.set === expected.set &&
  actual?.value === expected.value &&
  actual?.writable === expected.writable;

const anchorMatches = (
  initialTarget: object | null,
  key: PropertyKey,
  expected: DescriptorAnchor,
): boolean => {
  const current = findPropertyAnchor(initialTarget, key);
  return (
    current?.target === expected.target &&
    descriptorMatches(current.descriptor, expected.descriptor)
  );
};

export const captureBatteryTools = (
  targetGlobal: typeof globalThis,
): BatteryPromisePrimitives | null => {
  try {
    const PromiseConstructor = targetGlobal.Promise;
    const promisePrototype = PromiseConstructor?.prototype;
    if (!PromiseConstructor || !promisePrototype) {
      return null;
    }
    const constructorAnchor = findPropertyAnchor(promisePrototype, "constructor");
    const speciesAnchor = findPropertyAnchor(PromiseConstructor, PROMISE_SPECIES);
    const thenAnchor = findPropertyAnchor(promisePrototype, "then");
    if (!constructorAnchor || !speciesAnchor || !thenAnchor) {
      return null;
    }
    return {
      promiseConstructor: PromiseConstructor,
      promisePrototype,
      constructorAnchor,
      speciesAnchor,
      thenAnchor,
    };
  } catch {
    return null;
  }
};

export const canAwaitBatteryPromise = (
  primitives: BatteryPromisePrimitives | null,
  nativePromise: Promise<object>,
): boolean => {
  const promisePrototype = privateGetPrototype(nativePromise);
  if (promisePrototype === LOCAL_PROMISE_PROTOTYPE) {
    return true;
  }
  if (!primitives || promisePrototype !== primitives.promisePrototype) {
    return false;
  }
  return (
    anchorMatches(nativePromise, "then", primitives.thenAnchor) &&
    anchorMatches(nativePromise, "constructor", primitives.constructorAnchor) &&
    anchorMatches(
      primitives.promiseConstructor,
      PROMISE_SPECIES,
      primitives.speciesAnchor,
    )
  );
};
