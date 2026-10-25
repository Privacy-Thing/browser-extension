// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { InspectorApi } from "./inspector-api";
import type { XRayInspectorState } from "./inspector-contract";
import {
  createMemoryInspectorApi,
  type MemoryInspectorApi,
} from "./memory-inspector-api";
import { useXRayInspector } from "./useXRayInspector";

import { t } from "@/ui/i18n";
import { XRayAccessAccordion } from "@/ui/sidebar/modules/xray/XRayAccessAccordion";
import { XRayModule } from "@/ui/sidebar/modules/xray/XRayModule";
import { createInspectorXRayState } from "@/ui/sidebar/stories/xray-inspector-story-fixtures";

const xRayState = createInspectorXRayState();
if (!xRayState.ok) throw new Error("Expected a successful X-Ray fixture.");
const { assessments } = xRayState;

const readyState = (
  overrides: Partial<XRayInspectorState> = {},
): XRayInspectorState => ({
  available: true,
  armed: false,
  methodIds: [],
  mode: "first-call",
  pendingReload: false,
  appliesLive: false,
  // Screen is deliberately not trappable. Canvas applies on both targets.
  trappableMethodIds: [
    "canvas.getImageData",
    "canvas.toDataURL",
    "canvas.toBlob",
    "date.now",
    "webGL.getParameter",
  ],
  ...overrides,
});

const Harness = ({
  api,
  tabId = 1,
  refreshKey = 0,
  active = true,
}: {
  api: InspectorApi;
  tabId?: number;
  refreshKey?: number;
  active?: boolean;
}) => {
  const controller = useXRayInspector({ api, tabId, refreshKey });
  return (
    <XRayAccessAccordion
      assessments={assessments}
      surfaceSyncPending={false}
      inspector={{
        active,
        onActiveChange: () => undefined,
        controller,
        showFirefoxHint: false,
      }}
    />
  );
};

const deferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};

