import {
  createPublicArray,
  createPrivateArray,
  createPrivateMap,
  createPrivateWeakMap,
  privateArrayPush,
  privateDateNow,
  privateDefineProperty,
  privateIsExtensible,
  privateMapDelete,
  privateMapForEach,
  privateMapGet,
  privateMapSet,
  privateObjectFreeze,
  privateWeakMapGet,
  privateWeakMapSet,
} from "../runtime/primordials";

import {
  appendBounded,
  assertBoundedId,
  copyIntegrityIncident,
  copyIntegrityResult,
  copyPropDescriptor,
  createIntegrityResult,
  inspectAnchorState,
  normalizeHistoryLimit,
  resolveReceiver,
  unavailableResult,
} from "./surface-integrity-helpers";
import type {
  DescriptorRegistration,
  IntegrityIncident,
  IntegrityRegistryOptions,
  IntegrityResult,
  IntegrityResultSink,
  LookupRepairOutcome,
  RegisteredAnchor,
  RegisteredAnchorEntry,
  SurfaceIntegrityAnchor,
  SurfaceIntegrityRegistry,
} from "./surface-integrity-types";

export type * from "./surface-integrity-types";

type RegistryState<TSurfaceId extends string, TMethodId extends string> = {
  entriesById: Map<number, RegisteredAnchorEntry<TSurfaceId, TMethodId>>;
  entriesByTarget: WeakMap<
    object,
    Map<PropertyKey, RegisteredAnchorEntry<TSurfaceId, TMethodId>>
  >;
  historyLimit: number;
  now: () => number;
  sink: IntegrityResultSink<TSurfaceId, TMethodId> | null;
  nextRegistrationId: number;
  recentResults: IntegrityResult<TSurfaceId, TMethodId>[];
  incidentHistory: IntegrityIncident<TSurfaceId, TMethodId>[];
};

const createRegistryState = <TSurfaceId extends string, TMethodId extends string>(
  options: IntegrityRegistryOptions<TSurfaceId, TMethodId>,
): RegistryState<TSurfaceId, TMethodId> => ({
  entriesById: createPrivateMap(),
  entriesByTarget: createPrivateWeakMap(),
  historyLimit: normalizeHistoryLimit(options.historyLimit),
  now: options.now ?? privateDateNow,
  sink: options.sink ?? null,
  nextRegistrationId: 1,
  recentResults: createPrivateArray(0),
  incidentHistory: createPrivateArray(0),
});

const getEntry = <TSurfaceId extends string, TMethodId extends string>(
  state: RegistryState<TSurfaceId, TMethodId>,
  registered: RegisteredAnchor,
): RegisteredAnchorEntry<TSurfaceId, TMethodId> => {
  const entry = privateMapGet(state.entriesById, registered.registrationId);
  if (!entry || entry.token !== registered) {
    throw new TypeError("Unknown or unregistered integrity anchor");
  }
  return entry;
};

const createIncident = <TSurfaceId extends string, TMethodId extends string>(
  result: IntegrityResult<TSurfaceId, TMethodId>,
): IntegrityIncident<TSurfaceId, TMethodId> => ({
  surfaceId: result.surfaceId,
  realmId: result.realmId,
  reason: result.reason as NonNullable<typeof result.reason>,
  outcome: result.status as "repaired" | "unrecoverable",
  observedAt: result.observedAt,
  ...(result.methodId !== undefined ? { methodId: result.methodId } : {}),
});

const recordResult = <TSurfaceId extends string, TMethodId extends string>(
  state: RegistryState<TSurfaceId, TMethodId>,
  result: IntegrityResult<TSurfaceId, TMethodId>,
): IntegrityResult<TSurfaceId, TMethodId> => {
  appendBounded(
    state.recentResults,
    privateObjectFreeze(copyIntegrityResult(result)) as IntegrityResult<
      TSurfaceId,
      TMethodId
    >,
    state.historyLimit,
  );
  if (
    result.reason !== undefined &&
    (result.status === "repaired" || result.status === "unrecoverable")
  ) {
    appendBounded(
      state.incidentHistory,
      privateObjectFreeze(createIncident(result)) as IntegrityIncident<
        TSurfaceId,
        TMethodId
      >,
      state.historyLimit,
    );
  }
  try {
    state.sink?.record(copyIntegrityResult(result));
  } catch {
    // Evidence consumers must not affect repair or inspection.
  }
  return result;
};

