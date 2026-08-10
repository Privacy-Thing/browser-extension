import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createContainer,
  getContainer,
  hydrateAssignments,
  listContainers,
  reconcileAssignments,
} from "@/shared/container-service";
import type { ContainerAssignment, ContainerPresentation } from "@/shared/types";

const {
  getContainerCatalog,
  getBrowserContainer,
  createBrowserContainer,
  updateBrowserContainer,
  removeBrowserContainer,
} = vi.hoisted(() => ({
  getContainerCatalog: vi.fn(),
  getBrowserContainer: vi.fn(),
  createBrowserContainer: vi.fn(),
  updateBrowserContainer: vi.fn(),
  removeBrowserContainer: vi.fn(),
}));

vi.mock("@/targets/firefox/containers-api", () => ({
  CONTAINERS_API_ERROR: "Firefox contextual identities API is unavailable.",
  getContainerCatalog,
  getBrowserContainer,
  createBrowserContainer,
  updateBrowserContainer,
  removeBrowserContainer,
}));

describe("container-service", () => {
  const unavailableError = "Firefox contextual identities API is unavailable.";
  const liveContainer: ContainerPresentation = {
    cookieStoreId: "firefox-container-1",
    name: "Work",
    icon: "briefcase",
    iconUrl: "resource://usercontext-content/briefcase.svg",
    color: "orange",
    colorCode: "#ff9f00",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    getContainerCatalog.mockResolvedValue({
      available: true,
      containers: [liveContainer],
    });
    getBrowserContainer.mockResolvedValue(liveContainer);
    createBrowserContainer.mockResolvedValue(liveContainer);
    updateBrowserContainer.mockResolvedValue(liveContainer);
    removeBrowserContainer.mockResolvedValue(liveContainer);
  });

  it("lists containers through the first available backend", async () => {
    await expect(listContainers()).resolves.toEqual({
      available: true,
      containers: [liveContainer],
    });
  });

  it("returns null for getContainer when no backend is available", async () => {
    getContainerCatalog.mockResolvedValue({
      available: false,
      containers: [],
    });

    await expect(getContainer("firefox-container-1")).resolves.toBeNull();
    expect(getBrowserContainer).not.toHaveBeenCalled();
  });

  it("throws for write operations when no backend is available", async () => {
    getContainerCatalog.mockResolvedValue({
      available: false,
      containers: [],
    });

    await expect(
      createContainer({
        name: "Work",
        color: "orange",
        icon: "briefcase",
      }),
    ).rejects.toThrow(unavailableError);
  });

  it("splits hydrated and orphaned assignments explicitly", () => {
    const orphanedAssignment: ContainerAssignment = {
      cookieStoreId: "firefox-container-2",
      locationId: "warsaw",
    };

    expect(
      hydrateAssignments(
        [
          {
            cookieStoreId: "firefox-container-1",
            enabled: false,
            locationId: "berlin",
          },
          orphanedAssignment,
        ],
        [liveContainer],
      ),
    ).toEqual({
      hydratedAssignments: [
        {
          cookieStoreId: "firefox-container-1",
          enabled: false,
          locationId: "berlin",
          container: liveContainer,
        },
      ],
      orphanedAssignments: [orphanedAssignment],
    });
  });

  describe("reconcileAssignments", () => {
    const secondContainer: ContainerPresentation = {
      ...liveContainer,
      cookieStoreId: "firefox-container-2",
      name: "Shopping",
    };

    it("adds a baseline assignment for containers that lack one", () => {
      const result = reconcileAssignments([], [liveContainer, secondContainer]);

      expect(result.changed).toBe(true);
      expect(result.next).toEqual([
        { cookieStoreId: "firefox-container-1" },
        { cookieStoreId: "firefox-container-2" },
      ]);
    });

    it("preserves existing assignments (including their seeds) and drops orphans", () => {
      const existing: ContainerAssignment = {
        cookieStoreId: "firefox-container-1",
        locationId: "berlin",
        ruleSeedKey: "ctr001",
        authKey: "auth0001",
      };
      const orphan: ContainerAssignment = {
        cookieStoreId: "firefox-container-gone",
        ruleSeedKey: "ctr999",
      };

      const result = reconcileAssignments(
        [existing, orphan],
        [liveContainer, secondContainer],
      );

      expect(result.changed).toBe(true);
      expect(result.next).toEqual([existing, { cookieStoreId: "firefox-container-2" }]);
    });

    it("reports no change when every container already has an assignment", () => {
      const result = reconcileAssignments(
        [
          { cookieStoreId: "firefox-container-1", ruleSeedKey: "ctr001" },
          { cookieStoreId: "firefox-container-2", ruleSeedKey: "ctr002" },
        ],
        [liveContainer, secondContainer],
      );

      expect(result.changed).toBe(false);
    });
  });
});
