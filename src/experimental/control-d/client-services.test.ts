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

  it.each([
    undefined,
    { do: 3, status: null },
    { do: 3, status: 2 },
    { do: " ", status: 1 },
    { do: 3, status: " \t" },
  ])("rejects incomplete or unknown profile status: %j", async (action) => {
    const fetchImpl = vi.fn(async () =>
      response([{ PK: "netflix", name: "Netflix", category: "video", action }]),
    );

    await expect(
      new ControlDClient("test-token", fetchImpl).listProfileServices("profile"),
    ).rejects.toBeInstanceOf(ControlDApiError);
  });

  it.each([undefined, false, 1, "true"])(
    "rejects service collections without an explicit successful envelope: %j",
    async (success) => {
      const fetchImpl = vi.fn(
        async () => new Response(JSON.stringify({ success, body: { services: [] } })),
      );
      const client = new ControlDClient("test-token", fetchImpl);
      await expect(client.listServices()).rejects.toBeInstanceOf(ControlDApiError);
      await expect(client.listProfileServices("profile")).rejects.toBeInstanceOf(
        ControlDApiError,
      );
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

  it("redirects one native service through the encoded profile action", async () => {
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 200 }));

    await new ControlDClient("test-token", fetchImpl).redirectProfileService(
      "profile/a",
      "svc/netflix",
      "WAW",
    );

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(
      "https://api.controld.com/profiles/profile%2Fa/services/svc%2Fnetflix",
    );
    expect(init.method).toBe("PUT");
    expect(init.body?.toString()).toBe("do=3&status=1&via=WAW");
    expect(init.headers).toMatchObject({
      Accept: "application/json",
      Authorization: "Bearer test-token",
      "Content-Type": "application/x-www-form-urlencoded",
    });
  });

  it("deletes one native service without a request body", async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 204 }));

    await new ControlDClient("test-token", fetchImpl).deleteProfileService(
      "profile/a",
      "1688",
    );

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.controld.com/profiles/profile%2Fa/services/1688");
    expect(init.method).toBe("DELETE");
    expect(init.body).toBeUndefined();
    expect(init.headers).toMatchObject({ Authorization: "Bearer test-token" });
    expect(init.headers).not.toMatchObject({
      "Content-Type": expect.any(String),
    });
  });

  it("bypasses catalogue services with the dashboard bulk JSON shape", async () => {
    const fetchImpl = vi.fn(async () => new Response("{}", { status: 200 }));

    await new ControlDClient("test-token", fetchImpl).bypassProfileServices(
      "profile/a",
      ["netflix", "1688"],
    );

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.controld.com/profiles/profile%2Fa/services");
    expect(init.method).toBe("PUT");
    expect(init.body).toBe(
      JSON.stringify({
        services: [
          { PK: "netflix", do: 1, status: 1 },
          { PK: "1688", do: 1, status: 1 },
        ],
      }),
    );
    expect(init.headers).toMatchObject({
      Accept: "application/json",
      Authorization: "Bearer test-token",
      "Content-Type": "application/json",
    });
  });

  it("does not write when there are no services to bypass", async () => {
    const fetchImpl = vi.fn();
    await new ControlDClient("test-token", fetchImpl).bypassProfileServices(
      "profile",
      [],
    );
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("reads every custom rule before a lookup profile can be trusted", async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            success: true,
            body: { rules: [{ PK: "ads.example", action: { do: 0, status: 1 } }] },
          }),
        ),
    );

    await expect(
      new ControlDClient("test-token", fetchImpl).listCustomRules("profile/a"),
    ).resolves.toEqual([
      {
        hostname: "ads.example",
        groupId: null,
        action: 0,
        via: null,
        status: 1,
        comment: null,
      },
    ]);
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.controld.com/profiles/profile%2Fa/rules/all",
      expect.not.objectContaining({ method: "POST" }),
    );
  });
});
