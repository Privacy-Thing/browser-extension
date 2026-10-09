import { afterEach, describe, expect, it, vi } from "vitest";

import { ControlDApiError, ControlDClient } from "./client";

const dnsResponse = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/dns+json" },
  });

const matched = {
  Status: 0,
  Answer: [{ data: "203.0.113.9" }],
  QNAME: "other.example.",
  controld: {
    verdict: { verdictSource: "svc", verdictMatch: "netflix", verdictVia: "WAW" },
  },
};

afterEach(() => {
  vi.useRealTimers();
});

describe("Control D domain queries", () => {
  it("queries the dedicated DoH origin with the stored token and global receiver", async () => {
    const browserFetch = vi.fn(function (this: unknown) {
      if (this !== globalThis) throw new TypeError("Illegal invocation");
      return Promise.resolve(dnsResponse(matched));
    });

    await expect(
      new ControlDClient(
        "stored-token",
        browserFetch as unknown as typeof fetch,
      ).queryDomain("resolver-1", "www.example.com"),
    ).resolves.toEqual({
      hostname: "www.example.com",
      status: "matched",
      serviceId: "netflix",
    });

    const [url, init] = browserFetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(
      "https://dns.controld.com/resolver-1?name=www.example.com&type=A&controld=1&no_log=1",
    );
    expect(new URL(url).origin).toBe("https://dns.controld.com");
    expect(init.headers).toEqual({
      Accept: "application/dns+json",
      Authorization: "Bearer stored-token",
    });
    expect(init.redirect).toBe("error");
  });

  it("accepts a numeric RCODE when Status is absent", async () => {
    const fetchImpl = vi.fn(async () =>
      dnsResponse({
        RCODE: 0,
        controld: { verdict: { verdictSource: "svc", verdictMatch: "youtube" } },
      }),
    );
    await expect(
      new ControlDClient("stored-token", fetchImpl).queryDomain(
        "resolver-1",
        "youtu.be",
      ),
    ).resolves.toEqual({
      hostname: "youtu.be",
      status: "matched",
      serviceId: "youtube",
    });
  });

  it("does not send the token when the caller already aborted", async () => {
    const fetchImpl = vi.fn();
    await expect(
      new ControlDClient("stored-token", fetchImpl).queryDomain(
        "resolver-1",
        "example.com",
        AbortSignal.abort(),
      ),
    ).rejects.toMatchObject({
      message: "Control D domain query failed.",
      status: 0,
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("does not send the bearer token when the resolver id would leave the DoH origin", async () => {
    const fetchImpl = vi.fn();
    const client = new ControlDClient("stored-token", fetchImpl);

    await expect(
      client.queryDomain("https://evil.example/collect", "example.com"),
    ).rejects.toMatchObject({
      message: "Control D domain query URL was rejected.",
      status: 0,
      operation: "query domain",
    });
    await expect(client.queryDomain("resolver-1", "bad host")).rejects.toBeInstanceOf(
      ControlDApiError,
    );
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("reports custom-rule and unknown verdicts without the raw payload", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        dnsResponse({
          Status: 0,
          Answer: [{ data: "203.0.113.9" }],
          controld: { verdict: { verdictSource: "rules", verdictMatch: "netflix" } },
        }),
      )
      .mockResolvedValueOnce(
        dnsResponse({
          Status: 0,
          controld: { verdict: { verdictSource: "default" } },
        }),
      );
    const client = new ControlDClient("stored-token", fetchImpl);

    await expect(client.queryDomain("resolver-1", "example.com")).resolves.toEqual({
      hostname: "example.com",
      status: "overridden",
      serviceId: null,
    });
    await expect(client.queryDomain("resolver-1", "example.com")).resolves.toEqual({
      hostname: "example.com",
      status: "unresolved",
      serviceId: null,
    });
    fetchImpl.mockResolvedValueOnce(
      dnsResponse({
        Status: 3,
        controld: { verdict: { verdictSource: "svc", verdictMatch: "netflix" } },
      }),
    );
    await expect(client.queryDomain("resolver-1", "example.com")).resolves.toEqual({
      hostname: "example.com",
      status: "unresolved",
      serviceId: null,
    });
  });

  it("throws sanitized errors for HTTP, JSON and DNS status failures", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            token: "stored-token",
            resolver: "https://dns.controld.com/resolver-1",
            error: { message: "stored-token leaked" },
          }),
          { status: 403 },
        ),
      )
      .mockResolvedValueOnce(new Response("not-json {stored-token}", { status: 200 }))
      .mockResolvedValueOnce(
        dnsResponse({ Status: "NOERROR", secret: "stored-token" }),
      );
    const client = new ControlDClient("stored-token", fetchImpl);
    const readError = async (): Promise<ControlDApiError> => {
      try {
        await client.queryDomain("resolver-1", "example.com");
      } catch (error) {
        expect(error).toBeInstanceOf(ControlDApiError);
        return error as ControlDApiError;
      }
      throw new Error("expected Control D domain query to fail");
    };

    const httpError = await readError();
    const jsonError = await readError();
    const statusError = await readError();

    expect(httpError).toMatchObject({
      message: "Control D rejected query domain (HTTP 403).",
      status: 403,
      causeMessage: null,
    });
    expect(jsonError.message).toBe("Control D domain query returned invalid JSON.");
    expect(statusError.message).toBe(
      "Control D domain query returned a malformed DNS status.",
    );
    for (const error of [httpError, jsonError, statusError]) {
      expect(error.message).not.toContain("stored-token");
      expect(error.causeMessage ?? "").not.toContain("stored-token");
      expect(error.message).not.toContain("controld.com");
    }
  });

  it("redacts transport failures and times out on a fake clock", async () => {
    const transport = vi.fn(async () => {
      throw new TypeError(
        "failed https://dns.controld.com/resolver-1 for stored-token",
      );
    });
    await expect(
      new ControlDClient("stored-token", transport).queryDomain(
        "resolver-1",
        "example.com",
      ),
    ).rejects.toMatchObject({
      message: "Control D domain query failed.",
      status: 0,
      causeMessage: "TypeError: failed [CONTROL_D_URL_REDACTED] for [REDACTED]",
    });

    vi.useFakeTimers();
    const stalled = vi.fn((_url: string, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("The operation was aborted.", "AbortError"));
        });
      });
    });
    const pending = new ControlDClient(
      "stored-token",
      stalled as unknown as typeof fetch,
      25,
    ).queryDomain("resolver-1", "example.com");
    const assertion = expect(pending).rejects.toMatchObject({
      message: "Control D domain query timed out.",
      status: 0,
      causeMessage: null,
    });
    await vi.advanceTimersByTimeAsync(25);
    await assertion;
    expect(stalled).toHaveBeenCalledOnce();
  });
});
