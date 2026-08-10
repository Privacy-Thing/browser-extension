import { afterEach, describe, expect, it, vi } from "vitest";

type MockContextualIdentity = {
  cookieStoreId: string;
  name: string;
  color?: string;
  colorCode?: string;
  icon?: string;
  iconUrl?: string;
};

const stubContextualIdentities = (api?: {
  query?: (details: object) => Promise<MockContextualIdentity[]>;
  get?: (cookieStoreId: string) => Promise<MockContextualIdentity | undefined>;
  create?: (details: {
    name: string;
    color: string;
    icon: string;
  }) => Promise<MockContextualIdentity>;
  update?: (
    cookieStoreId: string,
    details: {
      name?: string;
      color?: string;
      icon?: string;
    },
  ) => Promise<MockContextualIdentity>;
  remove?: (cookieStoreId: string) => Promise<MockContextualIdentity>;
}) => {
  vi.stubGlobal("browser", {
    contextualIdentities: api,
  });
};

const loadModule = async () => {
  vi.resetModules();
  return import("@/targets/firefox/containers-api");
};

describe("containers-api", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reports the api as available when query succeeds", async () => {
    stubContextualIdentities({
      query: vi.fn().mockResolvedValue([]),
    });
    const { isContainersApiAvailable } = await loadModule();

    await expect(isContainersApiAvailable()).resolves.toBe(true);
  });

  it("returns an availability-aware container catalog", async () => {
    stubContextualIdentities({
      query: vi.fn().mockResolvedValue([
        {
          cookieStoreId: "firefox-container-1",
          name: "Work",
          color: "orange",
          colorCode: "#ff9f00",
          icon: "briefcase",
        },
      ]),
    });
    const { getContainerCatalog } = await loadModule();

    await expect(getContainerCatalog()).resolves.toEqual({
      available: true,
      containers: [
        {
          cookieStoreId: "firefox-container-1",
          name: "Work",
          color: "orange",
          colorCode: "#ff9f00",
          icon: "briefcase",
          iconUrl: "resource://usercontext-content/briefcase.svg",
        },
      ],
    });
  });

  it("normalizes queried identities with canonical icon urls", async () => {
    stubContextualIdentities({
      query: vi.fn().mockResolvedValue([
        {
          cookieStoreId: "firefox-container-1",
          name: "Work",
          color: "orange",
          colorCode: "#ff9f00",
          icon: "briefcase",
        },
      ]),
    });
    const { getBrowserContainers } = await loadModule();

    await expect(getBrowserContainers()).resolves.toEqual([
      {
        cookieStoreId: "firefox-container-1",
        name: "Work",
        color: "orange",
        colorCode: "#ff9f00",
        icon: "briefcase",
        iconUrl: "resource://usercontext-content/briefcase.svg",
      },
    ]);
  });

  it("returns null when a specific container cannot be retrieved", async () => {
    stubContextualIdentities({
      get: vi.fn().mockResolvedValue(undefined),
    });
    const { getBrowserContainer } = await loadModule();

    await expect(getBrowserContainer("firefox-container-1")).resolves.toBeNull();
  });

  it("creates containers through the firefox api", async () => {
    const create = vi.fn().mockResolvedValue({
      cookieStoreId: "firefox-container-8",
      name: "Banking",
      color: "purple",
      colorCode: "#af51f5",
      icon: "dollar",
    });
    stubContextualIdentities({ create });
    const { createBrowserContainer } = await loadModule();

    await expect(
      createBrowserContainer({
        name: "Banking",
        color: "purple",
        icon: "dollar",
      }),
    ).resolves.toEqual({
      cookieStoreId: "firefox-container-8",
      name: "Banking",
      color: "purple",
      colorCode: "#af51f5",
      icon: "dollar",
      iconUrl: "resource://usercontext-content/dollar.svg",
    });
    expect(create).toHaveBeenCalledWith({
      name: "Banking",
      color: "purple",
      icon: "dollar",
    });
  });

  it("updates containers through the firefox api", async () => {
    const update = vi.fn().mockResolvedValue({
      cookieStoreId: "firefox-container-3",
      name: "Personal",
      color: "toolbar",
      colorCode: "#7c7c7d",
      icon: "circle",
    });
    stubContextualIdentities({ update });
    const { updateBrowserContainer } = await loadModule();

    await expect(
      updateBrowserContainer("firefox-container-3", {
        name: "Personal",
        color: "toolbar",
        icon: "circle",
      }),
    ).resolves.toMatchObject({
      cookieStoreId: "firefox-container-3",
      name: "Personal",
      color: "toolbar",
      icon: "circle",
    });
    expect(update).toHaveBeenCalledWith("firefox-container-3", {
      name: "Personal",
      color: "toolbar",
      icon: "circle",
    });
  });

  it("removes containers through the firefox api", async () => {
    const remove = vi.fn().mockResolvedValue({
      cookieStoreId: "firefox-container-4",
      name: "Shopping",
      color: "blue",
      colorCode: "#37adff",
      icon: "cart",
    });
    stubContextualIdentities({ remove });
    const { removeBrowserContainer } = await loadModule();

    await expect(removeBrowserContainer("firefox-container-4")).resolves.toMatchObject({
      cookieStoreId: "firefox-container-4",
      name: "Shopping",
      color: "blue",
      icon: "cart",
    });
  });

  it("throws for write operations when the api is unavailable", async () => {
    stubContextualIdentities(undefined);
    const { CONTAINERS_API_ERROR, createBrowserContainer } = await loadModule();

    await expect(
      createBrowserContainer({
        name: "Work",
        color: "blue",
        icon: "briefcase",
      }),
    ).rejects.toThrow(CONTAINERS_API_ERROR);
  });
});
