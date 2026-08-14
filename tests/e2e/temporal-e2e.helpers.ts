import type { Frame, Page } from "@playwright/test";

type TemporalInstant = {
  epochMilliseconds: number | bigint;
  toLocaleString(
    locales?: string | string[],
    options?: Intl.DateTimeFormatOptions,
  ): string;
};

type TemporalZonedDateTime = {
  timeZoneId: string;
  toLocaleString(
    locales?: string | string[],
    options?: Intl.DateTimeFormatOptions,
  ): string;
};

type NativeTemporal = {
  Instant: {
    from(value: string): TemporalInstant;
  };
  Now: {
    timeZoneId(): string;
    zonedDateTimeISO(timeZone?: string): TemporalZonedDateTime;
  };
  ZonedDateTime: {
    from(value: string): TemporalZonedDateTime;
  };
};

export type TemporalE2ESnapshot =
  | { supported: false }
  | {
      supported: true;
      defaultTimeZone: string;
      explicitTimeZone: string;
      implicitInstantLocale: string;
      profileInstantLocale: string;
      explicitInstantLocale: string;
      nativeExplicitLocale: string;
      instantOptionsAfterCall: string;
      instantOptionsBeforeCall: string;
      implicitZonedLocale: string;
      profileZonedLocale: string;
      explicitZonedLocale: string;
      timeZoneIdSource: string;
    };

export const readTemporalE2ESnapshot = async (
  target: Page | Frame,
): Promise<TemporalE2ESnapshot> =>
  target.evaluate(() => {
    const temporal = (globalThis as typeof globalThis & { Temporal?: NativeTemporal })
      .Temporal;
    if (!temporal) {
      return { supported: false } as const;
    }

    const instant = temporal.Instant.from("2024-01-15T12:34:00Z");
    const instantOptions: Intl.DateTimeFormatOptions = {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    };
    const instantOptionsBeforeCall = JSON.stringify(instantOptions);
    const implicitInstantLocale = instant.toLocaleString(undefined, instantOptions);
    const instantOptionsAfterCall = JSON.stringify(instantOptions);
    const profileInstantLocale = instant.toLocaleString("pl", {
      ...instantOptions,
      timeZone: "Europe/Warsaw",
    });
    const explicitInstantOptions: Intl.DateTimeFormatOptions = {
      ...instantOptions,
      timeZone: "UTC",
    };
    const explicitInstantLocale = instant.toLocaleString(
      "en-US",
      explicitInstantOptions,
    );
    const nativeExplicitLocale = new Intl.DateTimeFormat(
      "en-US",
      explicitInstantOptions,
    ).format(new Date(Number(instant.epochMilliseconds)));

    const zonedDateTime = temporal.ZonedDateTime.from("2024-01-15T12:34:00+00:00[UTC]");

    return {
      supported: true,
      defaultTimeZone: temporal.Now.timeZoneId(),
      explicitTimeZone: temporal.Now.zonedDateTimeISO("UTC").timeZoneId,
      implicitInstantLocale,
      profileInstantLocale,
      explicitInstantLocale,
      nativeExplicitLocale,
      instantOptionsAfterCall,
      instantOptionsBeforeCall,
      implicitZonedLocale: zonedDateTime.toLocaleString(),
      profileZonedLocale: zonedDateTime.toLocaleString("pl"),
      explicitZonedLocale: zonedDateTime.toLocaleString("en-US"),
      timeZoneIdSource: Function.prototype.toString.call(temporal.Now.timeZoneId),
    } as const;
  });
