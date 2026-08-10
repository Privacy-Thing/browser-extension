import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { PopupProtectionDetails } from "@/ui/popup/components/PopupProtectionDetails";
import { createPopupStoryState } from "@/ui/popup/stories/popup-story-fixtures";

describe("PopupProtectionDetails", () => {
  it("keeps compact compatibility warnings on their surface rows", () => {
    const popupState = createPopupStoryState("rule-active", "all-policy-risks");
    if (!popupState) throw new Error("Expected a popup state fixture");

    const markup = renderToStaticMarkup(
      <PopupProtectionDetails
        popupState={popupState}
        onNotificationOpen={vi.fn()}
        onOpenXRay={vi.fn()}
      />,
    );

    expect(markup).not.toContain("Active compatibility policies");
    expect(markup).not.toContain("Offline mode, push notifications, background sync");
    expect(markup).not.toContain(
      "Privacy Thing blocks any Shared Worker it cannot spoof",
    );
    expect(markup).not.toContain("catalog surfaces mapped");
    // Attention is now an independent overlay (#111): the real protection
    // state stays visible and a separate compatibility affordance is
    // layered beside it, rather than replacing it.
    expect(markup.match(/\(Compatibility issue\)/g)).toHaveLength(2);
    expect(markup).toMatch(/Web Workers<\/h3><span[^>]+>Protected<\/span>/);
    expect(markup).toMatch(
      /Service Workers<\/span><span[^>]*><span[^>]*>Protected<\/span><button[^>]*>\(Compatibility issue\)<\/button><\/span><\/div>/,
    );
    expect(markup).toMatch(
      /Shared Workers<\/span><span[^>]*><span[^>]*>Protected<\/span><button[^>]*>\(Compatibility issue\)<\/button><\/span><\/div>/,
    );
    expect(markup).toContain("View page activity");
    expect(markup).toContain("gw-popup-footer-action gw-popup-protection-activity");
  });

  it("renders Web Workers as a pure aggregate over three ordered surfaces", () => {
    const popupState = createPopupStoryState("rule-active", "worker-runtime-warning");
    if (!popupState) throw new Error("Expected a popup state fixture");

    const markup = renderToStaticMarkup(
      <PopupProtectionDetails
        popupState={popupState}
        onNotificationOpen={vi.fn()}
        onOpenXRay={vi.fn()}
      />,
    );

    expect(markup).toContain("Web Workers");
    expect(markup.indexOf("Dedicated Workers")).toBeLessThan(
      markup.indexOf("Service Workers"),
    );
    expect(markup.indexOf("Service Workers")).toBeLessThan(
      markup.indexOf("Shared Workers"),
    );
    expect(markup.match(/\(Compatibility issue\)/g)).toHaveLength(1);
    expect(markup).toMatch(/Web Workers<\/h3><span[^>]+>Protected<\/span>/);
    expect(markup).toMatch(
      /Dedicated Workers<\/span><span[^>]*><span[^>]*>Protected<\/span><button[^>]*>\(Compatibility issue\)<\/button><\/span><\/div>/,
    );
    expect(markup).toMatch(
      /Service Workers<\/span><span[^>]*><span[^>]*>Protected<\/span>/,
    );
    expect(markup).toMatch(
      /Shared Workers<\/span><span[^>]*><span[^>]*>Protected<\/span>/,
    );
    expect(
      popupState.effectiveSummary.surfaceSummary.groups.find(
        (group) => group.key === "workers",
      )?.attentionCount,
    ).toBe(1);
  });

  it("names the browser surface when its status is unknown", () => {
    const popupState = createPopupStoryState("rule-active", "baseline");
    if (!popupState) throw new Error("Expected a popup state fixture");
    const geolocation = popupState.effectiveSummary.surfaceSummary.surfaces.find(
      (surface) => surface.key === "geolocation",
    );
    if (!geolocation) throw new Error("Expected the geolocation surface");
    geolocation.presentation = "unknown";

    const markup = renderToStaticMarkup(
      <PopupProtectionDetails
        popupState={popupState}
        onNotificationOpen={vi.fn()}
        onOpenXRay={vi.fn()}
      />,
    );

    expect(markup).toContain("Geolocation status is unknown.");
  });

  it("renders degraded protection with the danger tone", () => {
    const popupState = createPopupStoryState("rule-active", "runtime-degraded");
    if (!popupState) throw new Error("Expected a popup state fixture");

    const markup = renderToStaticMarkup(
      <PopupProtectionDetails
        popupState={popupState}
        onNotificationOpen={vi.fn()}
        onOpenXRay={vi.fn()}
      />,
    );

    expect(markup).toMatch(
      /Dedicated Workers<\/span><span[^>]*><span[^>]*data-state-tone="danger"[^>]*>Degraded<\/span>/,
    );
  });

  it("renders global protection off without pending or mixed states", () => {
    const popupState = createPopupStoryState("rule-active", "global-protections-off");
    if (!popupState) throw new Error("Expected a popup state fixture");

    const markup = renderToStaticMarkup(
      <PopupProtectionDetails
        popupState={popupState}
        onNotificationOpen={vi.fn()}
        onOpenXRay={vi.fn()}
      />,
    );

    expect(markup).not.toContain('data-surface-state="pending"');
    expect(markup).not.toContain('data-group-state="mixed"');
    expect(markup.match(/data-surface-state="native-by-policy"/g)).toHaveLength(
      popupState.effectiveSummary.surfaceSummary.counts["native-by-policy"],
    );
    expect(markup.match(/data-group-state="native-by-policy"/g)).toHaveLength(4);
  });
});
