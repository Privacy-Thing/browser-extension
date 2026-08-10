import type { BrowserClientHintBrand } from "./fingerprint-types.js";

/** Minimal shape of `navigator.userAgentData` needed for fingerprint derivation. */
export type UserAgentDataLike = {
  brands?: readonly BrowserClientHintBrand[];
  fullVersionList?: readonly BrowserClientHintBrand[];
  mobile?: boolean;
  platform?: string;
  getHighEntropyValues?: (hints: readonly string[]) => Promise<{
    fullVersionList?: readonly BrowserClientHintBrand[];
    mobile?: boolean;
    platform?: string;
    architecture?: string;
    bitness?: string;
  }>;
};

/** Native browser data used as the seed for fingerprint spoofing. */
export type BrowserFingerprintSource = {
  userAgent?: string | undefined;
  platform?: string | undefined;
  vendor?: string | undefined;
  hardwareConcurrency?: number | undefined;
  deviceMemory?: number | undefined;
  /** CPU architecture from Client Hints high-entropy values ("arm"/"x86"); Chromium-only. */
  architecture?: string | undefined;
  userAgentData?: UserAgentDataLike | null | undefined;
};

type ClientHintsNavigator = Navigator & {
  deviceMemory?: number;
  userAgentData?: UserAgentDataLike;
};

type HighEntropyHints =
  | Awaited<ReturnType<NonNullable<UserAgentDataLike["getHighEntropyValues"]>>>
  | undefined;

const cloneBrands = (
  brands: readonly BrowserClientHintBrand[] | undefined,
): BrowserClientHintBrand[] | undefined =>
  brands?.map((brand) => ({ brand: brand.brand, version: brand.version }));

const resolveMobile = (
  highEntropyHints: HighEntropyHints,
  nativeHints: UserAgentDataLike,
): boolean | undefined => {
  if (typeof highEntropyHints?.mobile === "boolean") return highEntropyHints.mobile;
  if (typeof nativeHints.mobile === "boolean") return nativeHints.mobile;
  return undefined;
};

const resolvePlatform = (
  highEntropyHints: HighEntropyHints,
  nativeHints: UserAgentDataLike,
): string | undefined => {
  if (typeof highEntropyHints?.platform === "string") return highEntropyHints.platform;
  if (typeof nativeHints.platform === "string") return nativeHints.platform;
  return undefined;
};

const buildUaDataSnapshot = (
  nativeHints: UserAgentDataLike | undefined,
  highEntropyHints: HighEntropyHints,
): UserAgentDataLike | undefined => {
  if (!nativeHints) return undefined;

  const userAgentData: UserAgentDataLike = {};
  const brands = cloneBrands(nativeHints.brands);
  const fullVersionList = cloneBrands(
    highEntropyHints?.fullVersionList ?? nativeHints.fullVersionList,
  );
  const mobile = resolveMobile(highEntropyHints, nativeHints);
  const platform = resolvePlatform(highEntropyHints, nativeHints);

  if (brands) userAgentData.brands = brands;
  if (fullVersionList) userAgentData.fullVersionList = fullVersionList;
  if (typeof mobile === "boolean") userAgentData.mobile = mobile;
  if (platform) userAgentData.platform = platform;

  return userAgentData;
};

let cachedFingerprint: BrowserFingerprintSource | undefined;
let hasCachedFingerprint = false;
let fingerprintPromise: Promise<BrowserFingerprintSource | undefined> | null = null;

export const clearFingerprintCache = (): void => {
  cachedFingerprint = undefined;
  hasCachedFingerprint = false;
  fingerprintPromise = null;
};

const readUncachedFingerprint = async (): Promise<
  BrowserFingerprintSource | undefined
> => {
  if (typeof navigator === "undefined") return undefined;

  const browserNavigator = navigator as ClientHintsNavigator;
  const nativeHints = browserNavigator.userAgentData;
  let highEntropyHints: HighEntropyHints;

  if (nativeHints?.getHighEntropyValues) {
    try {
      highEntropyHints = await nativeHints.getHighEntropyValues([
        "fullVersionList",
        "mobile",
        "platform",
        "architecture",
        "bitness",
      ]);
    } catch {
      highEntropyHints = undefined;
    }
  }

  const userAgentData = buildUaDataSnapshot(nativeHints, highEntropyHints);

  return {
    userAgent: browserNavigator.userAgent,
    platform: browserNavigator.platform,
    vendor: browserNavigator.vendor,
    hardwareConcurrency: browserNavigator.hardwareConcurrency,
    ...(typeof browserNavigator.deviceMemory === "number"
      ? { deviceMemory: browserNavigator.deviceMemory }
      : {}),
    ...(typeof highEntropyHints?.architecture === "string"
      ? { architecture: highEntropyHints.architecture }
      : {}),
    ...(userAgentData ? { userAgentData } : {}),
  };
};

export const readFingerprintSource = async (): Promise<
  BrowserFingerprintSource | undefined
> => {
  if (hasCachedFingerprint) return cachedFingerprint;

  if (!fingerprintPromise) {
    fingerprintPromise = readUncachedFingerprint().then((source) => {
      cachedFingerprint = source;
      hasCachedFingerprint = true;
      fingerprintPromise = null;
      return source;
    });
  }

  return fingerprintPromise;
};
