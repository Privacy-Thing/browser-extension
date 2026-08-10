import {
  privateArrayPush,
  privateArrayShift,
  privateGetPrototype,
  privateIsSafeInteger,
  privateObjectFreeze,
  privateOwnDescriptor,
} from "../runtime/primordials";

import type {
  DescriptorMismatch,
  InspectionState,
  IntegrityIncident,
  IntegrityReason,
  IntegrityResult,
  IntegrityUnavailable,
  SurfaceIntegrityAnchor,
  SurfaceIntegrityStatus,
} from "./surface-integrity-types";

const DEFAULT_HISTORY_LIMIT = 64;
const MAX_ID_LENGTH = 128;
const MAX_PROTOTYPE_DEPTH = 256;

const isAccessorDescriptor = (descriptor: PropertyDescriptor): boolean =>
  "get" in descriptor || "set" in descriptor;

export const copyPropDescriptor = (
  descriptor: PropertyDescriptor,
): PropertyDescriptor =>
  privateObjectFreeze(
    isAccessorDescriptor(descriptor)
      ? {
          configurable: descriptor.configurable ?? false,
          enumerable: descriptor.enumerable ?? false,
          ...(typeof descriptor.get === "function" ? { get: descriptor.get } : {}),
          ...(typeof descriptor.set === "function" ? { set: descriptor.set } : {}),
        }
      : {
          configurable: descriptor.configurable ?? false,
          enumerable: descriptor.enumerable ?? false,
          writable: descriptor.writable ?? false,
          value: descriptor.value,
        },
  );

const classifyMismatch = (
  actual: PropertyDescriptor | undefined,
  expected: PropertyDescriptor,
  validateDescriptor?: (
    actual: PropertyDescriptor,
    expected: PropertyDescriptor,
  ) => boolean,
): DescriptorMismatch | undefined => {
  if (!actual) return "descriptor-missing";
  if (validateDescriptor) {
    try {
      return validateDescriptor(actual, expected) ? undefined : "descriptor-replaced";
    } catch {
      return "descriptor-replaced";
    }
  }
  if (
    actual.configurable !== (expected.configurable ?? false) ||
    actual.enumerable !== (expected.enumerable ?? false)
  ) {
    return "descriptor-flags-changed";
  }
  const actualAccessor = isAccessorDescriptor(actual);
  const expectedAccessor = isAccessorDescriptor(expected);
  if (actualAccessor !== expectedAccessor) return "descriptor-replaced";
  if (expectedAccessor) {
    return actual.get === expected.get && actual.set === expected.set
      ? undefined
      : "descriptor-replaced";
  }
  if (actual.writable !== (expected.writable ?? false)) {
    return "descriptor-flags-changed";
  }
  return actual.value === expected.value ? undefined : "descriptor-replaced";
};

type ExpectedLookupInput = {
  receiver: object;
  target: object;
  key: PropertyKey;
  expected: PropertyDescriptor;
  validateDescriptor?: (
    actual: PropertyDescriptor,
    expected: PropertyDescriptor,
  ) => boolean;
};

const hasExpectedLookup = ({
  receiver,
  target,
  key,
  expected,
  validateDescriptor,
}: ExpectedLookupInput): boolean => {
  let current: object | null = receiver;
  let depth = 0;
  while (current && depth < MAX_PROTOTYPE_DEPTH) {
    let descriptor: PropertyDescriptor | undefined;
    try {
      descriptor = privateOwnDescriptor(current, key);
    } catch {
      return false;
    }
    if (descriptor) {
      return (
        current === target &&
        classifyMismatch(descriptor, expected, validateDescriptor) === undefined
      );
    }
    try {
      current = privateGetPrototype(current);
    } catch {
      return false;
    }
    depth += 1;
  }
  return false;
};

export const resolveReceiver = <TSurfaceId extends string, TMethodId extends string>(
  anchor: SurfaceIntegrityAnchor<TSurfaceId, TMethodId>,
): object | null => {
  try {
    return anchor.resolveReceiver?.() ?? null;
  } catch {
    return null;
  }
};

const inspectEffectiveLookup = <TSurfaceId extends string, TMethodId extends string>(
  anchor: SurfaceIntegrityAnchor<TSurfaceId, TMethodId>,
  target: object,
  expected: PropertyDescriptor,
  receiverOverride?: object,
): boolean => {
  if (!anchor.resolveReceiver && !receiverOverride) return true;
  const receiver = receiverOverride ?? resolveReceiver(anchor);
  if (!receiver) return false;
  if (!anchor.validateEffectiveLookup) {
    return hasExpectedLookup({
      receiver,
      target,
      key: anchor.key,
      expected,
      ...(anchor.validateDescriptor
        ? { validateDescriptor: anchor.validateDescriptor }
        : {}),
    });
  }
  try {
    return anchor.validateEffectiveLookup(receiver, target, anchor.key);
  } catch {
    return false;
  }
};

const resolveUnavailable = <TSurfaceId extends string, TMethodId extends string>(
  anchor: SurfaceIntegrityAnchor<TSurfaceId, TMethodId>,
): IntegrityUnavailable => {
  try {
    return anchor.resolveTargetUnavailable?.() ?? "target-missing";
  } catch {
    return "target-missing";
  }
};

const resolveMissingReceiver = <TSurfaceId extends string, TMethodId extends string>(
  anchor: SurfaceIntegrityAnchor<TSurfaceId, TMethodId>,
): IntegrityUnavailable => {
  try {
    return anchor.resolveReceiverMissing?.() ?? "target-not-ready";
  } catch {
    return "target-not-ready";
  }
};

