// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AppToast } from "./toast";

import { createRafController } from "@/test-utils/animation-frame";

describe("AppToast countdown", () => {
  let root: Root | null = null;
  let now = 0;
  let animationFrames = createRafController();

  beforeEach(() => {
    document.body.innerHTML = '<div id="root"></div>';
    Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
      configurable: true,
      value: true,
    });
    animationFrames = createRafController();
    vi.spyOn(performance, "now").mockImplementation(() => now);
    vi.stubGlobal("requestAnimationFrame", animationFrames.request);
    vi.stubGlobal("cancelAnimationFrame", animationFrames.cancel);
  });

  afterEach(async () => {
    if (root) {
      const currentRoot = root;
      root = null;
      await act(async () => currentRoot.unmount());
    }
    document.body.innerHTML = "";
    Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("pauses progress while hovered and resumes from the remaining duration", async () => {
    const container = document.getElementById("root");
    if (!container) throw new Error("Missing test root.");
    root = createRoot(container);

    await act(async () => {
      root?.render(
        <AppToast
          toastId="progress"
          tone="info"
          message="Progress"
          duration={1000}
          dismissible={false}
        />,
      );
    });

    const toast = container.querySelector<HTMLElement>("[data-pt-toast]");
    const progress = container.querySelector<HTMLElement>("[data-pt-toast-progress]");
    if (!toast || !progress) throw new Error("Missing toast progress elements.");

    now = 250;
    await act(async () => animationFrames.flush(now));
    expect(progress.style.width).toBe("75%");

    await act(async () =>
      toast.dispatchEvent(new MouseEvent("mouseover", { bubbles: true })),
    );
    expect(toast.dataset.paused).toBe("true");
    now = 750;
    await act(async () => animationFrames.flush(now));
    expect(progress.style.width).toBe("75%");

    await act(async () =>
      toast.dispatchEvent(new MouseEvent("mouseout", { bubbles: true })),
    );
    expect(toast.dataset.paused).toBe("false");
    now = 1000;
    await act(async () => animationFrames.flush(now));
    expect(progress.style.width).toBe("50%");
  });
});
