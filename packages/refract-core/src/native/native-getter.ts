import {
  registerInstalledDesc,
  type DescriptorRegistration,
} from "../integrity/surface-integrity-registry";
import {
  privateDefineProperty,
  privateOwnDescriptor,
  privateIsPrototypeOf,
  privateReflectApply,
} from "../runtime/primordials";

import { createNativeSource, maskAsNative } from "./native-mask";

export type NativeGetterIntegrity<
  TSurfaceId extends string = string,
  TMethodId extends string = string,
> = Omit<
  DescriptorRegistration<TSurfaceId, TMethodId>,
  "target" | "key" | "descriptor"
>;

export type NativeGetterOptions<
  T extends object,
  TValue,
  TSurfaceId extends string = string,
  TMethodId extends string = string,
> = {
  nativeGetter?: ((this: T) => TValue) | undefined;
  integrity?: NativeGetterIntegrity<TSurfaceId, TMethodId>;
};

export const defineNativeGetter = <
  T extends object,
  TValue,
  TSurfaceId extends string = string,
  TMethodId extends string = string,
>(
  target: T,
  property: PropertyKey,
  getter: (this: T) => TValue,
  options: NativeGetterOptions<T, TValue, TSurfaceId, TMethodId> = {},
): void => {
  const originalDescriptor = privateOwnDescriptor(target, property);
  const nativeAccessor = options.nativeGetter ?? originalDescriptor?.get;
  const targetConstructor = privateOwnDescriptor(target, "constructor")?.value as
    { prototype?: unknown } | undefined;
  const shouldEnforceReceiver =
    typeof target === "object" &&
    target !== null &&
    targetConstructor?.prototype === target;

  const get = privateOwnDescriptor(
    {
      get [property](): TValue {
        if (
          shouldEnforceReceiver &&
          (this === target || !privateIsPrototypeOf(target, this))
        ) {
          if (nativeAccessor) {
            privateReflectApply(nativeAccessor, this, []);
          }
          throw new TypeError("Illegal invocation");
        }

        return privateReflectApply(getter, this, []);
      },
    },
    property,
  )?.get;

  if (!get) {
    return;
  }

  const descriptor: PropertyDescriptor = {
    configurable: true,
    get: maskAsNative(get, createNativeSource(String(property), "get")),
  };
  privateDefineProperty(target, property, descriptor);
  if (options.integrity) {
    registerInstalledDesc({
      ...options.integrity,
      target,
      key: property,
      descriptor,
    });
  }
};
