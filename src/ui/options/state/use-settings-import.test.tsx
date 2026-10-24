// @vitest-environment jsdom

import { act, type ChangeEvent } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EXTENSION_COMMAND_TYPES as CMD } from "@/shared/extension-contract";
import type { SettingsImportPreview } from "@/shared/settings-import";
import { isSupportedTimeZone } from "@/shared/time-zone-validation";
import type { ExportedSettings, ExtensionCommand } from "@/shared/types";
import { useSettingsImport } from "@/ui/options/state/use-settings-import";
import { sendMessageOrThrow } from "@/ui/shared/runtime-messaging";

vi.mock("@/ui/shared/runtime-messaging", () => ({ sendMessageOrThrow: vi.fn() }));
vi.mock("@/ui/components/ui/toast", () => ({
  notify: { success: vi.fn(), error: vi.fn() },
}));

const incoming: SettingsImportPreview = {
  token: "initial",
  source: {
    version: 3,
    exportedAt: "2026-10-02T12:00:00Z",
    rules: [],
    locations: [
      {
        id: "warsaw",
        label: "Intentional profile",
        latitude: 52.2297,
        longitude: 21.0122,
        accuracy: 30,
        noiseRadius: 50,
        language: "fr",
        languages: ["fr", "en-US"],
        preferEnglishContent: true,
        timeZone: "Asia/Tokyo",
      },
    ],
  },
  selection: {
    mode: "merge",
    locations: { warsaw: "copy" },
    rules: {},
    containers: {},
  },
  conflicts: { locations: ["warsaw"], rules: [] },
  localContainers: [],
  changes: [],
  problems: [],
};

