import {
  createPrivateMap,
  createPrivateWeakMap,
  createPrivateWeakSet,
  privateMapGet,
  privateMapSet,
  privateDefineProperty,
  privateOwnDescriptor,
  privateReflectApply,
  privateStringIncludes,
  privateWeakMapGet,
  privateWeakMapHas,
  privateWeakMapSet,
  privateWeakSetAdd,
  privateWeakSetDelete,
  privateWeakSetHas,
} from "../runtime/primordials";

const FALLBACK_SOURCE = "function () { [native code] }";
type ToStringDelegate = (this: Function) => string;

const nativeSources = createPrivateWeakMap<object, string>();
const foreignToStringDelegates = createPrivateMap<number, ToStringDelegate>();
const activeToStringReceivers = createPrivateWeakSet<Function>();
let foreignToStringCount = 0;
const localFunctionPrototype = Function.prototype;
const initialFunctionToString = Function.prototype.toString;

const resolveDelegatedSource = (
  receiver: Function,
  primaryDelegate: ToStringDelegate,
): string => {
  if (privateWeakSetHas(activeToStringReceivers, receiver)) {
    return privateReflectApply(primaryDelegate, receiver, []);
  }
  privateWeakSetAdd(activeToStringReceivers, receiver);
  try {
    const primarySource = privateReflectApply(primaryDelegate, receiver, []);
    if (privateStringIncludes(primarySource, "[native code]")) {
      return primarySource;
    }

    for (let index = 0; index < foreignToStringCount; index += 1) {
      const delegate = privateMapGet(foreignToStringDelegates, index);
      if (!delegate || delegate === primaryDelegate) continue;
      const candidateSource = privateReflectApply(delegate, receiver, []);
      if (
        candidateSource !== primarySource &&
        privateStringIncludes(candidateSource, "[native code]")
      ) {
        return candidateSource;
      }
    }
    return primarySource;
  } finally {
    privateWeakSetDelete(activeToStringReceivers, receiver);
  }
};

const installNativeToString = (): void => {
  const currentToString = privateOwnDescriptor(
    localFunctionPrototype,
    "toString",
  )?.value;
  if (
    typeof currentToString === "function" &&
    privateWeakMapHas(nativeSources, currentToString)
  ) {
    return;
  }
  const delegatedToString =
    typeof currentToString === "function"
      ? (currentToString as ToStringDelegate)
      : initialFunctionToString;

  const patchedToString = {
    toString(this: Function): string {
      if (typeof this !== "function") {
        return privateReflectApply(delegatedToString, this, []);
      }
      const maskedSource = privateWeakMapGet(nativeSources, this);
      if (typeof maskedSource === "string") {
        return maskedSource;
      }

      return resolveDelegatedSource(this, delegatedToString);
    },
  }.toString;

  privateWeakMapSet(
    nativeSources,
    patchedToString,
    privateReflectApply(delegatedToString, delegatedToString, []),
  );

  privateDefineProperty(localFunctionPrototype, "toString", {
    configurable: true,
    enumerable: false,
    writable: true,
    value: patchedToString,
  });
};

export const mirrorNativeToStringInto = (targetGlobal: typeof globalThis): void => {
  installNativeToString();

  const targetFunction = targetGlobal.Function;
  if (!targetFunction?.prototype) {
    return;
  }

  const targetPrototype = targetFunction.prototype;
  if (targetPrototype === localFunctionPrototype) {
    return;
  }

  const targetToStringCandidate = targetPrototype.toString;
  if (
    typeof targetToStringCandidate !== "function" ||
    privateWeakMapHas(nativeSources, targetToStringCandidate)
  ) {
    return;
  }
  const targetToString = targetToStringCandidate as ToStringDelegate;
  const localToString = localFunctionPrototype.toString as ToStringDelegate;
  privateMapSet(foreignToStringDelegates, foreignToStringCount, targetToString);
  foreignToStringCount += 1;
  const mirroredToString = {
    toString(this: Function): string {
      if (typeof this !== "function") {
        return privateReflectApply(targetToString, this, []);
      }
      const maskedSource = privateWeakMapGet(nativeSources, this);
      if (typeof maskedSource === "string") {
        return maskedSource;
      }

      const targetSource = resolveDelegatedSource(this, targetToString);
      if (privateStringIncludes(targetSource, "[native code]")) {
        return targetSource;
      }
      const localSource = privateReflectApply(localToString, this, []);
      return privateStringIncludes(localSource, "[native code]")
        ? localSource
        : targetSource;
    },
  }.toString;
  privateWeakMapSet(
    nativeSources,
    mirroredToString,
    "function toString() { [native code] }",
  );

  privateDefineProperty(targetPrototype, "toString", {
    configurable: true,
    enumerable: false,
    writable: true,
    value: mirroredToString,
  });
};

export const isMaskedAsNative = (fn: unknown): boolean => {
  if (typeof fn !== "function") {
    return false;
  }

  try {
    return privateWeakMapHas(nativeSources, fn as Function);
  } catch {
    return false;
  }
};

export const createNativeSource = (
  name: string,
  kind: "function" | "get" = "function",
): string => {
  if (!name) {
    return FALLBACK_SOURCE;
  }

  if (kind === "get") {
    return `function get ${name}() { [native code] }`;
  }

  return `function ${name}() { [native code] }`;
};

const getNativeSourceName = (source: string): string | null => {
  const prefix = "function ";
  if (!source.startsWith(prefix)) {
    return null;
  }

  const startIndex = prefix.length;
  const openParenIndex = source.indexOf("(", startIndex);
  if (openParenIndex <= startIndex) {
    return null;
  }

  const name = source.slice(startIndex, openParenIndex).trim();
  if (!name) {
    return null;
  }

  return name;
};

export const maskAsNative = <T extends Function>(
  fn: T,
  source = createNativeSource(fn.name),
  length?: number,
): T => {
  registerNativeSource(fn, source);

  const intendedName = getNativeSourceName(source);
  if (intendedName && fn.name !== intendedName) {
    privateDefineProperty(fn, "name", {
      value: intendedName,
      configurable: true,
    });
  }

  if (length !== undefined && fn.length !== length) {
    privateDefineProperty(fn, "length", { value: length, configurable: true });
  }

  return fn;
};

export const registerNativeSource = <T extends Function>(fn: T, source: string): T => {
  installNativeToString();
  privateWeakMapSet(nativeSources, fn, source);
  return fn;
};
