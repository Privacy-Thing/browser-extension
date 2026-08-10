import { afterEach, describe, expect, it, vi } from "vitest";

import { syncSidebarMenus } from "@/background/sidebar-menus";

const makeContextMenusMock = () => {
  const create = vi.fn();
  const remove = vi.fn().mockResolvedValue(undefined);
  return { create, remove };
};

const noDebug = () => false;
const withDebug = () => true;

describe("syncSidebarMenus (firefox)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("always creates two sidebar items", async () => {
    const contextMenus = makeContextMenusMock();
    vi.stubGlobal("chrome", { contextMenus });

    await syncSidebarMenus(noDebug);

    expect(contextMenus.create).toHaveBeenCalledTimes(2);
  });

  it("creates four items when debug is on", async () => {
    const contextMenus = makeContextMenusMock();
    vi.stubGlobal("chrome", { contextMenus });

    await syncSidebarMenus(withDebug);

    expect(contextMenus.create).toHaveBeenCalledTimes(4);
  });

  it("removes logs items when debug is off", async () => {
    const contextMenus = makeContextMenusMock();
    vi.stubGlobal("chrome", { contextMenus });

    await syncSidebarMenus(noDebug);

    expect(contextMenus.create).toHaveBeenCalledTimes(2);
    expect(contextMenus.remove).toHaveBeenCalledTimes(2);
  });
});
