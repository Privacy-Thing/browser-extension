// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { flushReactEffects } from "@/test-utils/react";
import { useSettingsConfirmDialog } from "@/ui/options/state/use-settings-confirm-dialog";

const clickById = async (id: string): Promise<void> => {
  const element = document.getElementById(id);
  if (!(element instanceof HTMLButtonElement)) {
    throw new Error(`Missing button ${id}.`);
  }
  await act(async () => {
    element.click();
  });
  await flushReactEffects();
};

describe("useSettingsConfirmDialog", () => {
  let root: Root | null = null;
  let previousActEnvironment: boolean | undefined;

  beforeEach(() => {
    previousActEnvironment = (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean })
      .IS_REACT_ACT_ENVIRONMENT;
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true;
    document.body.innerHTML = '<div id="root"></div>';
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    root = null;
    document.body.innerHTML = "";
    if (previousActEnvironment === undefined) {
      delete (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean })
        .IS_REACT_ACT_ENVIRONMENT;
    } else {
      (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
        previousActEnvironment;
    }
  });

  it("keeps dialog content mounted through close until the next confirmation", async () => {
    const container = document.getElementById("root");
    if (!container) {
      throw new Error("Missing test root.");
    }

    const Harness = () => {
      const {
        confirmDialogOpen,
        confirmDialogConfig,
        requestConfirmation,
        resolveConfirmDialog,
      } = useSettingsConfirmDialog();

      return createElement(
        "div",
        null,
        createElement("div", { id: "confirm-open" }, String(confirmDialogOpen)),
        createElement("div", { id: "confirm-title" }, confirmDialogConfig?.title ?? ""),
        createElement(
          "button",
          {
            id: "open-alpha",
            onClick: () => {
              void requestConfirmation({ title: "Alpha confirm" });
            },
          },
          "open alpha",
        ),
        createElement(
          "button",
          {
            id: "open-beta",
            onClick: () => {
              void requestConfirmation({ title: "Beta confirm" });
            },
          },
          "open beta",
        ),
        createElement(
          "button",
          {
            id: "resolve-false",
            onClick: () => {
              resolveConfirmDialog(false);
            },
          },
          "resolve false",
        ),
      );
    };

    const nextRoot = createRoot(container);
    root = nextRoot;
    await act(async () => {
      nextRoot.render(createElement(Harness));
    });
    await flushReactEffects();

    await clickById("open-alpha");
    expect(document.getElementById("confirm-open")?.textContent).toBe("true");
    expect(document.getElementById("confirm-title")?.textContent).toBe("Alpha confirm");

    await clickById("resolve-false");
    expect(document.getElementById("confirm-open")?.textContent).toBe("false");
    expect(document.getElementById("confirm-title")?.textContent).toBe("Alpha confirm");

    await clickById("open-beta");
    expect(document.getElementById("confirm-open")?.textContent).toBe("true");
    expect(document.getElementById("confirm-title")?.textContent).toBe("Beta confirm");
  });
});
