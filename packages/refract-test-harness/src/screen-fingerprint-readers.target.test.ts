import { createScreenReaders } from "@privacy-brand/refract-core";
import type { RuntimeSnapshot } from "@privacy-brand/refract-core";
import { describe, expect, it } from "vitest";

const buildFingerprint = (
  screen: NonNullable<NonNullable<RuntimeSnapshot["fingerprint"]>["screen"]> | null,
  enabled = true,
): RuntimeSnapshot["fingerprint"] => ({
  screen: screen ?? undefined,
  spoofingToggles: enabled ? { screen: true } : { screen: false },
});

describe("createScreenReaders", () => {
  it("uses explicit spoofed values when present", () => {
    const readers = createScreenReaders({
      getFingerprint: () =>
        buildFingerprint({
          width: 1440,
          height: 900,
          availWidth: 1420,
          availHeight: 860,
          colorDepth: 24,
          pixelDepth: 30,
          devicePixelRatio: 2,
        }),
      nativeReaders: {
        width: () => 1,
        height: () => 1,
        availWidth: () => 1,
        availHeight: () => 1,
        colorDepth: () => 1,
        pixelDepth: () => 1,
        devicePixelRatio: () => 1,
      },
    });

    expect(readers.width()).toBe(1440);
    expect(readers.availWidth()).toBe(1420);
    expect(readers.availHeight()).toBe(860);
    expect(readers.pixelDepth()).toBe(30);
    expect(readers.devicePixelRatio()).toBe(2);
  });

  it("derives fallback values from spoofed screen config when explicit values are absent", () => {
    const readers = createScreenReaders({
      getFingerprint: () =>
        buildFingerprint({
          width: 1280,
          height: 30,
          colorDepth: 24,
        }),
      nativeReaders: {
        width: () => 1,
        height: () => 1,
        availWidth: () => 2,
        availHeight: () => 3,
        colorDepth: () => 4,
        pixelDepth: () => 5,
        devicePixelRatio: () => 6,
      },
      deriveAvailHeight: (screenConfig) =>
        typeof screenConfig.height === "number"
          ? Math.max(0, screenConfig.height - 40)
          : null,
    });

    expect(readers.availWidth()).toBe(1280);
    expect(readers.availHeight()).toBe(0);
    expect(readers.pixelDepth()).toBe(24);
  });

  it("falls back to native readers when spoofing is disabled", () => {
    const readers = createScreenReaders({
      getFingerprint: () =>
        buildFingerprint(
          {
            width: 1440,
            height: 900,
            colorDepth: 24,
            devicePixelRatio: 2,
          },
          false,
        ),
      nativeReaders: {
        width: () => 800,
        height: () => 600,
        availWidth: () => 790,
        availHeight: () => 590,
        colorDepth: () => 16,
        pixelDepth: () => 16,
        devicePixelRatio: () => 1,
      },
    });

    expect(readers.width()).toBe(800);
    expect(readers.availWidth()).toBe(790);
    expect(readers.devicePixelRatio()).toBe(1);
  });
});
