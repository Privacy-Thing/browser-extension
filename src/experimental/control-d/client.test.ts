import { afterEach, describe, expect, it, vi } from "vitest";

import { ControlDClient } from "./client";

const jsonResponse = (body: unknown, status = 200, headers?: HeadersInit): Response =>
  new Response(JSON.stringify(body), { status, ...(headers ? { headers } : {}) });

afterEach(() => {
  vi.useRealTimers();
});

describe("ControlDClient", () => {
  it("invokes an injected browser transport with the global receiver", async () => {
    const browserFetch = vi.fn(function (this: unknown) {
      if (this !== globalThis) throw new TypeError("Illegal invocation");
      return Promise.resolve(jsonResponse({ body: { profiles: [] } }));
    });

    await expect(
      new ControlDClient(
        "token",
        browserFetch as unknown as typeof fetch,
      ).listProfiles(),
    ).resolves.toEqual([]);
    expect(browserFetch).toHaveBeenCalledOnce();
  });

  it("validates proxy fields, ignores unknown fields and excludes hidden exits", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({
        body: {
          proxies: [
            {
              PK: "WAW",
              city: "Warsaw",
              country: "pl",
              country_name: "Poland",
              gps_lat: "52.2",
              gps_long: 21,
              future_field: true,
            },
            {
              PK: "SECRET",
              city: "Hidden",
              country: "PL",
              country_name: "Poland",
              gps_lat: 1,
              gps_long: 2,
              hidden: 1,
            },
          ],
        },
      }),
    );

    await expect(new ControlDClient("token", fetchImpl).listProxies()).resolves.toEqual(
      [
        {
          pk: "WAW",
          city: "Warsaw",
          countryCode: "PL",
          countryName: "Poland",
          latitude: 52.2,
          longitude: 21,
        },
      ],
    );
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://api.controld.com/proxies",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer token" }),
      }),
    );
  });

  it("does not retry authentication failures", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({}, 401));
    const request = new ControlDClient("bad", fetchImpl).listProfiles();

    await expect(request).rejects.toMatchObject({
      status: 401,
    });
    expect(fetchImpl).toHaveBeenCalledOnce();
  });

  it("surfaces a sanitized Control D error code, message and operation", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(
        {
          body: [],
          success: false,
          error: {
            message: "Name must be a maximum of 32 characters",
            code: 40003,
          },
        },
        400,
      ),
    );

    await expect(
      new ControlDClient("token", fetchImpl).createProfile("too-long"),
    ).rejects.toMatchObject({
      message:
        "Control D rejected create profile (HTTP 400, code 40003): Name must be a maximum of 32 characters",
      status: 400,
      operation: "create profile",
      apiCode: 40003,
    });
  });

  it("keeps a transport failure reason for redacted debug logging", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("Illegal invocation");
    });

    await expect(
      new ControlDClient("token", fetchImpl as unknown as typeof fetch).createProfile(
        "Privacy Thing",
      ),
    ).rejects.toMatchObject({
      status: 0,
      causeMessage: "TypeError: Illegal invocation",
    });
  });

  it("reads supported endpoint types and sends the selected icon", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          body: {
            types: {
              os: {
                name: "Desktop & Mobile",
                icons: { "desktop-linux": "Linux" },
              },
              browser: {
                name: "Browser",
                icons: {
                  "browser-chrome": "Google Chrome",
                  "browser-firefox": "Firefox",
                  "browser-other": "Other Browser",
                },
              },
              router: {
                name: "Router",
                icons: { router: "Router" },
              },
            },
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          body: {
            device: {
              PK: "device-1",
              resolvers: { doh: "https://dns.controld.com/secret" },
            },
          },
        }),
      );
    const client = new ControlDClient("token", fetchImpl as unknown as typeof fetch);

    await expect(client.listDeviceTypes()).resolves.toEqual([
      "desktop-linux",
      "browser-chrome",
      "browser-firefox",
      "browser-other",
      "router",
    ]);
    await expect(
      client.createDevice("Privacy Thing", "profile-1", "browser-chromium"),
    ).resolves.toMatchObject({
      id: "device-1",
      profileId: "profile-1",
      resolverDoh: "https://dns.controld.com/secret",
    });
    const [, createInit] = fetchImpl.mock.calls[1] as [string, RequestInit];
    expect(createInit.method).toBe("POST");
    expect(createInit.body?.toString()).toContain("client_count=1");
    expect(createInit.body?.toString()).toContain("profile_id=profile-1");
    expect(createInit.body?.toString()).toContain("icon=browser-chromium");
  });

  it("accepts a legacy flat endpoint-type map without treating groups as icons", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ body: { types: { "browser-other": "Other Browser" } } }),
    );

    await expect(
      new ControlDClient("token", fetchImpl).listDeviceTypes(),
    ).resolves.toEqual(["browser-other"]);
  });

  it("configures the managed profile default as enabled Bypass", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({}));

    await new ControlDClient("token", fetchImpl).setDefaultBypass("profile-1");

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.controld.com/profiles/profile-1/default");
    expect(init.method).toBe("PUT");
    expect(init.body?.toString()).toBe("do=1&status=1");
  });

  it("parses documented folder and rule list field names", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          body: {
            groups: [
              {
                PK: 7,
                group: "Managed folder",
                action: { do: 3, via: "WAW", status: 1 },
                count: 1,
              },
            ],
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          body: {
            rules: [
              {
                PK: "example.com",
                group: 7,
                action: { do: 3, via: "WAW", status: 1 },
              },
            ],
          },
        }),
      );
    const client = new ControlDClient("token", fetchImpl as unknown as typeof fetch);

    await expect(client.listGroups("profile-1")).resolves.toEqual([
      { id: 7, name: "Managed folder", action: 3, via: "WAW" },
    ]);
    await expect(client.listRules("profile-1", 7)).resolves.toEqual([
      {
        hostname: "example.com",
        groupId: 7,
        action: 3,
        via: "WAW",
        status: 1,
        comment: null,
      },
    ]);
  });

  it("respects Retry-After for a safe request", async () => {
    vi.useFakeTimers();
    const onRetry = vi.fn();
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({}, 429, { "Retry-After": "2" }))
      .mockResolvedValueOnce(jsonResponse({ body: { profiles: [] } }));

    const request = new ControlDClient(
      "token",
      fetchImpl as unknown as typeof fetch,
      12_000,
      onRetry,
    ).listProfiles();
    await vi.advanceTimersByTimeAsync(2_000);

    await expect(request).resolves.toEqual([]);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenCalledWith({
      attempt: 1,
      delayMs: 2_000,
      status: 429,
      requestId: null,
    });
  });
});
