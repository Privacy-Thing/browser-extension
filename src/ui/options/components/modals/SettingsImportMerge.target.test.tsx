// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { SettingsImportPreview } from "@/shared/settings-import";
import {
  SettingsImportDialogView,
  type ImportDialogProps,
} from "@/ui/options/components/modals/SettingsImportDialog";

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

const IDS = ["fine", "constructor", "toString", "__proto__"];
const mergePreview = (): SettingsImportPreview => ({
  token: "preview",
  source: {
    version: 3,
    exportedAt: "2026-10-02T12:00:00Z",
    rules: [],
    locations: IDS.map((id) => ({
      id,
      label: `Preset ${id}`,
      latitude: 48.85,
      longitude: 2.35,
      accuracy: 25,
      noiseRadius: 50,
      language: "fr-FR",
      languages: ["fr-FR", "fr"],
      timeZone: "Europe/Paris",
    })),
  },
  selection: { mode: "merge", locations: {}, rules: {}, containers: {} },
  conflicts: { locations: [], rules: [] },
  localContainers: [],
  changes: [],
  problems: [],
});
const render = (update: ImportDialogProps["update"] = vi.fn()) =>
  act(async () =>
    root.render(
      <SettingsImportDialogView
        preview={mergePreview()}
        busy={false}
        error={null}
        saveInFlight={false}
        cancel={vi.fn()}
        confirm={vi.fn()}
        update={update}
      />,
    ),
  );
const choiceOf = (id: string) =>
  document.querySelector(`[data-import-item="${id}"] [role="combobox"]`);

describe("merge selection for prototype-like IDs", () => {
  it.each(IDS)("defaults %s to import instead of an empty selector", async (id) => {
    await render();
    expect(choiceOf(id)?.getAttribute("data-import-choice")).toBe("import");
    expect(choiceOf(id)?.textContent).not.toBe("");
  });

  it("selects every ID as an own property when choosing all", async () => {
    const update = vi.fn();
    await render(update);
    const selectAll = document.querySelector<HTMLButtonElement>(
      '[data-import-selection="merge"] section button',
    );
    await act(async () => selectAll?.click());
    const { locations } = update.mock
      .calls[0]![0] as SettingsImportPreview["selection"];
    for (const id of IDS) {
      expect(Object.hasOwn(locations, id)).toBe(true);
      expect(Object.getOwnPropertyDescriptor(locations, id)?.value).toBe("import");
    }
  });
});
