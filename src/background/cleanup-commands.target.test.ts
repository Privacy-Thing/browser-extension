import { beforeEach, describe, expect, it, vi } from "vitest";

import { createCleanupHandlers } from "@/background/cleanup-commands";
import { syncDynamicHeaderRules } from "@/background/dnr";
import { cleanupHostnamesState } from "@/background/state-hygiene";
import { loadContainerAssignments } from "@/background/storage/container-assignments";
import { loadRules, saveRules } from "@/background/storage/rules";
import { loadSeenHosts } from "@/background/storage/seen-hosts";
import type { DomainRule } from "@/shared/types";

vi.mock("@/background/dnr", () => ({
  syncDynamicHeaderRules: vi.fn(async () => undefined),
}));

vi.mock("@/background/state-hygiene", async (importOriginal) => {
  const original = await importOriginal<Record<string, unknown>>();
  return {
    ...original,
    cleanupHostnamesState: vi.fn(async () => ["https://example.com"]),
    cleanupHostsWithReport: vi.fn(),
  };
});

vi.mock("@/background/storage/container-assignments", () => ({
  loadContainerAssignments: vi.fn(async () => []),
  saveContainerAssignments: vi.fn(),
}));

vi.mock("@/background/storage/rules", () => ({
  loadRules: vi.fn(),
  saveRules: vi.fn(),
}));

vi.mock("@/background/storage/seen-hosts", () => ({
  findIdentityHosts: vi.fn(() => ["example.com"]),
  findIdentityOrigins: vi.fn(() => ["https://example.com"]),
  findIdentityHostRecords: vi.fn(() => []),
  loadSeenHosts: vi.fn(async () => []),
}));

type CleanupCommandDeps = Parameters<typeof createCleanupHandlers>[0];

const rule = {
  pattern: "example.com",
  enabled: true,
  ruleSeedKey: "seed-before",
} as DomainRule;

const createDeps = (): CleanupCommandDeps => ({
  clearSnapshotCache: vi.fn(),
  ensureStorageMigration: vi.fn(async () => undefined),
  getActiveTabContexts: vi.fn(() => [{ tabId: 7, hostname: "example.com" }]),
  getLastKnownDebugMode: vi.fn(() => false),
  getPopupTabById: vi.fn(async () => undefined),
  isSupportedWebUrl: (url): url is string =>
    typeof url === "string" &&
    (url.startsWith("http://") || url.startsWith("https://")),
  logExtensionEvent: vi.fn() as CleanupCommandDeps["logExtensionEvent"],
  refreshActionState: vi.fn(async () => undefined),
  reloadSupportedWebTabs: vi.fn(async () => undefined),
  removeActiveTabContext: vi.fn(),
  resolveTrackedIdentity: vi.fn(() => null),
  setKnownContainers: vi.fn(),
  setLastKnownRules: vi.fn(),
  syncPreloadedState: vi.fn(async () => undefined),
});

describe("createCleanupHandlers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(loadRules).mockResolvedValue([rule]);
    vi.mocked(loadContainerAssignments).mockResolvedValue([]);
    vi.mocked(loadSeenHosts).mockResolvedValue([]);
  });

  it("returns a stable error when the requested rule does not exist", async () => {
    vi.mocked(loadRules).mockResolvedValue([]);
    const handlers = createCleanupHandlers(createDeps());

    await expect(
      handlers.previewIdentityCleanup({
        type: "pt:preview-identity-cleanup",
        target: "rule",
        pattern: "missing.test",
      }),
    ).resolves.toEqual({
      ok: false,
      error: "Rule not found.",
    });
  });

  it("rotates a rule, invalidates runtime state, and cleans its tracked hosts", async () => {
    const deps = createDeps();
    const handlers = createCleanupHandlers(deps);

    const response = await handlers.rotateIdentity({
      type: "pt:rotate-identity-target",
      target: "rule",
      pattern: "example.com",
    });

    expect(response).toEqual(
      expect.objectContaining({
        ok: true,
        target: "rule",
        pattern: "example.com",
        cleanedOrigins: ["https://example.com"],
      }),
    );
    expect(saveRules).toHaveBeenCalledOnce();
    expect(deps.setLastKnownRules).toHaveBeenCalledOnce();
    expect(deps.clearSnapshotCache).toHaveBeenCalledOnce();
    expect(deps.syncPreloadedState).toHaveBeenCalledOnce();
    expect(cleanupHostnamesState).toHaveBeenCalledWith(
      ["example.com"],
      expect.objectContaining({
        exactOrigins: ["https://example.com"],
      }),
    );
    expect(syncDynamicHeaderRules).toHaveBeenCalledOnce();
  });
});
