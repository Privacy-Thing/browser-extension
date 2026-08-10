// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import { vi } from "vitest";

import {
  drainPagePayloads,
  isPageBufferReady,
  markPageBufferReady,
  queuePagePayload,
} from "@/shared/firefox-page-world-buffer";

const createFakeDocument = () => {
  const scripts: Array<{
    type: string;
    textContent: string;
    attrs: Set<string>;
    remove: () => void;
  }> = [];

  const documentElement = {
    attrs: new Set<string>(),
    hasAttribute(name: string) {
      return this.attrs.has(name);
    },
    setAttribute(name: string) {
      this.attrs.add(name);
    },
    removeAttribute(name: string) {
      this.attrs.delete(name);
    },
  };

  const host = {
    appendChild(node: {
      type: string;
      textContent: string;
      attrs: Set<string>;
      remove: () => void;
    }) {
      scripts.push(node);
    },
  };

  return {
    head: {
      innerHTML: "",
      appendChild: host.appendChild,
    },
    body: host,
    documentElement,
    createElement(_tagName?: string) {
      const node = {
        type: "",
        textContent: "",
        attrs: new Set<string>(),
        setAttribute(name: string, _value?: string) {
          this.attrs.add(name);
        },
        remove() {
          const index = scripts.indexOf(node);
          if (index >= 0) {
            scripts.splice(index, 1);
          }
        },
      };

      return node;
    },
    querySelectorAll(selector: string) {
      const match = selector.match(/\[(data-[a-z0-9-]+)\]/i);
      const attr = match?.[1];
      if (!attr) {
        return [];
      }

      return scripts.filter(
        (node) => node.type === "application/json" && node.attrs.has(attr),
      );
    },
  };
};

describe("firefoxPageWorldBuffer", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("marks readiness on the shared document element", () => {
    vi.stubGlobal("document", createFakeDocument());

    expect(isPageBufferReady("bootstrap-heartbeat")).toBe(false);

    markPageBufferReady("bootstrap-heartbeat");

    expect(isPageBufferReady("bootstrap-heartbeat")).toBe(true);
  });

  it("queues and drains payloads in insertion order", () => {
    vi.stubGlobal("document", createFakeDocument());

    expect(queuePagePayload("bootstrap-heartbeat", { detail: "first" })).toBe(true);
    expect(queuePagePayload("bootstrap-heartbeat", { detail: "second" })).toBe(true);

    expect(drainPagePayloads("bootstrap-heartbeat")).toEqual([
      { detail: "first" },
      { detail: "second" },
    ]);
    expect(drainPagePayloads("bootstrap-heartbeat")).toEqual([]);
  });

  it("ignores malformed payloads while draining", () => {
    const document = createFakeDocument();
    vi.stubGlobal("document", document);

    const malformed = document.createElement("script");
    malformed.type = "application/json";
    malformed.setAttribute("data-tportid-bootstrap-log", "");
    malformed.textContent = "{";
    document.body.appendChild(malformed);

    queuePagePayload("bootstrap-log", { eventName: "ok" });

    expect(drainPagePayloads("bootstrap-log")).toEqual([{ eventName: "ok" }]);
  });

  it("returns false when no DOM host is available", () => {
    vi.stubGlobal("document", {
      head: null,
      body: null,
      documentElement: null,
    });

    expect(queuePagePayload("bootstrap-heartbeat", { detail: "miss" })).toBe(false);
  });
});
