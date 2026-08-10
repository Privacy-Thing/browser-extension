import { resolveSpoofingToggles } from "@/shared/fingerprint-spoofing";
import type {
  BrowserClientHintBrand,
  BrowserClientHints,
  BrowserFingerprint,
  CapturedFingerprint,
} from "@/shared/types";

export type ComparisonRowId =
  | "userAgent"
  | "appVersion"
  | "vendor"
  | "hardwareConcurrency"
  | "deviceMemory"
  | "platform"
  | "devicePixelRatio"
  | "pixelDepth"
  | "screenMetrics"
  | "canvas2d"
  | "webglRenderer"
  | "webglDebugExtension"
  | "webglReadPixels"
  | "audioFingerprint"
  | "clientHintBrands"
  | "clientHintPlatform"
  | "clientHintPlatformVersion"
  | "clientHintArchitecture"
  | "clientHintBitness"
  | "clientHintModel"
  | "clientHintMobile"
  | "clientHintFullVersionList"
  | "webRTCIcePolicy";

export type FingerprintComparisonRow = {
  id: ComparisonRowId;
  localValue: string;
  spoofedValue: string;
  changed: boolean;
  mono?: boolean;
  note?: string;
};

export type LocalFingerprintState = {
  readonly userAgent: string;
  readonly appVersion: string;
  readonly vendor: string;
  readonly platform: string;
  readonly hardwareConcurrency: number;
  readonly deviceMemory?: number | undefined;
  readonly webRTCAvailable: boolean;
  readonly capturedFingerprint: CapturedFingerprint | null;
};

export type BuildRowsOptions = {
  readonly local: LocalFingerprintState;
  readonly runtimeFingerprint: BrowserFingerprint | undefined;
  readonly pendingLabel: string;
  readonly notAvailableLabel: string;
  readonly matchingLocalNote: string;
  readonly browserVersionNote: string;
};

type FingerprintScreen =
  CapturedFingerprint["screen"] | BrowserFingerprint["screen"] | undefined;

const formatHashSummary = (
  hash: string | null | undefined,
  notAvailableLabel: string,
): string => (hash ? `${hash.slice(0, 12)}…` : notAvailableLabel);

const formatNoiseStatus = (seed: number): string =>
  `Noise enabled (seed 0x${seed.toString(16).padStart(8, "0")})`;

const deriveSpoofedHashPreview = (hash: string, seed: number): string => {
  let first = (seed ^ 0x811c9dc5) >>> 0;
  let second = (seed ^ 0x01000193) >>> 0;

  for (let index = 0; index < hash.length; index += 1) {
    const codePoint = hash.charCodeAt(index);
    first = Math.imul(first ^ codePoint, 0x01000193) >>> 0;
    second = Math.imul(second ^ (codePoint + index), 0x01000193) >>> 0;
  }

  return `${first.toString(16).padStart(8, "0")}${second.toString(16).padStart(8, "0")}`;
};

const formatNoiseSpoofing = (
  localHash: string | null | undefined,
  seed: number | undefined,
  notAvailableLabel: string,
): string => {
  if (typeof seed !== "number") {
    return notAvailableLabel;
  }

  if (!localHash) {
    return formatNoiseStatus(seed);
  }

  return `${formatHashSummary(deriveSpoofedHashPreview(localHash, seed), notAvailableLabel)}\n${formatNoiseStatus(seed)}`;
};

const formatScreenMetrics = (
  screen: FingerprintScreen,
  notAvailableLabel: string,
): string => {
  if (
    !screen ||
    typeof screen.width !== "number" ||
    typeof screen.height !== "number"
  ) {
    return notAvailableLabel;
  }

  const parts = [
    `${screen.width}x${screen.height}`,
    typeof screen.availWidth === "number" && typeof screen.availHeight === "number"
      ? `avail ${screen.availWidth}x${screen.availHeight}`
      : null,
    typeof screen.colorDepth === "number" ? `${screen.colorDepth}-bit` : null,
  ].filter((part): part is string => part !== null);

  return parts.join(" | ");
};

