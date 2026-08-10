import { afterEach, describe, expect, it, vi } from "vitest";

import {
  formatLocalTimestamp,
  formatUtcTimestamp,
  resolveBuildMetadata,
  toManifestVersion,
} from "../../scripts/resolve-build-metadata.mjs";

describe("resolveBuildMetadata", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("builds release metadata from semver", () => {
    expect(
      resolveBuildMetadata({
        channel: "release",
        releaseVersion: "1.2.3",
      }),
    ).toEqual({
      channel: "release",
      releaseVersion: "1.2.3",
      buildTimestamp: "",
      displayVersion: "1.2.3",
      manifestVersion: "1.2.3",
      artifactVersionLabel: "v1.2.3",
    });
  });

  it("builds beta metadata from a UTC timestamp", () => {
    expect(
      resolveBuildMetadata({
        channel: "beta",
        timestamp: "20260330_184512",
      }),
    ).toEqual({
      channel: "beta",
      releaseVersion: "",
      buildTimestamp: "20260330_184512",
      displayVersion: "0.2026.330.1845-beta",
      manifestVersion: "0.2026.330.1845",
      artifactVersionLabel: "beta-20260330_184512",
    });
  });

  it("normalizes legacy next metadata to beta", () => {
    const metadata = resolveBuildMetadata({
      channel: "next",
      timestamp: "20260330_184512",
    });

    expect(metadata.channel).toBe("beta");
    expect(metadata.displayVersion).toBe("0.2026.330.1845-beta");
    expect(metadata.artifactVersionLabel).toBe("beta-20260330_184512");
  });

  it("builds local metadata from a local timestamp", () => {
    const metadata = resolveBuildMetadata({
      channel: "local",
      timestamp: "20260330_184512",
    });

    expect(metadata.displayVersion).toBe("0.2026.330.1845-local");
    expect(metadata.manifestVersion).toBe("0.2026.330.1845");
    expect(metadata.artifactVersionLabel).toBe("local-20260330_184512");
  });

  it("uses the timestamp supplied through the build environment", () => {
    vi.stubEnv("PT_BUILD_CHANNEL", "beta");
    vi.stubEnv("PT_BUILD_TIMESTAMP", "20260330_184512");

    expect(resolveBuildMetadata().artifactVersionLabel).toBe("beta-20260330_184512");
  });

  it("uses Chrome-compatible numeric manifest versions for timestamped builds", () => {
    expect(toManifestVersion("20261231_235959")).toBe("0.2026.1231.2359");
    expect(toManifestVersion("20260407_021245")).toBe("0.2026.407.212");
  });

  it("formats UTC timestamps predictably", () => {
    expect(formatUtcTimestamp(new Date(Date.UTC(2026, 2, 30, 18, 45, 12)))).toBe(
      "20260330_184512",
    );
  });

  it("formats local timestamps predictably", () => {
    const date = new Date(2026, 2, 30, 18, 45, 12);

    expect(formatLocalTimestamp(date)).toBe("20260330_184512");
  });
});