const inspectEntry = <TSurfaceId extends string, TMethodId extends string>(
  state: RegistryState<TSurfaceId, TMethodId>,
  entry: RegisteredAnchorEntry<TSurfaceId, TMethodId>,
): IntegrityResult<TSurfaceId, TMethodId> => {
  const observedAt = state.now();
  const inspection = inspectAnchorState(entry.anchor);
  let result: IntegrityResult<TSurfaceId, TMethodId>;
  if (inspection.unavailableReason) {
    result = unavailableResult(entry.anchor, observedAt, inspection.unavailableReason);
  } else if (inspection.factoryFailed) {
    result = createIntegrityResult(
      entry.anchor,
      "unrecoverable",
      observedAt,
      "repair-failed",
    );
  } else if (inspection.mismatch) {
    result = createIntegrityResult(
      entry.anchor,
      "unconfirmed",
      observedAt,
      inspection.mismatch,
    );
  } else if (!inspection.effectiveLookupIntact) {
    result = createIntegrityResult(
      entry.anchor,
      "unrecoverable",
      observedAt,
      "prototype-chain-changed",
    );
  } else {
    result = createIntegrityResult(entry.anchor, "intact", observedAt);
  }
  return recordResult(state, result);
};

type LookupRepairInput<TSurfaceId extends string, TMethodId extends string> = {
  state: RegistryState<TSurfaceId, TMethodId>;
  entry: RegisteredAnchorEntry<TSurfaceId, TMethodId>;
  target: object;
  observedAt: number;
  receiverOverride?: object;
};

const ensureEffectiveLookup = <TSurfaceId extends string, TMethodId extends string>({
  state,
  entry,
  target,
  observedAt,
  receiverOverride,
}: LookupRepairInput<TSurfaceId, TMethodId>): IntegrityResult<
  TSurfaceId,
  TMethodId
> => {
  const receiver = receiverOverride ?? resolveReceiver(entry.anchor);
  if (!receiver || !entry.anchor.repairEffectiveLookup) {
    return recordResult(
      state,
      createIntegrityResult(
        entry.anchor,
        "unrecoverable",
        observedAt,
        "prototype-chain-changed",
      ),
    );
  }
  let outcome: LookupRepairOutcome;
  try {
    outcome = entry.anchor.repairEffectiveLookup(receiver, target, entry.anchor.key);
  } catch {
    outcome = "repair-failed";
  }
  if (outcome !== "repaired") {
    return recordResult(
      state,
      createIntegrityResult(entry.anchor, "unrecoverable", observedAt, outcome),
    );
  }
  const repaired = inspectAnchorState(entry.anchor, receiverOverride);
  if (
    repaired.unavailableReason ||
    repaired.factoryFailed ||
    repaired.mismatch ||
    !repaired.effectiveLookupIntact
  ) {
    return recordResult(
      state,
      createIntegrityResult(entry.anchor, "unrecoverable", observedAt, "repair-failed"),
    );
  }
  return recordResult(
    state,
    createIntegrityResult(entry.anchor, "repaired", observedAt, {
      reason: "prototype-chain-changed",
      repairedAt: state.now(),
    }),
  );
};

type EnsureInput<TSurfaceId extends string, TMethodId extends string> = {
  state: RegistryState<TSurfaceId, TMethodId>;
  entry: RegisteredAnchorEntry<TSurfaceId, TMethodId>;
  receiverOverride?: object;
};

const recordFailure = <TSurfaceId extends string, TMethodId extends string>(
  state: RegistryState<TSurfaceId, TMethodId>,
  entry: RegisteredAnchorEntry<TSurfaceId, TMethodId>,
  observedAt: number,
): IntegrityResult<TSurfaceId, TMethodId> =>
  recordResult(
    state,
    createIntegrityResult(entry.anchor, "unrecoverable", observedAt, "repair-failed"),
  );

