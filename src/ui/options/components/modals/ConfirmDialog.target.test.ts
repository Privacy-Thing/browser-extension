// @vitest-environment jsdom

import { act, createElement, Fragment } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const useSettingsMock = vi.fn();

vi.mock("@/ui/options/state/SettingsContext", () => ({
  useSettings: () => useSettingsMock(),
}));

import { ConfirmDialog } from "@/ui/options/components/modals/ConfirmDialog";

describe("ConfirmDialog", () => {
  let root: Root | null = null;
  let previousActEnvironment: boolean | undefined;
  const actEnvironment = globalThis as typeof globalThis & {
    IS_REACT_ACT_ENVIRONMENT?: boolean;
  };

  beforeEach(() => {
    useSettingsMock.mockReset();
    previousActEnvironment = actEnvironment.IS_REACT_ACT_ENVIRONMENT;
    actEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
    document.body.innerHTML = '<div id="root"></div>';
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    root = null;
    if (previousActEnvironment === undefined) {
      delete actEnvironment.IS_REACT_ACT_ENVIRONMENT;
    } else {
      actEnvironment.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
    }
    document.body.innerHTML = "";
  });

  it("supports split actions with a left ghost override button", async () => {
    const resolveConfirmDialog = vi.fn();
    useSettingsMock.mockReturnValue({
      confirmDialogOpen: true,
      confirmDialogConfig: {
        title: "Overwrite existing rule?",
        description: "A rule already exists.",
        confirmLabel: "Overwrite",
        cancelLabel: "No",
        confirmVariant: "ghost",
        cancelVariant: "default",
        confirmClassName:
          "text-destructive hover:bg-destructive/10 hover:text-destructive",
        footerLayout: "split",
        actionOrder: "confirm-cancel",
      },
      resolveConfirmDialog,
    });

    const container = document.getElementById("root");
    if (!container) {
      throw new Error("Missing test root.");
    }

    root = createRoot(container);
    await act(async () => {
      root?.render(createElement(ConfirmDialog));
    });

    const confirmButton = document.getElementById("confirm-dialog-confirm");
    const cancelButton = document.getElementById("confirm-dialog-cancel");
    if (
      !(confirmButton instanceof HTMLButtonElement) ||
      !(cancelButton instanceof HTMLButtonElement)
    ) {
      throw new Error("Missing confirm dialog buttons.");
    }

    const footer = confirmButton.parentElement;
    if (!(footer instanceof HTMLDivElement)) {
      throw new Error("Missing confirm dialog footer.");
    }

    expect(Array.from(footer.children)).toEqual([confirmButton, cancelButton]);
    expect(
      document.getElementById("confirm-dialog")?.getAttribute("data-animation-timing"),
    ).toBe("urgent");
    expect(footer.className).toContain("flex-row");
    expect(footer.className).toContain("justify-between");
    expect(confirmButton.className).toContain("text-destructive");
    expect(confirmButton.className).toContain("hover:bg-destructive/10");
    expect(cancelButton.className).toContain("bg-foreground");
  });

  it("renders multiline rich descriptions", async () => {
    const resolveConfirmDialog = vi.fn();
    useSettingsMock.mockReturnValue({
      confirmDialogOpen: true,
      confirmDialogConfig: {
        title: "New identity for example.com?",
        description: createElement(
          Fragment,
          null,
          createElement(
            "div",
            null,
            "This clears cookies, storage, service workers, and caches for sites tied to this rule.",
          ),
          createElement(
            "div",
            { className: "mt-3" },
            "Privacy Thing will clear browser data for these domains: example.com, cdn.example.com",
          ),
        ),
        confirmLabel: "Reset identity",
        cancelLabel: "Cancel",
      },
      resolveConfirmDialog,
    });

    const container = document.getElementById("root");
    if (!container) {
      throw new Error("Missing test root.");
    }

    root = createRoot(container);
    await act(async () => {
      root?.render(createElement(ConfirmDialog));
    });

    const description = document.getElementById("confirm-dialog-description");
    if (!(description instanceof HTMLDivElement)) {
      throw new Error("Missing confirm dialog description.");
    }

    expect(description.className).toContain("whitespace-pre-line");
    expect(Array.from(description.children)).toHaveLength(2);
    expect(description.firstElementChild).toBeInstanceOf(HTMLDivElement);
    expect(description.textContent).toContain(
      "This clears cookies, storage, service workers, and caches for sites tied to this rule.",
    );
    expect(description.textContent).toContain(
      "Privacy Thing will clear browser data for these domains: example.com, cdn.example.com",
    );
  });
});
