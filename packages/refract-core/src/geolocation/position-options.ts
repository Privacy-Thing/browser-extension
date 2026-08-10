const MAX_UNSIGNED_LONG = 0xffff_ffff;

const roundToEven = (value: number): number => {
  const floor = Math.floor(value);
  const fraction = value - floor;
  if (fraction < 0.5) {
    return floor;
  }
  if (fraction > 0.5) {
    return floor + 1;
  }
  return floor % 2 === 0 ? floor : floor + 1;
};

const clampUnsignedLong = (value: unknown): number => {
  // Unary plus follows WebIDL's ToNumber conversion and rejects BigInt,
  // unlike the Number() constructor which deliberately accepts it.
  const numberValue = +(value as number);
  if (Number.isNaN(numberValue) || numberValue <= 0) {
    return 0;
  }
  if (numberValue >= MAX_UNSIGNED_LONG) {
    return MAX_UNSIGNED_LONG;
  }
  return roundToEven(numberValue);
};

/** Performs the observable WebIDL dictionary conversion before API work begins. */
export const convertPositionOptions = (
  options?: PositionOptions | null,
): PositionOptions => {
  if (options !== undefined && options !== null && typeof options !== "object") {
    throw new TypeError("PositionOptions must be an object");
  }

  // WebIDL reads dictionary members lexicographically, including inherited and
  // non-enumerable properties. Keep these reads explicit and single-shot.
  const enableHighAccuracy = Boolean(options?.enableHighAccuracy);
  const maximumAge = clampUnsignedLong(options?.maximumAge ?? 0);
  const timeout = clampUnsignedLong(options?.timeout ?? MAX_UNSIGNED_LONG);

  return { enableHighAccuracy, maximumAge, timeout };
};