const ensureEntry = <TSurfaceId extends string, TMethodId extends string>({
  state,
  entry,
  receiverOverride,
}: EnsureInput<TSurfaceId, TMethodId>): IntegrityResult<TSurfaceId, TMethodId> => {
  const observedAt = state.now();
  const inspection = inspectAnchorState(entry.anchor, receiverOverride);
  if (inspection.unavailableReason) {
    return recordResult(
      state,
      unavailableResult(entry.anchor, observedAt, inspection.unavailableReason),
    );
  }
  if (inspection.factoryFailed || !inspection.target || !inspection.expected) {
    return recordFailure(state, entry, observedAt);
  }
  if (!inspection.mismatch && inspection.effectiveLookupIntact) {
    return recordResult(
      state,
      createIntegrityResult(entry.anchor, "intact", observedAt),
    );
  }
  if (!inspection.mismatch) {
    return ensureEffectiveLookup({
      state,
      entry,
      target: inspection.target,
      observedAt,
      ...(receiverOverride ? { receiverOverride } : {}),
    });
  }
  if (entry.anchor.repairPolicy === "audit") {
    return recordResult(
      state,
      createIntegrityResult(
        entry.anchor,
        "unconfirmed",
        observedAt,
        inspection.mismatch,
      ),
    );
  }
  if (inspection.actual?.configurable === false) {
    return recordResult(
      state,
      createIntegrityResult(
        entry.anchor,
        "unrecoverable",
        observedAt,
        "hostile-non-configurable",
      ),
    );
  }
  let extensible: boolean;
  try {
    extensible = privateIsExtensible(inspection.target);
  } catch {
    return recordFailure(state, entry, observedAt);
  }
  if (!inspection.actual && !extensible) {
    return recordResult(
      state,
      createIntegrityResult(
        entry.anchor,
        "unrecoverable",
        observedAt,
        "target-non-extensible",
      ),
    );
  }
  try {
    privateDefineProperty(inspection.target, entry.anchor.key, inspection.expected);
  } catch {
    return recordFailure(state, entry, observedAt);
  }
  return verifyDescriptorRepair({
    state,
    entry,
    target: inspection.target,
    observedAt,
    mismatch: inspection.mismatch,
    ...(receiverOverride ? { receiverOverride } : {}),
  });
};

type DescriptorRepairInput<
  TSurfaceId extends string,
  TMethodId extends string,
> = LookupRepairInput<TSurfaceId, TMethodId> & {
  mismatch: NonNullable<ReturnType<typeof inspectAnchorState>["mismatch"]>;
};

const verifyDescriptorRepair = <TSurfaceId extends string, TMethodId extends string>({
  state,
  entry,
  target,
  observedAt,
  mismatch,
  receiverOverride,
}: DescriptorRepairInput<TSurfaceId, TMethodId>): IntegrityResult<
  TSurfaceId,
  TMethodId
> => {
  const repaired = inspectAnchorState(entry.anchor, receiverOverride);
  if (
    !repaired.unavailableReason &&
    !repaired.factoryFailed &&
    !repaired.mismatch &&
    !repaired.effectiveLookupIntact &&
    entry.anchor.repairEffectiveLookup
  ) {
    return ensureEffectiveLookup({
      state,
      entry,
      target,
      observedAt,
      ...(receiverOverride ? { receiverOverride } : {}),
    });
  }
  if (
    repaired.unavailableReason ||
    repaired.factoryFailed ||
    repaired.mismatch ||
    !repaired.effectiveLookupIntact
  ) {
    return recordFailure(state, entry, observedAt);
  }
  return recordResult(
    state,
    createIntegrityResult(entry.anchor, "repaired", observedAt, {
      reason: mismatch,
      repairedAt: state.now(),
    }),
  );
};

const collectEnsured = <TSurfaceId extends string, TMethodId extends string>(
  state: RegistryState<TSurfaceId, TMethodId>,
  predicate: (entry: RegisteredAnchorEntry<TSurfaceId, TMethodId>) => boolean,
): IntegrityResult<TSurfaceId, TMethodId>[] => {
  const results = createPublicArray<IntegrityResult<TSurfaceId, TMethodId>>(0);
  privateMapForEach(state.entriesById, (entry) => {
    if (predicate(entry)) privateArrayPush(results, ensureEntry({ state, entry }));
  });
  return results;
};

