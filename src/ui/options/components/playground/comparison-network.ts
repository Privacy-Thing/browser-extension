import { parseBrowserUaVersion } from "@/shared/browser-fingerprint";
import type { CapturedFingerprint } from "@/shared/types";
import { t } from "@/ui/i18n";
import type { LocalFingerprintState } from "@/ui/options/components/playground/fingerprint-comparison";
import type { SpoofedRuntime } from "@/ui/options/components/playground/snapshot-sim";

const DEFAULT_BROWSER_VERSION = ["148", "0", "0", "0"] as const;

const formatHintHeader = (
  value: string | null | undefined,
  notAvailableLabel: string,
): string => (value ? `"${value}"` : notAvailableLabel);

const formatMobileHeader = (
  value: boolean | null | undefined,
  notAvailableLabel: string,
): string => {
  if (typeof value !== "boolean") return notAvailableLabel;
  return value ? "?1" : "?0";
};

const formatBrandHeaders = (
  brands: readonly { brand: string; version: string }[] | undefined,
  notAvailableLabel: string,
): string =>
  brands && brands.length > 0
    ? brands.map((brand) => `${brand.brand} ${brand.version}`).join(", ")
    : notAvailableLabel;

const getMajorVersion = (version: string | null | undefined): number | null => {
  if (!version) return null;
  const match = version.match(/^(\d+)(?:\.\d+){0,3}$/);
  if (!match) return null;
  const major = Number(match[1]);
  return Number.isInteger(major) ? major : null;
};

export const getBrowserVersionToken = (
  runtime: SpoofedRuntime | null,
  localFingerprint: LocalFingerprintState,
): string => {
  const uaVersions = [
    runtime?.fingerprint?.userAgent,
    runtime?.fingerprint?.appVersion,
    localFingerprint.userAgent,
    localFingerprint.appVersion,
  ];
  for (const value of uaVersions) {
    if (!value) continue;
    const parsedVersion = parseBrowserUaVersion(value);
    if (parsedVersion?.family === "chromium") {
      return `${parsedVersion.major}.0.0.0`;
    }
  }
  const hintVersions = [
    ...(runtime?.fingerprint?.clientHints?.fullVersionList ?? []).map(
      (brand) => brand.version,
    ),
    ...(localFingerprint.capturedFingerprint?.clientHints?.fullVersionList ?? []).map(
      (brand) => brand.version,
    ),
    ...(runtime?.fingerprint?.clientHints?.brands ?? []).map((brand) => brand.version),
    ...(localFingerprint.capturedFingerprint?.clientHints?.brands ?? []).map(
      (brand) => brand.version,
    ),
  ];
  for (const value of hintVersions) {
    const major = getMajorVersion(value);
    if (major !== null) return `${major}.0.0.0`;
  }
  return DEFAULT_BROWSER_VERSION.join(".");
};

const getLocalHintValue = <T>({
  fingerprint,
  formatter,
  render,
}: {
  fingerprint: CapturedFingerprint | null;
  formatter: (fingerprint: CapturedFingerprint) => T;
  render: (value: T) => string;
}): string =>
  fingerprint ? render(formatter(fingerprint)) : t.demo.comparison.probePending;

export type NetworkRow = {
  id: string;
  label: string;
  localValue: string;
  spoofedValue: string;
  changed: boolean;
  mono: boolean;
  note?: string;
};

export const buildNetworkRows = ({
  browserVersionNote,
  localFingerprint,
  runtime,
  systemAcceptLanguage,
}: {
  browserVersionNote: string;
  localFingerprint: LocalFingerprintState;
  runtime: SpoofedRuntime | null;
  systemAcceptLanguage: string;
}): NetworkRow[] => {
  if (!runtime) return [];
  const rows: NetworkRow[] = [
    {
      id: "acceptLanguage",
      label: t.demo.comparison.acceptLanguage,
      localValue: systemAcceptLanguage,
      spoofedValue: runtime.locale.acceptLanguage,
      changed: runtime.locale.acceptLanguage !== systemAcceptLanguage,
      mono: true,
    },
  ];
  if (!runtime.fingerprint?.spoofingToggles?.clientHints) return rows;

  const fingerprint = localFingerprint.capturedFingerprint;
  const localValue = <T>(
    formatter: (value: CapturedFingerprint) => T,
    render: (value: T) => string,
  ) => getLocalHintValue({ fingerprint, formatter, render });
  const localBrands = localValue(
    (value) => value.clientHints?.brands,
    (brands) => formatBrandHeaders(brands ?? undefined, t.demo.comparison.notAvailable),
  );
  const spoofedBrands = formatBrandHeaders(
    runtime.fingerprint.clientHints?.brands,
    t.demo.comparison.notAvailable,
  );
  const localPlatform = localValue(
    (value) => value.clientHints?.platform,
    (platform) => formatHintHeader(platform, t.demo.comparison.notAvailable),
  );
  const spoofedPlatform = formatHintHeader(
    runtime.fingerprint.clientHints?.platform,
    t.demo.comparison.notAvailable,
  );
  const localMobile = localValue(
    (value) => value.clientHints?.mobile,
    (mobile) => formatMobileHeader(mobile, t.demo.comparison.notAvailable),
  );
  const spoofedMobile = formatMobileHeader(
    runtime.fingerprint.clientHints?.mobile,
    t.demo.comparison.notAvailable,
  );
  const localVersions = localValue(
    (value) => value.clientHints?.fullVersionList,
    (brands) => formatBrandHeaders(brands ?? undefined, t.demo.comparison.notAvailable),
  );
  const spoofedVersions = formatBrandHeaders(
    runtime.fingerprint.clientHints?.fullVersionList,
    t.demo.comparison.notAvailable,
  );
  rows.push(
    {
      id: "secChUa",
      label: t.demo.comparison.secChUa,
      localValue: localBrands,
      spoofedValue: spoofedBrands,
      changed: localBrands !== spoofedBrands,
      mono: true,
      note: browserVersionNote,
    },
    {
      id: "secChUaPlatform",
      label: t.demo.comparison.secChUaPlatform,
      localValue: localPlatform,
      spoofedValue: spoofedPlatform,
      changed: localPlatform !== spoofedPlatform,
      mono: true,
    },
    {
      id: "secChUaMobile",
      label: t.demo.comparison.secChUaMobile,
      localValue: localMobile,
      spoofedValue: spoofedMobile,
      changed: localMobile !== spoofedMobile,
      mono: true,
    },
    {
      id: "secChUaFullVersionList",
      label: t.demo.comparison.secChUaFullVersionList,
      localValue: localVersions,
      spoofedValue: spoofedVersions,
      changed: localVersions !== spoofedVersions,
      mono: true,
      note: browserVersionNote,
    },
  );
  return rows;
};
