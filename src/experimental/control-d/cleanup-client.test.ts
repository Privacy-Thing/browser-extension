import { describe, expect, it, vi } from "vitest";

import { ControlDApiError, ControlDClient } from "./client";

describe("Control D cleanup DELETE routes", () => {
  it("uses encoded profile/device IDs and supports empty 204 responses", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 204 }));
    const client = new ControlDClient("fake-test-key", fetchImpl);
    await client.deleteGroup("profile /?", 42);
    await client.deleteDevice("device /?");
    await client.deleteProfile("profile /?");
    expect(fetchImpl.mock.calls.map(([url, init]) => [url, init?.method])).toEqual([
      ["https://api.controld.com/profiles/profile%20%2F%3F/groups/42", "DELETE"],
      ["https://api.controld.com/devices/device%20%2F%3F", "DELETE"],
      ["https://api.controld.com/profiles/profile%20%2F%3F", "DELETE"],
    ]);
  });

  it("exposes 404 for the cleanup executor and does not retry DELETEs", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("{}", { status: 404 }));
    const client = new ControlDClient("fake-test-key", fetchImpl);
    await expect(client.deleteProfile("gone")).rejects.toMatchObject({ status: 404 });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("returns a sanitized typed HTTP error", async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("{}", { status: 403 }));
    const client = new ControlDClient("fake-test-key", fetchImpl);
    await expect(client.deleteDevice("locked")).rejects.toBeInstanceOf(
      ControlDApiError,
    );
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
