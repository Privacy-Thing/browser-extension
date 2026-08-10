// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EXTENSION_STORAGE_KEYS } from "@/shared/extension-contract";
import { DEFAULT_PREFERENCES } from "@/shared/settings-defaults";
import { ThemeProvider } from "@/ui/shared/ThemeProvider";

vi.mock("@/ui/shared/preferences-migration", () => ({
  migrateLegacyPrefs: vi.fn(async () => undefined),
}));

vi.mock("@/ui/shared/runtime-messaging", () => ({
  sendRuntimeMessage: vi.fn(async () => undefined),
  sendMessageOrThrow: vi.fn(async () => ({ ok: true })),
}));

describe("ThemeProvider deferred initial paint", () => {
  let root: Root | null = null;
  let resolveStorage: (value: Record<string, unknown>) => void;
  let systemReduceMotion = false;

  beforeEach(() => {
    systemReduceMotion = false;
    Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", {
      configurable: true,
      value: true,
    });

    const storedPreferences = new Promise<Record<string, unknown>>((resolve) => {
      resolveStorage = resolve;
    });
    const storageListeners = {
      addListener: vi.fn(),
      removeListener: vi.fn(),
    };

    vi.stubGlobal("chrome", {
      storage: {
        local: { get: vi.fn(() => storedPreferences) },
        onChanged: storageListeners,
      },
    });
    vi.stubGlobal("matchMedia", vi.fn());
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn((query: string) => ({
        matches: query === "(prefers-reduced-motion: reduce)" && systemReduceMotion,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    });

    document.documentElement.removeAttribute("data-theme");
    document.documentElement.removeAttribute("data-reduce-motion");
    document.documentElement.classList.remove("high-contrast");
    document.body.removeAttribute("data-theme");
    document.body.removeAttribute("data-reduce-motion");
    document.body.classList.remove("high-contrast");
    document.body.innerHTML = '<div id="root"></div>';
  });

  afterEach(async () => {
    if (root) {
      const currentRoot = root;
      root = null;
      await act(async () => currentRoot.unmount());
    }
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.removeAttribute("data-reduce-motion");
    document.documentElement.classList.remove("high-contrast");
    document.body.removeAttribute("data-reduce-motion");
    Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
  });

  it("keeps the document hidden until the saved theme, accent, and contrast are ready", async () => {
    const container = document.getElementById("root");
    if (!container) throw new Error("Missing test root.");

    root = createRoot(container);
    await act(async () => {
      root?.render(
        <ThemeProvider deferInitialPaint>
          <div>Popup</div>
        </ThemeProvider>,
      );
      await Promise.resolve();
    });

    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
    expect(document.documentElement.classList.contains("high-contrast")).toBe(false);

    await act(async () => {
      resolveStorage({
        [EXTENSION_STORAGE_KEYS.preferences]: {
          ...DEFAULT_PREFERENCES,
          themeMode: "dark",
          themeAccentPreset: "violet",
          reduceMotion: true,
          highContrastMode: true,
          highContrastExplicit: true,
        },
      });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(document.body.getAttribute("data-theme")).toBe("dark");
    expect(document.documentElement.hasAttribute("data-reduce-motion")).toBe(true);
    expect(document.body.hasAttribute("data-reduce-motion")).toBe(false);
    expect(document.documentElement.classList.contains("high-contrast")).toBe(true);
    expect(document.documentElement.style.getPropertyValue("--primary")).not.toBe("");
  });

  it("uses the system reduced-motion preference as an effective override", async () => {
    const container = document.getElementById("root");
    if (!container) throw new Error("Missing test root.");
    systemReduceMotion = true;

    root = createRoot(container);
    await act(async () => {
      root?.render(
        <ThemeProvider deferInitialPaint>
          <div>Popup</div>
        </ThemeProvider>,
      );
      await Promise.resolve();
    });

    await act(async () => {
      resolveStorage({
        [EXTENSION_STORAGE_KEYS.preferences]: {
          ...DEFAULT_PREFERENCES,
          reduceMotion: false,
        },
      });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(document.documentElement.hasAttribute("data-reduce-motion")).toBe(true);
    expect(document.body.hasAttribute("data-reduce-motion")).toBe(false);
  });

  it("removes the motion marker when neither preference requests it", async () => {
    const container = document.getElementById("root");
    if (!container) throw new Error("Missing test root.");

    root = createRoot(container);
    await act(async () => {
      root?.render(
        <ThemeProvider deferInitialPaint>
          <div>Popup</div>
        </ThemeProvider>,
      );
      await Promise.resolve();
    });

    await act(async () => {
      resolveStorage({
        [EXTENSION_STORAGE_KEYS.preferences]: {
          ...DEFAULT_PREFERENCES,
          reduceMotion: false,
        },
      });
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(document.documentElement.hasAttribute("data-reduce-motion")).toBe(false);
    expect(document.body.hasAttribute("data-reduce-motion")).toBe(false);
  });
});
