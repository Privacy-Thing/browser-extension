import {
  cloneClientHintBrands,
  HIGH_ENTROPY_GETTERS,
} from "@privacy-brand/refract-core/fingerprint/client-hints-getters";
import {
  createNavigatorReaders,
  installNavigatorGetters,
} from "@privacy-brand/refract-core/fingerprint/navigator-fingerprint-readers";
import { isFpSurfaceEnabled } from "@privacy-brand/refract-core/fingerprint/surface-guards";
import {
  defineNativeGetter,
  type NativeGetterIntegrity,
} from "@privacy-brand/refract-core/native/native-getter";
import {
  createNativeSource,
  maskAsNative,
} from "@privacy-brand/refract-core/native/native-mask";
import {
  cloneLocaleLanguages,
  installLocaleGetters,
} from "@privacy-brand/refract-core/time/locale-getters";

import type { WorkerRuntimeSupport } from "./worker-runtime-support";

import type { RuntimeSnapshot } from "@/shared/types";

declare const WorkerNavigator: any;

const defineGetter = <T extends object, TValue>(
  target: T,
  property: PropertyKey,
  getter: (this: T) => TValue,
  integrity?: NativeGetterIntegrity,
): void =>
  defineNativeGetter(target, property, getter, {
    ...(integrity ? { integrity } : {}),
  });

export const installWorkerNavigator = (
  snapshot: RuntimeSnapshot,
  support: WorkerRuntimeSupport,
): void => {
  const nav = globalThis.navigator;
  if (!nav) return;
  const target =
    typeof WorkerNavigator !== "undefined"
      ? WorkerNavigator.prototype
      : Object.getPrototypeOf(nav);
  if (!target) return;

  support.loggers.navigator("install", [], {
    hasFingerprint: !!snapshot.fingerprint,
  });
  if (snapshot.timeLocaleEnabled !== false && snapshot.locale) {
    support.loggers.locale("install", [], {
      language: snapshot.locale.language,
      languages: cloneLocaleLanguages(snapshot.locale.languages),
    });
    installLocaleGetters(
      (property: PropertyKey, getter: () => any) =>
        defineGetter(
          target,
          property,
          () => {
            const value = getter();
            support.loggers.localeOnce(`get ${String(property)}`, [], value);
            return value;
          },
          {
            registrar: support.integrity,
            anchor: {
              surfaceId: "timeLocale",
              realmId: "worker",
              repairPolicy: "repair",
              criticality: "preview-critical",
              resolveReceiver: () => nav,
            },
          },
        ),
      {
        language: () => snapshot.locale.language,
        languages: () => snapshot.locale.languages,
      },
    );
  }

  const readers = createNavigatorReaders(() => snapshot.fingerprint);
  const methodIds = {
    appVersion: "navigator.appVersion",
    deviceMemory: "navigator.deviceMemory",
    hardwareConcurrency: "navigator.hardwareConcurrency",
    maxTouchPoints: "navigator.maxTouchPoints",
    platform: "navigator.platform",
    userAgent: "navigator.userAgent",
    vendor: "navigator.vendor",
  } as const;
  installNavigatorGetters({
    readers,
    defineGetter: (property, getter) =>
      defineGetter(
        target,
        property,
        () => {
          const value = getter();
          if (value !== undefined) {
            support.loggers.navigatorOnce(`get ${property}`, [], value);
          }
          return value;
        },
        {
          registrar: support.integrity,
          anchor: {
            surfaceId: "navigator",
            methodId: methodIds[property],
            realmId: "worker",
            repairPolicy: "repair",
            criticality: "preview-critical",
            resolveReceiver: () => nav,
          },
        },
      ),
    hasProperty: (property: string) => property in nav,
  });
};

