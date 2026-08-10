import { describe, expect, it } from "vitest";

import {
  ONBOARDING_DIRECTIONS,
  ONBOARDING_THING_TIMING,
  OPTIONS_HOVER_REACTION,
  OPTIONS_THING_TIMING,
} from "./brand-thing";

describe("OPTIONS_THING_TIMING", () => {
  it("keeps the Settings Thing deliberately unhurried", () => {
    expect(OPTIONS_HOVER_REACTION).toBe("boop");
    expect(OPTIONS_THING_TIMING).toEqual({
      lookAround: {
        cycleMs: 18_000,
        holdMs: 2_500,
      },
      pointer: {
        directionDelayMs: 2_700,
        idleHoldMs: 7_500,
        inactivityTimeoutMs: 15_000,
      },
    });
  });

  it("gives onboarding a diagonal gaze and more frequent blink", () => {
    expect(ONBOARDING_DIRECTIONS).toEqual(["south-west", "south-east"]);
    expect(ONBOARDING_THING_TIMING).toEqual({
      lookAround: {
        cycleMs: 10_000,
        holdMs: 2_000,
      },
      blink: {
        cycleMs: 5_000,
      },
    });
  });
});
