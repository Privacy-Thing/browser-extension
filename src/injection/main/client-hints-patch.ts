import {
  createLogger,
  createOnceLogger,
  type RuntimeDebugSnapshot,
} from "@privacy-brand/refract-browser/common/debug-logger";
import { markSurfaceUsed } from "@privacy-brand/refract-browser/common/surface-usage-emitter";
import {
  cloneClientHintBrands,
  HIGH_ENTROPY_GETTERS,
} from "@privacy-brand/refract-core/fingerprint/client-hints-getters";
import { isFpSurfaceEnabled } from "@privacy-brand/refract-core/fingerprint/surface-guards";
import {
  createNativeSource,
  maskAsNative,
} from "@privacy-brand/refract-core/native/native-mask";
import {
  createPrivateWeakMap,
  privateDefineProperty,
  privateOwnDescriptor,
  privateGetPrototype,
  privateObjectHasOwn,
  privatePromiseThen,
  privateReflectApply,
  privateWeakMapDelete,
  privateWeakMapGet,
  privateWeakMapSet,
} from "@privacy-brand/refract-core/runtime/primordials";

import { defineGetter } from "@/injection/main/locale-patch";
import {
  registerNavigatorRef,
  registerDescriptor,
  type RuntimeIntegrityContext,
} from "@/injection/main/surface-integrity";
import type { RuntimeSnapshot, SpoofingSurfaceMethodId } from "@/shared/types";

type AgentDataWithEntropy = {
  brands: readonly { brand: string; version: string }[];
  mobile: boolean;
  platform: string;
  getHighEntropyValues?: (hints: readonly string[]) => Promise<Record<string, unknown>>;
  toJSON?: () => Record<string, unknown>;
};

type ClientHintsState = {
  clientHints: NonNullable<NonNullable<RuntimeSnapshot["fingerprint"]>["clientHints"]>;
  debugSnapshot: RuntimeDebugSnapshot;
};

type ClientHintsInstallation = {
  anchor: Function;
  state: ClientHintsState;
  target: object;
};

const clientHintsInstallations = createPrivateWeakMap<
  object,
  ClientHintsInstallation
>();

type ClientHintsContext = {
  initialHints: ClientHintsState["clientHints"];
  userAgentData: AgentDataWithEntropy;
  target: object;
  integrity: (RuntimeIntegrityContext & { receiver?: object }) | undefined;
  getClientHints: () => ClientHintsState["clientHints"];
  logOnce: ReturnType<typeof createOnceLogger>;
};

const createHintIntegrity = (
  context: ClientHintsContext,
  methodId: SpoofingSurfaceMethodId,
): Parameters<typeof defineGetter>[3] | undefined =>
  context.integrity
    ? {
        registrar: context.integrity.registrar,
        anchor: {
          surfaceId: "clientHints",
          methodId,
          realmId: context.integrity.realmId,
          repairPolicy: "repair",
          criticality: "preview-critical",
          resolveReceiver: () => context.integrity?.receiver ?? context.userAgentData,
        },
      }
    : undefined;

const wrapHintGetter = <TValue>(
  context: ClientHintsContext,
  method: string,
  methodId: SpoofingSurfaceMethodId,
  getter: () => TValue,
): (() => TValue) =>
  function getClientHint(): TValue {
    markSurfaceUsed("clientHints", methodId);
    const value = getter();
    context.logOnce(method, [], value);
    return value;
  };

const installHintGetters = (context: ClientHintsContext): void => {
  const { initialHints, target } = context;
  if (initialHints.brands) {
    defineGetter(
      target,
      "brands",
      wrapHintGetter(context, "get brands", "clientHints.brands", () =>
        cloneClientHintBrands(context.getClientHints().brands),
      ),
      createHintIntegrity(context, "clientHints.brands"),
    );
  }
  if (typeof initialHints.mobile === "boolean") {
    defineGetter(
      target,
      "mobile",
      wrapHintGetter(
        context,
        "get mobile",
        "clientHints.mobile",
        () => context.getClientHints().mobile,
      ),
      createHintIntegrity(context, "clientHints.mobile"),
    );
  }
  if (initialHints.platform) {
    defineGetter(
      target,
      "platform",
      wrapHintGetter(
        context,
        "get platform",
        "clientHints.platform",
        () => context.getClientHints().platform,
      ),
      createHintIntegrity(context, "clientHints.platform"),
    );
  }
};

const createHintsJson = (
  clientHints: ClientHintsState["clientHints"],
): Record<string, unknown> => ({
  ...(clientHints.brands ? { brands: cloneClientHintBrands(clientHints.brands) } : {}),
  ...(typeof clientHints.mobile === "boolean" ? { mobile: clientHints.mobile } : {}),
  ...(clientHints.platform ? { platform: clientHints.platform } : {}),
});

const installToJson = (context: ClientHintsContext): Function | undefined => {
  if (!context.userAgentData.toJSON) return undefined;
  const patchedToJSON = maskAsNative(function toJSON(
    this: AgentDataWithEntropy,
  ): Record<string, unknown> {
    const result = createHintsJson(context.getClientHints());
    markSurfaceUsed("clientHints", "clientHints.toJSON");
    context.logOnce("toJSON", [], result);
    return result;
  }, createNativeSource("toJSON"));
  const descriptor: PropertyDescriptor = {
    configurable: true,
    enumerable: false,
    writable: true,
    value: patchedToJSON,
  };
  privateDefineProperty(context.target, "toJSON", descriptor);
  registerDescriptor({
    integrity: context.integrity,
    target: context.target,
    key: "toJSON",
    anchor: {
      surfaceId: "clientHints",
      methodId: "clientHints.toJSON",
      receiver: context.integrity?.receiver ?? context.userAgentData,
    },
    installedDescriptor: descriptor,
  });
  return patchedToJSON;
};

