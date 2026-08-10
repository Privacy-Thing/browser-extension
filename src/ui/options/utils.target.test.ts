import { describe, expect, it } from "vitest";

import { getVisibleSettingsTabs } from "@/ui/options/utils";

describe("getVisibleSettingsTabs", () => {
  it("places Containers immediately after Domain Rules when visible", () => {
    expect(
      getVisibleSettingsTabs({
        showContainers: true,
      }),
    ).toEqual([
      "rules",
      "containers",
      "profiles",
      "trusted-sites",
      "options",
      "advanced",
      "playground",
      "about",
    ]);
  });

  it("omits Containers when the environment does not expose that tab", () => {
    expect(
      getVisibleSettingsTabs({
        showContainers: false,
      }),
    ).toEqual([
      "rules",
      "profiles",
      "trusted-sites",
      "options",
      "advanced",
      "playground",
      "about",
    ]);
  });
});