const formatDevicePixelRatio = (
  screen: FingerprintScreen,
  notAvailableLabel: string,
): string =>
  screen && typeof screen.devicePixelRatio === "number"
    ? String(screen.devicePixelRatio)
    : notAvailableLabel;

const formatPixelDepth = (
  screen: FingerprintScreen,
  notAvailableLabel: string,
): string => {
  if (!screen) {
    return notAvailableLabel;
  }

  const pixelDepth =
    "pixelDepth" in screen && typeof screen.pixelDepth === "number"
      ? screen.pixelDepth
      : screen.colorDepth;
  return String(pixelDepth);
};

const formatBrandList = (
  brands: readonly BrowserClientHintBrand[] | undefined,
  notAvailableLabel: string,
): string =>
  brands && brands.length > 0
    ? brands.map((brand) => `${brand.brand} ${brand.version}`).join(", ")
    : notAvailableLabel;

const CHROMIUM_BRAND_NAMES = new Set([
  "Chromium",
  "Google Chrome",
  "Chrome",
  "Microsoft Edge",
  "Opera",
  "Brave",
]);

const hasNormalizedUaVersion = (value: string): boolean =>
  /\b(?:Chrome|Chromium|Edg|OPR)\/\d+\.0\.0\.0\b/.test(value);

const hasNormalizedVersionList = (value: string): boolean =>
  /\b(?:Google Chrome|Chromium|Chrome|Microsoft Edge|Opera|Brave) \d+\.0\.0\.0\b/.test(
    value,
  );

const hasNormalizedBrands = (
  brands: readonly BrowserClientHintBrand[] | undefined,
): boolean =>
  brands?.some(
    (brand) => CHROMIUM_BRAND_NAMES.has(brand.brand) && /^\d+$/.test(brand.version),
  ) ?? false;

const formatClientHintPlatform = (
  clientHints:
    BrowserClientHints | CapturedFingerprint["clientHints"] | null | undefined,
  notAvailableLabel: string,
): string => {
  if (!clientHints) {
    return notAvailableLabel;
  }

  return typeof clientHints.platform === "string" && clientHints.platform.length > 0
    ? clientHints.platform
    : notAvailableLabel;
};

const formatOptionalHint = (
  value: string | null | undefined,
  notAvailableLabel: string,
): string =>
  typeof value === "string" && value.length > 0 ? value : notAvailableLabel;

const formatClientHintMobile = (
  clientHints:
    BrowserClientHints | CapturedFingerprint["clientHints"] | null | undefined,
  notAvailableLabel: string,
): string => {
  if (!clientHints || typeof clientHints.mobile !== "boolean") {
    return notAvailableLabel;
  }

  return clientHints.mobile ? "true" : "false";
};

const formatWebGLRenderer = (
  webGL: CapturedFingerprint["webGL"] | BrowserFingerprint["webGL"] | undefined,
  notAvailableLabel: string,
): string => {
  if (!webGL) {
    return notAvailableLabel;
  }

  const parts = [webGL.vendor, webGL.renderer].filter(
    (part): part is string => typeof part === "string" && part.length > 0,
  );

  return parts.length > 0 ? parts.join(" / ") : notAvailableLabel;
};

const formatWebGLDebugStatus = (
  webGL: CapturedFingerprint["webGL"] | BrowserFingerprint["webGL"] | undefined,
  notAvailableLabel: string,
): string => {
  if (!webGL) {
    return notAvailableLabel;
  }

  if ("suppressDebugInfo" in webGL && webGL.suppressDebugInfo === true) {
    return "Hidden";
  }

  if (webGL.vendor || webGL.renderer) {
    return "Exposed";
  }

  return notAvailableLabel;
};

const formatPixelsHash = (
  webGL: CapturedFingerprint["webGL"] | undefined,
  notAvailableLabel: string,
): string => formatHashSummary(webGL?.readPixelsHash, notAvailableLabel);

