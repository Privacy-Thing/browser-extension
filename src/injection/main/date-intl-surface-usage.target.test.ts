import { afterEach, describe, expect, it, vi } from "vitest";

import type { RuntimeSnapshot } from "@/shared/types";

const mocks = vi.hoisted(() => ({
  markSurfaceUsed: vi.fn(),
}));

vi.mock("@privacy-brand/refract-browser/common/surface-usage-emitter", () => ({
  markSurfaceUsed: mocks.markSurfaceUsed,
}));

const ORIGINAL_DATE = globalThis.Date;
const NATIVE_DATE_DESCRIPTORS = {
  getTimezoneOffset: Object.getOwnPropertyDescriptor(
    ORIGINAL_DATE.prototype,
    "getTimezoneOffset",
  ),
  toString: Object.getOwnPropertyDescriptor(ORIGINAL_DATE.prototype, "toString"),
  toLocaleString: Object.getOwnPropertyDescriptor(
    ORIGINAL_DATE.prototype,
    "toLocaleString",
  ),
};
const NATIVE_INTL_CTORS = {
  DateTimeFormat: Intl.DateTimeFormat,
  NumberFormat: Intl.NumberFormat,
};
const NATIVE_INTL_DESCRIPTORS = {
  DateTimeFormatResolvedOptions: Object.getOwnPropertyDescriptor(
    Intl.DateTimeFormat.prototype,
    "resolvedOptions",
  ),
  DateTimeFormatFormat: Object.getOwnPropertyDescriptor(
    Intl.DateTimeFormat.prototype,
    "format",
  ),
  NumberFormatResolvedOptions: Object.getOwnPropertyDescriptor(
    Intl.NumberFormat.prototype,
    "resolvedOptions",
  ),
};

const restoreDescriptor = (
  target: object,
  property: PropertyKey,
  descriptor: PropertyDescriptor | undefined,
): void => {
  if (descriptor) {
    Object.defineProperty(target, property, descriptor);
  }
};

const buildSnapshot = (): RuntimeSnapshot => ({
  geo: {
    latitude: 52.2297,
    longitude: 21.0122,
    accuracy: 25,
    noiseRadius: 50,
  },
  locale: {
    language: "pl-PL",
    languages: ["pl-PL", "pl"],
    timeZone: "Europe/Warsaw",
    acceptLanguage: "pl-PL,pl;q=0.9",
  },
  date: {
    baseEpochMs: Date.UTC(2026, 0, 15, 12, 0, 0),
    offsetMs: 60 * 60 * 1000,
    timeZone: "Europe/Warsaw",
  },
  debugMode: false,
  watchPositionDelay: [100, 200],
  geolocationEnabled: true,
  timeLocaleEnabled: true,
});

afterEach(() => {
  globalThis.Date = ORIGINAL_DATE;
  restoreDescriptor(
    ORIGINAL_DATE.prototype,
    "getTimezoneOffset",
    NATIVE_DATE_DESCRIPTORS.getTimezoneOffset,
  );
  restoreDescriptor(
    ORIGINAL_DATE.prototype,
    "toString",
    NATIVE_DATE_DESCRIPTORS.toString,
  );
  restoreDescriptor(
    ORIGINAL_DATE.prototype,
    "toLocaleString",
    NATIVE_DATE_DESCRIPTORS.toLocaleString,
  );

  Object.defineProperty(Intl, "DateTimeFormat", {
    configurable: true,
    writable: true,
    value: NATIVE_INTL_CTORS.DateTimeFormat,
  });
  Object.defineProperty(Intl, "NumberFormat", {
    configurable: true,
    writable: true,
    value: NATIVE_INTL_CTORS.NumberFormat,
  });
  restoreDescriptor(
    NATIVE_INTL_CTORS.DateTimeFormat.prototype,
    "resolvedOptions",
    NATIVE_INTL_DESCRIPTORS.DateTimeFormatResolvedOptions,
  );
  restoreDescriptor(
    NATIVE_INTL_CTORS.DateTimeFormat.prototype,
    "format",
    NATIVE_INTL_DESCRIPTORS.DateTimeFormatFormat,
  );
  restoreDescriptor(
    NATIVE_INTL_CTORS.NumberFormat.prototype,
    "resolvedOptions",
    NATIVE_INTL_DESCRIPTORS.NumberFormatResolvedOptions,
  );

  mocks.markSurfaceUsed.mockReset();
  vi.resetModules();
});

describe("Date/Intl surface usage", () => {
  it("counts Date static and prototype calls as timeLocale usage", async () => {
    const { installDatePatch } = await import("@/injection/main/date-intl-patch");

    installDatePatch(buildSnapshot());
    mocks.markSurfaceUsed.mockClear();

    Date.now();
    Date.parse("2026-01-15");
    new Date("2026-01-15T12:00:00.000Z").getTimezoneOffset();

    expect(mocks.markSurfaceUsed.mock.calls.length).toBeGreaterThanOrEqual(4);
    expect(
      mocks.markSurfaceUsed.mock.calls.every(([category]) => category === "timeLocale"),
    ).toBe(true);
    expect(mocks.markSurfaceUsed).toHaveBeenCalledWith("timeLocale", "date.now");
    expect(mocks.markSurfaceUsed).toHaveBeenCalledWith("timeLocale", "date.parse");
    expect(mocks.markSurfaceUsed).toHaveBeenCalledWith(
      "timeLocale",
      "date.getTimezoneOffset",
    );
  });

  it("counts Intl construction, resolvedOptions, and DateTimeFormat output as timeLocale usage", async () => {
    const { installIntlPatch } = await import("@/injection/main/date-intl-patch");

    installIntlPatch(buildSnapshot());
    mocks.markSurfaceUsed.mockClear();

    const formatter = new Intl.DateTimeFormat();
    formatter.resolvedOptions();
    formatter.format(new Date("2026-01-15T12:00:00.000Z"));
    formatter.formatToParts(new Date("2026-01-15T12:00:00.000Z"));

    expect(mocks.markSurfaceUsed).toHaveBeenCalledTimes(4);
    expect(mocks.markSurfaceUsed).toHaveBeenCalledWith(
      "timeLocale",
      "intl.constructor",
    );
    expect(mocks.markSurfaceUsed).toHaveBeenCalledWith(
      "timeLocale",
      "intl.resolvedOptions",
    );
    expect(mocks.markSurfaceUsed).toHaveBeenCalledWith(
      "timeLocale",
      "intl.DateTimeFormat.format",
    );
    expect(mocks.markSurfaceUsed).toHaveBeenCalledWith(
      "timeLocale",
      "intl.DateTimeFormat.formatToParts",
    );
  });
});
