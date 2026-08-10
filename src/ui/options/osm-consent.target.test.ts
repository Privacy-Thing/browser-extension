import { describe, expect, it } from "vitest";

import {
  resolveDeniedFollowUp,
  shouldEnableOsmFeatures,
  shouldPromptForEditor,
  shouldPromptForGenerator,
} from "@/ui/options/osm-consent";

describe("osm consent helpers", () => {
  it("prompts generator unless consent was granted", () => {
    expect(shouldPromptForGenerator("unknown")).toBe(true);
    expect(shouldPromptForGenerator("denied")).toBe(true);
    expect(shouldPromptForGenerator("granted")).toBe(false);
  });

  it("prompts editor only for unknown consent", () => {
    expect(shouldPromptForEditor("unknown")).toBe(true);
    expect(shouldPromptForEditor("denied")).toBe(false);
    expect(shouldPromptForEditor("granted")).toBe(false);
  });

  it("enables OSM-backed features only after consent", () => {
    expect(shouldEnableOsmFeatures("granted")).toBe(true);
    expect(shouldEnableOsmFeatures("unknown")).toBe(false);
    expect(shouldEnableOsmFeatures("denied")).toBe(false);
  });

  it("keeps editor open after denying from an editor prompt", () => {
    expect(resolveDeniedFollowUp({ type: "editor", profileIndex: 2 })).toBe(
      "open-editor",
    );
    expect(resolveDeniedFollowUp({ type: "generator" })).toBe("close");
  });
});
