const INITIAL_NATIVE_DATE = globalThis.Date;

const isUsableDateConstructor = (
  value: unknown,
  prototype: typeof Date.prototype | undefined,
): value is typeof Date => {
  if (
    typeof value !== "function" ||
    value.prototype !== prototype ||
    typeof (value as typeof Date).now !== "function" ||
    typeof (value as typeof Date).parse !== "function" ||
    typeof (value as typeof Date).UTC !== "function"
  ) {
    return false;
  }

  try {
    return (
      Number.isFinite((value as typeof Date).now()) &&
      (value as typeof Date).parse("1970-01-01T00:00:00.000Z") === 0 &&
      (value as typeof Date).UTC(1970, 0, 1, 0, 0, 0, 0) === 0 &&
      Object.prototype.toString.call(new (value as typeof Date)(0)) === "[object Date]"
    );
  } catch {
    return false;
  }
};

/**
 * Resolves the original Date constructor even after `globalThis.Date` has been
 * replaced with our patched wrapper. The native prototype still points back to
 * its real constructor, so we can recover it without leaving a public marker on
 * `window`.
 */
const resolveNativeDate = (): typeof Date => {
  const currentDate = globalThis.Date;
  const prototype = currentDate?.prototype;
  const prototypeConstructor = Object.getOwnPropertyDescriptor(
    prototype ?? {},
    "constructor",
  )?.value;

  if (isUsableDateConstructor(INITIAL_NATIVE_DATE, INITIAL_NATIVE_DATE.prototype)) {
    return INITIAL_NATIVE_DATE;
  }

  if (isUsableDateConstructor(prototypeConstructor, prototype)) {
    return prototypeConstructor;
  }

  return currentDate;
};

export const getNativeDate = (): typeof Date => resolveNativeDate();
