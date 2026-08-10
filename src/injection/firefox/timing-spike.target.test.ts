import { afterEach, describe, expect, it, vi } from "vitest";

import { installTimingSpike } from "./timing-spike";

describe("installTimingSpike", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("captures readyState and href when hostname matches testHost", () => {
    vi.stubGlobal("location", {
      hostname: "qa.host",
      href: "https://qa.host/main-world-timing",
    });
    vi.stubGlobal("document", { readyState: "loading" });

    installTimingSpike("qa.host", "__gw_test_spike__");

    const marker = (globalThis as Record<string, unknown>)["__gw_test_spike__"] as
      | {
          readyState: string;
          href: string;
        }
      | undefined;

    expect(marker?.readyState).toBe("loading");
    expect(marker?.href).toBe("https://qa.host/main-world-timing");

    const descriptor = Object.getOwnPropertyDescriptor(globalThis, "__gw_test_spike__");
    expect(descriptor?.writable).toBe(false);
    expect(descriptor?.configurable).toBe(false);
    expect(descriptor?.enumerable).toBe(false);
  });

  it("does not set marker when testHost is empty", () => {
    installTimingSpike("", "__gw_test_spike_empty__");
    expect(
      (globalThis as Record<string, unknown>)["__gw_test_spike_empty__"],
    ).toBeUndefined();
  });

  it("does not set marker when hostname does not match testHost", () => {
    vi.stubGlobal("location", {
      hostname: "other.host",
      href: "https://other.host/page",
    });

    installTimingSpike("qa.host", "__gw_test_spike_mismatch__");
    expect(
      (globalThis as Record<string, unknown>)["__gw_test_spike_mismatch__"],
    ).toBeUndefined();
  });
});
