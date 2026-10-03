import { afterEach, expect, it, vi } from "vitest";

import { findWorkerRequestOwners } from "./firefox-worker-request-context";

const contexts = [
  { tabId: 1, hostname: "h.test", cookieStoreId: "firefox-default" },
  { tabId: 2, hostname: "k.test", cookieStoreId: "firefox-default" },
  { tabId: 3, hostname: "h.test", cookieStoreId: "firefox-container-1" },
];
afterEach(() => vi.unstubAllGlobals());
it("uses live browser frame ownership and preserves ambiguous owners across top hosts", async () => {
  vi.stubGlobal("chrome", {
    webNavigation: {
      getAllFrames: vi.fn(async ({ tabId }: { tabId: number }) => [
        {
          url:
            tabId === 1
              ? "https://k.test/frame#bootstrap-h"
              : "https://k.test/frame#bootstrap-k",
        },
      ]),
    },
  });
  expect(
    await findWorkerRequestOwners(
      "https://k.test/frame#any-page-controlled-seed",
      "firefox-default",
      contexts,
    ),
  ).toEqual(contexts.slice(0, 2));
  expect(chrome.webNavigation.getAllFrames).toHaveBeenCalledTimes(2);
  expect(
    await findWorkerRequestOwners(
      "https://unmatched.test",
      "firefox-default",
      contexts,
    ),
  ).toEqual([]);
});
it("cannot authorize missing, malformed or failed frame records", async () => {
  vi.stubGlobal("chrome", {
    webNavigation: {
      getAllFrames: vi.fn(async () => {
        throw new Error("tab closed");
      }),
    },
  });
  expect(await findWorkerRequestOwners(undefined, "firefox-default", contexts)).toEqual(
    [],
  );
  expect(await findWorkerRequestOwners("garbage", "firefox-default", contexts)).toEqual(
    [],
  );
  expect(chrome.webNavigation.getAllFrames).not.toHaveBeenCalled();
  expect(
    await findWorkerRequestOwners("https://h.test", "firefox-default", contexts),
  ).toEqual([]);
});
