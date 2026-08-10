import { createIntegrityRegistry } from "@privacy-brand/refract-core/integrity/surface-integrity-registry";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  defineGetter,
  installLocalePatch,
  installNavigatorPatch,
} from "@/injection/main/locale-patch";
import type { SpoofingSurfaceKey } from "@/shared/spoofing-surfaces";
import type { RuntimeSnapshot, SpoofingSurfaceMethodId } from "@/shared/types";

class FakeNavigator {}

const nativeLanguageDesc = Object.getOwnPropertyDescriptor(
  FakeNavigator.prototype,
  "language",
);
const nativeLanguagesDesc = Object.getOwnPropertyDescriptor(
  FakeNavigator.prototype,
  "languages",
);
const nativeTouchPointsDesc = Object.getOwnPropertyDescriptor(
  FakeNavigator.prototype,
  "maxTouchPoints",
);
const nativeCpuCountDesc = Object.getOwnPropertyDescriptor(
  FakeNavigator.prototype,
  "hardwareConcurrency",
);
const nativeMemoryDesc = Object.getOwnPropertyDescriptor(
  FakeNavigator.prototype,
  "deviceMemory",
);
const nativeWebdriverDesc = Object.getOwnPropertyDescriptor(
  FakeNavigator.prototype,
  "webdriver",
);

const buildSnapshot = (language: string, languages: string[]): RuntimeSnapshot => ({
  geo: {
    latitude: 52.2297,
    longitude: 21.0122,
    accuracy: 25,
    noiseRadius: 50,
  },
  locale: {
    language,
    languages,
    timeZone: "Europe/Warsaw",
    acceptLanguage: languages.join(","),
  },
  date: {
    baseEpochMs: Date.parse("2026-01-15T12:00:00.000Z"),
    offsetMs: 0,
    timeZone: "Europe/Warsaw",
  },
  debugMode: false,
  watchPositionDelay: [60, 500],
});

