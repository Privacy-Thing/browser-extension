import {
  buildFirefoxHashSeed,
  buildFxSeededUrl,
  buildFirefoxShimState,
  clearFirefoxStaticState,
  dispatchFxStateEvent,
  injectFxEphemeralState,
  isFirefoxShimState,
  parseFirefoxHashSeed,
  parseFxStateEvent,
  takeFxStaticState,
  takeFxEphemeralState,
  resolveFxSeedForHost,
  normalizeFxState,
  toSnapshotFromFxState,
  type FirefoxShimState,
} from "@privacy-brand/refract-browser/common/firefox-shim-state";
import type { RuntimeSnapshot } from "@privacy-brand/refract-core";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  FX_STATE_CHANGE_EVENT,
  FIREFOX_STATE_PORT_ID,
  FX_STATIC_CANDIDATES_KEY,
  SHIM_GUARD_KEY,
} from "@/shared/build-id-test-values";

const FIREFOX_HASH_SEED_PREFIX = `#${FIREFOX_STATE_PORT_ID}=`;

type FakeElement = {
  type: string;
  textContent: string | null;
  attributes: Map<string, string>;
  setAttribute: (name: string, value: string) => void;
  getAttribute: (name: string) => string | null;
  hasAttribute: (name: string) => boolean;
  remove: ReturnType<typeof vi.fn>;
};

const createRuntimeSnapshot = (baseEpochMs: number): RuntimeSnapshot => ({
  geo: {
    latitude: 52.23,
    longitude: 21.01,
    accuracy: 25,
    noiseRadius: 100,
  },
  locale: {
    language: "pl-PL",
    languages: ["pl-PL", "pl"],
    timeZone: "Europe/Warsaw",
    acceptLanguage: "pl-PL,pl;q=0.9",
    formattingLanguage: "pl-PL",
    formattingLanguages: ["pl-PL", "pl"],
  },
  date: {
    baseEpochMs,
    offsetMs: 0,
    timeZone: "Europe/Warsaw",
  },
  debugMode: false,
  watchPositionDelay: [60, 500],
  fingerprint: {
    hardwareConcurrency: 8,
    platform: "Win32",
  },
});

const createAbsentState = (): FirefoxShimState => ({
  bootstrap: {
    revision: 1,
  },
  geoStatus: "absent",
  geo: null,
  timeLocaleStatus: "absent",
  timeLocale: null,
  fingerprintStatus: "absent",
  fingerprint: null,
  debug: null,
  blockServiceWorkerRegistration: false,
});

const createReadyState = (): FirefoxShimState => ({
  bootstrap: {
    revision: 1,
  },
  geoStatus: "ready",
  geo: {
    latitude: 52.23,
    longitude: 21.01,
    accuracy: 25,
    noiseRadius: 100,
    watchPositionDelay: [60, 500],
  },
  timeLocaleStatus: "ready",
  timeLocale: {
    language: "pl-PL",
    languages: ["pl-PL", "pl"],
    formattingLanguage: "pl-PL",
    formattingLanguages: ["pl-PL", "pl"],
    timeZone: "Europe/Warsaw",
    offsetMinutes: -60,
  },
  fingerprintStatus: "ready",
  fingerprint: {
    hardwareConcurrency: 8,
    platform: "Win32",
  },
  debug: null,
  blockServiceWorkerRegistration: false,
});

const createLegacyReadyState = () => {
  const { bootstrap: _bootstrap, ...legacyState } = createReadyState();
  return legacyState;
};

const createFakeElement = (): FakeElement => {
  const attributes = new Map<string, string>();

  return {
    type: "",
    textContent: null,
    attributes,
    setAttribute(name: string, value: string) {
      attributes.set(name, value);
    },
    getAttribute(name: string) {
      return attributes.get(name) ?? null;
    },
    hasAttribute(name: string) {
      return attributes.has(name);
    },
    remove: vi.fn(),
  };
};

