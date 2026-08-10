import { afterEach, describe, expect, it, vi } from "vitest";

import { removeRetiredMenuItems, syncSidebarMenus } from "@/background/sidebar-menus";

const makeContextMenusMock = () => {
  const create = vi.fn();
  // remove() returns a Promise (Chrome 120+ style); rejects for unknown IDs but
  // safeRemoveMenuItem swallows that — so always resolve in tests.
  const remove = vi.fn().mockResolvedValue(undefined);
  return { create, remove };
};

const noDebug = () => false;
const withDebug = () => true;

describe("syncSidebarMenus (chromium)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("always creates two sidebar items, debug off", async () => {
    const contextMenus = makeContextMenusMock();
    vi.stubGlobal("chrome", { contextMenus });

    await syncSidebarMenus(noDebug);

    expect(contextMenus.create).toHaveBeenCalledTimes(2);
    const contexts = contextMenus.create.mock.calls.map(
      (call: unknown[]) => (call[0] as { contexts: string[] }).contexts,
    );
    expect(contexts).toContainEqual(["action"]);
    expect(contexts).toContainEqual(["page"]);
    expect(contextMenus.remove).not.toHaveBeenCalledWith("pt-sidebar-action");
  });

  it("creates two logs items when debug is on", async () => {
    const contextMenus = makeContextMenusMock();
    vi.stubGlobal("chrome", { contextMenus });

    await syncSidebarMenus(withDebug);

    expect(contextMenus.create).toHaveBeenCalledTimes(4);
    const titles = contextMenus.create.mock.calls.map(
      (call: unknown[]) => (call[0] as { title: string }).title,
    );
    expect(titles.filter((t) => t === "View logs")).toHaveLength(2);
  });

  it("creates sidebar items even when debug is off", async () => {
    const contextMenus = makeContextMenusMock();
    vi.stubGlobal("chrome", { contextMenus });

    await syncSidebarMenus(noDebug);

    expect(contextMenus.create).toHaveBeenCalledTimes(2);
    expect(contextMenus.remove).not.toHaveBeenCalledWith("pt-sidebar-action");
  });

  it("removes logs items when debug is off", async () => {
    const contextMenus = makeContextMenusMock();
    vi.stubGlobal("chrome", { contextMenus });

    await syncSidebarMenus(noDebug);

    expect(contextMenus.remove).toHaveBeenCalledTimes(2);
  });

  it("no-ops when chrome.contextMenus is absent", async () => {
    vi.stubGlobal("chrome", {});

    await expect(syncSidebarMenus(noDebug)).resolves.not.toThrow();
  });

  it("removes only the known retired menu ids during migration", async () => {
    const contextMenus = makeContextMenusMock();
    vi.stubGlobal("chrome", { contextMenus });

    await removeRetiredMenuItems();

    expect(contextMenus.remove).toHaveBeenCalledTimes(8);
    expect(contextMenus.remove).toHaveBeenCalledWith(
      ["geo", "warp-sidebar-action"].join(""),
    );
    expect(contextMenus.remove).toHaveBeenCalledWith(
      ["geo", "wrap-logs-page"].join(""),
    );
  });
});
