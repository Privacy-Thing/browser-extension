// @vitest-environment jsdom

import { act, type ChangeEvent } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EXTENSION_COMMAND_TYPES as CMD } from "@/shared/extension-contract";
import type { SettingsImportPreview } from "@/shared/settings-import";
import type { ExtensionCommand } from "@/shared/types";
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