const buildEntropyResult = (
  clientHints: ClientHintsState["clientHints"],
  hints: readonly string[],
): Record<string, unknown> => {
  const result = createHintsJson(clientHints);
  for (const hint of hints) {
    const getter = privateObjectHasOwn(HIGH_ENTROPY_GETTERS, hint)
      ? HIGH_ENTROPY_GETTERS[hint as keyof typeof HIGH_ENTROPY_GETTERS]
      : undefined;
    if (!getter) continue;
    const value = getter(clientHints);
    if (value !== undefined) result[hint] = value;
  }
  return result;
};

const installEntropyMethod = (context: ClientHintsContext): Function | undefined => {
  const nativeMethod = privateOwnDescriptor(context.target, "getHighEntropyValues")
    ?.value as AgentDataWithEntropy["getHighEntropyValues"];
  if (typeof nativeMethod !== "function") return undefined;
  const patchedMethod = maskAsNative(function getHighEntropyValues(
    this: AgentDataWithEntropy,
    hints: readonly string[],
  ): Promise<Record<string, unknown>> {
    const nativeResult = privateReflectApply(nativeMethod, this, [hints]) as Promise<
      Record<string, unknown>
    >;
    return privatePromiseThen(nativeResult, () => {
      const result = buildEntropyResult(context.getClientHints(), hints);
      markSurfaceUsed("clientHints", "clientHints.getHighEntropyValues");
      context.logOnce("getHighEntropyValues", [hints], result);
      return result;
    });
  }, createNativeSource("getHighEntropyValues"));
  const descriptor: PropertyDescriptor = {
    configurable: true,
    enumerable: false,
    writable: true,
    value: patchedMethod,
  };
  privateDefineProperty(context.target, "getHighEntropyValues", descriptor);
  registerDescriptor({
    integrity: context.integrity,
    target: context.target,
    key: "getHighEntropyValues",
    anchor: {
      surfaceId: "clientHints",
      methodId: "clientHints.getHighEntropyValues",
      receiver: context.integrity?.receiver ?? context.userAgentData,
    },
    installedDescriptor: descriptor,
  });
  return patchedMethod;
};

/**
 * Patches Chromium's User-Agent Client Hints object when the runtime snapshot
 * has a resolved fingerprint. The first bundle to patch a target realm remains
 * authoritative within that bundle and repeated discovery reuses its wrapper.
 */
export const installClientHintsPatch = (
  snapshot: RuntimeSnapshot,
  targetGlobal: typeof globalThis = globalThis,
  integrity?: RuntimeIntegrityContext & { receiver?: object },
): void => {
  if (!isFpSurfaceEnabled(snapshot.fingerprint, "clientHints")) {
    return;
  }

  const clientHints = snapshot.fingerprint?.clientHints;
  const targetNavigator = targetGlobal.navigator;
  if (!clientHints || !targetNavigator || !("userAgentData" in targetNavigator)) {
    return;
  }

  const userAgentData = (
    targetNavigator as Navigator & {
      userAgentData?: AgentDataWithEntropy;
    }
  ).userAgentData;
  if (!userAgentData) {
    return;
  }
  registerNavigatorRef(integrity, targetGlobal, "userAgentData", "clientHints");

  const target = privateGetPrototype(userAgentData) ?? userAgentData;
  const currentAnchor = userAgentData.getHighEntropyValues ?? userAgentData.toJSON;
  const existingInstallation = privateWeakMapGet(
    clientHintsInstallations,
    targetGlobal,
  );
  if (existingInstallation && existingInstallation.target === target) {
    if (currentAnchor !== existingInstallation.anchor) {
      throw new Error("Conflicting Client Hints installation");
    }
    existingInstallation.state.clientHints = clientHints;
    existingInstallation.state.debugSnapshot = snapshot;
    return;
  }
  if (existingInstallation) {
    privateWeakMapDelete(clientHintsInstallations, targetGlobal);
  }

  const state: ClientHintsState = {
    clientHints,
    debugSnapshot: snapshot,
  };
  const getClientHints = (): ClientHintsState["clientHints"] => state.clientHints;
  const logClientHints = createLogger(() => state.debugSnapshot, "ClientHints");
  const logClientHintsOnce = createOnceLogger(() => state.debugSnapshot, "ClientHints");
  logClientHints("install", [], {
    hasBrands: Boolean(clientHints.brands?.length),
    hasMobile: typeof clientHints.mobile === "boolean",
    hasPlatform: Boolean(clientHints.platform),
  });

  const context: ClientHintsContext = {
    initialHints: clientHints,
    userAgentData,
    target,
    integrity,
    getClientHints,
    logOnce: logClientHintsOnce,
  };
  installHintGetters(context);
  let installedAnchor = installToJson(context);
  installedAnchor = installEntropyMethod(context) ?? installedAnchor;

  if (installedAnchor) {
    privateWeakMapSet(clientHintsInstallations, targetGlobal, {
      anchor: installedAnchor,
      state,
      target,
    });
  }
};
