import { describe, expect, it } from "vitest";

import {
  compareNoticeVersions,
  isCatalogNotificationVersion,
  isNotificationVersion,
} from "@/shared/notification-version";

describe("notification versions", () => {
  it("validates release and beta formats independently", () => {
    expect(isNotificationVersion("release", "0.10.0")).toBe(true);
    expect(isNotificationVersion("release", "0.8.12.10")).toBe(true);
    expect(isNotificationVersion("release", "0.10")).toBe(false);
    expect(isNotificationVersion("beta", "0.2026.720.1530")).toBe(true);
    expect(isNotificationVersion("beta", "0.10.0")).toBe(false);
    expect(isNotificationVersion("beta", "0.2026.231.1200")).toBe(false);
    expect(isNotificationVersion("beta", "0.2026.720.2460")).toBe(false);
    expect(isCatalogNotificationVersion("release", "0.10.0")).toBe(true);
    expect(isCatalogNotificationVersion("release", "0.8.12.10")).toBe(false);
    expect(isCatalogNotificationVersion("beta", "0.2026.720.1530")).toBe(true);
  });

  it("compares numeric segments rather than strings", () => {
    expect(compareNoticeVersions("release", "0.9.9", "0.10.0")).toBe(-1);
    expect(compareNoticeVersions("release", "0.11.0", "0.10.0")).toBe(1);
    expect(compareNoticeVersions("beta", "0.2026.719.2359", "0.2026.720.1")).toBe(-1);
  });

  it("ignores the metadata revision segment for release product versions", () => {
    expect(compareNoticeVersions("release", "0.8.12.9", "0.8.12.10")).toBe(0);
    expect(compareNoticeVersions("release", "0.10.0", "0.10.0.0")).toBe(0);
    expect(compareNoticeVersions("release", "0.10.0", "0.10.0.6")).toBe(0);
    expect(compareNoticeVersions("release", "0.9.2", "0.9.2.1")).toBe(0);
    expect(compareNoticeVersions("release", "0.9.1", "0.9.2.1")).toBe(-1);
    expect(compareNoticeVersions("release", "0.10.0.3", "0.9.2.9")).toBe(1);
  });

  it("does not order invalid versions", () => {
    expect(compareNoticeVersions("release", "local", "0.10.0")).toBeNull();
    expect(compareNoticeVersions("beta", "0.10.0", "0.2026.720.1")).toBeNull();
  });
});
