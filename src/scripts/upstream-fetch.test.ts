import { describe, expect, it, vi } from "vitest";

import { fetchTrustedText } from "../../scripts/upstream-fetch.mjs";

const options = (fetchImpl: typeof fetch) => ({
  url: "https://store.steampowered.com/source",
  allowedOrigins: ["https://store.steampowered.com"],
  acceptedContentTypes: ["text/html"],
  accept: "text/html",
  maxBytes: 100,
  fetchImpl,
});

describe("fetchTrustedText", () => {
  it("reads a same-origin UTF-8 response with manual redirects enabled", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      Promise.resolve(
        new Response("survey", {
          headers: { "Content-Type": "text/html; charset=utf-8" },
        }),
      ),
    );

    await expect(fetchTrustedText(options(fetchImpl))).resolves.toBe("survey");
    expect(fetchImpl).toHaveBeenCalledWith(
      new URL("https://store.steampowered.com/source"),
      expect.objectContaining({ redirect: "manual" }),
    );
  });

  it("rejects a redirect to a different origin", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () =>
      Promise.resolve(
        new Response(null, {
          status: 302,
          headers: { Location: "https://example.com/payload" },
        }),
      ),
    );

    await expect(fetchTrustedText(options(fetchImpl))).rejects.toThrow(
      "not allowlisted",
    );
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("rejects declared and streamed bodies above the byte limit", async () => {
    const declared = vi.fn<typeof fetch>(async () =>
      Promise.resolve(
        new Response("small", {
          headers: {
            "Content-Type": "text/html",
            "Content-Length": "101",
          },
        }),
      ),
    );
    const streamed = vi.fn<typeof fetch>(async () =>
      Promise.resolve(
        new Response("x".repeat(101), {
          headers: { "Content-Type": "text/html" },
        }),
      ),
    );

    await expect(fetchTrustedText(options(declared))).rejects.toThrow("exceeds");
    await expect(fetchTrustedText(options(streamed))).rejects.toThrow("exceeds");
  });

  it("rejects an unexpected MIME type, charset, and invalid UTF-8", async () => {
    const wrongType = vi.fn<typeof fetch>(async () =>
      Promise.resolve(
        new Response("survey", { headers: { "Content-Type": "text/plain" } }),
      ),
    );
    const wrongCharset = vi.fn<typeof fetch>(async () =>
      Promise.resolve(
        new Response("survey", {
          headers: { "Content-Type": "text/html; charset=iso-8859-1" },
        }),
      ),
    );
    const invalidUtf8 = vi.fn<typeof fetch>(async () =>
      Promise.resolve(
        new Response(new Uint8Array([0xff]), {
          headers: { "Content-Type": "text/html" },
        }),
      ),
    );

    await expect(fetchTrustedText(options(wrongType))).rejects.toThrow("not accepted");
    await expect(fetchTrustedText(options(wrongCharset))).rejects.toThrow("charset");
    await expect(fetchTrustedText(options(invalidUtf8))).rejects.toThrow("UTF-8");
  });
});