const createFakeDocument = () => {
  const elements: FakeElement[] = [];

  const fakeDocument = {
    head: {
      prepend: (element: FakeElement) => {
        elements.unshift(element);
      },
    },
    documentElement: {},
    createElement: (_tag: string) => createFakeElement(),
    querySelector: (selector: string): FakeElement | null => {
      for (const element of elements) {
        if (element.type !== "application/json") {
          continue;
        }

        const attributeMatches = [...selector.matchAll(/\[(data-[^\]=]+)\]/g)];
        const matches = attributeMatches.every((match) =>
          element.hasAttribute(match[1] ?? ""),
        );
        if (matches) {
          return element;
        }
      }

      return null;
    },
  };

  return {
    fakeDocument: fakeDocument as unknown as Document,
    elements,
  };
};

describe("buildFirefoxShimState", () => {
  it.each([
    ["2026-01-15T12:00:00.000Z", -60],
    ["2026-07-15T12:00:00.000Z", -120],
  ])(
    "stores the target getTimezoneOffset value for %s",
    (isoString, expectedOffsetMinutes) => {
      const snapshot = createRuntimeSnapshot(Date.parse(isoString));

      const state = buildFirefoxShimState(snapshot, { revision: 123 });

      expect(state).toMatchObject({
        bootstrap: {
          revision: 123,
        },
        geoStatus: "ready",
        geo: {
          latitude: snapshot.geo.latitude,
          longitude: snapshot.geo.longitude,
          accuracy: snapshot.geo.accuracy,
          noiseRadius: snapshot.geo.noiseRadius,
          watchPositionDelay: snapshot.watchPositionDelay,
        },
        timeLocaleStatus: "ready",
        timeLocale: {
          language: snapshot.locale.language,
          languages: snapshot.locale.languages,
          timeZone: snapshot.locale.timeZone,
          offsetMinutes: expectedOffsetMinutes,
        },
        fingerprintStatus: "ready",
        fingerprint: snapshot.fingerprint,
        debug: null,
      });
    },
  );

  it("returns an absent state for a null snapshot", () => {
    expect(buildFirefoxShimState(null, { revision: 123 })).toEqual({
      ...createAbsentState(),
      bootstrap: {
        revision: 123,
      },
    });
  });

  it("marks fingerprint data absent when the snapshot has no fingerprint payload", () => {
    const snapshot = createRuntimeSnapshot(Date.parse("2026-01-15T12:00:00.000Z"));
    delete snapshot.fingerprint;

    expect(buildFirefoxShimState(snapshot, { revision: 123 })).toMatchObject({
      bootstrap: {
        revision: 123,
      },
      geoStatus: "ready",
      timeLocaleStatus: "ready",
      fingerprintStatus: "absent",
      fingerprint: null,
      debug: null,
    });
  });

  it("preserves debug logging metadata when the runtime snapshot enables it", () => {
    const snapshot = createRuntimeSnapshot(Date.parse("2026-01-15T12:00:00.000Z"));
    snapshot.debugMode = true;
    snapshot.logEventName = "_bootstrap-debug";

    expect(buildFirefoxShimState(snapshot, { revision: 123 })).toMatchObject({
      bootstrap: {
        revision: 123,
      },
      debug: {
        enabled: true,
        logEventName: "_bootstrap-debug",
      },
    });
  });

  it("preserves split navigator and Intl locale defaults in Firefox shim state", () => {
    const snapshot = {
      ...createRuntimeSnapshot(Date.parse("2026-01-15T12:00:00.000Z")),
      locale: {
        language: "en",
        languages: ["en", "pl"],
        formattingLanguage: "pl",
        formattingLanguages: ["pl", "en-US"],
        timeZone: "Europe/Warsaw",
        acceptLanguage: "en,pl;q=0.9",
      },
    } satisfies RuntimeSnapshot;

    expect(buildFirefoxShimState(snapshot, { revision: 123 })).toMatchObject({
      timeLocale: {
        language: "en",
        languages: ["en", "pl"],
        formattingLanguage: "pl",
        formattingLanguages: ["pl", "en-US"],
        timeZone: "Europe/Warsaw",
      },
    });
  });

  it("round-trips the Temporal flag inside ready Time & Locale state", () => {
    const snapshot = {
      ...createRuntimeSnapshot(Date.parse("2026-01-15T12:00:00.000Z")),
      temporalApiEnabled: true,
    } satisfies RuntimeSnapshot;

    const state = buildFirefoxShimState(snapshot, { revision: 123 });
    expect(state.timeLocale).toMatchObject({ temporalApiEnabled: true });
    expect(
      toSnapshotFromFxState(state, { baseEpochMs: snapshot.date.baseEpochMs })
        ?.temporalApiEnabled,
    ).toBe(true);
  });

  it("marks geolocation absent when the runtime snapshot disables geolocation spoofing", () => {
    const snapshot = {
      ...createRuntimeSnapshot(Date.parse("2026-01-15T12:00:00.000Z")),
      geolocationEnabled: false,
    } satisfies RuntimeSnapshot;

    expect(buildFirefoxShimState(snapshot, { revision: 123 })).toMatchObject({
      bootstrap: {
        revision: 123,
      },
      geolocationEnabled: false,
      geoStatus: "absent",
      geo: null,
      timeLocaleStatus: "ready",
      fingerprintStatus: "ready",
    });
  });
});