const formatPixelsSpoofing = (
  localHash: string | null | undefined,
  runtimeFingerprint: BrowserFingerprint,
  notAvailableLabel: string,
): string =>
  formatNoiseSpoofing(
    localHash,
    runtimeFingerprint.webGL?.readPixelsNoiseSeed,
    notAvailableLabel,
  );

const formatCanvasSpoofing = (
  localHash: string | null | undefined,
  runtimeFingerprint: BrowserFingerprint,
  notAvailableLabel: string,
): string =>
  formatNoiseSpoofing(localHash, runtimeFingerprint.canvasNoiseSeed, notAvailableLabel);

const formatAudioSpoofing = (
  localHash: string | null | undefined,
  runtimeFingerprint: BrowserFingerprint,
  notAvailableLabel: string,
): string =>
  formatNoiseSpoofing(localHash, runtimeFingerprint.audioNoiseSeed, notAvailableLabel);

const formatWebRTCSpoofing = (
  webRTCAvailable: boolean,
  notAvailableLabel: string,
): string => (webRTCAvailable ? "Relay-only ICE + SDP scrubber" : notAvailableLabel);

const hasMeaningfulChange = (
  localValue: string,
  spoofedValue: string,
  pendingLabel: string,
): boolean => localValue !== pendingLabel && localValue !== spoofedValue;

const maybeWithNote = (
  condition: boolean,
  note: string,
): Pick<FingerprintComparisonRow, "note"> | Record<string, never> =>
  condition ? { note } : {};

const getNavigatorRows = ({
  local,
  runtimeFingerprint,
  notAvailableLabel,
  matchingLocalNote,
  browserVersionNote,
}: Pick<
  BuildRowsOptions,
  "local" | "notAvailableLabel" | "matchingLocalNote" | "browserVersionNote"
> & { runtimeFingerprint: BrowserFingerprint }): FingerprintComparisonRow[] => {
  const spoofedUserAgent = runtimeFingerprint.userAgent ?? local.userAgent;
  const spoofedAppVersion = runtimeFingerprint.appVersion ?? local.appVersion;
  const spoofedCpuCount =
    runtimeFingerprint.hardwareConcurrency ?? local.hardwareConcurrency;
  const localDeviceMemoryValue =
    typeof local.deviceMemory === "number"
      ? String(local.deviceMemory)
      : notAvailableLabel;
  const spoofedDeviceMemoryValue =
    typeof runtimeFingerprint.deviceMemory === "number"
      ? String(runtimeFingerprint.deviceMemory)
      : localDeviceMemoryValue;

  return [
    {
      id: "userAgent",
      localValue: local.userAgent,
      spoofedValue: spoofedUserAgent,
      changed: false,
      ...maybeWithNote(hasNormalizedUaVersion(spoofedUserAgent), browserVersionNote),
    },
    {
      id: "appVersion",
      localValue: local.appVersion,
      spoofedValue: spoofedAppVersion,
      changed: false,
      ...maybeWithNote(hasNormalizedUaVersion(spoofedAppVersion), browserVersionNote),
    },
    {
      id: "vendor",
      localValue: local.vendor || notAvailableLabel,
      spoofedValue: runtimeFingerprint.vendor ?? local.vendor ?? notAvailableLabel,
      changed: false,
    },
    {
      id: "hardwareConcurrency",
      localValue: String(local.hardwareConcurrency),
      spoofedValue: String(spoofedCpuCount),
      changed: false,
      mono: true,
      ...maybeWithNote(
        typeof runtimeFingerprint.hardwareConcurrency === "number" &&
          runtimeFingerprint.hardwareConcurrency === local.hardwareConcurrency,
        matchingLocalNote,
      ),
    },
    {
      id: "deviceMemory",
      localValue: localDeviceMemoryValue,
      spoofedValue: spoofedDeviceMemoryValue,
      changed: false,
      mono: true,
      ...maybeWithNote(
        typeof runtimeFingerprint.deviceMemory === "number" &&
          typeof local.deviceMemory === "number" &&
          runtimeFingerprint.deviceMemory === local.deviceMemory,
        matchingLocalNote,
      ),
    },
    {
      id: "platform",
      localValue: local.platform,
      spoofedValue: runtimeFingerprint.platform ?? local.platform,
      changed: false,
    },
  ];
};