const createHintsResult = (
  clientHints: NonNullable<RuntimeSnapshot["fingerprint"]>["clientHints"],
): Record<string, any> => ({
  ...(clientHints?.brands ? { brands: cloneClientHintBrands(clientHints.brands) } : {}),
  ...(typeof clientHints?.mobile === "boolean" ? { mobile: clientHints.mobile } : {}),
  ...(clientHints?.platform ? { platform: clientHints.platform } : {}),
});

export const installWorkerClientHints = (
  snapshot: RuntimeSnapshot,
  support: WorkerRuntimeSupport,
): void => {
  if (!isFpSurfaceEnabled(snapshot.fingerprint, "clientHints")) return;
  const clientHints = snapshot.fingerprint?.clientHints;
  if (!clientHints || !("userAgentData" in navigator)) return;
  const userAgentData = (navigator as any).userAgentData;
  if (!userAgentData) return;

  support.loggers.clientHints("install", [], {
    hasBrands: !!clientHints.brands?.length,
    hasMobile: typeof clientHints.mobile === "boolean",
    hasPlatform: !!clientHints.platform,
  });
  const target = Object.getPrototypeOf(userAgentData) ?? userAgentData;
  if (clientHints.brands) {
    defineGetter(target, "brands", () => {
      const value = cloneClientHintBrands(clientHints.brands!);
      support.loggers.clientHintsOnce("get brands", [], value);
      return value;
    });
  }
  if (typeof clientHints.mobile === "boolean") {
    defineGetter(target, "mobile", () => {
      support.loggers.clientHintsOnce("get mobile", [], clientHints.mobile);
      return clientHints.mobile;
    });
  }
  if (clientHints.platform) {
    defineGetter(target, "platform", () => {
      support.loggers.clientHintsOnce("get platform", [], clientHints.platform);
      return clientHints.platform;
    });
  }
  patchClientHintMethods(target, userAgentData, clientHints, support);
  registerClientHints(target, userAgentData, support);
};

const patchClientHintMethods = (
  target: any,
  userAgentData: any,
  clientHints: NonNullable<RuntimeSnapshot["fingerprint"]>["clientHints"],
  support: WorkerRuntimeSupport,
): void => {
  if (userAgentData.toJSON) {
    Object.defineProperty(target, "toJSON", {
      configurable: true,
      value: maskAsNative(
        {
          toJSON() {
            const result = createHintsResult(clientHints);
            support.loggers.clientHintsOnce("toJSON", [], result);
            return result;
          },
        }.toJSON,
        createNativeSource("toJSON"),
      ),
    });
  }
  const nativeGetEntropyValues = userAgentData.getHighEntropyValues;
  if (!nativeGetEntropyValues) return;
  Object.defineProperty(target, "getHighEntropyValues", {
    configurable: true,
    value: maskAsNative(
      {
        async getHighEntropyValues(this: unknown, hints: string[]) {
          await Reflect.apply(nativeGetEntropyValues, this, [hints]);
          const result = createHintsResult(clientHints);
          for (const hint of hints) {
            const getter = Object.hasOwn(HIGH_ENTROPY_GETTERS, hint)
              ? (HIGH_ENTROPY_GETTERS as any)[hint]
              : undefined;
            if (!getter) continue;
            const value = getter(clientHints);
            if (value !== undefined) result[hint] = value;
          }
          support.loggers.clientHintsOnce("getHighEntropyValues", [hints], result);
          return result;
        },
      }.getHighEntropyValues,
      createNativeSource("getHighEntropyValues"),
    ),
  });
};

const registerClientHints = (
  target: object,
  receiver: object,
  support: WorkerRuntimeSupport,
): void => {
  const methods = {
    brands: "clientHints.brands",
    getHighEntropyValues: "clientHints.getHighEntropyValues",
    mobile: "clientHints.mobile",
    platform: "clientHints.platform",
    toJSON: "clientHints.toJSON",
  } as const;
  for (const key of Object.keys(methods) as Array<keyof typeof methods>) {
    support.register({
      target,
      key,
      surfaceId: "clientHints",
      methodId: methods[key],
      receiver,
    });
  }
};
