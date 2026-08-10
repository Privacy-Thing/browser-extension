import {
  cloneClientHintBrands,
  HIGH_ENTROPY_GETTERS,
} from "@privacy-brand/refract-core/fingerprint/client-hints-getters";
import {
  defineNativeGetter,
  type NativeGetterIntegrity,
} from "@privacy-brand/refract-core/native/native-getter";
import {
  createNativeSource,
  maskAsNative,
} from "@privacy-brand/refract-core/native/native-mask";
import {
  privateDefineProperty,
  privateOwnDescriptor,
  privateGetPrototype,
  privateObjectHasOwn,
  privateReflectApply,
} from "@privacy-brand/refract-core/runtime/primordials";

import {
  registerNavigatorRef,
  registerDescriptor,
  type RuntimeIntegrityContext,
} from "@/injection/main/surface-integrity";
import type { RuntimeSnapshot, SpoofingSurfaceMethodId } from "@/shared/types";

type FirefoxClientHints = NonNullable<
  NonNullable<RuntimeSnapshot["fingerprint"]>["clientHints"]
>;

type UserAgentDataLike = Record<string, unknown> & {
  getHighEntropyValues?: (hints: string[]) => Promise<unknown>;
};

type FxClientHintsOptions = {
  targetGlobal: typeof globalThis;
  integrity: RuntimeIntegrityContext;
  getClientHints: () => FirefoxClientHints | null;
};

export const installFxClientHints = ({
  targetGlobal,
  integrity,
  getClientHints,
}: FxClientHintsOptions): void => {
  const navigatorObject = targetGlobal.navigator;
  if (!("userAgentData" in navigatorObject)) {
    return;
  }

  const userAgentData = (navigatorObject as unknown as Record<string, unknown>)
    .userAgentData as UserAgentDataLike | undefined;
  if (!userAgentData) {
    return;
  }
  registerNavigatorRef(integrity, targetGlobal, "userAgentData", "clientHints");

  const target = privateGetPrototype(userAgentData) ?? userAgentData;
  const createIntegrityEntry = (
    methodId: SpoofingSurfaceMethodId,
  ): NativeGetterIntegrity => ({
    registrar: integrity.registrar,
    anchor: {
      surfaceId: "clientHints",
      methodId,
      realmId: integrity.realmId,
      repairPolicy: "repair",
      criticality: "preview-critical",
      resolveReceiver: () => userAgentData,
    },
  });

  defineNativeGetter(
    target,
    "brands",
    () => cloneClientHintBrands(getClientHints()?.brands),
    { integrity: createIntegrityEntry("clientHints.brands") },
  );
  defineNativeGetter(target, "mobile", () => getClientHints()?.mobile, {
    integrity: createIntegrityEntry("clientHints.mobile"),
  });
  defineNativeGetter(target, "platform", () => getClientHints()?.platform, {
    integrity: createIntegrityEntry("clientHints.platform"),
  });

  const nativeGetEntropyValues = privateOwnDescriptor(target, "getHighEntropyValues")
    ?.value as UserAgentDataLike["getHighEntropyValues"];
  if (!nativeGetEntropyValues) {
    return;
  }

  const descriptor: PropertyDescriptor = {
    configurable: true,
    enumerable: false,
    writable: true,
    value: maskAsNative(async function getHighEntropyValues(
      this: unknown,
      hints: string[],
    ) {
      const nativeResult = (await privateReflectApply(nativeGetEntropyValues, this, [
        hints,
      ])) as Record<string, unknown>;
      try {
        const clientHints = getClientHints();
        if (!clientHints) {
          return nativeResult;
        }
        const result: Record<string, unknown> = {
          ...(clientHints?.brands
            ? { brands: cloneClientHintBrands(clientHints.brands) }
            : {}),
          ...(typeof clientHints?.mobile === "boolean"
            ? { mobile: clientHints.mobile }
            : {}),
          ...(clientHints?.platform ? { platform: clientHints.platform } : {}),
        };
        for (const hint of hints) {
          const getter = privateObjectHasOwn(HIGH_ENTROPY_GETTERS, hint)
            ? HIGH_ENTROPY_GETTERS[hint as keyof typeof HIGH_ENTROPY_GETTERS]
            : undefined;
          if (!getter) {
            continue;
          }
          const value = getter(clientHints);
          if (value !== undefined) {
            result[hint] = value;
          }
        }
        return result;
      } catch {
        return nativeResult;
      }
    }, createNativeSource("getHighEntropyValues")),
  };
  privateDefineProperty(target, "getHighEntropyValues", descriptor);
  registerDescriptor({
    integrity,
    target,
    key: "getHighEntropyValues",
    anchor: {
      surfaceId: "clientHints",
      methodId: "clientHints.getHighEntropyValues",
      receiver: userAgentData,
    },
    installedDescriptor: descriptor,
  });
};
