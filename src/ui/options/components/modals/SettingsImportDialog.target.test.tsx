// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { SettingsImportPreview } from "@/shared/settings-import";
import { RESERVED_IMPORT_NAME } from "@/shared/settings-import";
import { t } from "@/ui/i18n";
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

const issue = (index: number, label: string, id: string, timeZone: string) => ({
  code: "custom",
  path: [index, "timeZone"],
  message: `Profile "${label}" (${id}): timeZone "${timeZone}" is unsupported. Choose a supported time zone before saving or activating this profile.`,
});
const render = async (error: string) => {
  const props: ImportDialogProps = {
    preview: null,
    busy: false,
    error,
    saveInFlight: false,
    cancel: vi.fn(),
    confirm: vi.fn(),
    update: vi.fn(),
  };
  await act(async () => root.render(<SettingsImportDialogView {...props} />));
};
const alert = () => document.querySelector("[data-import-error]");
const items = () =>
  [...document.querySelectorAll("[data-import-error-item]")].map(
    (item) => item.textContent,
  );

describe("import error alert", () => {
  it("shows only the message for one validation error and hints at the time zone", async () => {
    const mars = issue(0, "Mars", "mars", "Mars/Olympus");
    await render(JSON.stringify([mars]));
    expect(items()).toEqual([mars.message]);
    expect(alert()?.getAttribute("role")).toBe("alert");
    expect(
      document.querySelector('[data-import-error-hint="timeZone"]'),
    ).not.toBeNull();
    const details = document.querySelector("[data-import-error-details]");
    expect(details?.hasAttribute("open")).toBe(false);
    expect(details?.querySelector("pre")?.textContent).toContain('"code"');
    expect(alert()?.querySelector(":scope > p")?.textContent).not.toContain('"code"');
  });

  it("lists every validation error as its own item", async () => {
    const issues = [
      issue(0, "Mars", "mars", "Mars/Olympus"),
      issue(2, "Venus", "venus", "Venus/Cloud"),
    ];
    await render(JSON.stringify(issues));
    expect(items()).toEqual(issues.map((entry) => entry.message));
    expect(document.querySelectorAll("[data-import-error] li")).toHaveLength(2);
  });

  it("names a reserved ID and where it occurs, once per message", async () => {
    const issue = (path: Array<string | number>, name: string, scope: string) => ({
      code: RESERVED_IMPORT_NAME,
      path,
      name,
      scope,
      message: `Reserved name "${name}" cannot be imported.`,
    });
    await render(
      JSON.stringify([
        issue(["locations", 0, "id"], "constructor", "locations"),
        issue(["locations", 2, "id"], "constructor", "locations"),
        issue(
          ["workerPolicyExceptions", "__proto__"],
          "__proto__",
          "workerPolicyExceptions",
        ),
      ]),
    );
    const listed = [...document.querySelectorAll("[data-import-error-item]")];
    expect(
      listed.map((item) => [
        item.getAttribute("data-import-error-item"),
        item.getAttribute("data-import-error-name"),
        item.getAttribute("data-import-error-scope"),
      ]),
    ).toEqual([
      ["reservedName", "constructor", "locations"],
      ["reservedName", "__proto__", "workerPolicyExceptions"],
    ]);
    expect(items()).toEqual([
      t.settingsImport.reservedName("constructor", t.settingsImport.locations),
      t.settingsImport.reservedName("__proto__", "workerPolicyExceptions"),
    ]);
    expect(document.querySelector("[data-import-error-hint]")).toBeNull();
    expect(document.querySelector("[data-import-error-details]")).not.toBeNull();
  });

  it.each([
    "Settings changed after the preview. Review the import again.",
    "[not json",
    '[{"code":"custom"}]',
  ])("keeps other error text unchanged: %s", async (text) => {
    await render(text);
    expect(items()).toEqual([text]);
    expect(document.querySelector("[data-import-error-details]")).toBeNull();
    expect(document.querySelector("[data-import-error-hint]")).toBeNull();
  });
});

