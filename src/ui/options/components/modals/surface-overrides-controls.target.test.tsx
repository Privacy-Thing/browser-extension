// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SurfaceOverridesControls } from "@/ui/options/components/modals/surface-overrides-controls";

const renderWithRoot = async (
  element: ReturnType<typeof createElement>,
): Promise<Root> => {
  document.body.innerHTML = '<div id="root"></div>';
  const container = document.getElementById("root");
  if (!container) {
    throw new Error("Missing test root.");
  }

  const root = createRoot(container);
  await act(async () => {
    root.render(element);
  });
  return root;
};

const getButtonInGroup = (
  groupLabel: string,
  buttonLabel: string,
): HTMLButtonElement => {
  const group = Array.from(document.querySelectorAll('[role="group"]')).find(
    (element) => element.getAttribute("aria-label") === groupLabel,
  );
  if (!group) {
    throw new Error(`Missing ${groupLabel} group.`);
  }

  const button = Array.from(group.querySelectorAll("button")).find(
    (element) => element.getAttribute("aria-label") === buttonLabel,
  );
  if (!(button instanceof HTMLButtonElement)) {
    throw new Error(`Missing ${buttonLabel} button.`);
  }

  return button;
};

describe("SurfaceOverridesControls", () => {
  let root: Root | null = null;

  beforeEach(() => {
    Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
      configurable: true,
      value: true,
    });
  });

  afterEach(async () => {
    if (root) {
      await act(async () => {
        root?.unmount();
      });
      root = null;
    }
    Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
    document.body.innerHTML = "";
    vi.restoreAllMocks();
  });

  it("writes the Dedicated and Shared Worker mode override", async () => {
    const onChange = vi.fn();

    root = await renderWithRoot(
      createElement(SurfaceOverridesControls, {
        value: undefined,
        onChange,
      }),
    );

    await act(async () => {
      getButtonInGroup("Dedicated & Shared Workers", "Strict").click();
    });

    expect(onChange).toHaveBeenCalledWith({ sharedWorker: "strict" });
  });

  it("renders Dedicated and Shared Workers after Service Workers at the end", async () => {
    root = await renderWithRoot(
      createElement(SurfaceOverridesControls, {
        value: undefined,
        onChange: vi.fn(),
      }),
    );

    const groupLabels = Array.from(document.querySelectorAll('[role="group"]')).map(
      (element) => element.getAttribute("aria-label"),
    );

    expect(groupLabels.slice(-2)).toEqual([
      "Service Workers",
      "Dedicated & Shared Workers",
    ]);
    expect(groupLabels).not.toContain("Dedicated Workers");
  });

  it("uses semantic Service Worker override labels", async () => {
    const onChange = vi.fn();

    root = await renderWithRoot(
      createElement(SurfaceOverridesControls, {
        value: undefined,
        onChange,
      }),
    );

    await act(async () => {
      getButtonInGroup("Service Workers", "Block").click();
    });

    expect(getButtonInGroup("Service Workers", "Inherit")).toBeDefined();
    expect(getButtonInGroup("Service Workers", "Allow")).toBeDefined();
    expect(onChange).toHaveBeenCalledWith({ serviceWorker: true });
  });

  it("keeps boolean surface override behavior unchanged", async () => {
    const onChange = vi.fn();

    root = await renderWithRoot(
      createElement(SurfaceOverridesControls, {
        value: undefined,
        onChange,
      }),
    );

    await act(async () => {
      getButtonInGroup("Canvas", "Off").click();
    });

    expect(onChange).toHaveBeenCalledWith({ canvas: false });
  });
});
