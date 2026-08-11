import { describe, expect, it } from "vitest";

import { startProbeServers } from "./probe-server";

describe("startProbeServers", () => {
  it("starts two isolated origins for extension tests", async () => {
    const servers = await startProbeServers({
      primaryPort: 0,
      secondaryPort: 0,
    });

    try {
      expect(new URL(servers.primaryUrl).origin).not.toBe(
        new URL(servers.secondaryUrl).origin,
      );

      const primaryResponse = await fetch(`${servers.primaryUrl}/__test/host`);
      const secondaryResponse = await fetch(`${servers.secondaryUrl}/__test/host`);

      expect(primaryResponse.status).toBe(200);
      expect(secondaryResponse.status).toBe(200);
      await expect(primaryResponse.text()).resolves.toContain("Extension test host");
      await expect(secondaryResponse.text()).resolves.toContain("Extension test host");
    } finally {
      await servers.close();
    }
  });

  it("serves request probes without a privileged control interface", async () => {
    const servers = await startProbeServers({
      primaryPort: 0,
      secondaryPort: 0,
    });

    try {
      const echoResponse = await fetch(
        `${servers.primaryUrl}/api/echo-request?source=harness-test`,
        { headers: { Origin: servers.secondaryUrl } },
      );
      const echo = (await echoResponse.json()) as {
        method: string;
        path: string;
        search: string;
      };

      expect(echo).toEqual(
        expect.objectContaining({
          method: "GET",
          path: "/api/echo-request",
          search: "?source=harness-test",
        }),
      );
      expect(echoResponse.headers.get("access-control-allow-origin")).toBe(
        servers.secondaryUrl,
      );
      expect(echoResponse.headers.get("x-content-type-options")).toBe("nosniff");

      const retiredResponse = await fetch(`${servers.primaryUrl}/qa/`);
      expect(retiredResponse.status).toBe(404);
    } finally {
      await servers.close();
    }
  });

  it("encodes reflected HTML and parses prototype-shaped cookie names safely", async () => {
    const servers = await startProbeServers({
      primaryPort: 0,
      secondaryPort: 0,
    });

    try {
      const htmlResponse = await fetch(`${servers.primaryUrl}/api/echo-request.html`, {
        headers: {
          Cookie: "__proto__=first; constructor=second; duplicate=old; duplicate=new",
          "X-Probe": "<script>alert(1)</script>",
        },
      });
      const html = await htmlResponse.text();

      expect(htmlResponse.headers.get("x-content-type-options")).toBe("nosniff");
      expect(html).not.toContain("<script>alert(1)</script>");
      expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
      expect(html).toContain("&quot;__proto__&quot;: &quot;first&quot;");
      expect(html).toContain("&quot;constructor&quot;: &quot;second&quot;");
      expect(html).toContain("&quot;duplicate&quot;: &quot;new&quot;");
    } finally {
      await servers.close();
    }
  });
});
