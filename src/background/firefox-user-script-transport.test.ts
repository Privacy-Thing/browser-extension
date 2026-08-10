import { describe, expect, it } from "vitest";

import { isUserScriptReady } from "@/background/firefox-user-script-transport";

describe("isUserScriptReady", () => {
  it("requires Firefox userScripts permission", () => {
    expect(
      isUserScriptReady({
        hasPermission: false,
        registrationCount: 2,
        lastSyncSucceeded: true,
      }),
    ).toBe(false);
  });

  it("requires a successful registration sync", () => {
    expect(
      isUserScriptReady({
        hasPermission: true,
        registrationCount: 2,
        lastSyncSucceeded: false,
      }),
    ).toBe(false);
  });

  it("requires at least one active registration", () => {
    expect(
      isUserScriptReady({
        hasPermission: true,
        registrationCount: 0,
        lastSyncSucceeded: true,
      }),
    ).toBe(false);
  });

  it("treats a synced registered transport as ready", () => {
    expect(
      isUserScriptReady({
        hasPermission: true,
        registrationCount: 2,
        lastSyncSucceeded: true,
      }),
    ).toBe(true);
  });
});
