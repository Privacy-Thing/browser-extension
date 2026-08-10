import {
  createLogger,
  createOnceLogger,
} from "@privacy-brand/refract-browser/common/debug-logger";
import { markSurfaceUsed } from "@privacy-brand/refract-browser/common/surface-usage-emitter";
import {
  createNavigatorReaders,
  installNavigatorGetters,
} from "@privacy-brand/refract-core/fingerprint/navigator-fingerprint-readers";
import { isFpSurfaceEnabled } from "@privacy-brand/refract-core/fingerprint/surface-guards";
import { registerInstalledDesc } from "@privacy-brand/refract-core/integrity/surface-integrity-registry";
import type { NativeGetterIntegrity } from "@privacy-brand/refract-core/native/native-getter";
import {
  createNativeSource,
  maskAsNative,
} from "@privacy-brand/refract-core/native/native-mask";
import {
  createPrivateMap,
  createPrivateWeakMap,
  privateMapGet,
  privateMapSet,
  privateDefineProperty,
  privateOwnDescriptor,
  privateIsPrototypeOf,
  privateReflectApply,
  privateWeakMapGet,
  privateWeakMapSet,
} from "@privacy-brand/refract-core/runtime/primordials";
import {
  cloneLocaleLanguages,
  installLocaleGetters,
} from "@privacy-brand/refract-core/time/locale-getters";

import type { RuntimeIntegrityContext } from "@/injection/main/surface-integrity";
import type { RuntimeSnapshot, SpoofingSurfaceMethodId } from "@/shared/types";

const TIME_LOCALE_CATEGORY = "timeLocale";
const NAVIGATOR_CATEGORY = "navigator";
const gettersByTarget = createPrivateWeakMap<object, Map<PropertyKey, Function>>();
const NAVIGATOR_METHOD_IDS = {
  appVersion: "navigator.appVersion",
  deviceMemory: "navigator.deviceMemory",
  hardwareConcurrency: "navigator.hardwareConcurrency",
  maxTouchPoints: "navigator.maxTouchPoints",
  platform: "navigator.platform",
  userAgent: "navigator.userAgent",
  vendor: "navigator.vendor",
  webdriver: "navigator.webdriver",
} satisfies Record<string, SpoofingSurfaceMethodId>;

// A same-origin iframe's descriptors are protected twice by design: the
// iframe's own directly-injected content script (manifest `all_frames`)
// installs its getters as if it were the top document, and the parent's
// installIframePatch separately registers a child-realm anchor for the same
// property from outside. Each runs in its own bundle evaluation with its own
// `gettersByTarget`/registry state, so neither can recognize the other's
// masked getter by reference — comparing the masked toString() output
// instead (identical for any of our own installs, effectively unreproducible
// for a hostile replacement) avoids flagging our own redundant protection as
// a tamper.
const validateMaskedGetter = (
  actual: PropertyDescriptor,
  expected: PropertyDescriptor,
): boolean =>
  actual.configurable === (expected.configurable ?? false) &&
  actual.enumerable === (expected.enumerable ?? false) &&
  typeof actual.get === "function" &&
  typeof expected.get === "function" &&
  String(actual.get) === String(expected.get);

export const defineGetter = <T extends object, TValue>(
  target: T,
  property: PropertyKey,
  getter: (this: T) => TValue,
  integrity?: NativeGetterIntegrity,
): void => {
  const originalDescriptor = privateOwnDescriptor(target, property);
  const installedGetters = privateWeakMapGet(gettersByTarget, target);
  const installedGetter = installedGetters
    ? privateMapGet(installedGetters, property)
    : undefined;
  if (installedGetter && originalDescriptor?.get === installedGetter) {
    if (integrity) {
      registerInstalledDesc({
        ...integrity,
        target,
        key: property,
        descriptor: originalDescriptor,
      });
    }
    return;
  }
  const nativeAccessor = originalDescriptor?.get;
  const shouldEnforceReceiver =
    typeof target === "object" &&
    target !== null &&
    "constructor" in target &&
    (target as { constructor?: { prototype?: unknown } }).constructor?.prototype ===
      target;

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

        return getter.call(this as T);
      },
    },
    property,
  )?.get;

  if (!get) {
    return;
  }

  const descriptor: PropertyDescriptor = {
    configurable: true,
    // Redefining an existing property without an explicit `enumerable` keeps
    // its current attribute per spec, but the integrity registry's expected
    // descriptor (copied from this literal) defaults omitted `enumerable` to
    // `false` — mismatching a native property that was enumerable (e.g.
    // `window.devicePixelRatio`) and causing a spurious repair loop. Stating
    // it explicitly keeps native enumerability (avoiding a detectable
    // fingerprint change) and keeps the integrity anchor's expectation
    // truthful from the first install.
    enumerable: originalDescriptor?.enumerable ?? false,
    get: maskAsNative(get, createNativeSource(String(property), "get")),
  };
  privateDefineProperty(target, property, descriptor);
  let targetGetters = installedGetters;
  if (!targetGetters) {
    targetGetters = createPrivateMap<PropertyKey, Function>();
    privateWeakMapSet(gettersByTarget, target, targetGetters);
  }
  privateMapSet(targetGetters, property, get);
  if (integrity) {
    registerInstalledDesc({
      ...integrity,
      target,
      key: property,
      descriptor,
      anchor: {
        ...integrity.anchor,
        validateDescriptor: validateMaskedGetter,
      },
    });
  }
};

