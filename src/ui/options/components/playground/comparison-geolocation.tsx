import React from "react";

import { cn } from "@/ui/components/lib/utils";
import { Button } from "@/ui/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/ui/components/ui/tooltip";
import { t } from "@/ui/i18n";
import type {
  GeoReading,
  SystemGeoStatus,
} from "@/ui/options/components/playground/PlaygroundComparisonCards";
import type {
  SpoofedRuntime,
  SystemValues,
} from "@/ui/options/components/playground/snapshot-sim";
import { icon } from "@/ui/options/utils";

export const renderTechnicalLabel = (label: string): React.ReactNode =>
  label.split(/([./()])/).map((part, index) => (
    // eslint-disable-next-line react/no-array-index-key -- split produces empty strings for adjacent separators; index is the only stable identity
    <React.Fragment key={`${part}-${index}`}>
      {part}
      {[".", "/", "(", ")"].includes(part) ? <wbr /> : null}
    </React.Fragment>
  ));

const formatCoords = (lat: number, lng: number, accuracy: number): string => {
  const latDir = lat >= 0 ? "N" : "S";
  const lngDir = lng >= 0 ? "E" : "W";
  return (
    `${Math.abs(lat).toFixed(5)} deg ${latDir}, ` +
    `${Math.abs(lng).toFixed(5)} deg ${lngDir}  (+/-${Math.round(accuracy)} m)`
  );
};

const formatGeoTimestamp = (
  timestamp: number,
  options: { locales?: Intl.LocalesArgument; timeZone?: string } = {},
): string => {
  const formatted = new Intl.DateTimeFormat(options.locales, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short",
    ...(options.timeZone ? { timeZone: options.timeZone } : {}),
  }).format(new Date(timestamp));
  return `${timestamp} (${formatted})`;
};

const getSpoofedGeoValue = (spoofedGeo: GeoReading | null): string =>
  spoofedGeo
    ? formatCoords(spoofedGeo.latitude, spoofedGeo.longitude, spoofedGeo.accuracy)
    : t.demo.waitingForFix;

const getSpoofedOptions = (
  spoofedGeo: GeoReading | null,
): { changed: boolean; mono: boolean } => ({
  changed: Boolean(spoofedGeo),
  mono: Boolean(spoofedGeo),
});

export type DataRowRenderer = (
  label: React.ReactNode,
  localValue: React.ReactNode,
  spoofedValue?: React.ReactNode,
  options?: { changed?: boolean; mono?: boolean; note?: string },
) => React.ReactNode;

export const buildGeoStatusRow = ({
  dataRow,
  spoofedGeo,
  systemGeoStatus,
}: {
  dataRow: DataRowRenderer;
  spoofedGeo: GeoReading | null;
  systemGeoStatus: SystemGeoStatus;
}): React.ReactNode => {
  const labels: Partial<Record<SystemGeoStatus, string>> = {
    loading: t.demo.waitingForPermission,
    denied: t.demo.permissionDenied,
    unavailable: t.demo.geolocationUnavailable,
  };
  const localValue = labels[systemGeoStatus];
  return localValue
    ? dataRow(
        t.demo.comparison.currentPosition,
        localValue,
        getSpoofedGeoValue(spoofedGeo),
        getSpoofedOptions(spoofedGeo),
      )
    : null;
};

export const CellValue = ({
  value,
  changed = false,
  mono = true,
  note,
}: {
  value: string | React.ReactNode;
  changed?: boolean;
  mono?: boolean;
  note?: string;
}) => (
  <div className="space-y-1">
    <div
      className={cn(
        "text-[0.84rem] font-medium break-words whitespace-pre-line text-foreground",
        changed && "text-primary dark:text-primary",
        mono && "font-mono text-[0.80rem]",
      )}
    >
      {value}
    </div>
    {note ? (
      <div className="text-[0.72rem] leading-snug text-muted-foreground">{note}</div>
    ) : null}
  </div>
);

export const renderIdleGeoRow = ({
  cellCn,
  labelCn,
  spoofedGeo,
  valueCn,
}: {
  cellCn: string;
  labelCn: string;
  spoofedGeo: GeoReading | null;
  valueCn: string;
}): React.ReactNode => (
  <tr className="border-b border-border">
    <td className={cn(cellCn, labelCn)}>
      <span className="block break-words [overflow-wrap:anywhere]">
        {renderTechnicalLabel(t.demo.comparison.currentPosition)}
      </span>
    </td>
    {/* eslint-disable-next-line jsx-a11y/control-has-associated-label -- table cell, not a form control */}
    <td className={cn(cellCn, valueCn)}>
      <div className="flex flex-col items-center justify-center gap-2 py-1 text-center text-muted-foreground">
        <div className="space-y-1">
          <p className="text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-muted-foreground/80">
            {t.demo.requestRealLocationHintTitle}
          </p>
          <p className="text-xs leading-relaxed text-muted-foreground/80">
            {t.demo.requestRealLocationTableHint}
          </p>
        </div>
      </div>
    </td>
    <td className={cn(cellCn, valueCn)}>
      {spoofedGeo ? (
        <CellValue
          value={formatCoords(
            spoofedGeo.latitude,
            spoofedGeo.longitude,
            spoofedGeo.accuracy,
          )}
          changed
        />
      ) : (
        <CellValue value={t.demo.waitingForFix} mono={false} />
      )}
    </td>
  </tr>
);

export const renderGrantedGeoRows = ({
  dataRow,
  runtime,
  spoofedGeo,
  systemGeo,
  systemValues,
}: {
  dataRow: DataRowRenderer;
  runtime: SpoofedRuntime;
  spoofedGeo: GeoReading | null;
  systemGeo: GeoReading;
  systemValues: SystemValues;
}): React.ReactNode => (
  <>
    {dataRow(
      t.demo.comparison.coords,
      formatCoords(systemGeo.latitude, systemGeo.longitude, systemGeo.accuracy),
      getSpoofedGeoValue(spoofedGeo),
      { changed: Boolean(spoofedGeo), mono: true },
    )}
    {dataRow(
      <span className="inline-flex items-center gap-1.5">
        <span>{renderTechnicalLabel(t.demo.comparison.timestamp)}</span>
        <TooltipProvider delayDuration={150}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                aria-label={t.demo.comparison.timestampInfoLabel}
                className="rounded-full"
              >
                {icon("fa-circle-info", "text-[0.75rem]")}
              </Button>
            </TooltipTrigger>
            <TooltipContent className="max-w-72 px-3 py-2 text-xs leading-relaxed">
              {t.demo.comparison.timestampTooltip}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </span>,
      formatGeoTimestamp(systemGeo.timestamp, {
        locales: systemValues.languages,
        timeZone: systemValues.timeZone,
      }),
      spoofedGeo
        ? formatGeoTimestamp(spoofedGeo.timestamp, {
            locales: runtime.locale.languages,
            timeZone: runtime.locale.timeZone,
          })
        : "-",
      { changed: Boolean(spoofedGeo), mono: true },
    )}
  </>
);
