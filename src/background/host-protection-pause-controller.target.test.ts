import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { createHostPauseCtl } from "./host-protection-pause-controller";

import type { HostProtectionPause } from "@/shared/host-protection-pause";

const storage = vi.hoisted(() => ({
  getHostPauses: vi.fn((): HostProtectionPause[] => []),
  getHostPause: vi.fn(() => undefined),
  setHostPause: vi.fn(async () => undefined),
  expireHostPauses: vi.fn(async (): Promise<string[]> => []),
  initializeHostPauses: vi.fn(async () => undefined),
  recordPausedDocument: vi.fn(async () => undefined),
  HOST_PAUSE_ALARM: "expiry",
}));
vi.mock("@/background/storage/host-protection-pauses", () => storage);
vi.mock("@/background/settings-import-transaction", () => ({
  withConfigurationLock: (operation: () => Promise<unknown>) => operation(),
}));

const tabs = [
  { id: 1, url: "https://h.example/a", cookieStoreId: "firefox-container-1" },
  { id: 2, url: "https://h.example/b", cookieStoreId: "firefox-container-2" },
  { id: 3, url: "https://sub.h.example/" },
  { id: 4, url: "https://k.example/" },
];
const reload = vi.fn(async () => undefined);
beforeEach(() => {
  vi.clearAllMocks();
  storage.expireHostPauses.mockResolvedValue([]);
  storage.getHostPauses.mockReturnValue([]);
  vi.stubGlobal("chrome", {
    tabs: {
      query: vi.fn(async () => tabs),
      get: vi.fn(async (id: number) => tabs.find((tab) => tab.id === id)),
      reload,
      onRemoved: { addListener: vi.fn() },
    },
    alarms: { onAlarm: { addListener: vi.fn() } },
  });
});
afterEach(() => vi.unstubAllGlobals());

it("reloads every exact host across containers after refreshing state, retaining markers when reload fails", async () => {
  const refresh = vi.fn(async () => {
    expect(reload).not.toHaveBeenCalled();
  });
  reload.mockRejectedValueOnce(new Error("closed tab"));
  const prepareReload = vi.fn(async () => {
    expect(refresh).toHaveBeenCalledOnce();
  });
  const controller = createHostPauseCtl({
    refresh,
    prepareReload,
    getPopupState: vi.fn(async () => ({ ok: true as const, state: {} as never })),
  });
  expect((await controller.setPause("session", 1)).ok).toBe(true);
  expect(storage.setHostPause).toHaveBeenCalledWith("h.example", "session");
  expect(storage.recordPausedDocument.mock.calls).toEqual([
    [1, "h.example", "pending"],
    [2, "h.example", "pending"],
  ]);
  expect(refresh).toHaveBeenCalledWith([
    { tabId: 1, hostname: "h.example", cookieStoreId: "firefox-container-1" },
    { tabId: 2, hostname: "h.example", cookieStoreId: "firefox-container-2" },
    { tabId: 3, hostname: "sub.h.example" },
    { tabId: 4, hostname: "k.example" },
  ]);
  expect(prepareReload.mock.calls).toHaveLength(2);
  expect(prepareReload.mock.invocationCallOrder[0]).toBeLessThan(
    reload.mock.invocationCallOrder[0]!,
  );
  expect(reload.mock.calls).toEqual([[1], [2]]);
});

it("expires state without automatically reloading open documents", async () => {
  storage.expireHostPauses.mockResolvedValue(["h.example"]);
  const refresh = vi.fn(async () => undefined);
  const controller = createHostPauseCtl({
    refresh,
    prepareReload: vi.fn(async () => undefined),
    getPopupState: vi.fn(),
  });
  await controller.reconcile();
  expect(refresh).toHaveBeenCalledOnce();
  expect(reload).not.toHaveBeenCalled();
});

it("revalidates state on worker startup and handles expiry alarms without reloading documents", async () => {
  let refreshed: () => void = () => undefined;
  const started = new Promise<void>((resolve) => {
    refreshed = resolve;
  });
  const refresh = vi.fn(async () => {
    refreshed();
  });
  const controller = createHostPauseCtl({
    refresh,
    prepareReload: vi.fn(),
    getPopupState: vi.fn(),
  });
  controller.register();
  await started;
  expect(storage.initializeHostPauses).toHaveBeenCalled();
  expect(storage.expireHostPauses).toHaveBeenCalledOnce();
  storage.expireHostPauses.mockResolvedValue(["h.example"]);
  const expired = new Promise<void>((resolve) => {
    refreshed = resolve;
  });
  const listener = vi.mocked(chrome.alarms.onAlarm.addListener).mock.calls[0]![0];
  listener({
    name: storage.HOST_PAUSE_ALARM,
    scheduledTime: 0,
    persistAcrossSessions: false,
  });
  await expired;
  expect(refresh).toHaveBeenCalledTimes(2);
  expect(reload).not.toHaveBeenCalled();
});

it("reloads only hosts whose narrow tests expired, across their container tabs", async () => {
  storage.getHostPauses.mockReturnValue([
    {
      hostname: "h.example",
      id: "test",
      expiresAt: 1000,
      workerTest: "service-worker",
    },
  ]);
  storage.expireHostPauses.mockResolvedValue(["h.example"]);
  const controller = createHostPauseCtl({
    refresh: vi.fn(async () => undefined),
    prepareReload: vi.fn(async () => undefined),
    getPopupState: vi.fn(),
  });
  await controller.reconcile();
  expect(reload.mock.calls).toEqual([[1], [2]]);
});
