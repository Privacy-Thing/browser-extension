/**
 * Lightweight realm simulation for integration tests.
 *
 * Creates a fake window-like global that mimics the essential shape of a
 * browser realm without requiring a full E2E browser. Used for:
 * - idempotency tests (install once vs twice)
 * - descriptor shape verification
 * - native toString masking
 * - cross-realm iframe propagation logic
 *
 * Limitations: no real DOM, no actual native prototypes. Use E2E tests for
 * things that require the real browser runtime (CSP, Worker, actual Date).
 */

export type FakeGeolocation = {
  getCurrentPosition: (...args: unknown[]) => void;
  watchPosition: (...args: unknown[]) => number;
  clearWatch: (id: number) => void;
};

export type FakePermissions = {
  query: (descriptor: { name: string }) => Promise<{ name: string; state: string }>;
};

export type FakeNavigator = {
  geolocation: FakeGeolocation;
  permissions: FakePermissions;
  language: string;
  languages: readonly string[];
  userAgent: string;
  userAgentData?: unknown;
  deviceMemory?: number;
  hardwareConcurrency?: number;
};

export type FakeDate = {
  prototype: { getTimezoneOffset: () => number };
  new (value?: unknown): { getTimezoneOffset: () => number; getTime: () => number };
};

export type FakeIntl = {
  DateTimeFormat: {
    prototype: { format: (date?: Date) => string };
    new (locale?: string, options?: Intl.DateTimeFormatOptions): Intl.DateTimeFormat;
  };
};

export type WindowRealm = {
  /** The fake globalThis for this realm. */
  global: typeof globalThis;
  /** Mutation-observable references to key APIs. */
  navigator: FakeNavigator;
  geolocation: FakeGeolocation;
  permissions: FakePermissions;
};

/**
 * Creates a minimal fake window realm for Refract integration tests.
 * All API objects are plain JS objects — no real browser prototype chain.
 */
export const createWindowRealm = (): WindowRealm => {
  const timers = new Map<number, ReturnType<typeof setTimeout>>();
  let nextTimerId = 1;

  const fakeGeolocation: FakeGeolocation = {
    getCurrentPosition: () => {},
    watchPosition: () => 0,
    clearWatch: () => {},
  };

  const fakePermissions: FakePermissions = {
    query: async () => ({ name: "geolocation", state: "prompt" }),
  };

  const fakeNavigator: FakeNavigator = {
    geolocation: fakeGeolocation,
    permissions: fakePermissions,
    language: "en-US",
    languages: ["en-US", "en"],
    userAgent: "Mozilla/5.0 (fake realm)",
    hardwareConcurrency: 4,
  };

  const fakeGlobal = {
    navigator: fakeNavigator,
    Date: globalThis.Date,
    Intl: globalThis.Intl,
    Geolocation: undefined,
    Permissions: undefined,
    HTMLIFrameElement: undefined,
    setTimeout: (fn: () => void, delay: number): number => {
      const id = nextTimerId++;
      timers.set(id, setTimeout(fn, delay));
      return id;
    },
    clearTimeout: (id: number): void => {
      const real = timers.get(id);
      if (real !== undefined) {
        clearTimeout(real);
        timers.delete(id);
      }
    },
    location: { hostname: "test.example.com", hash: "", search: "", pathname: "/" },
    history: { replaceState: () => {} },
    document: {
      visibilityState: "visible" as DocumentVisibilityState,
      documentElement: { setAttribute: () => {} },
    },
    addEventListener: () => {},
    removeEventListener: () => {},
    postMessage: () => {},
  } as unknown as typeof globalThis;

  return {
    global: fakeGlobal,
    navigator: fakeNavigator,
    geolocation: fakeGeolocation,
    permissions: fakePermissions,
  };
};