const copyStoredAnchor = <TSurfaceId extends string, TMethodId extends string>(
  anchor: SurfaceIntegrityAnchor<TSurfaceId, TMethodId>,
): SurfaceIntegrityAnchor<TSurfaceId, TMethodId> =>
  privateObjectFreeze({
    surfaceId: anchor.surfaceId,
    realmId: anchor.realmId,
    resolveTarget: anchor.resolveTarget,
    key: anchor.key,
    createExpectedDescriptor: anchor.createExpectedDescriptor,
    repairPolicy: anchor.repairPolicy,
    criticality: anchor.criticality,
    ...(anchor.methodId !== undefined ? { methodId: anchor.methodId } : {}),
    ...(anchor.resolveTargetUnavailable
      ? { resolveTargetUnavailable: anchor.resolveTargetUnavailable }
      : {}),
    ...(anchor.validateDescriptor
      ? { validateDescriptor: anchor.validateDescriptor }
      : {}),
    ...(anchor.resolveReceiver ? { resolveReceiver: anchor.resolveReceiver } : {}),
    ...(anchor.resolveReceiverMissing
      ? { resolveReceiverMissing: anchor.resolveReceiverMissing }
      : {}),
    ...(anchor.validateEffectiveLookup
      ? { validateEffectiveLookup: anchor.validateEffectiveLookup }
      : {}),
    ...(anchor.repairEffectiveLookup
      ? { repairEffectiveLookup: anchor.repairEffectiveLookup }
      : {}),
  }) as SurfaceIntegrityAnchor<TSurfaceId, TMethodId>;

const resolveTarget = <TSurfaceId extends string, TMethodId extends string>(
  anchor: SurfaceIntegrityAnchor<TSurfaceId, TMethodId>,
): object | null => {
  try {
    return anchor.resolveTarget();
  } catch {
    return null;
  }
};

const getTargetEntries = <TSurfaceId extends string, TMethodId extends string>(
  state: RegistryState<TSurfaceId, TMethodId>,
  target: object | null,
  key: PropertyKey,
): Map<PropertyKey, RegisteredAnchorEntry<TSurfaceId, TMethodId>> | null => {
  if (!target) return null;
  let targetEntries = privateWeakMapGet(state.entriesByTarget, target);
  if (!targetEntries) {
    targetEntries = createPrivateMap();
    privateWeakMapSet(state.entriesByTarget, target, targetEntries);
  }
  const existing = privateMapGet(targetEntries, key);
  if (existing) privateMapDelete(state.entriesById, existing.token.registrationId);
  return targetEntries;
};

const registerAnchor = <TSurfaceId extends string, TMethodId extends string>(
  state: RegistryState<TSurfaceId, TMethodId>,
  anchor: SurfaceIntegrityAnchor<TSurfaceId, TMethodId>,
): RegisteredAnchor => {
  assertBoundedId("surfaceId", anchor.surfaceId);
  assertBoundedId("realmId", anchor.realmId);
  if (anchor.methodId !== undefined) assertBoundedId("methodId", anchor.methodId);
  const registeredTarget = resolveTarget(anchor);
  const targetEntries = getTargetEntries(state, registeredTarget, anchor.key);
  const token = privateObjectFreeze({
    registrationId: state.nextRegistrationId,
  }) as RegisteredAnchor;
  const entry: RegisteredAnchorEntry<TSurfaceId, TMethodId> = {
    token,
    anchor: copyStoredAnchor(anchor),
    registeredTarget,
  };
  state.nextRegistrationId += 1;
  privateMapSet(state.entriesById, token.registrationId, entry);
  if (targetEntries) privateMapSet(targetEntries, anchor.key, entry);
  return token;
};