describe("isFirefoxShimState", () => {
  it("accepts ready, absent, and null status variants", () => {
    expect(isFirefoxShimState(createReadyState())).toBe(true);
    expect(isFirefoxShimState(createAbsentState())).toBe(true);
    expect(
      isFirefoxShimState({
        ...createReadyState(),
        debug: {
          enabled: true,
          logEventName: "_firefox-bootstrap",
        },
      }),
    ).toBe(true);
    expect(
      isFirefoxShimState({
        bootstrap: {
          revision: 1,
        },
        geoStatus: null,
        geo: null,
        timeLocaleStatus: null,
        timeLocale: null,
        fingerprintStatus: null,
        fingerprint: null,
        debug: null,
      }),
    ).toBe(true);
  });

  it("rejects invalid status values", () => {
    expect(isFirefoxShimState({ ...createReadyState(), geoStatus: "invalid" })).toBe(
      false,
    );
    expect(
      isFirefoxShimState({ ...createReadyState(), timeLocaleStatus: "invalid" }),
    ).toBe(false);
    expect(
      isFirefoxShimState({ ...createReadyState(), fingerprintStatus: "invalid" }),
    ).toBe(false);
  });

  it("rejects invalid geo payloads", () => {
    expect(
      isFirefoxShimState({
        ...createReadyState(),
        geo: { latitude: "bad" },
      }),
    ).toBe(false);
    expect(
      isFirefoxShimState({
        ...createReadyState(),
        geo: {
          latitude: 52.23,
          longitude: 21.01,
          accuracy: 25,
          watchPositionDelay: [60],
        },
      }),
    ).toBe(false);
  });

  it("rejects invalid time-locale and fingerprint payloads", () => {
    expect(
      isFirefoxShimState({
        ...createReadyState(),
        timeLocale: { language: 123 },
      }),
    ).toBe(false);
    expect(
      isFirefoxShimState({
        ...createReadyState(),
        fingerprint: "bad",
      }),
    ).toBe(false);
    expect(
      isFirefoxShimState({
        ...createReadyState(),
        debug: { enabled: "yes", logEventName: null },
      }),
    ).toBe(false);
  });

  it("normalizes legacy states without bootstrap revision metadata", () => {
    expect(normalizeFxState(createLegacyReadyState())).toEqual({
      ...createReadyState(),
      bootstrap: {
        revision: 0,
      },
    });
  });
});

