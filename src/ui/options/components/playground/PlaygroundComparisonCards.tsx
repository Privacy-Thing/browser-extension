import React, { memo, useEffect, useMemo, useState } from "react";

import { cn } from "@/ui/components/lib/utils";
import { Card, CardContent } from "@/ui/components/ui/card";
import { t } from "@/ui/i18n";
import {
  buildGeoStatusRow,
  CellValue,
  type DataRowRenderer,
  renderGrantedGeoRows,
  renderIdleGeoRow,
  renderTechnicalLabel,
} from "@/ui/options/components/playground/comparison-geolocation";
import {
  buildNetworkRows,
  getBrowserVersionToken,
} from "@/ui/options/components/playground/comparison-network";
import {
  buildComparisonRows,
  type LocalFingerprintState,
} from "@/ui/options/components/playground/fingerprint-comparison";
import type {
  SpoofedDateValues,
  SpoofedRuntime,
  SystemValues,
} from "@/ui/options/components/playground/snapshot-sim";

export type GeoReading = {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
};

export type SystemGeoStatus = "idle" | "loading" | "granted" | "denied" | "unavailable";

export type ComparisonCardsProps = {
  runtime: SpoofedRuntime | null;
  selectedLocationLabel: string | null;
  systemValues: SystemValues;
  localFingerprint: LocalFingerprintState;
  spoofedGeo: GeoReading | null;
  systemGeoStatus: SystemGeoStatus;
  systemGeo: GeoReading | null;
};

const formatUtcOffset = (offsetMinutes: number): string => {
  if (offsetMinutes === 0) return "UTC+00:00";
  const absMin = Math.abs(offsetMinutes);
  const h = String(Math.floor(absMin / 60)).padStart(2, "0");
  const m = String(absMin % 60).padStart(2, "0");
  const sign = offsetMinutes < 0 ? "+" : "-";
  return `UTC${sign}${h}:${m}`;
};

const formatLanguages = (langs: readonly string[]): string => [...langs].join(", ");

const buildLiveDateFields = (
  date: Pick<
    SpoofedDateValues,
    | "getTimezoneOffset"
    | "toDateString"
    | "toLocaleDateString"
    | "toLocaleString"
    | "toLocaleTimeString"
    | "toString"
    | "toTimeString"
  >,
) => ({
  dateString: date.toString(),
  dateToDateString: date.toDateString(),
  dateToTimeString: date.toTimeString(),
  dateLocaleString: date.toLocaleString(),
  dateLocaleDateString: date.toLocaleDateString(),
  dateLocaleTimeString: date.toLocaleTimeString(),
  timezoneOffset: date.getTimezoneOffset(),
});

const getCellValueNoteProps = (
  note: string | undefined,
): { note: string } | Record<string, never> => (note === undefined ? {} : { note });

const getSpoofedTitleClassName = (
  selectedLocationLabel: string | null,
  defaultClassName: string,
): string =>
  selectedLocationLabel
    ? "pb-3 pt-4 text-left text-sm font-semibold uppercase tracking-wider text-primary"
    : defaultClassName;

const buildRowOptions = (row: {
  changed: boolean;
  mono?: boolean;
  note?: string;
}): { changed: boolean; mono?: boolean; note?: string } =>
  row.mono === undefined
    ? {
        changed: row.changed,
        ...(getCellValueNoteProps(row.note) as { note?: string }),
      }
    : {
        changed: row.changed,
        mono: row.mono,
        ...(getCellValueNoteProps(row.note) as { note?: string }),
      };

type DataRowOptions = { changed?: boolean; mono?: boolean; note?: string };
type DataRowProps = {
  hasSpoofed: boolean;
  label: React.ReactNode;
  localValue: React.ReactNode;
  options?: DataRowOptions | undefined;
  spoofedValue?: React.ReactNode;
};

const CELL_CN = "py-2.5 align-top";
const LABEL_CN = "text-[0.78rem] text-muted-foreground font-mono pr-4";
const VALUE_CN = "px-3";
const HEADER_CN =
  "text-xs font-bold uppercase tracking-wider text-muted-foreground pb-3 pt-4 text-left";

