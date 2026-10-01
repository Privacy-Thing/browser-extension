import { afterEach, describe, expect, it, vi } from "vitest";

import { setImportProgress } from "@/background/settings-import-progress";
import { createMigrationGuard } from "@/background/settings-migration-guard";

const dependencies = () => ({
  recover: vi.fn(async () => false),
  migrate: vi.fn(async () => undefined),
  rebuildRuntime: vi.fn(async () => undefined),
});

afterEach(() => setImportProgress({ active: false, recoveryNeeded: false }));

describe("configuration migration and recovery gate", () => {
  it("rebuilds runtime after initial recovery, even when recovery clears its flag", async () => {
    const deps = dependencies();
    const order: string[] = [];
    deps.recover.mockImplementation(async () => {
      order.push("recover");
      setImportProgress({ active: false, recoveryNeeded: false });
      return true;
    });
    deps.migrate.mockImplementation(async () => {
      order.push("migrate");
    });
    deps.rebuildRuntime.mockImplementation(async () => {
      order.push("rebuild");
    });
    const ensure = createMigrationGuard(deps);
    await Promise.all([ensure(), ensure()]);
    expect(order).toEqual(["recover", "migrate", "rebuild"]);
    await ensure();
    expect(deps.recover).toHaveBeenCalledOnce();
    expect(deps.rebuildRuntime).toHaveBeenCalledOnce();
  });

  it("retries a failed rebuild after the durable journal has already been removed", async () => {
    const deps = dependencies();
    deps.recover.mockResolvedValueOnce(true);
    deps.rebuildRuntime.mockRejectedValueOnce(new Error("header rules failed"));
    const ensure = createMigrationGuard(deps);
    await expect(ensure()).rejects.toThrow("header rules failed");
    await ensure();
    expect(deps.recover).toHaveBeenCalledOnce();
    expect(deps.migrate).toHaveBeenCalledOnce();
    expect(deps.rebuildRuntime).toHaveBeenCalledTimes(2);
  });

  it("retries migration without losing the initial recovery obligation", async () => {
    const deps = dependencies();
    deps.recover.mockResolvedValueOnce(true);
    deps.migrate.mockRejectedValueOnce(new Error("storage unavailable"));
    const ensure = createMigrationGuard(deps);
    await expect(ensure()).rejects.toThrow("storage unavailable");
    await ensure();
    expect(deps.rebuildRuntime).toHaveBeenCalledOnce();
  });

  it("does not read recovery storage again during normal runtime calls", async () => {
    const deps = dependencies();
    const ensure = createMigrationGuard(deps);
    await ensure();
    await ensure();
    expect(deps.recover).toHaveBeenCalledOnce();
    expect(deps.rebuildRuntime).not.toHaveBeenCalled();
    setImportProgress({ active: true, recoveryNeeded: true });
    await ensure();
    expect(deps.recover).toHaveBeenCalledOnce();
    setImportProgress({ active: false, recoveryNeeded: true });
    deps.recover.mockImplementation(async () => {
      setImportProgress({ active: false, recoveryNeeded: false });
      return true;
    });
    await ensure();
    expect(deps.recover).toHaveBeenCalledTimes(2);
    expect(deps.rebuildRuntime).toHaveBeenCalledOnce();
  });

  it("keeps concurrent callers waiting until runtime recovery finishes", async () => {
    const deps = dependencies();
    let finish!: () => void;
    const rebuilding = new Promise<void>((resolve) => {
      finish = resolve;
    });
    let started!: () => void;
    const startedRebuild = new Promise<void>((resolve) => {
      started = resolve;
    });
    deps.recover.mockResolvedValueOnce(true);
    deps.rebuildRuntime.mockImplementation(async () => {
      started();
      await rebuilding;
    });
    const ensure = createMigrationGuard(deps);
    const first = ensure();
    await startedRebuild;
    const finished = vi.fn();
    const second = ensure().then(finished);
    await Promise.resolve();
    expect(finished).not.toHaveBeenCalled();
    finish();
    await Promise.all([first, second]);
    expect(finished).toHaveBeenCalledOnce();
  });
});