describe("Firefox hash seed helpers", () => {
  it("round-trips a hash payload while preserving the original hash", () => {
    const state = createReadyState();

    const hash = buildFirefoxHashSeed(state, "#section-1");
    const parsed = parseFirefoxHashSeed(hash);

    expect(hash.startsWith(FIREFOX_HASH_SEED_PREFIX)).toBe(true);
    expect(parsed).toEqual({
      originalHash: "#section-1",
      state,
    });
  });

  it("normalizes a preserved fragment without a leading #", () => {
    const parsed = parseFirefoxHashSeed(
      buildFirefoxHashSeed(createReadyState(), "section-2"),
    );

    expect(parsed?.originalHash).toBe("#section-2");
  });

  it("builds a seeded URL without nesting an existing payload", () => {
    const initialSeededUrl = buildFxSeededUrl(
      "https://example.com/path?demo=1#original",
      createReadyState(),
    );
    const reseededUrl = buildFxSeededUrl(initialSeededUrl, createAbsentState());

    expect(parseFirefoxHashSeed(new URL(reseededUrl).hash)).toEqual({
      originalHash: "#original",
      state: createAbsentState(),
    });
  });

  it("rejects malformed payloads", () => {
    expect(parseFirefoxHashSeed(`${FIREFOX_HASH_SEED_PREFIX}not-json`)).toBeNull();
    expect(
      parseFirefoxHashSeed(
        `${FIREFOX_HASH_SEED_PREFIX}${btoa('{"originalHash":42}').replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")}`,
      ),
    ).toBeNull();
  });

  it("rejects legacy hash payloads without the current build key", () => {
    const legacyState = createLegacyReadyState();
    const legacyHash = `${FIREFOX_HASH_SEED_PREFIX}${btoa(
      JSON.stringify({
        originalHash: "",
        state: legacyState,
      }),
    )
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "")}`;

    expect(parseFirefoxHashSeed(legacyHash)).toBeNull();
  });

  it("rejects hash payloads from a different build key", () => {
    const mismatchedHash = `${FIREFOX_HASH_SEED_PREFIX}${btoa(
      JSON.stringify({
        buildKey: "stale-build",
        originalHash: "",
        state: createReadyState(),
      }),
    )
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/g, "")}`;

    expect(parseFirefoxHashSeed(mismatchedHash)).toBeNull();
  });

  it("prefers the most specific hostname entry when resolving seed state", () => {
    const wildcardState: FirefoxShimState = {
      ...createReadyState(),
      timeLocale: {
        language: "en-US",
        languages: ["en-US"],
        timeZone: "America/New_York",
        offsetMinutes: 240,
      },
    };
    const exactState = createReadyState();
    const containerState: FirefoxShimState = {
      ...createAbsentState(),
      fingerprintStatus: "ready",
      fingerprint: {
        hardwareConcurrency: 4,
        platform: "Linux x86_64",
      },
    };

    expect(
      resolveFxSeedForHost("api.example.com", {
        entries: [
          { pattern: "*.example.com", state: wildcardState },
          { pattern: "api.example.com", state: exactState },
        ],
        containerState,
      }),
    ).toEqual(exactState);
  });

  it("keeps Native rule patterns in Firefox seed specificity resolution", () => {
    const protectedState = createReadyState();

    expect(
      resolveFxSeedForHost("www.linkedin.com", {
        entries: [{ pattern: "*", state: protectedState }],
        containerState: null,
        nativeRulePatterns: ["*linkedin.com"],
      }),
    ).toBeNull();
    expect(
      resolveFxSeedForHost("api.example.com", {
        entries: [{ pattern: "api.example.com", state: protectedState }],
        containerState: null,
        nativeRulePatterns: ["*example.com"],
      }),
    ).toEqual(protectedState);
  });

  it("falls back to container state when no hostname entry matches", () => {
    const containerState = createReadyState();

    expect(
      resolveFxSeedForHost("unmatched.test", {
        entries: [{ pattern: "example.com", state: createAbsentState() }],
        containerState,
      }),
    ).toEqual(containerState);
  });

  it("returns null when neither hostname entries nor container state match", () => {
    expect(
      resolveFxSeedForHost("unmatched.test", {
        entries: [],
        containerState: null,
      }),
    ).toBeNull();
  });

  it("reads the most specific static state candidate from the shared carrier", () => {
    const wildcardState: FirefoxShimState = {
      ...createReadyState(),
      timeLocale: {
        language: "en-US",
        languages: ["en-US"],
        timeZone: "America/New_York",
        offsetMinutes: 240,
      },
    };
    const exactState = createReadyState();
    const globalRecord = globalThis as Record<string | symbol, unknown>;
    const symbol = Symbol.for(FX_STATIC_CANDIDATES_KEY);

    globalRecord[symbol] = [
      {
        buildKey: SHIM_GUARD_KEY,
        pattern: "*.example.com",
        specificity: {
          nonWildcardLength: 12,
          exactMatchBonus: 0,
          subdomainOnlyBonus: 1,
          wildcardCount: 1,
        },
        state: wildcardState,
      },
      {
        buildKey: SHIM_GUARD_KEY,
        pattern: "app.example.com",
        specificity: {
          nonWildcardLength: 15,
          exactMatchBonus: 1,
          subdomainOnlyBonus: 0,
          wildcardCount: 0,
        },
        state: exactState,
      },
    ];

    expect(takeFxStaticState(globalThis, "app.example.com")).toEqual(exactState);
    expect(globalRecord[symbol]).toBeUndefined();
  });

  it("ignores static state candidates that do not match the current hostname", () => {
    const globalRecord = globalThis as Record<string | symbol, unknown>;
    const symbol = Symbol.for(FX_STATIC_CANDIDATES_KEY);

    globalRecord[symbol] = [
      {
        buildKey: SHIM_GUARD_KEY,
        pattern: "other.example.com",
        specificity: {
          nonWildcardLength: 17,
          exactMatchBonus: 1,
          subdomainOnlyBonus: 0,
          wildcardCount: 0,
        },
        state: createReadyState(),
      },
    ];

    expect(takeFxStaticState(globalThis, "app.example.com")).toBeNull();
    expect(globalRecord[symbol]).toBeUndefined();
  });

  it("ignores malformed static state candidates and clears the carrier", () => {
    const globalRecord = globalThis as Record<string | symbol, unknown>;
    const symbol = Symbol.for(FX_STATIC_CANDIDATES_KEY);

    globalRecord[symbol] = [{ bogus: true }];

    expect(takeFxStaticState(globalThis, "example.com")).toBeNull();
    expect(globalRecord[symbol]).toBeUndefined();
  });

  it("ignores static state candidates from a different build key", () => {
    const globalRecord = globalThis as Record<string | symbol, unknown>;
    const symbol = Symbol.for(FX_STATIC_CANDIDATES_KEY);

    globalRecord[symbol] = [
      {
        buildKey: "stale-build",
        pattern: "example.com",
        specificity: {
          nonWildcardLength: 11,
          exactMatchBonus: 1,
          subdomainOnlyBonus: 0,
          wildcardCount: 0,
        },
        state: createReadyState(),
      },
    ];

    expect(takeFxStaticState(globalThis, "example.com")).toBeNull();
    expect(globalRecord[symbol]).toBeUndefined();
  });

  it("clears the static state carrier without consuming it", () => {
    const globalRecord = globalThis as Record<string | symbol, unknown>;
    const symbol = Symbol.for(FX_STATIC_CANDIDATES_KEY);

    globalRecord[symbol] = ["candidate"];
    clearFirefoxStaticState(globalThis);

    expect(globalRecord[symbol]).toBeUndefined();
  });

  it("preserves blockServiceWorkerRegistration from runtime snapshots", () => {
    const baseEpochMs = Date.parse("2026-01-15T12:00:00.000Z");
    const state = buildFirefoxShimState({
      ...createRuntimeSnapshot(baseEpochMs),
      blockServiceWorkerRegistration: true,
    });

    expect(state.blockServiceWorkerRegistration).toBe(true);
  });

  it("preserves SharedWorker compatibility opt-out from runtime snapshots", () => {
    const baseEpochMs = Date.parse("2026-01-15T12:00:00.000Z");
    const state = buildFirefoxShimState({
      ...createRuntimeSnapshot(baseEpochMs),
      sharedWorkerCompatibilityMode: false,
    });

    expect(state.sharedWorkerCompatibilityMode).toBe(false);
    expect(state.sharedWorkerHandlingMode).toBe("spoof");
  });

  it("preserves SharedWorker strict mode from runtime snapshots", () => {
    const baseEpochMs = Date.parse("2026-01-15T12:00:00.000Z");
    const state = buildFirefoxShimState({
      ...createRuntimeSnapshot(baseEpochMs),
      sharedWorkerHandlingMode: "strict",
      sharedWorkerCompatibilityMode: false,
    });

    expect(state.sharedWorkerHandlingMode).toBe("strict");
    expect(state.sharedWorkerCompatibilityMode).toBe(false);
  });

  it("converts a ready shim state back into a runtime snapshot for worker bootstraps", () => {
    const baseEpochMs = Date.parse("2026-01-15T12:00:00.000Z");
    const state: FirefoxShimState = {
      ...createReadyState(),
      sharedWorkerCompatibilityMode: false,
      blockServiceWorkerRegistration: true,
    };

    const snapshot = toSnapshotFromFxState(state, { baseEpochMs });

    expect(snapshot).not.toBeNull();
    expect(snapshot).toMatchObject({
      geo: {
        latitude: 52.23,
        longitude: 21.01,
        accuracy: 25,
        noiseRadius: 100,
      },
      locale: {
        language: "pl-PL",
        languages: ["pl-PL", "pl"],
        timeZone: "Europe/Warsaw",
        acceptLanguage: "pl-PL,pl;q=0.9",
      },
      date: {
        baseEpochMs,
        timeZone: "Europe/Warsaw",
      },
      watchPositionDelay: [60, 500],
      fingerprint: {
        hardwareConcurrency: 8,
        platform: "Win32",
      },
      sharedWorkerHandlingMode: "spoof",
      sharedWorkerCompatibilityMode: false,
      blockServiceWorkerRegistration: true,
    });
  });

  it("restores split navigator and Intl locale defaults from shim state", () => {
    const baseEpochMs = Date.parse("2026-01-15T12:00:00.000Z");
    const state: FirefoxShimState = {
      ...createReadyState(),
      timeLocale: {
        language: "en",
        languages: ["en", "pl"],
        formattingLanguage: "pl",
        formattingLanguages: ["pl", "en-US"],
        timeZone: "Europe/Warsaw",
        offsetMinutes: -60,
      },
    };

    const snapshot = toSnapshotFromFxState(state, { baseEpochMs });

    expect(snapshot?.locale).toMatchObject({
      language: "en",
      languages: ["en", "pl"],
      formattingLanguage: "pl",
      formattingLanguages: ["pl", "en-US"],
      acceptLanguage: "en,pl;q=0.9",
    });
  });

  it("rebuilds non-geolocation Firefox shim state for worker bootstraps", () => {
    const baseEpochMs = Date.parse("2026-01-15T12:00:00.000Z");
    const state: FirefoxShimState = {
      ...createReadyState(),
      geolocationEnabled: false,
      geoStatus: "absent",
      geo: null,
    };

    const snapshot = toSnapshotFromFxState(state, { baseEpochMs });

    expect(snapshot).toMatchObject({
      geolocationEnabled: false,
      locale: {
        language: "pl-PL",
        languages: ["pl-PL", "pl"],
        timeZone: "Europe/Warsaw",
      },
      date: {
        baseEpochMs,
        timeZone: "Europe/Warsaw",
      },
      fingerprint: {
        hardwareConcurrency: 8,
        platform: "Win32",
      },
    });
  });

  it("keeps fingerprint-only runtime data when geo/timeLocale state is absent", () => {
    expect(toSnapshotFromFxState(createAbsentState())).toMatchObject({
      geolocationEnabled: false,
      timeLocaleEnabled: false,
      geo: {
        latitude: 0,
        longitude: 0,
        accuracy: 0,
      },
    });
  });
});

