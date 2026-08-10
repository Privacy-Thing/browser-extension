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

      const retiredResponse = await fetch(`${servers.primaryUrl}/qa/`);
      expect(retiredResponse.status).toBe(404);
    } finally {
      await servers.close();
    }
  });
});
