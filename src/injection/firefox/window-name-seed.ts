import {
  normalizeFxWindowSeed,
  isFirefoxWindowSeedState,
  type FirefoxWindowSeedState,
} from "@privacy-brand/refract-browser/common/firefox-shim-state";
import {
  buildWindowNameTransport,
  parseWindowNameTransport,
} from "@privacy-brand/refract-browser/common/snapshot-transports";

export type FirefoxWindowSeedPayload = {
  previousName: string;
  seedState: FirefoxWindowSeedState;
};

const FX_WINDOW_SEED_KEY = __PT_SHIM_GUARD_KEY__;

export const parseFirefoxWindowSeed = (
  value: string,
  prefix: string,
): FirefoxWindowSeedPayload | null => {
  const raw = parseWindowNameTransport(value, prefix);
  if (!raw) {
    return null;
  }
  const parsed = raw as {
    buildKey?: unknown;
    previousName?: unknown;
    seedState?: unknown;
  };
  if (
    parsed.buildKey !== FX_WINDOW_SEED_KEY ||
    typeof parsed.previousName !== "string" ||
    !isFirefoxWindowSeedState(parsed.seedState)
  ) {
    return null;
  }
  return {
    previousName: parsed.previousName,
    seedState: normalizeFxWindowSeed(parsed.seedState)!,
  };
};

const stripFirefoxWindowSeed = (value: string, prefix: string): string => {
  const parsed = parseFirefoxWindowSeed(value, prefix);
  if (parsed) {
    return parsed.previousName;
  }
  return value.startsWith(prefix) ? "" : value;
};

export const buildFxWindowSeed = (
  currentWindowName: string,
  seedState: FirefoxWindowSeedState,
  prefix: string,
): string =>
  buildWindowNameTransport(
    {
      buildKey: FX_WINDOW_SEED_KEY,
      previousName: stripFirefoxWindowSeed(currentWindowName, prefix),
      seedState,
    },
    prefix,
  );

export const writeFxWindowSeed = (
  seedState: FirefoxWindowSeedState,
  prefix: string,
): void => {
  const currentWindow = globalThis as typeof globalThis & { name?: string };
  currentWindow.name = buildFxWindowSeed(currentWindow.name ?? "", seedState, prefix);
};

export const canPersistFxWindowSeed = (
  currentWindowName: string,
  seedState: FirefoxWindowSeedState,
  prefix: string,
): boolean => {
  const currentSeed = parseFirefoxWindowSeed(currentWindowName, prefix);
  if (!currentSeed) {
    return true;
  }
  return JSON.stringify(currentSeed.seedState) === JSON.stringify(seedState);
};
