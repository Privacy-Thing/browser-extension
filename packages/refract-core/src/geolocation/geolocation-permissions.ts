import {
  registerInstalledDesc,
  type IntegrityRegistrar,
  type RegisteredAnchor,
} from "../integrity/surface-integrity-registry";
import { createNativeSource, maskAsNative } from "../native/native-mask";
import {
  createPrivateWeakMap,
  privateDefineProperty,
  privateOwnDescriptor,
  privateGetPrototype,
  privateReflectApply,
  privateDeleteProperty,
  privateReflectGet,
  privateWeakMapGet,
  privateWeakMapSet,
} from "../runtime/primordials";

export type GeoPermissionState = "granted" | "denied";

type PermissionsLogger = (method: string, args: unknown[], result?: unknown) => void;
type ResolveGeolocationState = () => GeoPermissionState | Promise<GeoPermissionState>;

type QueryPatchRegistration = {
  integrity: PermissionIntegrity | undefined;
  logger: PermissionsLogger | undefined;
  resolveGeolocationState: ResolveGeolocationState;
};

export type PermissionIntegrity = {
  registrar: IntegrityRegistrar<any, any> & {
    ensure(anchor: RegisteredAnchor): unknown;
    ensureReceiver(anchor: RegisteredAnchor, receiver: object): unknown;
  };
  surfaceId: string;
  realmId: string;
};

export type GeoPermissionPatchState = {
  overriddenStates: WeakMap<object, GeoPermissionState>;
  stateDescriptors: WeakMap<object, PropertyDescriptor>;
  stateIntegrityTokens: WeakMap<object, WeakMap<object, RegisteredAnchor>>;
  stateUnavailableTokens: WeakMap<object, WeakMap<object, RegisteredAnchor>>;
  queryTargets: WeakMap<object, QueryPatchRegistration>;
};

export const createGeoPermissionState = (): GeoPermissionPatchState => ({
  overriddenStates: createPrivateWeakMap<object, GeoPermissionState>(),
  stateDescriptors: createPrivateWeakMap<object, PropertyDescriptor>(),
  stateIntegrityTokens: createPrivateWeakMap<
    object,
    WeakMap<object, RegisteredAnchor>
  >(),
  stateUnavailableTokens: createPrivateWeakMap<
    object,
    WeakMap<object, RegisteredAnchor>
  >(),
  queryTargets: createPrivateWeakMap<object, QueryPatchRegistration>(),
});

const patchStates = createPrivateWeakMap<object, GeoPermissionPatchState>();

export const getOrCreateGeoPermState = (
  targetGlobal: typeof globalThis,
): GeoPermissionPatchState => {
  const existing = privateWeakMapGet(patchStates, targetGlobal);
  if (existing) {
    return existing;
  }
  const state = createGeoPermissionState();
  privateWeakMapSet(patchStates, targetGlobal, state);
  return state;
};

const getRegistrarTokens = (
  tokens: WeakMap<object, WeakMap<object, RegisteredAnchor>>,
  permissionPrototype: object,
): WeakMap<object, RegisteredAnchor> => {
  let tokensByRegistrar = privateWeakMapGet(tokens, permissionPrototype);
  if (!tokensByRegistrar) {
    tokensByRegistrar = createPrivateWeakMap<object, RegisteredAnchor>();
    privateWeakMapSet(tokens, permissionPrototype, tokensByRegistrar);
  }
  return tokensByRegistrar;
};

const registerUnavailableState = (
  permissionPrototype: object,
  patchState: GeoPermissionPatchState,
  integrity: PermissionIntegrity,
): void => {
  const tokensByRegistrar = getRegistrarTokens(
    patchState.stateUnavailableTokens,
    permissionPrototype,
  );
  const registrarKey = integrity.registrar as object;
  if (privateWeakMapGet(tokensByRegistrar, registrarKey)) {
    return;
  }
  const token = integrity.registrar.register({
    surfaceId: integrity.surfaceId,
    realmId: integrity.realmId,
    resolveTarget: () => null,
    resolveTargetUnavailable: () => "target-missing",
    key: "state",
    createExpectedDescriptor: () => ({}),
    repairPolicy: "repair",
    criticality: "preview-critical",
  });
  privateWeakMapSet(tokensByRegistrar, registrarKey, token);
  integrity.registrar.ensure(token);
};

