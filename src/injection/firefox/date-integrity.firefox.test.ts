import { createIntegrityRegistry } from "@privacy-brand/refract-core/integrity/surface-integrity-registry";
import { describe, expect, it } from "vitest";

import { registerFxDateIntegrity } from "@/injection/firefox/date-integrity";
import type { SpoofingSurfaceKey } from "@/shared/spoofing-surfaces";
import type { SpoofingSurfaceMethodId } from "@/shared/types";

describe("Firefox Date integrity ownership", () => {
  it("repairs installed methods without taking ownership of unrelated methods", () => {
    const canonicalToString = () => "canonical";
    const unrelatedGetTime = () => 1;
    class FakeDate {}
    Object.defineProperty(FakeDate.prototype, "toString", {
      configurable: true,
      writable: true,
      value: canonicalToString,
    });
    Object.defineProperty(FakeDate.prototype, "getTime", {
      configurable: true,
      writable: true,
      value: unrelatedGetTime,
    });
    const registry = createIntegrityRegistry<
      SpoofingSurfaceKey,
      SpoofingSurfaceMethodId
    >({ now: () => 1 });
    registerFxDateIntegrity({ registrar: registry, realmId: "document" }, FakeDate);

    const attackerToString = () => "attacker";
    const attackerGetTime = () => 2;
    Object.defineProperty(FakeDate.prototype, "toString", {
      configurable: true,
      writable: true,
      value: attackerToString,
    });
    Object.defineProperty(FakeDate.prototype, "getTime", {
      configurable: true,
      writable: true,
      value: attackerGetTime,
    });

    expect(registry.ensureSurface("timeLocale")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ status: "repaired", methodId: "date.toString" }),
      ]),
    );
    expect(FakeDate.prototype.toString).toBe(canonicalToString);
    expect((FakeDate.prototype as unknown as { getTime: Function }).getTime).toBe(
      attackerGetTime,
    );
  });
});
