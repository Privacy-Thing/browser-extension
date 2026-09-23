import type { SurfacePresentationState } from "@privacy-brand/xray-protocol";
import { describe, expect, it } from "vitest";

import { es } from "./es";
import { pt } from "./pt";

const pluralProtectionCounts: Record<SurfacePresentationState, number> = {
  "not-applicable": 2,
  "native-by-policy": 2,
  unrecoverable: 1,
  degraded: 1,
  pending: 2,
  repaired: 1,
  "browser-enforced": 1,
  protected: 1,
  unknown: 2,
};

describe("localized dynamic copy", () => {
  it("uses complete Spanish plural phrases", () => {
    expect(es.popup.notificationsBadgeLabel(2)).toBe("2 notificaciones no leídas");
    expect(es.popup.protectionCounts(pluralProtectionCounts)).toBe(
      "3 protegidos · 2 degradados · 2 confirmando · 2 no modificados · 2 no aplicables · 2 desconocidos",
    );
  });

  it("uses complete Portuguese plural phrases", () => {
    expect(pt.popup.notificationsBadgeLabel(2)).toBe("2 notificações não lidas");
    expect(pt.popup.protectionCounts(pluralProtectionCounts)).toBe(
      "3 protegidos · 2 degradados · 2 confirmando · 2 não modificados · 2 não aplicáveis · 2 desconhecidos",
    );
    expect(pt.rules.globalFallback.overridesBadge(2)).toBe(
      "2 configurações personalizadas",
    );
  });
});
