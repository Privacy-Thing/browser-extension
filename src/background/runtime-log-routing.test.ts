import { describe, expect, it } from "vitest";

import { resolveLogCategory } from "@/background/runtime-log-routing";
import { LogCategory } from "@/shared/types";

describe("runtime-log-routing", () => {
  it("maps geo-related runtime events", () => {
    expect(resolveLogCategory("Geolocation.getCurrentPosition")).toBe(LogCategory.Geo);
    expect(resolveLogCategory("Permissions.query [geolocation]")).toBe(LogCategory.Geo);
  });

  it("maps locale-related runtime events", () => {
    expect(resolveLogCategory("Intl.DateTimeFormat")).toBe(LogCategory.Locale);
    expect(resolveLogCategory("Locale.get language")).toBe(LogCategory.Locale);
    expect(resolveLogCategory("Navigator.get userAgent")).toBe(LogCategory.Locale);
    expect(resolveLogCategory("ClientHints.getHighEntropyValues")).toBe(
      LogCategory.Locale,
    );
  });

  it("falls back to system for other runtime events", () => {
    expect(resolveLogCategory("Canvas.toDataURL")).toBe(LogCategory.System);
    expect(resolveLogCategory("Worker.compatibility-csp-blocked")).toBe(
      LogCategory.System,
    );
  });
});