const DataRow = ({
  hasSpoofed,
  label,
  localValue,
  options,
  spoofedValue,
}: DataRowProps) => (
  <tr className="border-b border-border last:border-0">
    <td className={cn(CELL_CN, LABEL_CN)}>
      <span className="block break-words [overflow-wrap:anywhere]">
        {typeof label === "string" ? renderTechnicalLabel(label) : label}
      </span>
    </td>
    <td className={cn(CELL_CN, VALUE_CN)}>
      <CellValue value={localValue} mono={options?.mono ?? true} />
    </td>
    {hasSpoofed ? (
      <td className={cn(CELL_CN, VALUE_CN)}>
        <CellValue
          value={spoofedValue ?? "-"}
          changed={options?.changed ?? false}
          mono={options?.mono ?? true}
          {...getCellValueNoteProps(options?.note)}
        />
      </td>
    ) : null}
  </tr>
);

const SectionRow = ({ first = false, label }: { first?: boolean; label: string }) => (
  <tr className={cn(!first && "border-t border-border")}>
    <td colSpan={3} className="pt-4 pb-1">
      <span className="text-sm font-semibold text-foreground">{label}</span>
    </td>
  </tr>
);

type DateFields = ReturnType<typeof buildLiveDateFields>;

const LocaleRows = ({
  liveSpoofed,
  liveSystem,
  runtime,
  systemValues,
}: {
  liveSpoofed: DateFields;
  liveSystem: DateFields;
  runtime: SpoofedRuntime;
  systemValues: SystemValues;
}) => (
  <>
    <SectionRow label={t.demo.sections.localeDate} first />
    <DataRow
      hasSpoofed
      label={t.demo.comparison.language}
      localValue={systemValues.language}
      spoofedValue={runtime.locale.language}
      options={{ changed: runtime.locale.language !== systemValues.language }}
    />
    <DataRow
      hasSpoofed
      label={t.demo.comparison.languages}
      localValue={formatLanguages(systemValues.languages)}
      spoofedValue={formatLanguages(runtime.locale.languages)}
      options={{
        changed:
          formatLanguages(runtime.locale.languages) !==
          formatLanguages(systemValues.languages),
      }}
    />
    <DataRow
      hasSpoofed
      label={t.demo.comparison.timeZone}
      localValue={systemValues.timeZone}
      spoofedValue={runtime.locale.timeZone}
      options={{ changed: runtime.locale.timeZone !== systemValues.timeZone }}
    />
    <DataRow
      hasSpoofed
      label={t.demo.comparison.timeZoneOffset}
      localValue={`${liveSystem.timezoneOffset} min (${formatUtcOffset(liveSystem.timezoneOffset)})`}
      spoofedValue={`${liveSpoofed.timezoneOffset} min (${formatUtcOffset(liveSpoofed.timezoneOffset)})`}
      options={{ changed: liveSpoofed.timezoneOffset !== liveSystem.timezoneOffset }}
    />
    {(
      [
        [t.demo.comparison.dateToString, "dateString"],
        [t.demo.comparison.dateToDateString, "dateToDateString"],
        [t.demo.comparison.dateToTimeString, "dateToTimeString"],
        [t.demo.comparison.dateLocaleString, "dateLocaleString"],
        [t.demo.comparison.dateLocaleDateString, "dateLocaleDateString"],
        [t.demo.comparison.dateLocaleTimeString, "dateLocaleTimeString"],
      ] as const
    ).map(([label, valueKey]) => (
      <DataRow
        key={valueKey}
        hasSpoofed
        label={label}
        localValue={liveSystem[valueKey]}
        spoofedValue={liveSpoofed[valueKey]}
        options={{ changed: liveSpoofed[valueKey] !== liveSystem[valueKey] }}
      />
    ))}
  </>
);

const NetworkRows = ({ rows }: { rows: ReturnType<typeof buildNetworkRows> }) => (
  <>
    <SectionRow label={t.demo.sections.networkHeaders} />
    {rows.map((row) => (
      <DataRow
        key={row.id}
        hasSpoofed
        label={row.label}
        localValue={row.localValue}
        spoofedValue={row.spoofedValue}
        options={buildRowOptions(row)}
      />
    ))}
  </>
);

