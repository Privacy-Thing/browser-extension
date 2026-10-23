// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { WorkerTestSession, WorkerTestState } from "@/shared/worker-test";
import { flushReactEffects } from "@/test-utils/react";
import { WorkerTestWindow } from "@/ui/troubleshooter/WorkerTestWindow";

const hook = vi.hoisted(() => ({
  data: null as WorkerTestState | null,
  open: vi.fn(async () => undefined),
  action: vi.fn(async () => undefined),
  close: vi.fn(async () => undefined),
}));

vi.mock("@/ui/shared/useWorkerTroubleshooter", () => ({
  useWorkerTroubleshooter: () => ({
    target: { tabId: 7, hostname: "app.example.test" },
    data: hook.data,
    xray: null,
    pending: null,
    error: null,
    now: 0,
    open: hook.open,
    action: hook.action,
    close: hook.close,
  }),
}));

vi.mock("@/ui/shared/WorkerTestReport", () => ({ WorkerTestReport: () => null }));

const session = (phase: WorkerTestSession["phase"]): WorkerTestSession => ({
  id: "test",
  hostname: "app.example.test",
  kind: "shared-worker",
  expiresAt: 1,
  phase,
  configurationFingerprint: "test",
  before: {} as WorkerTestSession["before"],
  after: null,
});
const state = (phase: WorkerTestSession["phase"] | null): WorkerTestState => ({
  ok: true,
  session: phase ? session(phase) : null,
  blocked: null,
  reloadRequired: false,
  candidates: [{ kind: "service-worker", evidence: "missing" }],
});

let root: Root | null = null;
let container: HTMLElement;
let resize: (() => void) | null = null;
const update = vi.fn(async () => ({}));

const stubBrowser = (type: string) => {
  vi.stubGlobal("chrome", {
    windows: { getCurrent: vi.fn(async () => ({ id: 3, type })), update },
    tabs: { getCurrent: vi.fn(async () => ({ id: 9 })), remove: vi.fn() },
  });
};

const render = async () => {
  await act(async () => {
    root = createRoot(container);
    root.render(createElement(WorkerTestWindow));
  });
  await flushReactEffects();
};

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  window.history.replaceState(null, "", "/src/ui/troubleshooter/index.html?tabId=7");
  vi.stubGlobal(
    "ResizeObserver",
    class {
      constructor(callback: () => void) {
        resize = callback;
      }
      observe() {}
      disconnect() {}
    },
  );
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockReturnValue({
    height: 500,
  } as DOMRect);
  vi.spyOn(window, "outerHeight", "get").mockReturnValue(840);
  vi.spyOn(window, "innerHeight", "get").mockReturnValue(800);
  vi.spyOn(window.screen, "availHeight", "get").mockReturnValue(1000);
  hook.data = state(null);
});

afterEach(() => {
  act(() => root?.unmount());
  root = null;
  container.remove();
  resize = null;
  update.mockClear();
  hook.action.mockClear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("WorkerTestWindow", () => {
  it("renders the troubleshooter as the window content, not as a dialog", async () => {
    stubBrowser("popup");
    await render();
    expect(hook.open).toHaveBeenCalledTimes(1);
    expect(container.querySelector("[data-worker-test-window]")).not.toBeNull();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it("fits a dedicated popup window to its content height", async () => {
    stubBrowser("popup");
    await render();
    expect(update).toHaveBeenLastCalledWith(3, { height: 540 });
    vi.mocked(HTMLElement.prototype.getBoundingClientRect).mockReturnValue({
      height: 620,
    } as DOMRect);
    resize?.();
    expect(update).toHaveBeenLastCalledWith(3, { height: 660 });
    vi.mocked(HTMLElement.prototype.getBoundingClientRect).mockReturnValue({
      height: 2000,
    } as DOMRect);
    resize?.();
    expect(update).toHaveBeenLastCalledWith(3, { height: 1000 });
  });

  it("never resizes an ordinary browser window that opened the page as a tab", async () => {
    stubBrowser("normal");
    await render();
    resize?.();
    expect(update).not.toHaveBeenCalled();
  });

  it("finishes only after a decision saved from this window", async () => {
    stubBrowser("popup");
    hook.data = state("saved");
    await render();
    const view = () => container.querySelector("[data-worker-test-window]")!;
    // A saved session found on reopen keeps the remaining candidate testable.
    expect(view().hasAttribute("data-worker-test-finished")).toBe(false);
    expect(container.querySelector("[data-worker-test-start]")).not.toBeNull();

    hook.data = state("helped");
    await act(async () => root?.render(createElement(WorkerTestWindow)));
    await act(async () =>
      container.querySelector<HTMLButtonElement>("[data-worker-test-save]")!.click(),
    );
    expect(hook.action).toHaveBeenCalledWith("save");
    hook.data = state("saved");
    await act(async () => root?.render(createElement(WorkerTestWindow)));
    expect(view().hasAttribute("data-worker-test-finished")).toBe(true);
    expect(container.querySelector("[data-worker-test-start]")).toBeNull();
    expect(container.querySelector("[data-worker-test-result]")).not.toBeNull();
  });
});
