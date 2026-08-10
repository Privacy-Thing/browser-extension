// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { TagsInput } from "./tags-input";

describe("TagsInput", () => {
  let root: Root | null = null;

  beforeEach(() => {
    Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
      configurable: true,
      value: true,
    });
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
    Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
  });

  it("keeps hidden animated prefix tags mounted so CSS can animate them horizontally", async () => {
    document.body.innerHTML = '<div id="root"></div>';
    const container = document.getElementById("root");
    if (!container) {
      throw new Error("Missing test root.");
    }

    const currentRoot = createRoot(container);
    root = currentRoot;
    await act(async () => {
      currentRoot.render(
        <TagsInput
          value={[]}
          prefixTags={[
            {
              value: "en",
              tone: "accent",
              visible: false,
              animated: true,
            },
          ]}
          placeholder="Add language..."
        />,
      );
    });

    const prefixTag = container.querySelector('[data-prefix-tag-state="hidden"]');
    const input = container.querySelector("input");
    const rootElement = container.firstElementChild;
    const innerPrefixTag = prefixTag?.firstElementChild;

    expect(prefixTag).not.toBeNull();
    expect(rootElement?.className).not.toContain("gap-1.5");
    expect(prefixTag?.className).toContain("grid-cols-[0fr]");
    expect(prefixTag?.className).toContain(
      "transition-[grid-template-columns,max-height,opacity,margin]",
    );
    expect(prefixTag?.className).toContain("max-h-0");
    expect(prefixTag?.className).toContain("mr-0");
    expect(prefixTag?.className).toContain("h-0");
    expect(innerPrefixTag?.className).toContain("px-0");
    expect(innerPrefixTag?.className).toContain("py-0");
    expect(innerPrefixTag?.className).toContain("border-transparent");
    expect(rootElement?.className).toContain("gw-form-control");
    expect(rootElement?.className).toContain("gw-form-focus-within");
    expect(input?.getAttribute("placeholder")).toBe("Add language...");
  });
});
