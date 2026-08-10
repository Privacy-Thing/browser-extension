// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";

import { RUNTIME_DISABLED_ATTR } from "@/shared/build-id-test-values";

describe("private runtime-disabled latch", () => {
  afterEach(() => {
    document.documentElement.removeAttribute(RUNTIME_DISABLED_ATTR);
    vi.resetModules();
  });

  it("accepts the bootstrap marker before the runtime decision is finalized", async () => {
    document.documentElement.setAttribute(RUNTIME_DISABLED_ATTR, "");
    const { isRuntimeDisabled } =
      await import("@privacy-brand/refract-browser/common/runtime-config");

    expect(isRuntimeDisabled()).toBe(true);
  });

  it("ignores later page mutations after accepting an enabled bootstrap", async () => {
    const { finalizeRuntimeEnabled, isRuntimeDisabled } =
      await import("@privacy-brand/refract-browser/common/runtime-config");
    expect(isRuntimeDisabled()).toBe(false);
    finalizeRuntimeEnabled();

    document.documentElement.setAttribute(RUNTIME_DISABLED_ATTR, "");
    expect(isRuntimeDisabled()).toBe(false);
  });

  it("keeps an accepted disabled decision after the page removes the marker", async () => {
    document.documentElement.setAttribute(RUNTIME_DISABLED_ATTR, "");
    const { isRuntimeDisabled } =
      await import("@privacy-brand/refract-browser/common/runtime-config");
    expect(isRuntimeDisabled()).toBe(true);

    document.documentElement.removeAttribute(RUNTIME_DISABLED_ATTR);
    expect(isRuntimeDisabled()).toBe(true);
  });
});
