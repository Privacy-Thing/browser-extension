import {
  createIntegrityRegistry,
  type IntegrityResult,
  type SurfaceIntegrityAnchor,
} from "@privacy-brand/refract-core/integrity/surface-integrity-registry";
import { describe, expect, it } from "vitest";

type SurfaceId = "navigator" | "screen";
type MethodId = "navigator.userAgent" | "screen.width";

const createClock = () => {
  let value = 100;
  return () => {
    value += 1;
    return value;
  };
};

const createGetterAnchor = ({
  target,
  getter,
  receiver,
  realmId = "top",
  repairPolicy = "repair",
  resolveTargetUnavailable,
}: {
  target: object | null;
  getter: () => string;
  receiver?: object;
  realmId?: string;
  repairPolicy?: "repair" | "audit" | "strict";
  resolveTargetUnavailable?: () =>
    "target-not-ready" | "target-missing" | "realm-destroyed";
}): SurfaceIntegrityAnchor<SurfaceId, MethodId> => ({
  surfaceId: "navigator",
  methodId: "navigator.userAgent",
  realmId,
  resolveTarget: () => target,
  key: "userAgent",
  createExpectedDescriptor: () => ({
    configurable: true,
    enumerable: false,
    get: getter,
  }),
  ...(receiver ? { resolveReceiver: () => receiver } : {}),
  ...(resolveTargetUnavailable ? { resolveTargetUnavailable } : {}),
  repairPolicy,
  criticality: "preview-critical",
});

