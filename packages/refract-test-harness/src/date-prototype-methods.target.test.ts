import { createDateMethodDescs, createDateMethods } from "@privacy-brand/refract-core";
import { createIntlDefaults } from "@privacy-brand/refract-core";
import { describe, expect, it, vi } from "vitest";

describe("date-prototype-methods", () => {
  const realDate = new Date(Date.UTC(2026, 0, 15, 12, 34, 56, 789));
  const intlDefaults = createIntlDefaults(["en-US"], "UTC");

  const createMethods = () =>
    createDateMethods({
      NativeDate: Date,
      DateTimeFormat: Intl.DateTimeFormat,
      getTime: (date) => date.getTime(),
      setTime: (date, epochMs) => date.setTime(epochMs),
      getNativeTimezoneOffset: (date) => date.getTimezoneOffset(),
      getMilliseconds: (date) => date.getMilliseconds(),
      localeTimeZone: "UTC",
      intlDefaults,
    });

  it("formats native epochs for locale strings and numeric getters", () => {
    const methods = createMethods();

    expect(methods.getTimezoneOffset.call(realDate)).toBe(0);
    expect(methods.toDateString.call(realDate)).toBe("Thu Jan 15 2026");
    expect(methods.getFullYear.call(realDate)).toBe(2026);
    expect(methods.getMonth.call(realDate)).toBe(0);
    expect(methods.getDate.call(realDate)).toBe(15);
    expect(methods.getDay.call(realDate)).toBe(4);
    expect(methods.getHours.call(realDate)).toBe(12);
    expect(methods.getMinutes.call(realDate)).toBe(34);
    expect(methods.getSeconds.call(realDate)).toBe(56);
    expect(methods.getMilliseconds.call(realDate)).toBe(789);
  });

  it("preserves invalid-date behavior", () => {
    const methods = createMethods();
    const invalidDate = new Date(Number.NaN);

    expect(methods.toString.call(invalidDate)).toBe("Invalid Date");
    expect(methods.toLocaleString.call(invalidDate)).toBe("Invalid Date");
    expect(methods.getFullYear.call(invalidDate)).toBeNaN();
  });

  it("creates masked property descriptors with locale-method arity zero", () => {
    const methods = createMethods();
    const maskAsNative = vi.fn((fn) => fn);
    const createNativeSource = vi.fn((name: string) => `native:${name}`);

    const descriptors = createDateMethodDescs(
      methods,
      maskAsNative,
      createNativeSource,
    );

    expect(Object.keys(descriptors)).toContain("toLocaleString");
    expect(maskAsNative).toHaveBeenCalledWith(
      methods.toLocaleString,
      "native:toLocaleString",
      0,
    );
    expect(maskAsNative).toHaveBeenCalledWith(
      methods.getTimezoneOffset,
      "native:getTimezoneOffset",
    );
    expect(descriptors.getTimezoneOffset).toMatchObject({
      configurable: true,
      enumerable: false,
      writable: true,
    });
    expect(descriptors.toLocaleString).toMatchObject({
      configurable: true,
      enumerable: false,
      writable: true,
    });
  });
});