describe("parseFxStateEvent", () => {
  it("parses a valid CustomEvent payload", () => {
    const state = createReadyState();

    expect(
      parseFxStateEvent(
        new CustomEvent("shim-state", {
          detail: JSON.stringify(state),
        }),
      ),
    ).toEqual(state);
  });

  it("accepts legacy CustomEvent payloads without bootstrap metadata", () => {
    const state = createLegacyReadyState();
    const event = new CustomEvent(FX_STATE_CHANGE_EVENT, {
      detail: JSON.stringify(state),
    });

    expect(parseFxStateEvent(event)).toEqual({
      ...createReadyState(),
      bootstrap: {
        revision: 0,
      },
    });
  });

  it("rejects invalid event payloads", () => {
    expect(parseFxStateEvent(new Event("shim-state"))).toBeNull();
    expect(parseFxStateEvent(new CustomEvent("shim-state", { detail: 42 }))).toBeNull();
    expect(
      parseFxStateEvent(new CustomEvent("shim-state", { detail: "not-json{" })),
    ).toBeNull();
    expect(
      parseFxStateEvent(
        new CustomEvent("shim-state", {
          detail: JSON.stringify({ invalid: true }),
        }),
      ),
    ).toBeNull();
  });
});

describe("ephemeral DOM transport", () => {
  it("round-trips a ready state and removes the bootstrap element after a successful read", () => {
    const { fakeDocument, elements } = createFakeDocument();
    const state = createReadyState();

    injectFxEphemeralState(fakeDocument, state);

    const result = takeFxEphemeralState(fakeDocument);

    expect(result).toEqual(state);
    expect(elements[0]?.remove).toHaveBeenCalledTimes(1);
  });

  it("replaces a stale bootstrap element before injecting the next state", () => {
    const { fakeDocument, elements } = createFakeDocument();

    injectFxEphemeralState(fakeDocument, createAbsentState());
    const staleElement = elements[0];

    injectFxEphemeralState(fakeDocument, createReadyState());
    const result = takeFxEphemeralState(fakeDocument);

    expect(staleElement?.remove).toHaveBeenCalledTimes(1);
    expect(result).toEqual(createReadyState());
  });

  it("leaves malformed bootstrap payloads in place for unrelated readers", () => {
    const { fakeDocument, elements } = createFakeDocument();

    injectFxEphemeralState(fakeDocument, createReadyState());
    elements[0]!.textContent = "not-json{";

    const result = takeFxEphemeralState(fakeDocument);

    expect(result).toBeNull();
    expect(elements[0]?.remove).not.toHaveBeenCalled();
  });

  it("tags the bootstrap element with a data-* marker instead of relying on dataset", () => {
    const { fakeDocument, elements } = createFakeDocument();

    injectFxEphemeralState(fakeDocument, createReadyState());

    expect(
      Array.from(elements[0]?.attributes.keys() ?? []).some((name) =>
        name.startsWith("data-"),
      ),
    ).toBe(true);
  });

  it("returns null when no bootstrap element is present", () => {
    const { fakeDocument } = createFakeDocument();

    expect(takeFxEphemeralState(fakeDocument)).toBeNull();
  });
});

describe("dispatchFxStateEvent", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("emits a single document event with a parseable payload", () => {
    const state = createReadyState();
    const fakeDocument = new EventTarget();
    const documentListener = vi.fn((event: Event) => parseFxStateEvent(event));
    const windowDispatch = vi.fn();

    vi.stubGlobal("document", fakeDocument);
    vi.stubGlobal("dispatchEvent", windowDispatch);

    fakeDocument.addEventListener(FX_STATE_CHANGE_EVENT, documentListener, {
      once: true,
    });

    dispatchFxStateEvent(state);

    expect(documentListener).toHaveBeenCalledTimes(1);
    expect(documentListener.mock.results[0]?.value).toEqual(state);
    expect(windowDispatch).not.toHaveBeenCalled();
  });
});
