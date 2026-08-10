export type SurfaceIntegrityStatus =
  "intact" | "repaired" | "unrecoverable" | "not-applicable" | "unconfirmed";

export type IntegrityReason =
  | "descriptor-missing"
  | "descriptor-replaced"
  | "descriptor-flags-changed"
  | "prototype-chain-changed"
  | "target-not-ready"
  | "target-missing"
  | "target-non-extensible"
  | "hostile-non-configurable"
  | "repair-failed"
  | "realm-destroyed";

export type IntegrityRepairPolicy = "repair" | "audit" | "strict";
export type IntegrityCriticality = "preview-critical" | "standard";
export type IntegrityUnavailable = Extract<
  IntegrityReason,
  "target-not-ready" | "target-missing" | "realm-destroyed"
>;

export type LookupRepairOutcome =
  "repaired" | "hostile-non-configurable" | "repair-failed";

export type IntegrityResult<
  TSurfaceId extends string = string,
  TMethodId extends string = string,
> = {
  status: SurfaceIntegrityStatus;
  surfaceId: TSurfaceId;
  realmId: string;
  observedAt: number;
  methodId?: TMethodId;
  reason?: IntegrityReason;
  repairedAt?: number;
};

export type IntegrityIncident<
  TSurfaceId extends string = string,
  TMethodId extends string = string,
> = {
  surfaceId: TSurfaceId;
  realmId: string;
  reason: IntegrityReason;
  outcome: "repaired" | "unrecoverable";
  observedAt: number;
  methodId?: TMethodId;
};

export type SurfaceIntegrityAnchor<
  TSurfaceId extends string = string,
  TMethodId extends string = string,
> = {
  surfaceId: TSurfaceId;
  realmId: string;
  resolveTarget: () => object | null;
  key: PropertyKey;
  createExpectedDescriptor: () => PropertyDescriptor;
  repairPolicy: IntegrityRepairPolicy;
  criticality: IntegrityCriticality;
  methodId?: TMethodId;
  resolveTargetUnavailable?: () => IntegrityUnavailable;
  validateDescriptor?: (
    actual: PropertyDescriptor,
    expected: PropertyDescriptor,
  ) => boolean;
  resolveReceiver?: () => object | null;
  resolveReceiverMissing?: () => IntegrityUnavailable;
  validateEffectiveLookup?: (
    receiver: object,
    target: object,
    key: PropertyKey,
  ) => boolean;
  repairEffectiveLookup?: (
    receiver: object,
    target: object,
    key: PropertyKey,
  ) => LookupRepairOutcome;
};

export type RegisteredAnchor = {
  readonly registrationId: number;
};

export type IntegrityRegistrar<
  TSurfaceId extends string = string,
  TMethodId extends string = string,
> = {
  register(anchor: SurfaceIntegrityAnchor<TSurfaceId, TMethodId>): RegisteredAnchor;
};

export type IntegrityResultSink<
  TSurfaceId extends string = string,
  TMethodId extends string = string,
> = {
  record(result: IntegrityResult<TSurfaceId, TMethodId>): void;
};

export type SurfaceIntegrityRegistry<
  TSurfaceId extends string = string,
  TMethodId extends string = string,
> = IntegrityRegistrar<TSurfaceId, TMethodId> & {
  inspect(anchor: RegisteredAnchor): IntegrityResult<TSurfaceId, TMethodId>;
  ensure(anchor: RegisteredAnchor): IntegrityResult<TSurfaceId, TMethodId>;
  ensureReceiver(
    anchor: RegisteredAnchor,
    receiver: object,
  ): IntegrityResult<TSurfaceId, TMethodId>;
  ensureSurface(
    surfaceId: TSurfaceId,
    realmId?: string,
  ): IntegrityResult<TSurfaceId, TMethodId>[];
  ensureRealm(realmId: string): IntegrityResult<TSurfaceId, TMethodId>[];
  ensureAll(): IntegrityResult<TSurfaceId, TMethodId>[];
  unregisterRealm(realmId: string): void;
  setResultSink(sink: IntegrityResultSink<TSurfaceId, TMethodId> | null): void;
  getRecentResults(): IntegrityResult<TSurfaceId, TMethodId>[];
  getIncidentHistory(): IntegrityIncident<TSurfaceId, TMethodId>[];
};

export type IntegrityRegistryOptions<
  TSurfaceId extends string = string,
  TMethodId extends string = string,
> = {
  historyLimit?: number;
  now?: () => number;
  sink?: IntegrityResultSink<TSurfaceId, TMethodId>;
};

export type DescriptorRegistration<
  TSurfaceId extends string = string,
  TMethodId extends string = string,
> = {
  registrar: IntegrityRegistrar<TSurfaceId, TMethodId>;
  target: object;
  key: PropertyKey;
  descriptor: PropertyDescriptor;
  anchor: Omit<
    SurfaceIntegrityAnchor<TSurfaceId, TMethodId>,
    "resolveTarget" | "key" | "createExpectedDescriptor"
  >;
};

export type RegisteredAnchorEntry<
  TSurfaceId extends string,
  TMethodId extends string,
> = {
  token: RegisteredAnchor;
  anchor: SurfaceIntegrityAnchor<TSurfaceId, TMethodId>;
  registeredTarget: object | null;
};

export type DescriptorMismatch =
  "descriptor-missing" | "descriptor-replaced" | "descriptor-flags-changed";

export type InspectionState = {
  target: object | null;
  expected: PropertyDescriptor | null;
  actual: PropertyDescriptor | undefined;
  mismatch?: DescriptorMismatch;
  effectiveLookupIntact: boolean;
  unavailableReason?: IntegrityUnavailable;
  factoryFailed: boolean;
};