describe("installLocalePatch", () => {
  afterEach(() => {
    vi.unstubAllGlobals();

    if (nativeLanguageDesc) {
      Object.defineProperty(FakeNavigator.prototype, "language", nativeLanguageDesc);
    } else {
      delete (FakeNavigator.prototype as { language?: string }).language;
    }

    if (nativeLanguagesDesc) {
      Object.defineProperty(FakeNavigator.prototype, "languages", nativeLanguagesDesc);
    } else {
      delete (FakeNavigator.prototype as { languages?: string[] }).languages;
    }

    if (nativeTouchPointsDesc) {
      Object.defineProperty(
        FakeNavigator.prototype,
        "maxTouchPoints",
        nativeTouchPointsDesc,
      );
    } else {
      delete (FakeNavigator.prototype as { maxTouchPoints?: number }).maxTouchPoints;
    }

    for (const [property, descriptor] of [
      ["hardwareConcurrency", nativeCpuCountDesc],
      ["deviceMemory", nativeMemoryDesc],
      ["webdriver", nativeWebdriverDesc],
    ] as const) {
      if (descriptor) {
        Object.defineProperty(FakeNavigator.prototype, property, descriptor);
      } else {
        Reflect.deleteProperty(FakeNavigator.prototype, property);
      }
    }
  });

  it.each([
    {
      language: "pl-PL",
      languages: ["pl-PL", "pl"],
    },
    {
      language: "fr-FR",
      languages: ["fr-FR", "fr"],
    },
  ])("spoofs navigator language getters for $language", ({ language, languages }) => {
    const snapshot = buildSnapshot(language, languages);
    installLocalePatch(snapshot, FakeNavigator.prototype);

    const navigator = new FakeNavigator() as FakeNavigator & {
      language: string;
      languages: string[];
    };

    expect(navigator.language).toBe(language);
    expect(navigator.languages).toEqual(languages);

    const languageGetter = Object.getOwnPropertyDescriptor(
      FakeNavigator.prototype,
      "language",
    )?.get;
    const languagesGetter = Object.getOwnPropertyDescriptor(
      FakeNavigator.prototype,
      "languages",
    )?.get;

    expect(languageGetter?.toString()).toContain("[native code]");
    expect(languagesGetter?.toString()).toContain("[native code]");
  });

  it("overrides an existing navigator locale shim with the runtime snapshot", () => {
    Object.defineProperty(FakeNavigator.prototype, "language", {
      configurable: true,
      get(): string {
        return "en-US";
      },
    });
    Object.defineProperty(FakeNavigator.prototype, "languages", {
      configurable: true,
      get(): string[] {
        return ["en-US", "en"];
      },
    });

    const snapshot = buildSnapshot("pl-PL", ["pl-PL", "pl"]);
    installLocalePatch(snapshot, FakeNavigator.prototype);

    const navigator = new FakeNavigator() as FakeNavigator & {
      language: string;
      languages: string[];
    };

    expect(navigator.language).toBe("pl-PL");
    expect(navigator.languages).toEqual(["pl-PL", "pl"]);
  });

  it("repairs a deleted locale getter from its canonical installed descriptor", () => {
    const snapshot = buildSnapshot("pl-PL", ["pl-PL", "pl"]);
    const navigator = new FakeNavigator() as FakeNavigator & {
      language: string;
    };
    const integrity = createIntegrityRegistry<
      SpoofingSurfaceKey,
      SpoofingSurfaceMethodId
    >({ now: () => 1 });
    installLocalePatch(snapshot, FakeNavigator.prototype, {
      registrar: integrity,
      realmId: "document",
      receiver: navigator,
    });

    expect(Reflect.deleteProperty(FakeNavigator.prototype, "language")).toBe(true);
    expect(integrity.ensureSurface("timeLocale")).toContainEqual(
      expect.objectContaining({
        status: "repaired",
        reason: "descriptor-missing",
      }),
    );
    expect(navigator.language).toBe("pl-PL");
  });

  it("preserves illegal invocation behavior for prototype access", () => {
    Object.defineProperty(FakeNavigator.prototype, "language", {
      configurable: true,
      get(this: FakeNavigator): string {
        if (!(this instanceof FakeNavigator)) {
          throw new TypeError("Illegal invocation");
        }

        return "en-US";
      },
    });

    defineGetter(FakeNavigator.prototype, "language", () => "pl-PL");

    const getter = Object.getOwnPropertyDescriptor(
      FakeNavigator.prototype,
      "language",
    )?.get;

    expect(() => getter?.call(FakeNavigator.prototype)).toThrow(TypeError);
  });

  it("spoofs navigator maxTouchPoints from the runtime fingerprint", () => {
    Object.defineProperty(FakeNavigator.prototype, "maxTouchPoints", {
      configurable: true,
      get(): number {
        return 0;
      },
    });

    const snapshot = {
      ...buildSnapshot("pl-PL", ["pl-PL", "pl"]),
      fingerprint: {
        maxTouchPoints: 5,
        spoofingToggles: {
          navigator: true,
        },
      },
    } satisfies RuntimeSnapshot;

    installNavigatorPatch(snapshot, FakeNavigator.prototype);

    const navigator = new FakeNavigator() as FakeNavigator & { maxTouchPoints: number };

    expect(navigator.maxTouchPoints).toBe(5);
    expect(
      Object.getOwnPropertyDescriptor(
        FakeNavigator.prototype,
        "maxTouchPoints",
      )?.get?.toString(),
    ).toContain("[native code]");
  });

  it("spoofs navigator hardwareConcurrency from the runtime fingerprint", () => {
    Object.defineProperty(FakeNavigator.prototype, "hardwareConcurrency", {
      configurable: true,
      get(): number {
        return 2;
      },
    });

    const snapshot = {
      ...buildSnapshot("pl-PL", ["pl-PL", "pl"]),
      fingerprint: {
        hardwareConcurrency: 12,
        spoofingToggles: {
          navigator: true,
        },
      },
    } satisfies RuntimeSnapshot;

    installNavigatorPatch(snapshot, FakeNavigator.prototype);

    const navigator = new FakeNavigator() as FakeNavigator & {
      hardwareConcurrency: number;
    };

    expect(navigator.hardwareConcurrency).toBe(12);
    expect(
      Object.getOwnPropertyDescriptor(
        FakeNavigator.prototype,
        "hardwareConcurrency",
      )?.get?.toString(),
    ).toContain("[native code]");
  });

  it("repairs an attacker replacement of a navigator fingerprint getter", () => {
    Object.defineProperty(FakeNavigator.prototype, "hardwareConcurrency", {
      configurable: true,
      get(): number {
        return 2;
      },
    });
    const snapshot = {
      ...buildSnapshot("pl-PL", ["pl-PL", "pl"]),
      fingerprint: {
        hardwareConcurrency: 12,
        spoofingToggles: { navigator: true },
      },
    } satisfies RuntimeSnapshot;
    const navigator = new FakeNavigator() as FakeNavigator & {
      hardwareConcurrency: number;
    };
    const integrity = createIntegrityRegistry<
      SpoofingSurfaceKey,
      SpoofingSurfaceMethodId
    >({ now: () => 1 });
    installNavigatorPatch(snapshot, FakeNavigator.prototype, {
      registrar: integrity,
      realmId: "document",
      receiver: navigator,
    });
    Object.defineProperty(FakeNavigator.prototype, "hardwareConcurrency", {
      configurable: true,
      get: () => 1,
    });

    expect(integrity.ensureSurface("navigator")).toContainEqual(
      expect.objectContaining({
        status: "repaired",
        methodId: "navigator.hardwareConcurrency",
        reason: "descriptor-replaced",
      }),
    );
    expect(navigator.hardwareConcurrency).toBe(12);
  });

  it("does not add maxTouchPoints when the target does not expose it natively", () => {
    const target = {};
    const snapshot = {
      ...buildSnapshot("pl-PL", ["pl-PL", "pl"]),
      fingerprint: {
        maxTouchPoints: 5,
        spoofingToggles: {
          navigator: true,
        },
      },
    } satisfies RuntimeSnapshot;

    installNavigatorPatch(snapshot, target);

    expect("maxTouchPoints" in target).toBe(false);
  });

  it("leaves maxTouchPoints native when navigator spoofing is disabled", () => {
    Object.defineProperty(FakeNavigator.prototype, "maxTouchPoints", {
      configurable: true,
      get(): number {
        return 2;
      },
    });

    const snapshot = {
      ...buildSnapshot("pl-PL", ["pl-PL", "pl"]),
      fingerprint: {
        maxTouchPoints: 5,
        spoofingToggles: {
          navigator: false,
        },
      },
    } satisfies RuntimeSnapshot;

    installNavigatorPatch(snapshot, FakeNavigator.prototype);

    const navigator = new FakeNavigator() as FakeNavigator & { maxTouchPoints: number };

    expect(navigator.maxTouchPoints).toBe(2);
    expect("webdriver" in navigator).toBe(false);
  });

  it("uses the provided target for deviceMemory without depending on global navigator", () => {
    vi.stubGlobal("navigator", undefined);

    const target = { deviceMemory: 4 };
    const snapshot = {
      ...buildSnapshot("pl-PL", ["pl-PL", "pl"]),
      fingerprint: {
        deviceMemory: 8,
        spoofingToggles: {
          navigator: true,
        },
      },
    } satisfies RuntimeSnapshot;

    expect(() => installNavigatorPatch(snapshot, target)).not.toThrow();
    expect((target as { deviceMemory: number }).deviceMemory).toBe(8);
  });

  it("spoofs navigator deviceMemory on native targets", () => {
    Object.defineProperty(FakeNavigator.prototype, "deviceMemory", {
      configurable: true,
      get(): number {
        return 4;
      },
    });

    const snapshot = {
      ...buildSnapshot("pl-PL", ["pl-PL", "pl"]),
      fingerprint: {
        deviceMemory: 16,
        spoofingToggles: {
          navigator: true,
        },
      },
    } satisfies RuntimeSnapshot;

    installNavigatorPatch(snapshot, FakeNavigator.prototype);

    const navigator = new FakeNavigator() as FakeNavigator & {
      deviceMemory: number;
    };

    expect(navigator.deviceMemory).toBe(16);
  });
});
