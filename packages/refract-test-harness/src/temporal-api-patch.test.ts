import {
  installTemporalApiPatch,
  type TemporalApiMethodId,
} from "@privacy-brand/refract-core/time/temporal-api-patch";
import { describe, expect, it, vi } from "vitest";

type Call = { args: unknown[]; receiver: unknown };

const createTemporalFixture = () => {
  const calls = new Map<string, Call[]>();
  const record = (key: string, receiver: unknown, args: unknown[]) => {
    const entries = calls.get(key) ?? [];
    entries.push({ args, receiver });
    calls.set(key, entries);
  };
  const now: Record<string, unknown> = {};
  Object.defineProperties(now, {
    instant: {
      configurable: true,
      enumerable: false,
      writable: true,
      value: function instant() {
        record("Now.instant", this, []);
        return { epochNanoseconds: 123n };
      },
    },
    timeZoneId: {
      configurable: true,
      enumerable: false,
      writable: true,
      value: function timeZoneId() {
        record("Now.timeZoneId", this, []);
        return "Native/Zone";
      },
    },
  });
  for (const key of [
    "plainDateTimeISO",
    "zonedDateTimeISO",
    "plainDateISO",
    "plainTimeISO",
  ]) {
    Object.defineProperty(now, key, {
      configurable: true,
      enumerable: false,
      writable: true,
      value: function (timeZone?: unknown) {
        const args = timeZone === undefined ? [] : [timeZone];
        record(`Now.${key}`, this, args);
        return { key, timeZone };
      },
    });
  }

  const temporal: Record<string, unknown> & { Now: typeof now } = { Now: now };
  const instances = new Map<string, { toLocaleString(...args: unknown[]): unknown }>();
  for (const typeName of [
    "Duration",
    "Instant",
    "PlainDate",
    "PlainDateTime",
    "PlainMonthDay",
    "PlainTime",
    "PlainYearMonth",
    "ZonedDateTime",
  ]) {
    const prototype = {};
    Object.defineProperty(prototype, "toLocaleString", {
      configurable: true,
      enumerable: false,
      writable: true,
      value: function toLocaleString(...args: unknown[]) {
        if (!Object.prototype.isPrototypeOf.call(prototype, this)) {
          throw new TypeError("Invalid receiver");
        }
        record(`${typeName}.toLocaleString`, this, args);
        return { args, typeName };
      },
    });
    temporal[typeName] = { prototype };
    instances.set(
      typeName,
      Object.create(prototype) as {
        toLocaleString(...args: unknown[]): unknown;
      },
    );
  }
  return { calls, instances, temporal };
};