const GeoRows = ({
  runtime,
  spoofedGeo,
  systemGeo,
  systemGeoStatus,
  systemValues,
}: Pick<
  ComparisonCardsProps,
  "runtime" | "spoofedGeo" | "systemGeo" | "systemGeoStatus" | "systemValues"
>) => {
  if (!runtime) return null;
  const dataRow: DataRowRenderer = (label, localValue, spoofedValue, options) => (
    <DataRow
      hasSpoofed
      label={label}
      localValue={localValue}
      spoofedValue={spoofedValue}
      options={options}
    />
  );
  return (
    <>
      <SectionRow label={t.demo.sections.geolocation} />
      {systemGeoStatus === "idle"
        ? renderIdleGeoRow({
            cellCn: CELL_CN,
            labelCn: LABEL_CN,
            spoofedGeo,
            valueCn: VALUE_CN,
          })
        : null}
      {buildGeoStatusRow({ dataRow, spoofedGeo, systemGeoStatus })}
      {systemGeoStatus === "granted" && systemGeo
        ? renderGrantedGeoRows({
            dataRow,
            runtime,
            spoofedGeo,
            systemGeo,
            systemValues,
          })
        : null}
    </>
  );
};

const getComparisonLabels = () => ({
  userAgent: t.demo.comparison.userAgent,
  appVersion: t.demo.comparison.appVersion,
  vendor: t.demo.comparison.vendor,
  hardwareConcurrency: t.demo.comparison.hardwareConcurrency,
  deviceMemory: t.demo.comparison.deviceMemory,
  platform: t.demo.comparison.platform,
  clientHintPlatformVersion: t.demo.comparison.clientHintPlatformVersion,
  clientHintArchitecture: t.demo.comparison.clientHintArchitecture,
  clientHintBitness: t.demo.comparison.clientHintBitness,
  clientHintModel: t.demo.comparison.clientHintModel,
  clientHintMobile: t.demo.comparison.clientHintMobile,
  devicePixelRatio: t.demo.comparison.devicePixelRatio,
  pixelDepth: t.demo.comparison.pixelDepth,
  screenMetrics: t.demo.comparison.screenMetrics,
  canvas2d: t.demo.comparison.canvas2d,
  webglRenderer: t.demo.comparison.webglRenderer,
  webglDebugExtension: t.demo.comparison.webglDebugExtension,
  webglReadPixels: t.demo.comparison.webglReadPixels,
  audioFingerprint: t.demo.comparison.audioFingerprint,
  clientHintBrands: t.demo.comparison.clientHintBrands,
  clientHintFullVersionList: t.demo.comparison.clientHintFullVersionList,
  clientHintPlatform: t.demo.comparison.clientHintPlatform,
  webRTCIcePolicy: t.demo.comparison.webRTCIcePolicy,
});

const SECTION_BY_ROW_ID = {
  userAgent: "browserFingerprint",
  appVersion: "browserFingerprint",
  vendor: "browserFingerprint",
  hardwareConcurrency: "browserFingerprint",
  deviceMemory: "browserFingerprint",
  platform: "browserFingerprint",
  clientHintBrands: "browserFingerprint",
  clientHintPlatform: "browserFingerprint",
  clientHintPlatformVersion: "browserFingerprint",
  clientHintArchitecture: "browserFingerprint",
  clientHintBitness: "browserFingerprint",
  clientHintModel: "browserFingerprint",
  clientHintMobile: "browserFingerprint",
  clientHintFullVersionList: "browserFingerprint",
  canvas2d: "webglCanvas",
  webglRenderer: "webglCanvas",
  webglDebugExtension: "webglCanvas",
  webglReadPixels: "webglCanvas",
  screenMetrics: "screen",
  devicePixelRatio: "screen",
  pixelDepth: "screen",
  audioFingerprint: "audio",
  webRTCIcePolicy: "webRTC",
} as const;

