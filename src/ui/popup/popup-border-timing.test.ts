import { describe, expect, it } from "vitest";

import { resolvePopupBorderTiming } from "@/ui/popup/popup-border-timing";

describe("resolvePopupBorderTiming", () => {
  it("keeps ordinary popup states steady", () => {
    expect(
      resolvePopupBorderTiming({
        hasError: false,
        hasUserTopic: false,
        tone: "active",
      }),
    ).toBe("steady");
  });

  it("boosts notices that need the user's attention even when their tone is warning", () => {
    expect(
      resolvePopupBorderTiming({
        hasError: false,
        hasUserTopic: true,
        tone: "warning",
      }),
    ).toBe("boosted");
  });

  it.each(["warning", "danger"] as const)(
    "makes a standalone %s state urgent",
    (tone) => {
      expect(
        resolvePopupBorderTiming({
          hasError: false,
          hasUserTopic: false,
          tone,
        }),
      ).toBe("urgent");
    },
  );

  it("gives errors precedence over user notices", () => {
    expect(
      resolvePopupBorderTiming({
        hasError: true,
        hasUserTopic: true,
        tone: "active",
      }),
    ).toBe("urgent");
  });
});
