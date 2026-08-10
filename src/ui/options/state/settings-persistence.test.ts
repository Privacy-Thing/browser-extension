import { describe, expect, it } from "vitest";

import {
  clearAutosaveScopes,
  collectAutosaveScopes,
  hasPendingAutosaveScopes,
  type PendingAutosaveScopes,
} from "@/ui/options/state/settings-persistence";

describe("settings autosave scope helpers", () => {
  it("reports when any autosave scope is pending", () => {
    expect(
      hasPendingAutosaveScopes({
        "simple-settings": false,
        "location-model": false,
      }),
    ).toBe(false);

    expect(
      hasPendingAutosaveScopes({
        "simple-settings": true,
        "location-model": false,
      }),
    ).toBe(true);
  });

  it("merges requested and pending scopes in deterministic order", () => {
    const pending: PendingAutosaveScopes = {
      "simple-settings": false,
      "location-model": true,
    };

    expect(collectAutosaveScopes(pending, ["simple-settings"])).toEqual([
      "simple-settings",
      "location-model",
    ]);
  });

  it("clears only the requested pending scopes", () => {
    const pending: PendingAutosaveScopes = {
      "simple-settings": true,
      "location-model": true,
    };

    clearAutosaveScopes(pending, "simple-settings");

    expect(pending).toEqual({
      "simple-settings": false,
      "location-model": true,
    });
  });
});