describe("time zone choice for rejected presets", () => {
  const mars = issue(0, "Mars", "mars", "Mars/Olympus");
  const venus = issue(1, "Venus", "venus", "Venus/Cloud");
  const correction = (id: string, label: string, rejected: string, zone?: string) => ({
    id,
    label,
    rejectedTimeZone: rejected,
    timeZone: zone ?? null,
  });
  const preview: SettingsImportPreview = {
    token: "accepted",
    source: {
      version: 3,
      exportedAt: "2026-10-02T12:00:00Z",
      rules: [],
      locations: [],
    },
    selection: { mode: "replace", locations: {}, rules: {}, containers: {} },
    conflicts: { locations: [], rules: [] },
    localContainers: [],
    changes: [],
    problems: [],
  };
  const renderChoice = async (props: Partial<ImportDialogProps>) => {
    const full: ImportDialogProps = {
      preview: null,
      busy: false,
      error: null,
      saveInFlight: false,
      cancel: vi.fn(),
      confirm: vi.fn(),
      update: vi.fn(),
      applyTimeZone: vi.fn(),
      ...props,
    };
    await act(async () => root.render(<SettingsImportDialogView {...full} />));
  };
  const picker = (id: string) =>
    document.querySelector<HTMLElement>(`[data-import-time-zone-correction="${id}"]`);
  const nameOf = (element: Element | null | undefined) =>
    (element?.getAttribute("aria-labelledby") ?? "")
      .split(" ")
      .map((id) => document.getElementById(id)?.textContent)
      .join(" ");
  const confirmButton = () =>
    document.querySelector<HTMLButtonElement>("#settings-import-confirm");

  beforeEach(() => {
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    Element.prototype.scrollIntoView = () => {};
  });

  it("keeps the readable error and offers one named picker instead of the edit hint", async () => {
    await renderChoice({
      error: JSON.stringify([mars]),
      timeZoneCorrections: [correction("mars", "Mars", "Mars/Olympus")],
    });
    expect(alert()?.getAttribute("role")).toBe("alert");
    expect(items()).toEqual([mars.message]);
    expect(document.querySelector("[data-import-error-hint]")).toBeNull();
    expect(picker("mars")?.dataset.importTimeZoneState).toBe("missing");
    expect(picker("mars")?.dataset.importRejectedTimeZone).toBe("Mars/Olympus");
    const combobox = picker("mars")?.querySelector('[role="combobox"]');
    expect(nameOf(combobox)).toContain("Mars (mars)");
    expect(nameOf(combobox)).toContain("Mars/Olympus");
    expect(confirmButton()?.disabled).toBe(true);
  });

  it("names a separate picker for each rejected preset", async () => {
    await renderChoice({
      error: JSON.stringify([mars, venus]),
      timeZoneCorrections: [
        correction("mars", "Mars", "Mars/Olympus", "Asia/Tokyo"),
        correction("venus", "Venus", "Venus/Cloud"),
      ],
    });
    const comboboxes = [
      ...document.querySelectorAll(
        "[data-import-time-zone-correction] [role=combobox]",
      ),
    ];
    expect(comboboxes.map(nameOf)).toEqual([
      expect.stringContaining("Mars (mars)"),
      expect.stringContaining("Venus (venus)"),
    ]);
    expect(picker("mars")?.dataset.importTimeZoneState).toBe("chosen");
    expect(picker("venus")?.dataset.importTimeZoneState).toBe("missing");
    expect(
      document
        .querySelector("[data-import-time-zone-corrections]")
        ?.getAttribute("data-import-time-zone-missing"),
    ).toBe("1");
  });

  it("lists only supported zones and reports the chosen one for its preset", async () => {
    const applyTimeZone = vi.fn();
    await renderChoice({
      error: JSON.stringify([mars, venus]),
      applyTimeZone,
      timeZoneCorrections: [
        correction("mars", "Mars", "Mars/Olympus"),
        correction("venus", "Venus", "Venus/Cloud"),
      ],
    });
    await act(async () =>
      picker("venus")?.querySelector<HTMLElement>('[role="combobox"]')?.click(),
    );
    const offered = [...document.querySelectorAll("[data-combobox-option-value]")].map(
      (option) => option.getAttribute("data-combobox-option-value"),
    );
    expect(new Set(offered)).toEqual(
      new Set(["UTC", ...Intl.supportedValuesOf("timeZone")]),
    );
    expect(offered).not.toContain("Venus/Cloud");
    await act(async () =>
      document
        .querySelector<HTMLElement>('[data-combobox-option-value="Europe/Paris"]')
        ?.click(),
    );
    expect(applyTimeZone).toHaveBeenCalledExactlyOnceWith("venus", "Europe/Paris");
  });

  it("enables Confirm only once the corrected preview has a zone for every preset", async () => {
    await renderChoice({
      preview,
      timeZoneCorrections: [
        correction("mars", "Mars", "Mars/Olympus", "Asia/Tokyo"),
        correction("venus", "Venus", "Venus/Cloud"),
      ],
    });
    expect(confirmButton()?.disabled).toBe(true);
    await renderChoice({
      preview,
      timeZoneCorrections: [
        correction("mars", "Mars", "Mars/Olympus", "Asia/Tokyo"),
        correction("venus", "Venus", "Venus/Cloud", "Europe/Paris"),
      ],
    });
    expect(confirmButton()?.disabled).toBe(false);
    expect(document.querySelector("[data-import-error]")).toBeNull();
  });
});
