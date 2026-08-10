import {
  createNavigatorReaders,
  installNavigatorGetters,
} from "@privacy-brand/refract-core";
import type { BrowserFingerprint } from "@privacy-brand/refract-core";
import { describe, expect, it } from "vitest";

describe("createNavigatorReaders", () => {
  it("reads navigator fingerprint overrides when spoofing stays enabled", () => {
    const readers = createNavigatorReaders(() => ({
      hardwareConcurrency: 8,
      deviceMemory: 16,
      maxTouchPoints: 5,
      platform: "Win32",
      userAgent: "Mozilla/5.0 Example",
      vendor: "Example Vendor",
      appVersion: "5.0 Example",
      spoofingToggles: {
        navigator: true,
      },
    }));

    expect(readers.hardwareConcurrency()).toBe(8);
    expect(readers.deviceMemory()).toBe(16);
    expect(readers.maxTouchPoints()).toBe(5);
    expect(readers.platform()).toBe("Win32");
    expect(readers.userAgent()).toBe("Mozilla/5.0 Example");
    expect(readers.vendor()).toBe("Example Vendor");
    expect(readers.appVersion()).toBe("5.0 Example");
  });

  it("returns undefined when navigator spoofing is disabled", () => {
    const readers = createNavigatorReaders(() => ({
      hardwareConcurrency: 8,
      platform: "Win32",
      spoofingToggles: {
        navigator: false,
      },
    }));

    expect(readers.hardwareConcurrency()).toBeUndefined();
    expect(readers.platform()).toBeUndefined();
  });

  it("re-reads mutable fingerprint state dynamically", () => {
    let fingerprint: BrowserFingerprint | null = {
      platform: "Win32",
      spoofingToggles: {
        navigator: true,
      },
    };
    const readers = createNavigatorReaders(() => fingerprint);

    expect(readers.platform()).toBe("Win32");

    fingerprint = {
      platform: "Linux x86_64",
      spoofingToggles: {
        navigator: true,
      },
    };
    expect(readers.platform()).toBe("Linux x86_64");

    fingerprint = {
      platform: "Linux x86_64",
      spoofingToggles: {
        navigator: false,
      },
    };
    expect(readers.platform()).toBeUndefined();
  });

  it("installs only defined static getters by default", () => {
    const definedProperties: string[] = [];
    const readers = createNavigatorReaders(() => ({
      platform: "Win32",
      spoofingToggles: {
        navigator: true,
      },
    }));

    installNavigatorGetters({
      readers,
      defineGetter: (property) => {
        definedProperties.push(property);
      },
      hasProperty: () => true,
    });

    expect(definedProperties).toEqual(["platform"]);
  });

  it("installs fallback-capable getters even when current value is unset", () => {
    const definedProperties: string[] = [];
    const readers = createNavigatorReaders(() => ({
      spoofingToggles: {
        navigator: true,
      },
    }));

    installNavigatorGetters({
      readers,
      defineGetter: (property) => {
        definedProperties.push(property);
      },
      hasProperty: () => true,
      installFallbackGetters: true,
    });

    expect(definedProperties).toEqual([
      "hardwareConcurrency",
      "deviceMemory",
      "maxTouchPoints",
      "platform",
      "userAgent",
      "vendor",
      "appVersion",
    ]);
  });

  it("skips deviceMemory and maxTouchPoints when the target does not expose them", () => {
    const definedProperties: string[] = [];
    const readers = createNavigatorReaders(() => ({
      deviceMemory: 8,
      maxTouchPoints: 5,
      platform: "Win32",
      spoofingToggles: {
        navigator: true,
      },
    }));

    installNavigatorGetters({
      readers,
      defineGetter: (property) => {
        definedProperties.push(property);
      },
      hasProperty: (property) =>
        property !== "deviceMemory" && property !== "maxTouchPoints",
    });

    expect(definedProperties).toEqual(["platform"]);
  });
});
