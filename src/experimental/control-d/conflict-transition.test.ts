import { describe, expect, it } from "vitest";

import { isConflictEntered } from "./conflict-transition";

const config = (status: string, lastAttemptAt = "t1") => ({
  version: 2,
  connected: true,
  status,
  lastError: "needs review",
  lastAttemptAt,
});

describe("isConflictEntered", () => {
  it("fires when the config enters the conflict state", () => {
    expect(
      isConflictEntered({ oldValue: config("ready"), newValue: config("conflict") }),
    ).toBe(true);
    expect(isConflictEntered({ newValue: config("conflict") })).toBe(true);
  });

  it("does not fire for a repeated conflict write from a failed preview", () => {
    expect(
      isConflictEntered({
        oldValue: config("conflict", "t1"),
        newValue: config("conflict", "t2"),
      }),
    ).toBe(false);
  });

  it("ignores other states and unrelated values", () => {
    expect(isConflictEntered({ newValue: config("ready") })).toBe(false);
    expect(isConflictEntered({ newValue: "conflict" })).toBe(false);
    expect(
      isConflictEntered({ newValue: { ...config("conflict"), lastError: null } }),
    ).toBe(false);
    expect(isConflictEntered({})).toBe(false);
  });
});