const preparePermPrototype = (
  permissionPrototype: object,
  patchState: GeoPermissionPatchState,
  integrity: PermissionIntegrity | undefined,
): void => {
  let installedDescriptor = privateWeakMapGet(
    patchState.stateDescriptors,
    permissionPrototype,
  );
  if (!installedDescriptor) {
    const stateDescriptor = privateOwnDescriptor(permissionPrototype, "state");
    const nativeGetter = stateDescriptor?.get;
    if (!nativeGetter) {
      if (integrity) {
        registerUnavailableState(permissionPrototype, patchState, integrity);
      }
      return;
    }

    const stateGetter = maskAsNative(
      function state(this: PermissionStatus): PermissionState {
        // Keep the browser's brand check authoritative for forged receivers.
        const nativeState = privateReflectApply(
          nativeGetter,
          this,
          [],
        ) as PermissionState;
        return privateWeakMapGet(patchState.overriddenStates, this) ?? nativeState;
      },
      createNativeSource("state", "get"),
    );

    installedDescriptor = {
      ...stateDescriptor,
      get: stateGetter,
    };
    privateDefineProperty(permissionPrototype, "state", installedDescriptor);
    privateWeakMapSet(
      patchState.stateDescriptors,
      permissionPrototype,
      installedDescriptor,
    );
  }
  if (!integrity) {
    return;
  }
  const tokensByRegistrar = getRegistrarTokens(
    patchState.stateIntegrityTokens,
    permissionPrototype,
  );
  const registrarKey = integrity.registrar as object;
  let token = privateWeakMapGet(tokensByRegistrar, registrarKey);
  if (!token) {
    token = registerInstalledDesc({
      registrar: integrity.registrar,
      target: permissionPrototype,
      key: "state",
      descriptor: installedDescriptor,
      anchor: {
        surfaceId: integrity.surfaceId,
        realmId: integrity.realmId,
        repairPolicy: "repair",
        criticality: "preview-critical",
        repairEffectiveLookup: (receiver, target, key) => {
          if (receiver === target) return "repair-failed";
          const shadow = privateOwnDescriptor(receiver, key);
          if (!shadow) return "repair-failed";
          if (shadow.configurable === false) return "hostile-non-configurable";
          return privateDeleteProperty(receiver, key) ? "repaired" : "repair-failed";
        },
      },
    });
    privateWeakMapSet(tokensByRegistrar, registrarKey, token);
  }
};

const ensurePermissionGetter = (
  status: PermissionStatus,
  patchState: GeoPermissionPatchState,
  integrity: PermissionIntegrity | undefined,
): void => {
  const permissionPrototype = privateGetPrototype(status);
  if (!permissionPrototype) return;
  preparePermPrototype(permissionPrototype, patchState, integrity);
  if (!integrity) return;
  const tokensByRegistrar = privateWeakMapGet(
    patchState.stateIntegrityTokens,
    permissionPrototype,
  );
  const token = tokensByRegistrar
    ? privateWeakMapGet(tokensByRegistrar, integrity.registrar as object)
    : undefined;
  if (token) {
    integrity.registrar.ensureReceiver(token, status);
  }
};

type CapturedPermissionDesc = {
  descriptor: PermissionDescriptor;
  readName: () => unknown;
};

const capturePermissionName = (
  descriptor: PermissionDescriptor,
): CapturedPermissionDesc | null => {
  if (
    descriptor === null ||
    (typeof descriptor !== "object" && typeof descriptor !== "function")
  ) {
    return null;
  }

  let nameRead = false;
  let name: unknown;
  const forwardedDescriptor = new Proxy(descriptor, {
    get(target, property) {
      if (property === "name") {
        if (!nameRead) {
          name = privateReflectGet(target, property, target);
          nameRead = true;
        }
        return name;
      }
      return privateReflectGet(target, property, target);
    },
  });

  return {
    descriptor: forwardedDescriptor,
    readName: () => {
      if (!nameRead) {
        privateReflectGet(forwardedDescriptor, "name", forwardedDescriptor);
      }
      return name;
    },
  };
};

export const installGeoPermPatch = ({
  logger,
  integrity,
  permissionPrototype,
  patchState,
  queryTarget,
  resolveGeolocationState,
}: {
  logger?: PermissionsLogger;
  integrity?: PermissionIntegrity;
  permissionPrototype?: object | null;
  patchState: GeoPermissionPatchState;
  queryTarget: Permissions | Navigator["permissions"];
  resolveGeolocationState: ResolveGeolocationState;
}): void => {
  if (permissionPrototype) {
    preparePermPrototype(permissionPrototype, patchState, integrity);
  }
  const target = queryTarget as object;
  const existingRegistration = privateWeakMapGet(patchState.queryTargets, target);
  if (existingRegistration) {
    existingRegistration.logger = logger;
    existingRegistration.integrity = integrity;
    existingRegistration.resolveGeolocationState = resolveGeolocationState;
    return;
  }

  const nativeQuery = queryTarget.query;
  const registration: QueryPatchRegistration = {
    integrity,
    logger,
    resolveGeolocationState,
  };
  privateWeakMapSet(patchState.queryTargets, target, registration);

  const patchedQuery = {
    query(
      this: Permissions,
      descriptor: PermissionDescriptor,
    ): Promise<PermissionStatus> {
      const capturedDescriptor = capturePermissionName(descriptor);
      // The proxy is lazy: native query validates its receiver before the first
      // descriptor property read, and then sees the same cached name as Privacy Thing.
      const nativeResult = privateReflectApply(nativeQuery, this, [
        capturedDescriptor?.descriptor ?? descriptor,
      ]) as Promise<PermissionStatus>;

      if (capturedDescriptor?.readName() !== "geolocation") {
        registration.logger?.("query [native]", [descriptor]);
        return nativeResult;
      }

      return nativeResult.then(async (status) => {
        const state = await registration.resolveGeolocationState();
        ensurePermissionGetter(status, patchState, registration.integrity);
        privateWeakMapSet(patchState.overriddenStates, status, state);
        registration.logger?.("query [geolocation]", [descriptor], { state });
        return status;
      });
    },
  }.query;

  privateDefineProperty(queryTarget, "query", {
    configurable: true,
    value: maskAsNative(patchedQuery, createNativeSource("query")),
  });
};
