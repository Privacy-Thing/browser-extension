import type { SurfacePresentationState } from "@privacy-brand/xray-protocol";
import { describe, expect, it } from "vitest";

import { en } from "./en";
import { es } from "./es";
import { pt } from "./pt";
import { ru } from "./ru";
import { uk } from "./uk";

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
  it("keeps diagnostic JavaScript method names unchanged", () => {
    expect(ru.sidebar.accessed.methods).toEqual(en.sidebar.accessed.methods);
    expect(uk.sidebar.accessed.methods).toEqual(en.sidebar.accessed.methods);
  });

  it("joins Russian and Ukrainian interface fragments into complete sentences", () => {
    for (const catalog of [ru, uk]) {
      const mapAttribution = `${catalog.about.assets.mapPreviewsPrefix}OpenFreeMap${catalog.about.assets.mapPreviewsMiddle}OpenStreetMap${catalog.about.assets.mapPreviewsSuffix}`;
      const privacyLink = `${catalog.welcome.steps.privacy.descriptionBeforePolicy} ${catalog.welcome.steps.privacy.policyLink}${catalog.welcome.steps.privacy.descriptionAfterPolicy}`;
      const websiteLink = `${catalog.about.website.prefix}${catalog.about.website.linkLabel}${catalog.about.website.suffix}`;
      expect(mapAttribution).not.toMatch(/ {2,}/);
      expect(privacyLink).not.toMatch(/ {2,}/);
      expect(websiteLink).not.toMatch(/\s+[,.;!?]/);
      expect(privacyLink).toMatch(/[.!?]$/);
    }
  });

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

  it.each([
    [1, "1 непрочитанное уведомление", "1 непрочитане сповіщення"],
    [2, "2 непрочитанных уведомления", "2 непрочитані сповіщення"],
    [5, "5 непрочитанных уведомлений", "5 непрочитаних сповіщень"],
    [11, "11 непрочитанных уведомлений", "11 непрочитаних сповіщень"],
    [21, "21 непрочитанное уведомление", "21 непрочитане сповіщення"],
    [22, "22 непрочитанных уведомления", "22 непрочитані сповіщення"],
    [25, "25 непрочитанных уведомлений", "25 непрочитаних сповіщень"],
  ])(
    "uses the right Russian and Ukrainian badge forms for %i",
    (count, russian, ukrainian) => {
      expect(ru.popup.notificationsBadgeLabel(count)).toBe(russian);
      expect(uk.popup.notificationsBadgeLabel(count)).toBe(ukrainian);
    },
  );

  it("declines rule and preset counts in both languages", () => {
    expect(ru.rules.globalFallback.overridesBadge(21)).toBe("21 особая настройка");
    expect(ru.rules.globalFallback.overridesBadge(22)).toBe("22 особые настройки");
    expect(ru.rules.globalFallback.overridesBadge(25)).toBe("25 особых настроек");
    expect(uk.locations.viewAssignedRulesAriaLabel("Київ", 22)).toBe(
      "Показати 22 правила для профілю «Київ»",
    );
    expect(uk.trustedSites.rulesCta.activeRulesOnly(11)).toContain(
      "11 активних правил",
    );
  });
});