export const installLocalePatch = (
  snapshot: RuntimeSnapshot,
  target: object = Navigator.prototype,
  integrity?: RuntimeIntegrityContext & { receiver?: object },
): void => {
  if (!snapshot.locale || snapshot.timeLocaleEnabled === false) {
    return;
  }

  const logLocale = createLogger(snapshot, "Locale");
  const logLocaleOnce = createOnceLogger(snapshot, "Locale");
  logLocale("install", [], {
    language: snapshot.locale.language,
    languages: cloneLocaleLanguages(snapshot.locale.languages),
  });

  installLocaleGetters(
    <TValue>(property: "language" | "languages", getter: () => TValue): void =>
      defineGetter(
        target,
        property,
        () => {
          markSurfaceUsed(TIME_LOCALE_CATEGORY);
          const value = getter();
          logLocaleOnce(`get ${property}`, [], value);
          return value;
        },
        integrity
          ? {
              registrar: integrity.registrar,
              anchor: {
                surfaceId: "timeLocale",
                realmId: integrity.realmId,
                repairPolicy: "repair",
                criticality: "preview-critical",
                ...(integrity.receiver
                  ? { resolveReceiver: () => integrity.receiver ?? null }
                  : {}),
              },
            }
          : undefined,
      ),
    {
      language: () => snapshot.locale.language,
      languages: () => snapshot.locale.languages,
    },
  );
};

export const installNavigatorPatch = (
  snapshot: RuntimeSnapshot,
  target: object = Navigator.prototype,
  integrity?: RuntimeIntegrityContext & { receiver?: object },
): void => {
  const fingerprint = snapshot.fingerprint;
  if (!fingerprint || !isFpSurfaceEnabled(fingerprint, "navigator")) {
    return;
  }

  const logNavigator = createLogger(snapshot, "Navigator");
  const logNavigatorOnce = createOnceLogger(snapshot, "Navigator");
  logNavigator("install", [], {
    hasFingerprint: true,
  });
  const createIntegrityEntry = (
    methodId: SpoofingSurfaceMethodId,
  ): NativeGetterIntegrity | undefined =>
    integrity
      ? {
          registrar: integrity.registrar,
          anchor: {
            surfaceId: "navigator",
            methodId,
            realmId: integrity.realmId,
            repairPolicy: "repair",
            criticality: "preview-critical",
            ...(integrity.receiver
              ? { resolveReceiver: () => integrity.receiver ?? null }
              : {}),
          },
        }
      : undefined;

  defineGetter(
    target,
    "webdriver",
    () => {
      markSurfaceUsed(NAVIGATOR_CATEGORY, NAVIGATOR_METHOD_IDS.webdriver);
      logNavigatorOnce("get webdriver", [], false);
      return false;
    },
    createIntegrityEntry(NAVIGATOR_METHOD_IDS.webdriver),
  );

  const readers = createNavigatorReaders(() => fingerprint);
  installNavigatorGetters({
    readers,
    defineGetter: (property, getter) =>
      defineGetter(
        target,
        property,
        () => {
          markSurfaceUsed(NAVIGATOR_CATEGORY, NAVIGATOR_METHOD_IDS[property]);
          const value = getter();
          if (value !== undefined) {
            logNavigatorOnce(`get ${property}`, [], value);
          }
          return value;
        },
        createIntegrityEntry(NAVIGATOR_METHOD_IDS[property]),
      ),
    hasProperty: (property) => property in target,
  });
};
