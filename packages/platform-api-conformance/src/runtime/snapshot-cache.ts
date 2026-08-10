import { createHash } from "node:crypto";

import type { Config } from "../types.js";

import {
  FX_SEEDED_INPUT,
  TEST_RUNTIME_ACTIVATOR,
  type ActivatorCacheInput,
  type FxSeededInput,
  type SnapshotRuntimeActivator,
} from "./snapshot-fixtures.js";

const sortKeysRecursively = (value: unknown): unknown => {
  if (Array.isArray(value)) {
    return value.map(sortKeysRecursively);
  }

  if (value == null || typeof value !== "object") {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nestedValue]) => [key, sortKeysRecursively(nestedValue)]),
  );
};

const createActivatorInput = (
  runtimeActivator: SnapshotRuntimeActivator,
): ActivatorCacheInput => {
  return {
    entries: runtimeActivator.entries.map((entry) => {
      const stableDate = {
        offsetMs: entry.snapshot.date.offsetMs,
        timeZone: entry.snapshot.date.timeZone,
      };

      return {
        pattern: entry.pattern,
        blockServiceWorkerRegistration: entry.blockServiceWorkerRegistration,
        snapshot: {
          ...entry.snapshot,
          date: stableDate,
        },
      };
    }),
  };
};

export function buildSnapshotCacheKey(
  config: Pick<Config, "apiSurfaces" | "valueProbes">,
  runtimeActivator: SnapshotRuntimeActivator = TEST_RUNTIME_ACTIVATOR,
  fxSeededInput: FxSeededInput = FX_SEEDED_INPUT,
): string {
  const cacheInput = sortKeysRecursively({
    surfaces: config.apiSurfaces,
    probes: config.valueProbes ?? [],
    runtimeActivator: createActivatorInput(runtimeActivator),
    fxSeededInput,
  });

  return createHash("sha256")
    .update(JSON.stringify(cacheInput))
    .digest("hex")
    .slice(0, 12);
}

export function deriveChromiumExtId(extensionPath: string): string {
  const idBytes = createHash("sha256").update(extensionPath).digest().subarray(0, 16);

  return Array.from(
    idBytes,
    (byte) =>
      `${String.fromCharCode(97 + (byte >> 4))}${String.fromCharCode(97 + (byte & 0x0f))}`,
  ).join("");
}
