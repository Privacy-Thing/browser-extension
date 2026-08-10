import type { BrowserFingerprint } from "../types/snapshot";

import { isFpSurfaceEnabled } from "./surface-guards";

type NavigatorValueMap = Pick<
  BrowserFingerprint,
  | "hardwareConcurrency"
  | "deviceMemory"
  | "maxTouchPoints"
  | "platform"
  | "userAgent"
  | "vendor"
  | "appVersion"
>;

export type NavigatorFpProperty = keyof NavigatorValueMap;

export type NavigatorFpReader = () =>
  NavigatorValueMap[keyof NavigatorValueMap] | undefined;

export type NavigatorFpReaders = {
  [K in keyof NavigatorValueMap]-?: () => NavigatorValueMap[K] | undefined;
};

type NavigatorGetterInstaller = (
  property: NavigatorFpProperty,
  getter: NavigatorFpReader,
) => void;

type NavigatorGetterOptions = {
  readers: NavigatorFpReaders;
  defineGetter: NavigatorGetterInstaller;
  hasProperty: (property: NavigatorFpProperty) => boolean;
  installFallbackGetters?: boolean;
};

const NAVIGATOR_FP_PROPERTIES: readonly NavigatorFpProperty[] = [
  "hardwareConcurrency",
  "deviceMemory",
  "maxTouchPoints",
  "platform",
  "userAgent",
  "vendor",
  "appVersion",
];

const requiresTargetProperty = (property: NavigatorFpProperty): boolean =>
  property === "deviceMemory" || property === "maxTouchPoints";

export function createNavigatorReaders(
  getFingerprint: () => BrowserFingerprint | null | undefined,
): NavigatorFpReaders {
  const readNumber = (
    property: "hardwareConcurrency" | "deviceMemory" | "maxTouchPoints",
  ): number | undefined => {
    const fingerprint = getFingerprint();
    const value = fingerprint?.[property];
    return isFpSurfaceEnabled(fingerprint, "navigator") && typeof value === "number"
      ? value
      : undefined;
  };

  const readString = (
    property: "platform" | "userAgent" | "vendor" | "appVersion",
  ): string | undefined => {
    const fingerprint = getFingerprint();
    const value = fingerprint?.[property];
    return isFpSurfaceEnabled(fingerprint, "navigator") &&
      typeof value === "string" &&
      value.length > 0
      ? value
      : undefined;
  };

  return {
    hardwareConcurrency: () => readNumber("hardwareConcurrency"),
    deviceMemory: () => readNumber("deviceMemory"),
    maxTouchPoints: () => readNumber("maxTouchPoints"),
    platform: () => readString("platform"),
    userAgent: () => readString("userAgent"),
    vendor: () => readString("vendor"),
    appVersion: () => readString("appVersion"),
  };
}

export function installNavigatorGetters({
  readers,
  defineGetter,
  hasProperty,
  installFallbackGetters = false,
}: NavigatorGetterOptions): void {
  for (const property of NAVIGATOR_FP_PROPERTIES) {
    if (requiresTargetProperty(property) && !hasProperty(property)) {
      continue;
    }

    const getter = readers[property];
    if (!installFallbackGetters && getter() === undefined) {
      continue;
    }

    defineGetter(property, getter);
  }
}

export const NAVIGATOR_READERS_SOURCE = `
  const NAVIGATOR_FP_PROPERTIES = [
    "hardwareConcurrency",
    "deviceMemory",
    "maxTouchPoints",
    "platform",
    "userAgent",
    "vendor",
    "appVersion"
  ];
  const requiresTargetProperty = (property) =>
    property === "deviceMemory" || property === "maxTouchPoints";
  const createNavigatorReaders = (getFingerprint) => {
    const readNumber = (property) => {
      const fingerprint = getFingerprint();
      const value = fingerprint?.[property];
      return isFpSurfaceEnabled(fingerprint, "navigator") && typeof value === "number"
        ? value
        : undefined;
    };

    const readString = (property) => {
      const fingerprint = getFingerprint();
      const value = fingerprint?.[property];
      return isFpSurfaceEnabled(fingerprint, "navigator") &&
        typeof value === "string" &&
        value.length > 0
        ? value
        : undefined;
    };

    return {
      hardwareConcurrency: () => readNumber("hardwareConcurrency"),
      deviceMemory: () => readNumber("deviceMemory"),
      maxTouchPoints: () => readNumber("maxTouchPoints"),
      platform: () => readString("platform"),
      userAgent: () => readString("userAgent"),
      vendor: () => readString("vendor"),
      appVersion: () => readString("appVersion")
    };
  };
  const installNavigatorGetters = ({
    readers,
    defineGetter,
    hasProperty,
    installFallbackGetters = false
  }) => {
    for (const property of NAVIGATOR_FP_PROPERTIES) {
      if (requiresTargetProperty(property) && !hasProperty(property)) {
        continue;
      }

      const getter = readers[property];
      if (!installFallbackGetters && getter() === undefined) {
        continue;
      }

      defineGetter(property, getter);
    }
  };
`;
