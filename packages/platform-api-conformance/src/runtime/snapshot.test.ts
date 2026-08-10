import { describe, expect, it } from "vitest";

import { buildSnapshotCacheKey, deriveChromiumExtId } from "./snapshot.js";

const BASE_CONFIG = {
  apiSurfaces: ["Navigator.prototype"],
  valueProbes: [],
};

describe("deriveChromiumExtId", () => {
  it("matches Chromium's path-derived unpacked extension ID", () => {
    expect(deriveChromiumExtId("/tmp/privacy-thing-extension")).toBe(
      "imhokoafoeehcmljbnpkcdbelbdilncm",
    );
  });
});

function createRuntimeActivator(overrides?: {
  fingerprintUserAgent?: string;
  baseEpochMs?: number;
}) {
  return {
    entries: [
      {
        pattern: "*",
        blockServiceWorkerRegistration: false,
        snapshot: {
          geo: { latitude: 1, longitude: 2, accuracy: 3, noiseRadius: 4 },
          locale: {
            language: "en-GB",
            languages: ["en-GB", "en"],
            timeZone: "Europe/London",
            acceptLanguage: "en-GB,en;q=0.9",
          },
          date: {
            baseEpochMs: overrides?.baseEpochMs ?? 1,
            offsetMs: 0,
            timeZone: "Europe/London",
          },
          debugMode: false,
          watchPositionDelay: [100, 500] as [number, number],
          fingerprint: {
            userAgent:
              overrides?.fingerprintUserAgent ??
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          },
          blockServiceWorkerRegistration: false,
        },
      },
    ],
  };
}

function createFxSeededInput(overrides?: {
  language?: string;
  languages?: readonly string[];
  timeZone?: string;
  locationId?: string;
  runtimeTestHost?: string;
}) {
  const runtimeTestHost = overrides?.runtimeTestHost ?? "127.0.0.1";
  const locationId = overrides?.locationId ?? "warsaw";
  const language = overrides?.language ?? "pl-PL";
  const languages = overrides?.languages ?? ["pl-PL", "pl"];
  const timeZone = overrides?.timeZone ?? "Europe/Warsaw";

  return {
    runtimeTestHost,
    seededRule: {
      pattern: runtimeTestHost,
      locationId,
      enabled: true,
      blockServiceWorkerRegistration: false,
    },
    seededLocation: {
      id: locationId,
      latitude: 52.2297,
      longitude: 21.0122,
      accuracy: 25,
      noiseRadius: 50,
      language,
      languages,
      timeZone,
    },
    readiness: {
      language,
      languages,
    },
  };
}

describe("buildSnapshotCacheKey", () => {
  it("does not change when date.baseEpochMs changes", () => {
    const firstKey = buildSnapshotCacheKey(
      BASE_CONFIG,
      createRuntimeActivator({ baseEpochMs: 1 }),
      createFxSeededInput(),
    );
    const secondKey = buildSnapshotCacheKey(
      BASE_CONFIG,
      createRuntimeActivator({ baseEpochMs: 9_999_999 }),
      createFxSeededInput(),
    );

    expect(firstKey).toBe(secondKey);
  });

  it("changes when the fingerprint payload changes", () => {
    const firstKey = buildSnapshotCacheKey(
      BASE_CONFIG,
      createRuntimeActivator({ fingerprintUserAgent: "ua-one" }),
      createFxSeededInput(),
    );
    const secondKey = buildSnapshotCacheKey(
      BASE_CONFIG,
      createRuntimeActivator({ fingerprintUserAgent: "ua-two" }),
      createFxSeededInput(),
    );

    expect(firstKey).not.toBe(secondKey);
  });

  it("changes when Firefox seeded capture inputs change", () => {
    const firstKey = buildSnapshotCacheKey(
      BASE_CONFIG,
      createRuntimeActivator(),
      createFxSeededInput({
        language: "pl-PL",
        languages: ["pl-PL", "pl"],
        timeZone: "Europe/Warsaw",
        locationId: "warsaw",
      }),
    );
    const secondKey = buildSnapshotCacheKey(
      BASE_CONFIG,
      createRuntimeActivator(),
      createFxSeededInput({
        language: "en-GB",
        languages: ["en-GB", "en"],
        timeZone: "Europe/London",
        locationId: "london",
      }),
    );

    expect(firstKey).not.toBe(secondKey);
  });

  it("changes when value probe definitions change", () => {
    const firstKey = buildSnapshotCacheKey(
      {
        ...BASE_CONFIG,
        valueProbes: [
          { expression: "navigator.language", api: "Navigator.prototype.language" },
        ],
      },
      createRuntimeActivator(),
      createFxSeededInput(),
    );
    const secondKey = buildSnapshotCacheKey(
      {
        ...BASE_CONFIG,
        valueProbes: [
          {
            expression: "navigator.language",
            api: "Worker.Navigator.prototype.language",
            context: "worker" as const,
          },
        ],
      },
      createRuntimeActivator(),
      createFxSeededInput(),
    );

    expect(firstKey).not.toBe(secondKey);
  });

  it("changes when function-lies probe parameters change", () => {
    const firstKey = buildSnapshotCacheKey(
      {
        ...BASE_CONFIG,
        valueProbes: [
          {
            kind: "function-lies" as const,
            expression: "Date.prototype.toString",
            receiverExpression: "Date.prototype",
            api: "Date.prototype.toString(lies)",
          },
        ],
      },
      createRuntimeActivator(),
      createFxSeededInput(),
    );
    const secondKey = buildSnapshotCacheKey(
      {
        ...BASE_CONFIG,
        valueProbes: [
          {
            kind: "function-lies" as const,
            expression: "Date.prototype.toString",
            receiverExpression: "new Date(0)",
            api: "Date.prototype.toString(lies)",
          },
        ],
      },
      createRuntimeActivator(),
      createFxSeededInput(),
    );

    expect(firstKey).not.toBe(secondKey);
  });

  it("changes when probe expectation metadata changes", () => {
    const firstKey = buildSnapshotCacheKey(
      {
        ...BASE_CONFIG,
        valueProbes: [
          {
            expression: "new Date(0).toString()",
            api: "Date.prototype.toString",
            expectedPattern: "^ok$",
            category: "compatibility" as const,
          },
        ],
      },
      createRuntimeActivator(),
      createFxSeededInput(),
    );
    const secondKey = buildSnapshotCacheKey(
      {
        ...BASE_CONFIG,
        valueProbes: [
          {
            expression: "new Date(0).toString()",
            api: "Date.prototype.toString",
            expectedPattern: "^invalid$",
            category: "compatibility" as const,
          },
        ],
      },
      createRuntimeActivator(),
      createFxSeededInput(),
    );

    expect(firstKey).not.toBe(secondKey);
  });
});
