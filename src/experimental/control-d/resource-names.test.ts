import { describe, expect, it } from "vitest";

import {
  controlDEndpointName,
  controlDFolderName,
  controlDProfileName,
  controlDRuleComment,
} from "./resource-names";

const INSTANCE_ID = "123e4567-e89b-12d3-a456-426614174000";

describe("Control D resource names", () => {
  it("keeps every remote resource name within the live API limit", () => {
    const names = [
      controlDProfileName(INSTANCE_ID),
      controlDEndpointName(INSTANCE_ID, "chromium"),
      controlDEndpointName(INSTANCE_ID, "firefox"),
      controlDFolderName(INSTANCE_ID, "an-arbitrarily-long-proxy-primary-key"),
    ];

    expect(names.every((name) => name.length <= 32)).toBe(true);
    expect(names.every((name) => /^[\x20-\x7E]+$/.test(name))).toBe(true);
    expect(controlDProfileName(INSTANCE_ID).length).toBeLessThan(32);
  });

  it("is stable and distinguishes instances, browsers and proxy locations", () => {
    expect(controlDProfileName(INSTANCE_ID)).toBe("Privacy Thing 123e4567e89b12d3");
    expect(controlDEndpointName(INSTANCE_ID, "chromium")).not.toBe(
      controlDEndpointName(INSTANCE_ID, "firefox"),
    );
    expect(controlDFolderName(INSTANCE_ID, "WAW")).not.toBe(
      controlDFolderName(INSTANCE_ID, "LON"),
    );
    expect(controlDRuleComment(INSTANCE_ID)).toBe("PT 123e4567e89b12d3");
  });
});
