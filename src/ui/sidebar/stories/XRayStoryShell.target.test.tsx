// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createXRayStoryState } from "./xray-story-fixtures";
import { XRayStoryShell } from "./XRayStoryShell";

describe("XRayStoryShell", () => {
  let root: Root | null = null;

  beforeEach(() => {
    Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
      configurable: true,
      value: true,
    });
    document.body.innerHTML = '<div id="root"></div>';
  });

  afterEach(async () => {
    if (root) {
      const currentRoot = root;
      root = null;
      await act(async () => currentRoot.unmount());
    }
    document.body.innerHTML = "";
    Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
  });

  it("simulates shell actions locally without the extension API", async () => {
    const container = document.getElementById("root");
    if (!container) throw new Error("Missing root.");
    root = createRoot(container);

    await act(async () => {
      root?.render(<XRayStoryShell state={createXRayStoryState("error")} />);
    });

    expect(container.firstElementChild?.className).toContain("w-[360px]");

    const settings = document.querySelector<HTMLButtonElement>(
      'button[title="Open settings"]',
    );
    expect(settings).not.toBeNull();

    await act(async () => settings?.click());

    expect(document.body.textContent).toContain("Open settings");
    expect(document.querySelector('[role="status"]')).not.toBeNull();
  });
});
