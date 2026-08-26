export type BrowserClientHintBrand = {
  brand: string;
  version: string;
};

export type BrowserClientHints = {
  brands?: BrowserClientHintBrand[];
  fullVersionList?: BrowserClientHintBrand[];
  platform?: string;
  platformVersion?: string;
  mobile?: boolean;
  architecture?: string;
  bitness?: string;
  model?: string;
  formFactors?: string[];
  wow64?: boolean;
  deviceMemory?: number;
};

export type FingerprintToggles = {
  canvas?: boolean | undefined;
  webGL?: boolean | undefined;
  audio?: boolean | undefined;
  navigator?: boolean | undefined;
  screen?: boolean | undefined;
  clientHints?: boolean | undefined;
  battery?: boolean | undefined;
  webRTC?: boolean | undefined;
};

export type BrowserFingerprint = {
  hardwareConcurrency?: number;
  deviceMemory?: number;
  maxTouchPoints?: number;
  platform?: string;
  userAgent?: string;
  vendor?: string;
  appVersion?: string;
  clientHints?: BrowserClientHints;
  canvasNoiseSeed?: number;
  webGL?:
    | {
        renderer?: string | undefined;
        vendor?: string | undefined;
        suppressDebugInfo?: boolean | undefined;
        readPixelsNoiseSeed?: number | undefined;
      }
    | undefined;
  audioNoiseSeed?: number | undefined;
  screen?:
    | {
        width?: number | undefined;
        height?: number | undefined;
        availWidth?: number | undefined;
        availHeight?: number | undefined;
        colorDepth?: number | undefined;
        pixelDepth?: number | undefined;
        devicePixelRatio?: number | undefined;
      }
    | undefined;
  spoofingToggles?: FingerprintToggles | undefined;
  /**
   * Domain-fencing marker present only on shared multi-domain carriers.
   * Consuming realms finalize per-site noise seeds and strip it before
   * installing the runtime.
   */
  fencing?: { key: string } | undefined;
};

export type RuntimeSnapshot = {
  geo: {
    latitude: number;
    longitude: number;
    accuracy: number;
    noiseRadius: number;
  };
  locale: {
    language: string;
    languages: readonly string[];
    timeZone: string;
    acceptLanguage: string;
    formattingLanguage?: string;
    formattingLanguages?: readonly string[];
  };
  /** @deprecated Compatibility payload for pre-epoch-fix runtimes. New code uses locale.timeZone. */
  date: {
    baseEpochMs: number;
    offsetMs: number;
    timeZone: string;
  };
  debugMode: boolean;
  watchPositionDelay: [number, number];
  sharedWorkerHandlingMode?: "native" | "spoof" | "strict";
  sharedWorkerCompatibilityMode?: boolean;
  geolocationEnabled?: boolean | undefined;
  timeLocaleEnabled?: boolean | undefined;
  temporalApiEnabled?: boolean | undefined;
  fingerprint?: BrowserFingerprint;
  logEventName?: string;
  blockServiceWorkerRegistration?: boolean;
  authKey?: string;
};

export type FirefoxTimeLocaleState = {
  language: string;
  languages: readonly string[];
  formattingLanguage?: string;
  formattingLanguages?: readonly string[];
  timeZone: string;
  temporalApiEnabled?: boolean | undefined;
  /** @deprecated Compatibility payload for pre-epoch-fix Firefox runtimes. */
  offsetMinutes: number;
};

export type FirefoxGeoState = {
  latitude: number;
  longitude: number;
  accuracy: number;
  noiseRadius?: number | undefined;
  watchPositionDelay?: [number, number] | undefined;
};
