/** Runtime snapshot capture via Playwright. */

import { existsSync } from "node:fs";

import { CacheManager } from "../cache/cache-manager.js";
import { firefoxBuildDir } from "../repo-paths.js";
import type { Config, ValueProbe } from "../types.js";

import { buildSnapshotCacheKey, deriveChromiumExtId } from "./snapshot-cache.js";
import { captureChromiumSpoofed, captureChromiumVanilla } from "./snapshot-chromium.js";
import { captureFirefoxSpoofed, captureFirefoxVanilla } from "./snapshot-firefox.js";
export type { SnapshotRuntimeActivator } from "./snapshot-fixtures.js";
import { closeServer, startTestServer } from "./snapshot-server.js";
import type { BrowserSnapshotPair, SnapshotResult } from "./snapshot-types.js";

export type { BrowserSnapshotPair, SnapshotResult } from "./snapshot-types.js";
export { buildSnapshotCacheKey, deriveChromiumExtId };

const filterProbes = (
  probes: ValueProbe[],
  target: "chromium" | "firefox",
): ValueProbe[] =>
  probes.filter((probe) => !probe.targets || probe.targets.includes(target));

export const captureSnapshots = async (config: Config): Promise<SnapshotResult> => {
  const cacheKey = `snapshot-${buildSnapshotCacheKey(config)}`;
  const cached = CacheManager.get<SnapshotResult>(cacheKey);
  if (cached) {
    console.log(
      "  Using cached snapshots (run with --clear-cache to force fresh capture).",
    );
    return cached;
  }

  const { url: serverUrl, server } = await startTestServer();
  console.log(`  Test server: ${serverUrl}`);
  try {
    const probes = config.valueProbes ?? [];
    const chromiumProbes = filterProbes(probes, "chromium");
    console.log("  Capturing Chromium vanilla snapshot...");
    const vanilla = await captureChromiumVanilla(
      serverUrl,
      config.apiSurfaces,
      chromiumProbes,
    );
    console.log("  Capturing Chromium spoofed snapshot...");
    const spoofed = await captureChromiumSpoofed(
      serverUrl,
      config.apiSurfaces,
      chromiumProbes,
    );
    const chromium: BrowserSnapshotPair = {
      vanilla: vanilla.descriptors,
      spoofed: spoofed.descriptors,
      vanillaProbes: vanilla.probes,
      spoofedProbes: spoofed.probes,
    };
    const result: SnapshotResult = { chromium };

    if (existsSync(firefoxBuildDir)) {
      const firefoxProbes = filterProbes(probes, "firefox");
      console.log("  Capturing Firefox vanilla snapshot...");
      const fxVanilla = await captureFirefoxVanilla(
        serverUrl,
        config.apiSurfaces,
        firefoxProbes,
      );
      console.log("  Capturing Firefox spoofed snapshot...");
      const fxSpoofed = await captureFirefoxSpoofed(
        serverUrl,
        config.apiSurfaces,
        firefoxProbes,
      );
      result.firefox = {
        vanilla: fxVanilla.descriptors,
        spoofed: fxSpoofed.descriptors,
        vanillaProbes: fxVanilla.probes,
        spoofedProbes: fxSpoofed.probes,
      };
    } else {
      console.log(
        "  Firefox build not found — skipping Firefox snapshot. Run 'pnpm task build:firefox' to include Firefox coverage.",
      );
    }

    CacheManager.set(cacheKey, result);
    return result;
  } finally {
    await closeServer(server);
  }
};
