import {
  registerInstalledDesc,
  type IntegrityRegistrar as CoreIntegrityRegistrar,
  type RegisteredAnchor,
} from "@privacy-brand/refract-core/integrity/surface-integrity-registry";
import {
  privateGetPrototype,
  privateOwnDescriptor,
} from "@privacy-brand/refract-core/runtime/primordials";

import type { SpoofingSurfaceKey } from "@/shared/spoofing-surfaces";
import type { SpoofingSurfaceMethodId } from "@/shared/types";

export const DOCUMENT_REALM_ID = "document";

export type IntegrityRegistrar = CoreIntegrityRegistrar<
  SpoofingSurfaceKey,
  SpoofingSurfaceMethodId
> & {
  ensure(anchor: RegisteredAnchor): unknown;
  ensureReceiver(anchor: RegisteredAnchor, receiver: object): unknown;
};

export type RuntimeIntegrityContext = {
  registrar: IntegrityRegistrar;
  realmId: string;
};

export type IntegrityAnchor = {
  surfaceId: SpoofingSurfaceKey;
  methodId?: SpoofingSurfaceMethodId;
  receiver?: object;
  resolveReceiver?: () => object | null;
  unavailableReason?: "target-not-ready";
  validateEffectiveLookup?: (
    receiver: object,
    target: object,
    key: PropertyKey,
  ) => boolean;
  repairEffectiveLookup?: (
    receiver: object,
    target: object,
    key: PropertyKey,
  ) => "repaired" | "hostile-non-configurable" | "repair-failed";
};

export type DescriptorInput = {
  integrity: RuntimeIntegrityContext | undefined;
  target: object;
  key: PropertyKey;
  anchor: IntegrityAnchor;
  installedDescriptor?: PropertyDescriptor;
};

export const registerDescriptor = ({
  integrity,
  target,
  key,
  anchor,
  installedDescriptor,
}: DescriptorInput): RegisteredAnchor | undefined => {
  if (!integrity) return undefined;
  const descriptor = installedDescriptor ?? privateOwnDescriptor(target, key);
  if (!descriptor) return undefined;
  const resolveReceiver =
    anchor.resolveReceiver ??
    (anchor.receiver ? () => anchor.receiver ?? null : undefined);
  return registerInstalledDesc({
    registrar: integrity.registrar,
    target,
    key,
    descriptor,
    anchor: {
      surfaceId: anchor.surfaceId,
      ...(anchor.methodId ? { methodId: anchor.methodId } : {}),
      realmId: integrity.realmId,
      repairPolicy: "repair",
      criticality: "preview-critical",
      ...(resolveReceiver ? { resolveReceiver } : {}),
      ...(anchor.validateEffectiveLookup
        ? { validateEffectiveLookup: anchor.validateEffectiveLookup }
        : {}),
      ...(anchor.repairEffectiveLookup
        ? { repairEffectiveLookup: anchor.repairEffectiveLookup }
        : {}),
      ...(anchor.unavailableReason
        ? {
            resolveReceiverMissing: () =>
              anchor.unavailableReason ?? "target-not-ready",
          }
        : {}),
    },
  });
};

export const findPropertyOwner = (
  receiver: object,
  key: PropertyKey,
): { owner: object; descriptor: PropertyDescriptor } | null => {
  let current: object | null = receiver;
  for (let depth = 0; current && depth < 256; depth += 1) {
    const descriptor = privateOwnDescriptor(current, key);
    if (descriptor) return { owner: current, descriptor };
    current = privateGetPrototype(current);
  }
  return null;
};
