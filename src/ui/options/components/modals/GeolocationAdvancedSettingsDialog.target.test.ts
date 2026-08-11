// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";

import { commitWatchPositionDelay } from "./GeolocationAdvancedSettingsDialog";

describe("commitWatchPositionDelay", () => {
  it("routes the committed range only through settings autosave", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    const scheduleAutosave = vi.fn();

    commitWatchPositionDelay([12, 45], [6, 10], scheduleAutosave);

    expect(scheduleAutosave).toHaveBeenCalledWith({ watchPositionDelay: [12, 45] });
    expect(setItem).not.toHaveBeenCalled();
  });

  it("fills a missing slider endpoint from the current range", () => {
    const scheduleAutosave = vi.fn();

    commitWatchPositionDelay([12], [6, 10], scheduleAutosave);

    expect(scheduleAutosave).toHaveBeenCalledWith({ watchPositionDelay: [12, 10] });
  });
});