const FingerprintRows = ({
  rows,
}: {
  rows: ReturnType<typeof buildComparisonRows>;
}) => {
  const labels = getComparisonLabels();
  const sections = {
    browserFingerprint: t.demo.sections.browserFingerprint,
    webglCanvas: t.demo.sections.webglCanvas,
    screen: t.demo.sections.screen,
    audio: t.demo.sections.audio,
    networkHeaders: t.demo.sections.networkHeaders,
    webRTC: t.demo.sections.webRTC,
  } as const;
  return rows.map((row, index) => {
    const currentSection = SECTION_BY_ROW_ID[row.id];
    const previousSection = index > 0 ? SECTION_BY_ROW_ID[rows[index - 1]!.id] : null;
    return (
      <React.Fragment key={row.id}>
        {currentSection !== previousSection ? (
          <SectionRow label={sections[currentSection]} />
        ) : null}
        <DataRow
          hasSpoofed
          label={labels[row.id]}
          localValue={row.localValue}
          spoofedValue={row.spoofedValue}
          options={buildRowOptions(row)}
        />
      </React.Fragment>
    );
  });
};

const useComparisonData = ({
  localFingerprint,
  runtime,
  systemValues,
}: Pick<ComparisonCardsProps, "localFingerprint" | "runtime" | "systemValues">) => {
  const [tick, setTick] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setTick(Date.now()), 1_000);
    return () => window.clearInterval(id);
  }, []);
  const liveSystem = useMemo(() => buildLiveDateFields(new Date(tick)), [tick]);
  const liveSpoofed = runtime ? buildLiveDateFields(runtime.date) : null;
  const browserVersionNote = useMemo(
    () =>
      t.demo.comparison.browserVersionNote(
        getBrowserVersionToken(runtime, localFingerprint),
      ),
    [localFingerprint, runtime],
  );
  const fingerprintRows = useMemo(
    () =>
      buildComparisonRows({
        local: localFingerprint,
        runtimeFingerprint: runtime?.fingerprint,
        pendingLabel: t.demo.comparison.probePending,
        notAvailableLabel: t.demo.comparison.notAvailable,
        matchingLocalNote: t.demo.comparison.spoofedMatchesLocal,
        browserVersionNote,
      }),
    [browserVersionNote, localFingerprint, runtime],
  );
  const networkRows = useMemo(
    () =>
      buildNetworkRows({
        browserVersionNote,
        localFingerprint,
        runtime,
        systemAcceptLanguage: systemValues.acceptLanguage,
      }),
    [browserVersionNote, localFingerprint, runtime, systemValues.acceptLanguage],
  );
  return { fingerprintRows, liveSpoofed, liveSystem, networkRows };
};

const ComparisonTable = ({
  data,
  props,
}: {
  data: ReturnType<typeof useComparisonData> & { liveSpoofed: DateFields };
  props: ComparisonCardsProps & { runtime: SpoofedRuntime };
}) => (
  <table className="w-full table-fixed">
    <colgroup>
      <col style={{ width: "28%" }} />
      <col style={{ width: "36%" }} />
      <col style={{ width: "36%" }} />
    </colgroup>
    <thead>
      <tr className="border-b border-border">
        <th className={HEADER_CN} aria-hidden="true" />
        <th className={cn(HEADER_CN, VALUE_CN)}>{t.demo.localMachineTitle}</th>
        <th
          className={cn(
            VALUE_CN,
            getSpoofedTitleClassName(props.selectedLocationLabel, HEADER_CN),
          )}
        >
          {props.selectedLocationLabel ?? t.demo.spoofedTitle}
        </th>
      </tr>
    </thead>
    <tbody>
      <LocaleRows
        liveSpoofed={data.liveSpoofed}
        liveSystem={data.liveSystem}
        runtime={props.runtime}
        systemValues={props.systemValues}
      />
      <NetworkRows rows={data.networkRows} />
      <GeoRows {...props} />
      <FingerprintRows rows={data.fingerprintRows} />
    </tbody>
  </table>
);

export const ComparisonCards = memo((props: ComparisonCardsProps) => {
  const data = useComparisonData(props);
  return (
    <Card>
      <CardContent className="px-4 py-0">
        {!props.runtime || !data.liveSpoofed ? (
          <div className="flex flex-col items-center justify-center py-12 text-sm text-muted-foreground text-center">
            {t.demo.selectLocationPrompt}
          </div>
        ) : (
          <ComparisonTable
            data={{ ...data, liveSpoofed: data.liveSpoofed }}
            props={{ ...props, runtime: props.runtime }}
          />
        )}
      </CardContent>
    </Card>
  );
});

ComparisonCards.displayName = "ComparisonCards";
