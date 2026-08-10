// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FormDialogShell } from "./form-dialog-shell";

describe("FormDialogShell", () => {
  let root: Root | null = null;

  beforeEach(() => {
    Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
      configurable: true,
      value: true,
    });
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        disconnect() {}
      },
    );
  });

  afterEach(async () => {
    if (root) {
      const currentRoot = root;
      root = null;
      await act(async () => {
        currentRoot.unmount();
      });
    }

    document.body.innerHTML = "";
    vi.unstubAllGlobals();
    Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
  });

  it("dismisses an expanded child layer before the dialog", async () => {
    document.body.innerHTML = '<div id="root"></div>';
    const container = document.getElementById("root");
    if (!container) {
      throw new Error("Missing test root.");
    }

    const onOpenChange = vi.fn();
    root = createRoot(container);
    await act(async () => {
      root?.render(
        <FormDialogShell
          open
          onOpenChange={onOpenChange}
          title="Location"
          closeLabel="Close"
        >
          <button role="combobox" aria-expanded="true" aria-controls="location-options">
            Location
          </button>
        </FormDialogShell>,
      );
    });

    const overlay = document.querySelector(".gw-dialog-overlay");
    if (!(overlay instanceof HTMLElement)) {
      throw new Error("Missing dialog overlay.");
    }

    await act(async () => {
      overlay.dispatchEvent(
        new PointerEvent("pointerdown", {
          bubbles: true,
          button: 0,
        }),
      );
      overlay.click();
    });

    expect(onOpenChange).not.toHaveBeenCalled();

    const trigger = document.querySelector('[aria-controls="location-options"]');
    if (!(trigger instanceof HTMLElement)) {
      throw new Error("Missing expanded layer trigger.");
    }
    trigger.setAttribute("aria-expanded", "false");

    await act(async () => {
      overlay.dispatchEvent(
        new PointerEvent("pointerdown", {
          bubbles: true,
          button: 0,
        }),
      );
      overlay.click();
    });

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