const pendingValue = <T>({
  value,
  formatter,
  pendingLabel,
}: {
  value: T | null | undefined;
  formatter: (input: T) => string;
  pendingLabel: string;
}): string => (value === null || value === undefined ? pendingLabel : formatter(value));

const getClientHintRows = ({
  captured,
  runtime,
  pendingLabel,
  notAvailableLabel,
  browserVersionNote,
}: {
  captured: CapturedFingerprint | null;
  runtime: BrowserFingerprint;
  pendingLabel: string;
  notAvailableLabel: string;
  browserVersionNote: string;
}): FingerprintComparisonRow[] => {
  const local = (formatter: (fingerprint: CapturedFingerprint) => string) =>
    pendingValue({ value: captured, formatter, pendingLabel });
  const hint = runtime.clientHints;
  const versionList = formatBrandList(hint?.fullVersionList, notAvailableLabel);
  return [
    {
      id: "clientHintBrands",
      localValue: local((fingerprint) =>
        formatBrandList(fingerprint.clientHints?.brands, notAvailableLabel),
      ),
      spoofedValue: formatBrandList(hint?.brands, notAvailableLabel),
      changed: false,
      ...(hasNormalizedBrands(hint?.brands) ? { note: browserVersionNote } : {}),
    },
    {
      id: "clientHintPlatform",
      localValue: local((fingerprint) =>
        formatClientHintPlatform(fingerprint.clientHints, notAvailableLabel),
      ),
      spoofedValue: formatClientHintPlatform(hint, notAvailableLabel),
      changed: false,
    },
    ...(["platformVersion", "architecture", "bitness", "model"] as const).map(
      (key) => ({
        id: `clientHint${key.charAt(0).toUpperCase()}${key.slice(1)}` as ComparisonRowId,
        localValue: local((fingerprint) =>
          formatOptionalHint(fingerprint.clientHints?.[key], notAvailableLabel),
        ),
        spoofedValue: formatOptionalHint(hint?.[key], notAvailableLabel),
        changed: false,
      }),
    ),
    {
      id: "clientHintMobile",
      localValue: local((fingerprint) =>
        formatClientHintMobile(fingerprint.clientHints, notAvailableLabel),
      ),
      spoofedValue: formatClientHintMobile(hint, notAvailableLabel),
      changed: false,
    },
    {
      id: "clientHintFullVersionList",
      localValue: local((fingerprint) =>
        formatBrandList(fingerprint.clientHints?.fullVersionList, notAvailableLabel),
      ),
      spoofedValue: versionList,
      changed: false,
      ...(hasNormalizedVersionList(versionList) ? { note: browserVersionNote } : {}),
    },
  ];
};

const getWebRtcRow = (
  available: boolean,
  notAvailableLabel: string,
): FingerprintComparisonRow => ({
  id: "webRTCIcePolicy",
  localValue: available ? "Browser-managed ICE policy" : notAvailableLabel,
  spoofedValue: formatWebRTCSpoofing(available, notAvailableLabel),
  changed: false,
});

