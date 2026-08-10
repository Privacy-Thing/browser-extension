import { createIntegrityRegistry } from "@privacy-brand/refract-core/integrity/surface-integrity-registry";
import { describe, expect, it } from "vitest";

import { installFxClientHints } from "@/injection/firefox/client-hints-patch";
import type { SpoofingSurfaceKey } from "@/shared/spoofing-surfaces";
import type { SpoofingSurfaceMethodId } from "@/shared/types";

describe("Firefox Client Hints integrity", () => {
  it("repairs deleted getters and replaced high-entropy methods", async () => {
    class FakeUserAgentData {
      get brands() {
        return [{ brand: "Firefox", version: "1" }];
      }
      get mobile() {
        return true;
      }
      get platform() {
        return "Windows";
      }
      async getHighEntropyValues(_hints: string[]) {
        return { platform: "Windows" };
      }
    }
    const userAgentData = new FakeUserAgentData();
    const registry = createIntegrityRegistry<
      SpoofingSurfaceKey,
      SpoofingSurfaceMethodId
    >({ now: () => 1 });
    const navigatorObject = { userAgentData };
    installFxClientHints({
      targetGlobal: {
        navigator: navigatorObject,
      } as unknown as typeof globalThis,
      integrity: { registrar: registry, realmId: "document" },
      getClientHints: () => ({
        brands: [{ brand: "Firefox", version: "2" }],
        mobile: false,
        platform: "Linux",
      }),
    });

    expect(registry.ensureSurface("clientHints")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ status: "intact", methodId: "clientHints.brands" }),
        expect.objectContaining({
          status: "intact",
          methodId: "clientHints.getHighEntropyValues",
        }),
      ]),
    );

    Reflect.deleteProperty(FakeUserAgentData.prototype, "brands");
    Object.defineProperty(FakeUserAgentData.prototype, "getHighEntropyValues", {
      configurable: true,
      value: async () => ({ attacker: true }),
    });
    navigatorObject.userAgentData = new FakeUserAgentData();

    expect(registry.ensureSurface("clientHints")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ status: "repaired", methodId: "clientHints.brands" }),
        expect.objectContaining({
          status: "repaired",
          methodId: "clientHints.getHighEntropyValues",
        }),
        expect.objectContaining({
          status: "repaired",
          surfaceId: "clientHints",
        }),
      ]),
    );
    expect(navigatorObject.userAgentData).toBe(userAgentData);
    expect(userAgentData.brands).toEqual([{ brand: "Firefox", version: "2" }]);
    await expect(userAgentData.getHighEntropyValues([])).resolves.toMatchObject({
      brands: [{ brand: "Firefox", version: "2" }],
      mobile: false,
      platform: "Linux",
    });
  });
});
