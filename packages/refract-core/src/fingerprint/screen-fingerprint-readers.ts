import type { RuntimeSnapshot } from "../types/snapshot";

import { isFpSurfaceEnabled } from "./surface-guards";

type FingerprintState = RuntimeSnapshot["fingerprint"] | null | undefined;
type ScreenConfig = NonNullable<NonNullable<FingerprintState>["screen"]>;

type ScreenReaderKey =
  | "width"
  | "height"
  | "availWidth"
  | "availHeight"
  | "colorDepth"
  | "pixelDepth"
  | "devicePixelRatio";

type ScreenReaderMap = Record<ScreenReaderKey, () => number>;

type ScreenReaderOptions = {
  getFingerprint: () => FingerprintState;
  nativeReaders: ScreenReaderMap;
  deriveAvailWidth?: ((screenConfig: ScreenConfig) => number | null) | undefined;
  deriveAvailHeight?: ((screenConfig: ScreenConfig) => number | null) | undefined;
  derivePixelDepth?: ((screenConfig: ScreenConfig) => number | null) | undefined;
};

const getEnabledScreenConfig = (fingerprint: FingerprintState): ScreenConfig | null => {
  if (!isFpSurfaceEnabled(fingerprint, "screen")) {
    return null;
  }

  return fingerprint?.screen ?? null;
};

export const createScreenReaders = ({
  getFingerprint,
  nativeReaders,
  deriveAvailWidth = (screenConfig) =>
    typeof screenConfig.width === "number" ? screenConfig.width : null,
  deriveAvailHeight = (screenConfig) =>
    typeof screenConfig.height === "number" ? screenConfig.height : null,
  derivePixelDepth = (screenConfig) =>
    typeof screenConfig.colorDepth === "number" ? screenConfig.colorDepth : null,
}: ScreenReaderOptions): ScreenReaderMap => {
  return {
    width: () => {
      const screenConfig = getEnabledScreenConfig(getFingerprint());
      if (typeof screenConfig?.width === "number") {
        return screenConfig.width;
      }

      return nativeReaders.width();
    },
    height: () => {
      const screenConfig = getEnabledScreenConfig(getFingerprint());
      if (typeof screenConfig?.height === "number") {
        return screenConfig.height;
      }

      return nativeReaders.height();
    },
    availWidth: () => {
      const screenConfig = getEnabledScreenConfig(getFingerprint());
      if (typeof screenConfig?.availWidth === "number") {
        return screenConfig.availWidth;
      }

      if (screenConfig) {
        const derived = deriveAvailWidth(screenConfig);
        if (typeof derived === "number") {
          return derived;
        }
      }

      return nativeReaders.availWidth();
    },
    availHeight: () => {
      const screenConfig = getEnabledScreenConfig(getFingerprint());
      if (typeof screenConfig?.availHeight === "number") {
        return screenConfig.availHeight;
      }

      if (screenConfig) {
        const derived = deriveAvailHeight(screenConfig);
        if (typeof derived === "number") {
          return derived;
        }
      }

      return nativeReaders.availHeight();
    },
    colorDepth: () => {
      const screenConfig = getEnabledScreenConfig(getFingerprint());
      if (typeof screenConfig?.colorDepth === "number") {
        return screenConfig.colorDepth;
      }

      return nativeReaders.colorDepth();
    },
    pixelDepth: () => {
      const screenConfig = getEnabledScreenConfig(getFingerprint());
      if (typeof screenConfig?.pixelDepth === "number") {
        return screenConfig.pixelDepth;
      }

      if (screenConfig) {
        const derived = derivePixelDepth(screenConfig);
        if (typeof derived === "number") {
          return derived;
        }
      }

      return nativeReaders.pixelDepth();
    },
    devicePixelRatio: () => {
      const screenConfig = getEnabledScreenConfig(getFingerprint());
      if (typeof screenConfig?.devicePixelRatio === "number") {
        return screenConfig.devicePixelRatio;
      }

      return nativeReaders.devicePixelRatio();
    },
  };
};