export const inspectAnchorState = <TSurfaceId extends string, TMethodId extends string>(
  anchor: SurfaceIntegrityAnchor<TSurfaceId, TMethodId>,
  receiverOverride?: object,
): InspectionState => {
  let target: object | null;
  try {
    target = anchor.resolveTarget();
  } catch {
    target = null;
  }
  if (!target) {
    return {
      target: null,
      expected: null,
      actual: undefined,
      effectiveLookupIntact: false,
      unavailableReason: resolveUnavailable(anchor),
      factoryFailed: false,
    };
  }
  let expected: PropertyDescriptor;
  try {
    expected = anchor.createExpectedDescriptor();
  } catch {
    return failedInspection(target, null);
  }
  let actual: PropertyDescriptor | undefined;
  try {
    actual = privateOwnDescriptor(target, anchor.key);
  } catch {
    return failedInspection(target, expected);
  }
  const mismatch = classifyMismatch(actual, expected, anchor.validateDescriptor);
  let receiver = receiverOverride;
  if (!mismatch && !receiver && anchor.resolveReceiver) {
    receiver = resolveReceiver(anchor) ?? undefined;
  }
  if (!mismatch && !receiver && anchor.resolveReceiverMissing) {
    return {
      target,
      expected,
      actual,
      effectiveLookupIntact: false,
      unavailableReason: resolveMissingReceiver(anchor),
      factoryFailed: false,
    };
  }
  return {
    target,
    expected,
    actual,
    ...(mismatch !== undefined ? { mismatch } : {}),
    effectiveLookupIntact: mismatch
      ? true
      : inspectEffectiveLookup(anchor, target, expected, receiver),
    factoryFailed: false,
  };
};

const failedInspection = (
  target: object,
  expected: PropertyDescriptor | null,
): InspectionState => ({
  target,
  expected,
  actual: undefined,
  effectiveLookupIntact: false,
  factoryFailed: true,
});

export const normalizeHistoryLimit = (value: number | undefined): number =>
  typeof value === "number" && privateIsSafeInteger(value) && value > 0
    ? value
    : DEFAULT_HISTORY_LIMIT;

export const assertBoundedId = (name: string, value: string): void => {
  if (value.length === 0 || value.length > MAX_ID_LENGTH) {
    throw new TypeError(
      `${name} must contain between 1 and ${MAX_ID_LENGTH} characters`,
    );
  }
};

export const appendBounded = <T>(target: T[], value: T, limit: number): void => {
  privateArrayPush(target, value);
  while (target.length > limit) privateArrayShift(target);
};

type ResultDetails = {
  reason?: IntegrityReason;
  repairedAt?: number;
};

export const createIntegrityResult = <
  TSurfaceId extends string,
  TMethodId extends string,
>(
  anchor: SurfaceIntegrityAnchor<TSurfaceId, TMethodId>,
  status: SurfaceIntegrityStatus,
  observedAt: number,
  reasonOrDetails?: IntegrityReason | ResultDetails,
): IntegrityResult<TSurfaceId, TMethodId> => {
  const details =
    typeof reasonOrDetails === "string" ? { reason: reasonOrDetails } : reasonOrDetails;
  return {
    status,
    surfaceId: anchor.surfaceId,
    realmId: anchor.realmId,
    observedAt,
    ...(anchor.methodId !== undefined ? { methodId: anchor.methodId } : {}),
    ...(details?.reason !== undefined ? { reason: details.reason } : {}),
    ...(details?.repairedAt !== undefined ? { repairedAt: details.repairedAt } : {}),
  };
};

export const copyIntegrityResult = <
  TSurfaceId extends string,
  TMethodId extends string,
>(
  result: IntegrityResult<TSurfaceId, TMethodId>,
): IntegrityResult<TSurfaceId, TMethodId> => ({
  status: result.status,
  surfaceId: result.surfaceId,
  realmId: result.realmId,
  observedAt: result.observedAt,
  ...(result.methodId !== undefined ? { methodId: result.methodId } : {}),
  ...(result.reason !== undefined ? { reason: result.reason } : {}),
  ...(result.repairedAt !== undefined ? { repairedAt: result.repairedAt } : {}),
});

export const copyIntegrityIncident = <
  TSurfaceId extends string,
  TMethodId extends string,
>(
  incident: IntegrityIncident<TSurfaceId, TMethodId>,
): IntegrityIncident<TSurfaceId, TMethodId> => ({
  surfaceId: incident.surfaceId,
  realmId: incident.realmId,
  reason: incident.reason,
  outcome: incident.outcome,
  observedAt: incident.observedAt,
  ...(incident.methodId !== undefined ? { methodId: incident.methodId } : {}),
});

export const unavailableResult = <TSurfaceId extends string, TMethodId extends string>(
  anchor: SurfaceIntegrityAnchor<TSurfaceId, TMethodId>,
  observedAt: number,
  reason: IntegrityUnavailable,
): IntegrityResult<TSurfaceId, TMethodId> => {
  if (reason === "target-not-ready") {
    return createIntegrityResult(anchor, "unconfirmed", observedAt, reason);
  }
  if (reason === "realm-destroyed") {
    return createIntegrityResult(anchor, "not-applicable", observedAt, reason);
  }
  return createIntegrityResult(anchor, "unrecoverable", observedAt, reason);
};