describe("X-Ray Inspector", () => {
  let root: Root | null = null;

  const render = async (element: React.ReactElement) => {
    const container = document.getElementById("root");
    if (!container) throw new Error("Missing test root.");
    root ??= createRoot(container);
    await act(async () => {
      root?.render(element);
    });
  };

  const panel = () =>
    document.querySelector<HTMLElement>("[data-xray-inspector-panel]");
  const phase = () => panel()?.dataset.inspectorPhase;
  const status = () =>
    document.querySelector<HTMLElement>("[data-inspector-status]")?.dataset
      .inspectorStatus ?? null;
  const toggle = () =>
    document.querySelector<HTMLElement>("[data-xray-inspector-toggle]");

  const checkbox = (label: string) => {
    const match = Array.from(document.querySelectorAll("label")).find(
      (candidate) => candidate.textContent === label,
    );
    const input = match ? document.getElementById(match.htmlFor) : null;
    if (!(input instanceof HTMLInputElement))
      throw new Error(`No checkbox "${label}".`);
    return input;
  };

  const button = (name: string) => {
    const match = Array.from(document.querySelectorAll("button")).find(
      (candidate) =>
        candidate.getAttribute("aria-label") === name || candidate.textContent === name,
    );
    if (!match) throw new Error(`No button "${name}".`);
    return match;
  };

  const click = async (element: HTMLElement) => {
    await act(async () => {
      element.click();
    });
  };

  const canvasCategory = t.sidebar.accessed.categories.canvas;
  const canvasToDataURL = t.sidebar.accessed.methods.canvasToDataURL;

  const selectToDataURL = async () => {
    await click(button(t.sidebar.inspector.list.methodsOf(canvasCategory)));
    await click(checkbox(canvasToDataURL));
  };

  const lastCall = (api: MemoryInspectorApi) => api.calls.at(-1);

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
      await act(async () => {
        currentRoot.unmount();
      });
    }
    document.body.innerHTML = "";
    Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
  });

  it("drives the category checkbox through none, mixed and all", async () => {
    await render(<Harness api={createMemoryInspectorApi(readyState())} />);
    const category = checkbox(canvasCategory);
    expect(category.checked).toBe(false);
    expect(category.indeterminate).toBe(false);

    await selectToDataURL();
    expect(category.indeterminate).toBe(true);
    expect(category.checked).toBe(false);
    expect(
      document
        .querySelector('[data-inspector-category="canvas"]')
        ?.getAttribute("data-selection"),
    ).toBe("some");

    await click(category);
    expect(category.indeterminate).toBe(false);
    expect(category.checked).toBe(true);
    expect(checkbox(t.sidebar.accessed.methods.canvasGetImageData).checked).toBe(true);

    await click(category);
    expect(category.checked).toBe(false);
    expect(checkbox(canvasToDataURL).checked).toBe(false);
  });

  it("wires disclosure, descriptions and labels for assistive technology", async () => {
    await render(<Harness api={createMemoryInspectorApi(readyState())} />);
    const disclosure = button(t.sidebar.inspector.list.methodsOf(canvasCategory));
    expect(disclosure.getAttribute("aria-expanded")).toBe("false");
    await click(disclosure);
    expect(disclosure.getAttribute("aria-expanded")).toBe("true");
    const group = document.getElementById(
      disclosure.getAttribute("aria-controls") ?? "",
    );
    expect(group?.querySelector('[data-inspector-method="canvas.toDataURL"]')).not.toBe(
      null,
    );

    const summary = document.getElementById(
      checkbox(canvasCategory).getAttribute("aria-describedby") ?? "",
    );
    expect(summary?.textContent).toContain(
      t.sidebar.inspector.list.selectedSummary(0, 3),
    );

    for (const input of document.querySelectorAll<HTMLInputElement>(
      "input[type=checkbox]",
    )) {
      expect(input.labels?.length, input.outerHTML).toBe(1);
    }
    expect(document.querySelector('[role="status"]')).not.toBe(null);
  });

  it("disables methods the rule does not spoof and explains why", async () => {
    await render(<Harness api={createMemoryInspectorApi(readyState())} />);
    const screen = checkbox(t.sidebar.accessed.categories.screen);
    expect(screen.disabled).toBe(true);
    await click(
      button(t.sidebar.inspector.list.methodsOf(t.sidebar.accessed.categories.screen)),
    );
    const width = checkbox(t.sidebar.accessed.methods.screenWidth);
    expect(width.disabled).toBe(true);
    expect(
      document.getElementById(width.getAttribute("aria-describedby") ?? "")
        ?.textContent,
    ).toContain(t.sidebar.inspector.list.notTrappableReason);
  });

  it("shows the arming status as a dot on the Inspector toggle", async () => {
    const api = createMemoryInspectorApi(readyState());
    await render(<Harness api={api} active={false} />);
    expect(status()).toBe(null);

    await render(<Harness api={api} />);
    expect(status()).toBe("idle");
    expect(toggle()?.textContent).toContain(`(${t.sidebar.inspector.status.idle})`);

    await selectToDataURL();
    await click(button(t.sidebar.inspector.actions.armReload));
    expect(status()).toBe("armed");
    expect(toggle()?.textContent).toContain(`(${t.sidebar.inspector.status.armed(1)})`);

    await click(checkbox(t.sidebar.accessed.categories.webGL));
    expect(status()).toBe("changed");
    await render(<Harness api={api} active={false} />);
    expect(status()).toBe("changed");
  });

  it("offers no arm action until a method is selected", async () => {
    await render(<Harness api={createMemoryInspectorApi(readyState())} />);
    expect(phase()).toBe("idle");
    expect(document.querySelector("[data-inspector-actions]")).toBe(null);
  });

  it.each([
    [
      t.sidebar.inspector.actions.armReload,
      "now",
      t.sidebar.inspector.result.reload,
      false,
    ],
    [
      t.sidebar.inspector.actions.armNextLoad,
      "next-load",
      t.sidebar.inspector.result.nextLoad,
      true,
    ],
  ] as const)(
    "%s arms only the selected method with apply=%s",
    async (action, apply, outcome, pendingReload) => {
      const api = createMemoryInspectorApi(readyState());
      await render(<Harness api={api} />);
      await selectToDataURL();
      expect(
        document.getElementById(button(action).getAttribute("aria-describedby") ?? "")
          ?.textContent,
      ).toBe(t.sidebar.inspector.hint.ready(1));
      await click(button(action));

      expect(lastCall(api)).toEqual({
        kind: "set",
        tabId: 1,
        methodIds: ["canvas.toDataURL"],
        mode: "first-call",
        apply,
      });
      expect(phase()).toBe("armed");
      expect(panel()?.dataset.inspectorPendingReload).toBe(String(pendingReload));
      expect(document.querySelector('[role="status"]')?.textContent).toBe(
        `${t.sidebar.inspector.result.armed(1)} ${outcome}`,
      );
    },
  );

  it("shows a single live action when the runtime applies traps live", async () => {
    const api = createMemoryInspectorApi(readyState({ appliesLive: true }));
    await render(<Harness api={api} />);
    await selectToDataURL();
    expect(document.querySelectorAll("[data-inspector-apply]")).toHaveLength(1);
    expect(document.body.textContent).not.toContain(t.sidebar.inspector.reloadNote);
    await click(button(t.sidebar.inspector.actions.arm));
    expect(lastCall(api)).toMatchObject({ kind: "set", apply: "now" });
    expect(document.querySelector('[role="status"]')?.textContent).toContain(
      t.sidebar.inspector.result.live,
    );
  });

  it("leaves the selected count and apply result to assistive technology", async () => {
    const api = createMemoryInspectorApi(readyState({ appliesLive: true }));
    await render(<Harness api={api} active={false} />);
    expect(document.body.textContent).toContain(t.sidebar.accessed.description);
    await render(<Harness api={api} />);
    expect(document.body.textContent).not.toContain(t.sidebar.accessed.description);

    await selectToDataURL();
    expect(document.querySelector("[data-inspector-hint]")).toBe(null);
    const arm = button(t.sidebar.inspector.actions.arm);
    expect(
      document.getElementById(arm.getAttribute("aria-describedby") ?? "")?.textContent,
    ).toBe(t.sidebar.inspector.hint.ready(1));

    await click(arm);
    expect(phase()).toBe("armed");
    expect(document.querySelector("[data-inspector-hint]")).toBe(null);
    expect(document.querySelector('[role="status"]')?.textContent).toBe(
      `${t.sidebar.inspector.result.armed(1)} ${t.sidebar.inspector.result.live}`,
    );

    await click(button(t.sidebar.inspector.actions.disarm));
    expect(document.querySelector('[role="status"]')?.textContent).toBe(
      `${t.sidebar.inspector.result.disarmed} ${t.sidebar.inspector.result.live}`,
    );
  });

  it("sends the every-call mode with the selection", async () => {
    const api = createMemoryInspectorApi(readyState());
    await render(<Harness api={api} />);
    await selectToDataURL();
    await click(document.querySelector<HTMLElement>('[role="switch"]')!);
    expect(document.querySelector("[data-inspector-every-call-warning]")).not.toBe(
      null,
    );
    await click(button(t.sidebar.inspector.actions.armReload));
    expect(lastCall(api)).toMatchObject({ kind: "set", mode: "every-call" });
  });

  it.each([
    [t.sidebar.inspector.actions.disarmReload, "now"],
    [t.sidebar.inspector.actions.disarmNextLoad, "next-load"],
  ] as const)("%s clears traps with apply=%s", async (action, apply) => {
    const api = createMemoryInspectorApi(
      readyState({ armed: true, methodIds: ["canvas.toDataURL"] }),
    );
    await render(<Harness api={api} />);
    expect(phase()).toBe("armed");
    await click(button(t.sidebar.inspector.list.methodsOf(canvasCategory)));
    expect(checkbox(canvasToDataURL).checked).toBe(true);
    await click(button(action));
    expect(lastCall(api)).toEqual({ kind: "clear", tabId: 1, apply });
    expect(phase()).toBe("idle");
  });

  it("flags a changed selection while armed and applies the new set", async () => {
    const api = createMemoryInspectorApi(
      readyState({ armed: true, methodIds: ["canvas.toDataURL"] }),
    );
    await render(<Harness api={api} />);
    await click(checkbox(t.sidebar.accessed.categories.webGL));
    expect(phase()).toBe("changed");
    await click(button(t.sidebar.inspector.actions.applyReload));
    expect(lastCall(api)).toMatchObject({
      kind: "set",
      methodIds: ["canvas.toDataURL", "webGL.getParameter"],
      apply: "now",
    });
    expect(phase()).toBe("armed");
  });

  it("treats a mode change while armed as a change to apply", async () => {
    const api = createMemoryInspectorApi(
      readyState({ armed: true, methodIds: ["canvas.toDataURL"] }),
    );
    await render(<Harness api={api} />);
    await click(document.querySelector<HTMLElement>('[role="switch"]')!);
    expect(phase()).toBe("changed");
    await click(button(t.sidebar.inspector.actions.applyNextLoad));
    expect(lastCall(api)).toEqual({
      kind: "set",
      tabId: 1,
      methodIds: ["canvas.toDataURL"],
      mode: "every-call",
      apply: "next-load",
    });
  });

  it("treats emptying an armed selection as a disarm", async () => {
    const api = createMemoryInspectorApi(
      readyState({ armed: true, methodIds: ["canvas.toDataURL"] }),
    );
    await render(<Harness api={api} />);
    // Mixed → all → none.
    await click(checkbox(canvasCategory));
    await click(checkbox(canvasCategory));
    expect(phase()).toBe("changed");
    expect(
      document
        .querySelector("[data-inspector-actions]")
        ?.getAttribute("data-inspector-actions"),
    ).toBe("disarm");
  });

  it("keeps the user's edits when a refresh reports the armed state again", async () => {
    const api = createMemoryInspectorApi(
      readyState({ armed: true, methodIds: ["canvas.toDataURL"] }),
    );
    await render(<Harness api={api} refreshKey={0} />);
    await click(checkbox(t.sidebar.accessed.categories.webGL));
    await render(<Harness api={api} refreshKey={1} />);
    expect(api.calls.filter((call) => call.kind === "get")).toHaveLength(2);
    expect(phase()).toBe("changed");
    expect(checkbox(t.sidebar.accessed.categories.webGL).checked).toBe(true);
  });

  it("does not let a slower, older load overwrite a command result", async () => {
    const memory = createMemoryInspectorApi(readyState());
    const slowLoad = deferred<XRayInspectorState>();
    let loads = 0;
    const api: InspectorApi = {
      ...memory,
      get: (tabId) => (++loads === 2 ? slowLoad.promise : memory.get(tabId)),
    };
    await render(<Harness api={api} refreshKey={0} />);
    await render(<Harness api={api} refreshKey={1} />);
    await selectToDataURL();
    await click(button(t.sidebar.inspector.actions.armReload));
    expect(phase()).toBe("armed");
    await act(async () => {
      slowLoad.resolve(readyState());
      await slowLoad.promise;
    });
    expect(phase()).toBe("armed");
  });

  it("explains a missing runtime instead of failing when commands are unknown", async () => {
    const memory = createMemoryInspectorApi(readyState());
    const { InspectorMissingError } = await import("./inspector-api");
    const api: InspectorApi = {
      ...memory,
      set: () => Promise.reject(new InspectorMissingError()),
    };
    await render(<Harness api={api} />);
    await selectToDataURL();
    await click(button(t.sidebar.inspector.actions.armReload));
    expect(panel()?.dataset.inspectorUnavailable).toBe("no-runtime");
  });

  it("reports a failed apply and stays unarmed", async () => {
    const api = createMemoryInspectorApi(readyState(), { failWith: "Tab closed" });
    await render(<Harness api={api} />);
    await selectToDataURL();
    await click(button(t.sidebar.inspector.actions.armReload));
    expect(document.querySelector('[role="alert"]')?.textContent).toBe(
      t.sidebar.inspector.actionError("Tab closed"),
    );
    expect(phase()).toBe("idle");
  });

  it("starts a fresh draft when the active tab changes", async () => {
    const api = createMemoryInspectorApi(readyState());
    await render(<Harness api={api} tabId={1} />);
    await selectToDataURL();
    await render(<Harness api={api} tabId={2} />);
    expect(checkbox(canvasCategory).indeterminate).toBe(false);
    expect(api.calls.at(-1)).toEqual({ kind: "get", tabId: 2 });
  });

  it("stays out of release builds", async () => {
    await render(
      <XRayModule
        tabId={1}
        xRayState={xRayState}
        xRayLoading={false}
        xRaySurfaceSyncPending={false}
        refreshXRayState={() => undefined}
        locationId={null}
        xRayInspectorApi={createMemoryInspectorApi(readyState())}
      />,
    );
    expect(document.querySelector("[data-xray-section=page-activity]")).not.toBe(null);
    expect(document.querySelector("[data-xray-inspector-toggle]")).toBe(null);
  });
});
