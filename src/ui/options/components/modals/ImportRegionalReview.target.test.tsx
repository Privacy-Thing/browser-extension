// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { SettingsImportPreview } from "@/shared/settings-import";
import { ImportRegionalReview } from "@/ui/options/components/modals/ImportRegionalReview";

let root: Root;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  document.body.innerHTML = '<div id="root"></div>';
  root = createRoot(document.getElementById("root")!);
});
afterEach(async () => {
  await act(async () => root.unmount());
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
});
const previewFor = (id: string): SettingsImportPreview => ({
  token: "preview",
  source: {
    version: 3,
    exportedAt: "2026-10-02T12:00:00Z",
    rules: [],
    locations: [
      {
        id,
        label: id,
        latitude: 48.85,
        longitude: 2.35,
        accuracy: 25,
        noiseRadius: 50,
        language: "fr-FR",
        languages: ["fr-FR", "fr"],
        timeZone: "Asia/Tokyo",
      },
    ],
  },
  selection: { mode: "merge", locations: {}, rules: {}, containers: {} },
  conflicts: { locations: [], rules: [] },
  localContainers: [],
  changes: [],
  problems: [],
});
const render = async (preview: SettingsImportPreview) => {
  await act(async () =>
    root.render(<ImportRegionalReview preview={preview} disabled={false} />),
  );
};

describe("import regional profile selection", () => {
  it.each(["constructor", "toString", "__proto__"])(
    "shows the default import review for the valid profile ID %s",
    async (id) => {
      await render(previewFor(id));
      expect(document.querySelector(`[data-regional-profile="${id}"]`)).not.toBeNull();
      expect(
        document.querySelector('[data-regional-warning="timeZone"]'),
      ).not.toBeNull();
    },
  );

  it.each(["keep", "skip"] as const)(
    "omits a profile explicitly selected as %s",
    async (choice) => {
      const preview = previewFor("constructor");
      preview.selection.locations = { constructor: choice };
      await render(preview);
      expect(document.querySelector("[data-import-regional-review]")).toBeNull();
    },
  );

  it("waits for a conflict choice before reviewing a preset and shows copy choices", async () => {
    const preview = previewFor("constructor");
    preview.conflicts.locations = ["constructor"];
    await render(preview);
    expect(document.querySelector("[data-import-regional-review]")).toBeNull();
    preview.selection.locations = { constructor: "copy" as const };
    await render(preview);
    expect(
      document.querySelector('[data-regional-profile="constructor"]'),
    ).not.toBeNull();
  });
});
