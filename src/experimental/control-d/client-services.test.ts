import { describe, expect, it, vi } from "vitest";

import { ControlDApiError, ControlDClient } from "./client";

const response = (services: unknown): Response =>
  new Response(JSON.stringify({ success: true, body: { services } }));

describe("Control D service reads", () => {
  it("reads catalogue keys used by native service rules, including numeric names", async () => {
    const fetchImpl = vi.fn(async () =>
      response([
        {
          id: "catalogue-uuid",
          PK: "netflix",
          name: "Netflix",
          category: "video",
          unlock_location: "JFK",
          warning: "Best effort",
        },
        { PK: 1688, name: 1688, category: "shop" },
      ]),
    );

    const services = await new ControlDClient("test-token", fetchImpl).listServices();

    expect(services).toEqual([
      { pk: "netflix", name: "Netflix", category: "video" },
      { pk: "1688", name: "1688", category: "shop" },
    ]);
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.controld.com/services/categories/all",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer test-token" }),
      }),
    );
  });

  it("reads enabled and disabled native service actions without changing the profile", async () => {
    const fetchImpl = vi.fn(async () =>
      response([
        {
          PK: "netflix",
          name: "Netflix",
          category: "video",
          action: { do: 3, status: 1, via: "WAW" },
        },
        {
          PK: "zoom",
          name: "Zoom",
          category: "tools",
          action: { do: 2, status: 0, via: "192.0.2.1", via_v6: "2001:db8::1" },
        },
        {
          PK: "1688",
          name: 1688,
          category: "shop",
          action: { do: "1", status: "1" },
        },
      ]),
    );

    const services = await new ControlDClient(
      "test-token",
      fetchImpl,
    ).listProfileServices("profile/a");

    expect(services).toEqual([
      {
        pk: "netflix",
        name: "Netflix",
        category: "video",
        action: 3,
        status: 1,
        via: "WAW",
        viaV6: null,
      },
      {
        pk: "zoom",
        name: "Zoom",
        category: "tools",
        action: 2,
        status: 0,
        via: "192.0.2.1",
        viaV6: "2001:db8::1",
      },
      {
        pk: "1688",
        name: "1688",
        category: "shop",
        action: 1,
        status: 1,
        via: null,
        viaV6: null,
      },
    ]);
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.controld.com/profiles/profile%2Fa/services",
      expect.not.objectContaining({
        method: expect.anything(),
      }),
    );
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.controld.com/profiles/profile%2Fa/services",
      expect.not.objectContaining({
        body: expect.anything(),
      }),
    );
  });

  it.each([undefined, { do: 3, status: null }, { do: 3, status: 2 }])(
    "rejects incomplete or unknown profile status: %j",
    async (action) => {
      const fetchImpl = vi.fn(async () =>
        response([{ PK: "netflix", name: "Netflix", category: "video", action }]),
      );

      await expect(
        new ControlDClient("test-token", fetchImpl).listProfileServices("profile"),
      ).rejects.toBeInstanceOf(ControlDApiError);
    },
  );

  it("accepts an empty collection but rejects missing or partial catalogue data", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(response([]))
      .mockResolvedValueOnce(response(undefined))
      .mockResolvedValueOnce(
        response([
          { PK: "netflix", name: "Netflix", category: "video" },
          { name: "Missing key", category: "video" },
        ]),
      );
    const client = new ControlDClient("test-token", fetchImpl);

    await expect(client.listServices()).resolves.toEqual([]);
    await expect(client.listServices()).rejects.toBeInstanceOf(ControlDApiError);
    await expect(client.listServices()).rejects.toBeInstanceOf(ControlDApiError);
  });

  it("rejects failed API envelopes and unknown profile actions without exposing payload data", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            success: false,
            body: { services: [] },
            error: { message: "private-server-detail" },
          }),
        ),
      )
      .mockResolvedValueOnce(
        response([
          {
            PK: "netflix",
            name: "Netflix",
            category: "video",
            action: { do: 99, status: 1 },
          },
        ]),
      );
    const client = new ControlDClient("test-token", fetchImpl);

    await expect(client.listServices()).rejects.toThrow("invalid service catalogue");
    await expect(client.listProfileServices("profile")).rejects.toThrow(
      "invalid profile services",
    );
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