const getSurfaceRows = ({
  captured,
  local,
  runtime,
  pendingLabel,
  notAvailableLabel,
}: {
  captured: CapturedFingerprint | null;
  local: LocalFingerprintState;
  runtime: BrowserFingerprint;
  pendingLabel: string;
  notAvailableLabel: string;
}): FingerprintComparisonRow[] => {
  const rows: FingerprintComparisonRow[] = [];
  const pending = (formatter: (fingerprint: CapturedFingerprint) => string) =>
    pendingValue({ value: captured, formatter, pendingLabel });
  const toggles = resolveSpoofingToggles(runtime.spoofingToggles);
  if (toggles.canvas) {
    rows.push({
      id: "canvas2d",
      localValue: pending((value) =>
        formatHashSummary(value.canvasHash, notAvailableLabel),
      ),
      spoofedValue: formatCanvasSpoofing(
        captured?.canvasHash,
        runtime,
        notAvailableLabel,
      ),
      changed: false,
      mono: true,
    });
  }
  if (toggles.webGL) {
    rows.push(
      {
        id: "webglRenderer",
        localValue: pending((value) =>
          formatWebGLRenderer(value.webGL, notAvailableLabel),
        ),
        spoofedValue: formatWebGLRenderer(runtime.webGL, notAvailableLabel),
        changed: false,
      },
      {
        id: "webglDebugExtension",
        localValue: pending((value) =>
          formatWebGLDebugStatus(value.webGL, notAvailableLabel),
        ),
        spoofedValue: formatWebGLDebugStatus(runtime.webGL, notAvailableLabel),
        changed: false,
      },
      {
        id: "webglReadPixels",
        localValue: pending((value) =>
          formatPixelsHash(value.webGL, notAvailableLabel),
        ),
        spoofedValue: formatPixelsSpoofing(
          captured?.webGL.readPixelsHash,
          runtime,
          notAvailableLabel,
        ),
        changed: false,
        mono: true,
      },
    );
  }
  if (toggles.screen) {
    rows.push(
      {
        id: "screenMetrics",
        localValue: pending((value) =>
          formatScreenMetrics(value.screen, notAvailableLabel),
        ),
        spoofedValue: formatScreenMetrics(runtime.screen, notAvailableLabel),
        changed: false,
        mono: true,
      },
      {
        id: "devicePixelRatio",
        localValue: pending((value) =>
          formatDevicePixelRatio(value.screen, notAvailableLabel),
        ),
        spoofedValue: formatDevicePixelRatio(runtime.screen, notAvailableLabel),
        changed: false,
        mono: true,
      },
      {
        id: "pixelDepth",
        localValue: pending((value) =>
          formatPixelDepth(value.screen, notAvailableLabel),
        ),
        spoofedValue: formatPixelDepth(runtime.screen, notAvailableLabel),
        changed: false,
        mono: true,
      },
    );
  }
  if (toggles.audio) {
    rows.push({
      id: "audioFingerprint",
      localValue: pending((value) =>
        formatHashSummary(value.audioHash, notAvailableLabel),
      ),
      spoofedValue: formatAudioSpoofing(
        captured?.audioHash,
        runtime,
        notAvailableLabel,
      ),
      changed: false,
      mono: true,
    });
  }
  if (toggles.webRTC) {
    rows.push(getWebRtcRow(local.webRTCAvailable, notAvailableLabel));
  }
  return rows;
};

export const buildComparisonRows = ({
  local,
  runtimeFingerprint,
  pendingLabel,
  notAvailableLabel,
  matchingLocalNote,
  browserVersionNote,
}: BuildRowsOptions): FingerprintComparisonRow[] => {
  if (!runtimeFingerprint) {
    return [];
  }

  const toggles = resolveSpoofingToggles(runtimeFingerprint.spoofingToggles);
  const capturedFingerprint = local.capturedFingerprint;
  const rows: FingerprintComparisonRow[] = [];

  if (toggles.navigator) {
    rows.push(
      ...getNavigatorRows({
        local,
        runtimeFingerprint,
        notAvailableLabel,
        matchingLocalNote,
        browserVersionNote,
      }),
    );
  }

  if (toggles.clientHints) {
    rows.push(
      ...getClientHintRows({
        captured: capturedFingerprint,
        runtime: runtimeFingerprint,
        pendingLabel,
        notAvailableLabel,
        browserVersionNote,
      }),
    );
  }
  rows.push(
    ...getSurfaceRows({
      captured: capturedFingerprint,
      local,
      runtime: runtimeFingerprint,
      pendingLabel,
      notAvailableLabel,
    }),
  );

  return rows.map((row) => ({
    ...row,
    changed: hasMeaningfulChange(row.localValue, row.spoofedValue, pendingLabel),
  }));
};