const removeRealmEntries = <TSurfaceId extends string, TMethodId extends string>(
  state: RegistryState<TSurfaceId, TMethodId>,
  realmId: string,
): void => {
  const registrationIds = createPrivateArray<number>(0);
  privateMapForEach(state.entriesById, (entry, registrationId) => {
    if (entry.anchor.realmId !== realmId) return;
    privateArrayPush(registrationIds, registrationId);
    if (!entry.registeredTarget) return;
    const targetEntries = privateWeakMapGet(
      state.entriesByTarget,
      entry.registeredTarget,
    );
    if (targetEntries) privateMapDelete(targetEntries, entry.anchor.key);
  });
  for (let index = 0; index < registrationIds.length; index += 1) {
    const registrationId = registrationIds[index];
    if (registrationId !== undefined) {
      privateMapDelete(state.entriesById, registrationId);
    }
  }
};

const retainOtherRealms = <T extends { realmId: string }>(
  values: T[],
  realmId: string,
): T[] => {
  const retained = createPrivateArray<T>(0);
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value && value.realmId !== realmId) privateArrayPush(retained, value);
  }
  return retained;
};

const unregisterRealm = <TSurfaceId extends string, TMethodId extends string>(
  state: RegistryState<TSurfaceId, TMethodId>,
  realmId: string,
): void => {
  removeRealmEntries(state, realmId);
  state.recentResults = retainOtherRealms(state.recentResults, realmId);
  state.incidentHistory = retainOtherRealms(state.incidentHistory, realmId);
};

const copyResults = <TSurfaceId extends string, TMethodId extends string>(
  values: IntegrityResult<TSurfaceId, TMethodId>[],
): IntegrityResult<TSurfaceId, TMethodId>[] => {
  const results = createPublicArray<IntegrityResult<TSurfaceId, TMethodId>>(0);
  for (let index = 0; index < values.length; index += 1) {
    const result = values[index];
    if (result) privateArrayPush(results, copyIntegrityResult(result));
  }
  return results;
};

const copyIncidents = <TSurfaceId extends string, TMethodId extends string>(
  values: IntegrityIncident<TSurfaceId, TMethodId>[],
): IntegrityIncident<TSurfaceId, TMethodId>[] => {
  const results = createPublicArray<IntegrityIncident<TSurfaceId, TMethodId>>(0);
  for (let index = 0; index < values.length; index += 1) {
    const incident = values[index];
    if (incident) privateArrayPush(results, copyIntegrityIncident(incident));
  }
  return results;
};

/** Registers the exact canonical descriptor that an installer just applied. */
export const registerInstalledDesc = <
  TSurfaceId extends string = string,
  TMethodId extends string = string,
>({
  registrar,
  target,
  key,
  descriptor,
  anchor,
}: DescriptorRegistration<TSurfaceId, TMethodId>): RegisteredAnchor => {
  const expected = copyPropDescriptor(descriptor);
  return registrar.register({
    ...anchor,
    resolveTarget: () => target,
    key,
    createExpectedDescriptor: () => expected,
  });
};

export const createIntegrityRegistry = <
  TSurfaceId extends string = string,
  TMethodId extends string = string,
>(
  options: IntegrityRegistryOptions<TSurfaceId, TMethodId> = {},
): SurfaceIntegrityRegistry<TSurfaceId, TMethodId> => {
  const state = createRegistryState(options);
  return {
    register: (anchor) => registerAnchor(state, anchor),
    inspect: (registered) => inspectEntry(state, getEntry(state, registered)),
    ensure: (registered) => ensureEntry({ state, entry: getEntry(state, registered) }),
    ensureReceiver: (registered, receiver) =>
      ensureEntry({
        state,
        entry: getEntry(state, registered),
        receiverOverride: receiver,
      }),
    ensureSurface: (surfaceId, realmId) =>
      collectEnsured(
        state,
        (entry) =>
          entry.anchor.surfaceId === surfaceId &&
          (realmId === undefined || entry.anchor.realmId === realmId),
      ),
    ensureRealm: (realmId) =>
      collectEnsured(state, (entry) => entry.anchor.realmId === realmId),
    ensureAll: () => collectEnsured(state, () => true),
    unregisterRealm: (realmId) => unregisterRealm(state, realmId),
    setResultSink: (sink) => {
      state.sink = sink;
    },
    getRecentResults: () => copyResults(state.recentResults),
    getIncidentHistory: () => copyIncidents(state.incidentHistory),
  };
};
