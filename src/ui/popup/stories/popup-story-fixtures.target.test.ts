import { describe, expect, it } from "vitest";

import { createPopupStoryState, type PopupStoryContext } from "./popup-story-fixtures";

import { BUILD_BROWSER_TARGET } from "@/shared/build-flags";
import {
  POPUP_PRESENTATION_KINDS,
  resolvePresentationKind,
} from "@/ui/popup/popup-view-model";

const CONTEXTS: readonly PopupStoryContext[] = [
  "baseline",
  "global-protections-off",
  "runtime-degraded",
  "worker-runtime-warning",
  "service-worker-block",
  "shared-worker-strict",
  "worker-csp-relaxed",
  "all-policy-risks",
  "notifications",
  "notifications-acknowledged",
  "notifications-mixed",
  "notifications-resolved",
  "extension-notification",
  "firefox-first-inline",
];

describe("popup Storybook fixtures", () => {
  it.each(POPUP_PRESENTATION_KINDS)(
    "resolves the %s base fixture through the production view-model classifier",
    (kind) => {
      expect(resolvePresentationKind(createPopupStoryState(kind, "baseline"))).toBe(
        kind,
      );
    },
  );

  it("keeps every context compatible with every base presentation kind", () => {
    for (const kind of POPUP_PRESENTATION_KINDS) {
      for (const context of CONTEXTS) {
        expect(resolvePresentationKind(createPopupStoryState(kind, context))).toBe(
          kind,
        );
      }
    }
  });

  it("exposes all active worker-policy risks in the dedicated context", () => {
    const state = createPopupStoryState("rule-active", "all-policy-risks");

    expect(
      state?.effectiveSummary.surfaceSummary.surfaces
        .map((surface) => surface.attention?.notificationKind)
        .filter(
          (kind) => kind === "service-worker-block" || kind === "shared-worker-strict",
        ),
    ).toEqual(["service-worker-block", "shared-worker-strict"]);
    expect(state?.notifications.map((notification) => notification.kind)).toEqual([
      "service-worker-block",
      "shared-worker-strict",
    ]);
    expect(state?.hasUnreadNotification).toBe(true);
    expect(state?.effectiveSummary.surfaceSummary.attentionCount).toBe(2);
  });

  it("models a real degraded runtime without adding compatibility attention", () => {
    const state = createPopupStoryState("rule-active", "runtime-degraded");
    const worker = state?.effectiveSummary.surfaceSummary.surfaces.find(
      (surface) => surface.key === "worker",
    );

    expect(worker?.presentation).toBe("degraded");
    expect(worker?.evidence.integrity).toBe("degraded");
    expect(worker?.activity.failed).toBe(true);
    expect(state?.effectiveSummary.surfaceSummary.counts.degraded).toBe(1);
    expect(state?.effectiveSummary.surfaceSummary.attentionCount).toBe(0);
    expect(state?.notifications).toEqual([]);
  });

  it("models global protection off as an intentional native policy", () => {
    const state = createPopupStoryState("rule-active", "global-protections-off");

    expect(state?.currentRule.enabled).toBe(true);
    expect(state?.currentRule.type).toBe("suffix");
    expect(state?.currentTab.hasExactRule).toBe(false);
    expect(state?.effectiveSummary.resolutionContext.state).toBe("disabled");
    expect(state?.effectiveSummary.surfaceSummary.counts.pending).toBe(0);
    expect(state?.effectiveSummary.surfaceSummary.counts["native-by-policy"]).toBe(
      BUILD_BROWSER_TARGET === "firefox" ? 11 : 13,
    );
    expect(
      state?.effectiveSummary.surfaceSummary.groups.every(
        (group) => group.state === "native-by-policy",
      ),
    ).toBe(true);
  });

  it.each([
    ["notifications", 4, 0],
    ["notifications-acknowledged", 0, 0],
    ["notifications-mixed", 3, 0],
    ["notifications-resolved", 0, 4],
  ] as const)("models %s notification state", (context, unreadCount, resolvedCount) => {
    const state = createPopupStoryState("rule-active", context);

    expect(
      state?.notifications.filter(
        (notification) =>
          notification.readAt === null && notification.resolvedAt === null,
      ),
    ).toHaveLength(unreadCount);
    expect(
      state?.notifications.filter((notification) => notification.resolvedAt !== null),
    ).toHaveLength(resolvedCount);
  });

  it("uses the catalog ID and separate version in the extension notification story", () => {
    const state = createPopupStoryState("rule-active", "extension-notification");

    expect(state?.notifications).toEqual([
      expect.objectContaining({
        id: "notification-center-intro",
        dedupeKey: "extension:update:notification-center-intro",
        kind: "significant-update",
        scope: "extension",
        channel: "release",
        introducedInVersion: "0.9.0",
      }),
    ]);
  });

  it("includes release and beta notifications in the catalog-list story", () => {
    const state = createPopupStoryState("rule-active", "notifications");

    expect(
      state?.notifications.filter((item) => item.kind === "significant-update"),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ channel: "release", introducedInVersion: "0.9.0" }),
        expect.objectContaining({
          channel: "beta",
          introducedInVersion: "0.2026.720.1530",
        }),
      ]),
    );
  });
});
