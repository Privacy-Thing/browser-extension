import {
  privateObjectCreate,
  privateObjectHasOwn,
} from "@privacy-brand/refract-core/runtime/primordials";
import { DATE_METHOD_KEYS } from "@privacy-brand/refract-core/time/date-prototype-methods";

import {
  registerDescriptor,
  type RuntimeIntegrityContext,
} from "@/injection/main/surface-integrity";
import type { SpoofingSurfaceMethodId } from "@/shared/types";

export const FX_DATE_INTEGRITY_KEYS = ["constructor", ...DATE_METHOD_KEYS] as const;

const DATE_METHOD_IDS = {
  constructor: "date.constructor",
  getTimezoneOffset: "date.getTimezoneOffset",
  toLocaleString: "date.toLocaleString",
  toString: "date.toString",
} as const satisfies Partial<Record<PropertyKey, SpoofingSurfaceMethodId>>;

export const registerFxDateIntegrity = (
  integrity: RuntimeIntegrityContext,
  dateConstructor: { prototype: object },
): void => {
  const receiver = privateObjectCreate(dateConstructor.prototype);
  for (const key of FX_DATE_INTEGRITY_KEYS) {
    registerDescriptor({
      integrity,
      target: dateConstructor.prototype,
      key,
      anchor: {
        surfaceId: "timeLocale",
        ...(privateObjectHasOwn(DATE_METHOD_IDS, key)
          ? { methodId: DATE_METHOD_IDS[key as keyof typeof DATE_METHOD_IDS] }
          : {}),
        receiver,
      },
    });
  }
};
