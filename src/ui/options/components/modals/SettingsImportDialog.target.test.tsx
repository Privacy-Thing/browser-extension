// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