describe("SurfaceIntegrityRegistry", () => {
  it("confirms an exact descriptor and its effective inherited lookup", () => {
    const getter = () => "spoofed";
    const target = {};
    const receiver = Object.create(target) as object;
    Object.defineProperty(target, "userAgent", {
      configurable: true,
      enumerable: false,
      get: getter,
    });
    const registry = createIntegrityRegistry<SurfaceId, MethodId>({
      now: createClock(),
    });
    const registered = registry.register(
      createGetterAnchor({ target, getter, receiver }),
    );

    expect(Reflect.ownKeys(registered)).toEqual(["registrationId"]);
    expect(registry.inspect(registered)).toMatchObject({
      status: "intact",
      surfaceId: "navigator",
      methodId: "navigator.userAgent",
      realmId: "top",
    });
    expect((receiver as { userAgent?: string }).userAgent).toBe("spoofed");
  });

  it("repairs a deleted configurable descriptor with the canonical getter", () => {
    const getter = () => "spoofed";
    const target = {};
    Object.defineProperty(target, "userAgent", {
      configurable: true,
      enumerable: false,
      get: getter,
    });
    const recorded: IntegrityResult<SurfaceId, MethodId>[] = [];
    const registry = createIntegrityRegistry<SurfaceId, MethodId>({
      now: createClock(),
      sink: { record: (result) => recorded.push(result) },
    });
    const registered = registry.register(createGetterAnchor({ target, getter }));

    expect(Reflect.deleteProperty(target, "userAgent")).toBe(true);
    expect(registry.ensure(registered)).toMatchObject({
      status: "repaired",
      reason: "descriptor-missing",
    });
    expect(Object.getOwnPropertyDescriptor(target, "userAgent")?.get).toBe(getter);
    expect(registry.ensure(registered)).toMatchObject({ status: "intact" });
    expect(recorded.map(({ status }) => status)).toEqual(["repaired", "intact"]);
    expect(registry.getIncidentHistory()).toEqual([
      expect.objectContaining({
        outcome: "repaired",
        reason: "descriptor-missing",
      }),
    ]);
  });

  it("replaces an attacker-controlled configurable descriptor without wrapper growth", () => {
    const getter = () => "spoofed";
    const target = {};
    Object.defineProperty(target, "userAgent", {
      configurable: true,
      enumerable: false,
      get: getter,
    });
    const registry = createIntegrityRegistry<SurfaceId, MethodId>({
      now: createClock(),
    });
    const registered = registry.register(createGetterAnchor({ target, getter }));
    const attackerGetter = () => "host";
    Object.defineProperty(target, "userAgent", {
      configurable: true,
      enumerable: false,
      get: attackerGetter,
    });

    expect(registry.ensure(registered)).toMatchObject({
      status: "repaired",
      reason: "descriptor-replaced",
    });
    const repairedGetter = Object.getOwnPropertyDescriptor(target, "userAgent")?.get;
    expect(repairedGetter).toBe(getter);
    expect(repairedGetter).not.toBe(attackerGetter);
    expect(registry.ensure(registered)).toMatchObject({ status: "intact" });
    expect(Object.getOwnPropertyDescriptor(target, "userAgent")?.get).toBe(getter);
  });

  it("repairs changed descriptor flags", () => {
    const getter = () => "spoofed";
    const target = {};
    Object.defineProperty(target, "userAgent", {
      configurable: true,
      enumerable: true,
      get: getter,
    });
    const registry = createIntegrityRegistry<SurfaceId, MethodId>({
      now: createClock(),
    });
    const registered = registry.register(createGetterAnchor({ target, getter }));

    expect(registry.ensure(registered)).toMatchObject({
      status: "repaired",
      reason: "descriptor-flags-changed",
    });
    expect(Object.getOwnPropertyDescriptor(target, "userAgent")?.enumerable).toBe(
      false,
    );
  });

  it("compares and repairs data descriptors using normalized default flags", () => {
    const target = {};
    const patchedWorker = function Worker() {};
    const attackerWorker = function Worker() {};
    Object.defineProperty(target, "Worker", {
      configurable: true,
      writable: true,
      value: attackerWorker,
    });
    const registry = createIntegrityRegistry<SurfaceId, MethodId>({
      now: createClock(),
    });
    const registered = registry.register({
      surfaceId: "navigator",
      realmId: "top",
      resolveTarget: () => target,
      key: "Worker",
      createExpectedDescriptor: () => ({
        configurable: true,
        writable: true,
        value: patchedWorker,
      }),
      repairPolicy: "repair",
      criticality: "preview-critical",
    });

    expect(registry.ensure(registered)).toMatchObject({
      status: "repaired",
      reason: "descriptor-replaced",
    });
    expect(Object.getOwnPropertyDescriptor(target, "Worker")).toMatchObject({
      configurable: true,
      enumerable: false,
      writable: true,
      value: patchedWorker,
    });
    expect(registry.ensure(registered)).toMatchObject({ status: "intact" });
  });

  it("reports a hostile non-configurable replacement without retrying repair", () => {
    const getter = () => "spoofed";
    const attackerGetter = () => "host";
    const target = {};
    Object.defineProperty(target, "userAgent", {
      configurable: false,
      enumerable: false,
      get: attackerGetter,
    });
    const registry = createIntegrityRegistry<SurfaceId, MethodId>({
      now: createClock(),
    });
    const registered = registry.register(createGetterAnchor({ target, getter }));

    expect(registry.ensure(registered)).toMatchObject({
      status: "unrecoverable",
      reason: "hostile-non-configurable",
    });
    expect(Object.getOwnPropertyDescriptor(target, "userAgent")?.get).toBe(
      attackerGetter,
    );
    expect(registry.getIncidentHistory()).toHaveLength(1);
  });

  it("reports a missing descriptor on a non-extensible target", () => {
    const target = Object.preventExtensions({});
    const registry = createIntegrityRegistry<SurfaceId, MethodId>({
      now: createClock(),
    });
    const registered = registry.register(
      createGetterAnchor({ target, getter: () => "spoofed" }),
    );

    expect(registry.ensure(registered)).toMatchObject({
      status: "unrecoverable",
      reason: "target-non-extensible",
    });
  });

  it("detects when the protected descriptor leaves the receiver lookup chain", () => {
    const getter = () => "spoofed";
    const target = {};
    const receiver = Object.create(target) as object;
    Object.defineProperty(target, "userAgent", {
      configurable: true,
      enumerable: false,
      get: getter,
    });
    const registry = createIntegrityRegistry<SurfaceId, MethodId>({
      now: createClock(),
    });
    const registered = registry.register(
      createGetterAnchor({ target, getter, receiver }),
    );

    Object.setPrototypeOf(receiver, {});
    expect(registry.ensure(registered)).toMatchObject({
      status: "unrecoverable",
      reason: "prototype-chain-changed",
    });
    expect(Object.getOwnPropertyDescriptor(target, "userAgent")?.get).toBe(getter);
  });

  it("repairs a configurable receiver shadow through an effective lookup hook", () => {
    const getter = () => "spoofed";
    const target = {};
    const receiver = Object.create(target) as object;
    Object.defineProperty(target, "userAgent", {
      configurable: true,
      get: getter,
    });
    const registry = createIntegrityRegistry<SurfaceId, MethodId>({
      now: createClock(),
    });
    const registered = registry.register({
      ...createGetterAnchor({ target, getter, receiver }),
      repairEffectiveLookup: (resolvedReceiver, _target, key) => {
        const shadow = Object.getOwnPropertyDescriptor(resolvedReceiver, key);
        if (shadow?.configurable === false) return "hostile-non-configurable";
        return Reflect.deleteProperty(resolvedReceiver, key)
          ? "repaired"
          : "repair-failed";
      },
    });
    Object.defineProperty(receiver, "userAgent", {
      configurable: true,
      value: "host",
    });

    expect(registry.ensure(registered)).toMatchObject({
      status: "repaired",
      reason: "prototype-chain-changed",
    });
    expect(Object.hasOwn(receiver, "userAgent")).toBe(false);
    expect((receiver as { userAgent: string }).userAgent).toBe("spoofed");
  });

  it.each(["replace", "delete"] as const)(
    "repairs a target descriptor %s and receiver shadow in one bounded pass",
    (drift) => {
      const getter = () => "spoofed";
      const target = {};
      const receiver = Object.create(target) as object;
      Object.defineProperty(target, "userAgent", {
        configurable: true,
        get: getter,
      });
      const registry = createIntegrityRegistry<SurfaceId, MethodId>({
        now: createClock(),
      });
      const registered = registry.register({
        ...createGetterAnchor({ target, getter, receiver }),
        repairEffectiveLookup: (resolvedReceiver, _target, key) => {
          const shadow = Object.getOwnPropertyDescriptor(resolvedReceiver, key);
          if (shadow?.configurable === false) return "hostile-non-configurable";
          return Reflect.deleteProperty(resolvedReceiver, key)
            ? "repaired"
            : "repair-failed";
        },
      });
      if (drift === "delete") {
        Reflect.deleteProperty(target, "userAgent");
      } else {
        Object.defineProperty(target, "userAgent", {
          configurable: true,
          get: () => "host",
        });
      }
      Object.defineProperty(receiver, "userAgent", {
        configurable: true,
        value: "shadow",
      });

      expect(registry.ensure(registered)).toMatchObject({ status: "repaired" });
      expect(Object.getOwnPropertyDescriptor(target, "userAgent")?.get).toBe(getter);
      expect(Object.hasOwn(receiver, "userAgent")).toBe(false);
      expect((receiver as { userAgent: string }).userAgent).toBe("spoofed");
    },
  );

  it("does not touch a receiver shadow when the target descriptor is hostile", () => {
    const getter = () => "spoofed";
    const target = {};
    const receiver = Object.create(target) as object;
    Object.defineProperty(target, "userAgent", {
      configurable: false,
      get: () => "host",
    });
    Object.defineProperty(receiver, "userAgent", {
      configurable: true,
      value: "shadow",
    });
    const registry = createIntegrityRegistry<SurfaceId, MethodId>({
      now: createClock(),
    });
    const registered = registry.register({
      ...createGetterAnchor({ target, getter, receiver }),
      repairEffectiveLookup: () => "repaired",
    });

    expect(registry.ensure(registered)).toMatchObject({
      status: "unrecoverable",
      reason: "hostile-non-configurable",
    });
    expect(Object.hasOwn(receiver, "userAgent")).toBe(true);
  });

  it("reports a non-configurable receiver shadow as unrecoverable", () => {
    const getter = () => "spoofed";
    const target = {};
    const receiver = Object.create(target) as object;
    Object.defineProperty(target, "userAgent", { configurable: true, get: getter });
    Object.defineProperty(receiver, "userAgent", {
      configurable: false,
      value: "host",
    });
    const registry = createIntegrityRegistry<SurfaceId, MethodId>({
      now: createClock(),
    });
    const registered = registry.register({
      ...createGetterAnchor({ target, getter, receiver }),
      repairEffectiveLookup: (resolvedReceiver, _target, key) =>
        Object.getOwnPropertyDescriptor(resolvedReceiver, key)?.configurable === false
          ? "hostile-non-configurable"
          : "repair-failed",
    });

    expect(registry.ensure(registered)).toMatchObject({
      status: "unrecoverable",
      reason: "hostile-non-configurable",
    });
  });

  it.each([
    ["target-not-ready", "unconfirmed"],
    ["target-missing", "unrecoverable"],
    ["realm-destroyed", "not-applicable"],
  ] as const)("maps %s to %s", (reason, status) => {
    const registry = createIntegrityRegistry<SurfaceId, MethodId>({
      now: createClock(),
    });
    const registered = registry.register(
      createGetterAnchor({
        target: null,
        getter: () => "spoofed",
        resolveTargetUnavailable: () => reason,
      }),
    );

    expect(registry.ensure(registered)).toMatchObject({ status, reason });
  });

  it("keeps audit-only child anchors visible without copying or repairing them", () => {
    const getter = () => "canonical";
    const attackerGetter = () => "parent-poison";
    const childTarget = {};
    Object.defineProperty(childTarget, "userAgent", {
      configurable: true,
      get: attackerGetter,
    });
    const registry = createIntegrityRegistry<SurfaceId, MethodId>({
      now: createClock(),
    });
    const registered = registry.register(
      createGetterAnchor({
        target: childTarget,
        getter,
        realmId: "child-1",
        repairPolicy: "audit",
      }),
    );

    expect(registry.ensure(registered)).toMatchObject({
      status: "unconfirmed",
      reason: "descriptor-replaced",
      realmId: "child-1",
    });
    expect(Object.getOwnPropertyDescriptor(childTarget, "userAgent")?.get).toBe(
      attackerGetter,
    );
  });

  it("replaces duplicate target/key registrations and unregisters realm-owned state", () => {
    const target = {};
    const getter = () => "spoofed";
    Object.defineProperty(target, "userAgent", {
      configurable: true,
      get: getter,
    });
    const registry = createIntegrityRegistry<SurfaceId, MethodId>({
      now: createClock(),
    });
    const first = registry.register(
      createGetterAnchor({ target, getter, realmId: "child-1" }),
    );
    const second = registry.register(
      createGetterAnchor({ target, getter, realmId: "child-1" }),
    );

    expect(() => registry.ensure(first)).toThrow(
      "Unknown or unregistered integrity anchor",
    );
    expect(registry.ensure(second)).toMatchObject({ status: "intact" });
    registry.unregisterRealm("child-1");
    expect(registry.ensureRealm("child-1")).toEqual([]);
    expect(registry.getRecentResults()).toEqual([]);
    expect(registry.getIncidentHistory()).toEqual([]);
    expect(() => registry.ensure(second)).toThrow(
      "Unknown or unregistered integrity anchor",
    );
  });

  it("bounds stored results and incidents", () => {
    const getter = () => "spoofed";
    const target = {};
    const registry = createIntegrityRegistry<SurfaceId, MethodId>({
      historyLimit: 2,
      now: createClock(),
    });
    const registered = registry.register(createGetterAnchor({ target, getter }));

    registry.ensure(registered);
    Reflect.deleteProperty(target, "userAgent");
    registry.ensure(registered);
    Reflect.deleteProperty(target, "userAgent");
    registry.ensure(registered);

    expect(registry.getRecentResults()).toHaveLength(2);
    expect(registry.getIncidentHistory()).toHaveLength(2);
  });

  it("uses captured primordials when inspecting and repairing anchors", () => {
    const getter = () => "spoofed";
    const target = {};
    const registry = createIntegrityRegistry<SurfaceId, MethodId>({
      historyLimit: 1,
      now: createClock(),
    });
    registry.register(createGetterAnchor({ target, getter }));

    const mapForEachDescriptor = Object.getOwnPropertyDescriptor(
      Map.prototype,
      "forEach",
    );
    const arrayPushDescriptor = Object.getOwnPropertyDescriptor(
      Array.prototype,
      "push",
    );
    const arrayShiftDescriptor = Object.getOwnPropertyDescriptor(
      Array.prototype,
      "shift",
    );
    const extensibleDescriptor = Object.getOwnPropertyDescriptor(
      Object,
      "isExtensible",
    );
    if (
      !mapForEachDescriptor ||
      !arrayPushDescriptor ||
      !arrayShiftDescriptor ||
      !extensibleDescriptor
    ) {
      throw new Error("Required primordial descriptors are unavailable");
    }

    let poisonedCallCount = 0;
    const poison = () => {
      poisonedCallCount += 1;
      throw new Error("poisoned primordial called");
    };

    Object.defineProperty(Map.prototype, "forEach", {
      ...mapForEachDescriptor,
      value: poison,
    });
    Object.defineProperty(Array.prototype, "push", {
      ...arrayPushDescriptor,
      value: poison,
    });
    Object.defineProperty(Array.prototype, "shift", {
      ...arrayShiftDescriptor,
      value: poison,
    });
    Object.defineProperty(Object, "isExtensible", {
      ...extensibleDescriptor,
      value: poison,
    });

    let firstResult: IntegrityResult<SurfaceId, MethodId> | undefined;
    let secondResult: IntegrityResult<SurfaceId, MethodId> | undefined;
    try {
      firstResult = registry.ensureAll()[0];
      Reflect.deleteProperty(target, "userAgent");
      secondResult = registry.ensureAll()[0];
    } finally {
      Object.defineProperty(Map.prototype, "forEach", mapForEachDescriptor);
      Object.defineProperty(Array.prototype, "push", arrayPushDescriptor);
      Object.defineProperty(Array.prototype, "shift", arrayShiftDescriptor);
      Object.defineProperty(Object, "isExtensible", extensibleDescriptor);
    }

    expect(poisonedCallCount).toBe(0);
    expect(firstResult).toMatchObject({ status: "repaired" });
    expect(secondResult).toMatchObject({ status: "repaired" });
    expect(Object.getOwnPropertyDescriptor(target, "userAgent")?.get).toBe(getter);
  });
});