const messaging = vi.mocked(sendMessageOrThrow);
let current: ReturnType<typeof useSettingsImport>;
const applied = vi.fn();
const Harness = () => {
  current = useSettingsImport({
    apply: applied,
    autosaveTimerRef: { current: null },
    saveInFlight: false,
  });
  return null;
};
let root: Root;
beforeEach(async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("chrome", {
    storage: { onChanged: { addListener: vi.fn(), removeListener: vi.fn() } },
  });
  messaging.mockImplementation(async (input) => {
    const message = input as ExtensionCommand;
    if (message.type === CMD.getImportUndoStatus)
      return { ok: true, available: false, expiresAt: null };
    if (message.type === CMD.previewSettingsImport)
      return {
        ok: true,
        preview: {
          ...incoming,
          token: message.previousToken ? "corrected" : "initial",
          source: message.settings,
        },
      };
    throw new Error("Unexpected mutation");
  });
  document.body.innerHTML = '<div id="root"></div>';
  root = createRoot(document.getElementById("root")!);
  await act(async () => root.render(<Harness />));
  await act(async () =>
    current.handleImportSettings({
      currentTarget: {
        value: "file.json",
        files: [{ text: async () => JSON.stringify(incoming.source) }],
      },
    } as unknown as ChangeEvent<HTMLInputElement>),
  );
});
afterEach(async () => {
  await act(async () => root.unmount());
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

const mutationCalls = () =>
  messaging.mock.calls.filter(
    ([message]) => (message as ExtensionCommand).type === CMD.importSettings,
  );

describe("regional corrections in import", () => {
  it("changes only the selected zone in the source and retains merge choices while preparing a new preview", async () => {
    expect(mutationCalls()).toHaveLength(0);
    await act(async () => current.updateImportTimeZone("warsaw", "Europe/Warsaw"));
    const command = messaging.mock.calls
      .map(([message]) => message as ExtensionCommand)
      .find(
        (message) =>
          message.type === CMD.previewSettingsImport &&
          message.previousToken === "initial",
      );
    expect(command).toMatchObject({
      settings: {
        ...incoming.source,
        locations: [{ ...incoming.source.locations[0], timeZone: "Europe/Warsaw" }],
      },
      selection: incoming.selection,
    });
    expect(current.importPreview?.token).toBe("corrected");
    expect(mutationCalls()).toHaveLength(0);
    expect(applied).not.toHaveBeenCalled();
    await act(async () => current.cancelImport());
    expect(current.importPreview).toBeNull();
    expect(mutationCalls()).toHaveLength(0);
  });

  it("keeps both zone corrections made in the same tick", async () => {
    const profile = incoming.source.locations[0]!;
    const source = {
      ...incoming.source,
      locations: ["a", "b", "c"].map((id) => ({
        ...profile,
        id,
        timeZone: "Asia/Tokyo",
      })),
    };
    await act(async () =>
      current.handleImportSettings({
        currentTarget: {
          value: "file.json",
          files: [{ text: async () => JSON.stringify(source) }],
        },
      } as unknown as ChangeEvent<HTMLInputElement>),
    );
    await act(async () => {
      void current.updateImportTimeZone("a", "Europe/Paris");
      void current.updateImportTimeZone("b", "Europe/Paris");
    });
    expect(
      current.importPreview?.source.locations.map((item) => [item.id, item.timeZone]),
    ).toEqual([
      ["a", "Europe/Paris"],
      ["b", "Europe/Paris"],
      ["c", "Asia/Tokyo"],
    ]);
  });

  it("keeps a zone correction when a selection change follows in the same tick", async () => {
    await act(async () => {
      void current.updateImportTimeZone("warsaw", "Europe/Warsaw");
      void current.updateImportSelection({
        ...incoming.selection,
        locations: { warsaw: "skip" },
      });
    });
    expect(current.importPreview?.source.locations[0]?.timeZone).toBe("Europe/Warsaw");
  });

  it("keeps the original preview and reports a failed suggestion without applying configuration", async () => {
    messaging.mockRejectedValueOnce(new Error("Preview failed"));
    await act(async () => current.updateImportTimeZone("warsaw", "Europe/Warsaw"));
    expect(current.importError).toBe("Preview failed");
    expect(current.importPreview?.source).toEqual(incoming.source);
    expect(mutationCalls()).toHaveLength(0);
  });

  it("allows an intentional mismatch to be imported unchanged", async () => {
    messaging.mockResolvedValueOnce({ ok: true });
    await act(async () => current.applyImport());
    expect(mutationCalls()[0]?.[0]).toEqual({
      type: CMD.importSettings,
      previewToken: "initial",
    });
    expect(applied).toHaveBeenCalledOnce();
  });
});

describe("unsupported time zones in an import file", () => {
  const profile = incoming.source.locations[0]!;
  const file = (zones: Record<string, string>): ExportedSettings => ({
    ...incoming.source,
    locations: Object.entries(zones).map(([id, timeZone]) => ({
      ...profile,
      id,
      label: `Preset ${id}`,
      timeZone,
    })),
  });
  const previewCalls = () =>
    messaging.mock.calls
      .map(([message]) => message as ExtensionCommand)
      .filter((message) => message.type === CMD.previewSettingsImport);
  const lastPreviewZones = () => {
    const last = previewCalls().at(-1);
    return last?.type === CMD.previewSettingsImport
      ? last.settings.locations.map((item) => [item.id, item.timeZone])
      : [];
  };
  const choices = () =>
    current.importTimeZoneCorrections.map((item) => [
      item.id,
      item.rejectedTimeZone,
      item.timeZone,
    ]);
  const load = (settings: ExportedSettings) =>
    act(async () =>
      current.handleImportSettings({
        currentTarget: {
          value: "file.json",
          files: [{ text: async () => JSON.stringify(settings) }],
        },
      } as unknown as ChangeEvent<HTMLInputElement>),
    );

  beforeEach(() => {
    // Mirrors the background contract: any unsupported zone rejects the preview.
    messaging.mockImplementation(async (input) => {
      const message = input as ExtensionCommand;
      if (message.type === CMD.getImportUndoStatus)
        return { ok: true, available: false, expiresAt: null };
      if (message.type === CMD.previewSettingsImport) {
        const rejected = message.settings.locations.filter(
          (item) => !isSupportedTimeZone(item.timeZone),
        );
        if (rejected.length > 0)
          return {
            ok: false,
            error: JSON.stringify(
              rejected.map((item) => ({
                code: "custom",
                path: [item.id, "timeZone"],
                message: `timeZone "${item.timeZone}" is unsupported.`,
              })),
            ),
          };
        return {
          ok: true,
          preview: { ...incoming, token: "accepted", source: message.settings },
        };
      }
      throw new Error("Unexpected mutation");
    });
  });

  it("offers a choice for a rejected preset and previews the corrected file", async () => {
    await load(file({ mars: "Mars/Olympus" }));
    expect(current.importPreview).toBeNull();
    expect(current.importError).toContain("Mars/Olympus");
    expect(choices()).toEqual([["mars", "Mars/Olympus", null]]);
    await act(async () => current.updateImportTimeZone("mars", "Asia/Tokyo"));
    expect(lastPreviewZones()).toEqual([["mars", "Asia/Tokyo"]]);
    expect(current.importError).toBeNull();
    expect(current.importPreview?.token).toBe("accepted");
    expect(current.importPreview?.source.locations[0]?.timeZone).toBe("Asia/Tokyo");
    expect(choices()).toEqual([["mars", "Mars/Olympus", "Asia/Tokyo"]]);
    expect(mutationCalls()).toHaveLength(0);
  });

  it("waits until every rejected preset has a zone before previewing again", async () => {
    await load(
      file({ mars: "Mars/Olympus", paris: "Europe/Paris", venus: "Venus/Cloud" }),
    );
    const rejectedRequests = previewCalls().length;
    expect(choices()).toEqual([
      ["mars", "Mars/Olympus", null],
      ["venus", "Venus/Cloud", null],
    ]);
    await act(async () => current.updateImportTimeZone("mars", "Asia/Tokyo"));
    expect(previewCalls()).toHaveLength(rejectedRequests);
    expect(current.importError).not.toBeNull();
    expect(choices()).toEqual([
      ["mars", "Mars/Olympus", "Asia/Tokyo"],
      ["venus", "Venus/Cloud", null],
    ]);
    await act(async () => current.updateImportTimeZone("venus", "Europe/Paris"));
    expect(previewCalls()).toHaveLength(rejectedRequests + 1);
    expect(
      current.importPreview?.source.locations.map((item) => item.timeZone),
    ).toEqual(["Asia/Tokyo", "Europe/Paris", "Europe/Paris"]);
  });

  it("keeps every choice made in rapid succession, including a changed mind", async () => {
    await load(file({ mars: "Mars/Olympus", venus: "Venus/Cloud" }));
    await act(async () => {
      void current.updateImportTimeZone("mars", "Asia/Tokyo");
      void current.updateImportTimeZone("venus", "Europe/Paris");
      void current.updateImportTimeZone("mars", "Europe/Berlin");
      void current.updateImportTimeZone("mars", "Europe/Berlin");
    });
    expect(lastPreviewZones()).toEqual([
      ["mars", "Europe/Berlin"],
      ["venus", "Europe/Paris"],
    ]);
    expect(
      current.importPreview?.source.locations.map((item) => item.timeZone),
    ).toEqual(["Europe/Berlin", "Europe/Paris"]);
    expect(choices()).toEqual([
      ["mars", "Mars/Olympus", "Europe/Berlin"],
      ["venus", "Venus/Cloud", "Europe/Paris"],
    ]);
    await act(async () => current.updateImportTimeZone("venus", "Asia/Tokyo"));
    expect(
      current.importPreview?.source.locations.map((item) => item.timeZone),
    ).toEqual(["Europe/Berlin", "Asia/Tokyo"]);
  });

  it("forgets rejected presets when the import is cancelled or another file is chosen", async () => {
    await load(file({ mars: "Mars/Olympus" }));
    await act(async () => current.cancelImport());
    expect(choices()).toEqual([]);
    await load(file({ mars: "Mars/Olympus" }));
    await load(file({ paris: "Europe/Paris" }));
    expect(choices()).toEqual([]);
    expect(current.importPreview?.token).toBe("accepted");
  });
});
