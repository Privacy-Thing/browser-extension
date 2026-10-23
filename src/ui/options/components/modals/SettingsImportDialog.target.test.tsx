// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