describe("Temporal API patch", () => {
  it("uses the profile time zone only for Temporal.Now defaults", () => {
    const fixture = createTemporalFixture();
    const onAccess = vi.fn<(methodId: TemporalApiMethodId) => void>();
    const anchors = installTemporalApiPatch({
      targetGlobal: { Temporal: fixture.temporal },
      defaults: { languages: ["pl-PL", "pl"], timeZone: "Europe/Warsaw" },
      onAccess,
    });

    const now = fixture.temporal.Now as Record<string, (...args: unknown[]) => unknown>;
    expect(now.timeZoneId!()).toBe("Europe/Warsaw");
    expect(now.plainDateTimeISO!()).toEqual({
      key: "plainDateTimeISO",
      timeZone: "Europe/Warsaw",
    });
    expect(now.plainDateTimeISO!("Asia/Tokyo")).toEqual({
      key: "plainDateTimeISO",
      timeZone: "Asia/Tokyo",
    });
    expect(now.instant!()).toEqual({ epochNanoseconds: 123n });
    expect(fixture.calls.get("Now.plainDateTimeISO")?.map((call) => call.args)).toEqual(
      [["Europe/Warsaw"], ["Asia/Tokyo"]],
    );
    expect(anchors).toHaveLength(14);
    expect(onAccess).toHaveBeenCalledWith("temporal.Now.instant");
  });

  it("applies locale defaults and adds a default time zone only to Instant", () => {
    const fixture = createTemporalFixture();
    installTemporalApiPatch({
      targetGlobal: { Temporal: fixture.temporal },
      defaults: { languages: ["pl-PL", "pl"], timeZone: "Europe/Warsaw" },
    });

    fixture.instances.get("PlainDate")!.toLocaleString();
    const explicitOptions = { calendar: "iso8601" };
    fixture.instances.get("Instant")!.toLocaleString("de-DE", explicitOptions);
    fixture.instances.get("ZonedDateTime")!.toLocaleString();

    expect(fixture.calls.get("PlainDate.toLocaleString")?.[0]?.args).toEqual([
      ["pl-PL", "pl"],
    ]);
    const instantArgs = fixture.calls.get("Instant.toLocaleString")?.[0]?.args;
    expect(instantArgs?.[0]).toBe("de-DE");
    expect(instantArgs?.[1]).not.toBe(explicitOptions);
    expect((instantArgs?.[1] as Record<string, unknown>).calendar).toBe("iso8601");
    expect((instantArgs?.[1] as Record<string, unknown>).timeZone).toBe(
      "Europe/Warsaw",
    );
    expect(explicitOptions).toEqual({ calendar: "iso8601" });
    expect(fixture.calls.get("ZonedDateTime.toLocaleString")?.[0]?.args).toEqual([
      ["pl-PL", "pl"],
    ]);
  });

  it("preserves lazy option access and explicit inherited time zones", () => {
    const fixture = createTemporalFixture();
    installTemporalApiPatch({
      targetGlobal: { Temporal: fixture.temporal },
      defaults: { languages: ["pl-PL"], timeZone: "Europe/Warsaw" },
    });

    let unrelatedReads = 0;
    const inheritedOptions = Object.create(
      Object.defineProperty({}, "timeZone", {
        configurable: true,
        value: "UTC",
      }),
    ) as Record<string, unknown>;
    Object.defineProperty(inheritedOptions, "unrelated", {
      enumerable: true,
      get() {
        unrelatedReads += 1;
        return "unused";
      },
    });
    let calendarReceiver: unknown;
    Object.defineProperty(inheritedOptions, "calendar", {
      configurable: true,
      get() {
        calendarReceiver = this;
        return "iso8601";
      },
    });

    fixture.instances.get("Instant")!.toLocaleString("en-US", inheritedOptions);

    const passedOptions = fixture.calls.get("Instant.toLocaleString")?.[0]?.args[1] as
      Record<string, unknown> | undefined;
    expect(passedOptions !== inheritedOptions).toBe(true);
    expect(passedOptions?.timeZone).toBe("UTC");
    expect(passedOptions?.calendar).toBe("iso8601");
    expect(calendarReceiver).toBe(inheritedOptions);
    expect(unrelatedReads).toBe(0);
    expect(Object.hasOwn(inheritedOptions, "timeZone")).toBe(false);

    const nonEnumerableOptions = {};
    Object.defineProperty(nonEnumerableOptions, "timeZone", {
      configurable: true,
      value: "Asia/Tokyo",
    });
    fixture.instances.get("Instant")!.toLocaleString("en-US", nonEnumerableOptions);
    const secondOptions = fixture.calls.get("Instant.toLocaleString")?.[1]?.args[1] as
      Record<string, unknown> | undefined;
    expect(secondOptions?.timeZone).toBe("Asia/Tokyo");
  });

  it("preserves descriptors, receiver errors, and native-looking functions", () => {
    const fixture = createTemporalFixture();
    const prototype = (
      fixture.temporal.Instant as { prototype: Record<string, unknown> }
    ).prototype;
    const before = Object.getOwnPropertyDescriptor(prototype, "toLocaleString")!;
    installTemporalApiPatch({
      targetGlobal: { Temporal: fixture.temporal },
      defaults: { languages: ["en-GB"], timeZone: "Europe/London" },
    });
    const after = Object.getOwnPropertyDescriptor(prototype, "toLocaleString")!;

    expect(after.configurable).toBe(before.configurable);
    expect(after.enumerable).toBe(before.enumerable);
    expect(after.writable).toBe(before.writable);
    expect(Function.prototype.toString.call(after.value)).toContain("[native code]");
    expect(Object.hasOwn(after.value as object, "prototype")).toBe(false);
    expect(Object.getPrototypeOf(after.value)).toBe(
      Object.getPrototypeOf(before.value),
    );
    expect(() => Reflect.construct(after.value as Function, [])).toThrow(TypeError);
    expect(() => Reflect.apply(after.value, {}, [])).toThrow(TypeError);
  });

  it("does not wrap the same Temporal namespace twice", () => {
    const fixture = createTemporalFixture();
    const onAccess = vi.fn<(methodId: TemporalApiMethodId) => void>();
    const options = {
      targetGlobal: { Temporal: fixture.temporal },
      defaults: { languages: ["en-US"], timeZone: "UTC" },
      onAccess,
    };

    const firstAnchors = installTemporalApiPatch(options);
    const installedTimeZoneId = fixture.temporal.Now.timeZoneId;
    const secondAnchors = installTemporalApiPatch(options);

    expect(secondAnchors).toBe(firstAnchors);
    expect(fixture.temporal.Now.timeZoneId).toBe(installedTimeZoneId);
    (fixture.temporal.Now.timeZoneId as () => unknown)();
    expect(onAccess).toHaveBeenCalledTimes(1);
  });

  it("is a safe no-op for missing and partial Temporal implementations", () => {
    expect(
      installTemporalApiPatch({
        targetGlobal: {},
        defaults: { languages: ["en-US"], timeZone: "UTC" },
      }),
    ).toEqual([]);
    expect(
      installTemporalApiPatch({
        targetGlobal: { Temporal: { Now: {} } },
        defaults: { languages: ["en-US"], timeZone: "UTC" },
      }),
    ).toEqual([]);
  });
});
