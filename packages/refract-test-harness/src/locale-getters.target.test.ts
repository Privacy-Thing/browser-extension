import {
  installLocaleGetters,
  LOCALE_GETTERS_SOURCE,
} from "@privacy-brand/refract-core";
import { describe, expect, it, vi } from "vitest";

describe("installLocaleGetters", () => {
  it("registers both locale getters through the provided adapter", () => {
    const defineGetter = vi.fn();

    installLocaleGetters(defineGetter, {
      language: () => "pl-PL",
      languages: () => ["pl-PL", "pl"],
    });

    expect(defineGetter).toHaveBeenCalledTimes(2);
    expect(defineGetter.mock.calls[0]?.[0]).toBe("language");
    expect(defineGetter.mock.calls[1]?.[0]).toBe("languages");
    expect(defineGetter.mock.calls[0]?.[1]()).toBe("pl-PL");
    expect(defineGetter.mock.calls[1]?.[1]()).toEqual(["pl-PL", "pl"]);
  });

  it("keeps the readers live for adapters with mutable runtime state", () => {
    let language = "en-US";
    let languages: readonly string[] = ["en-US", "en"];
    const installed = new Map<string, () => unknown>();

    installLocaleGetters(
      (property, getter) => {
        installed.set(property, getter);
      },
      {
        language: () => language,
        languages: () => languages,
      },
    );

    language = "fr-FR";
    languages = ["fr-FR", "fr"];

    expect(installed.get("language")?.()).toBe("fr-FR");
    expect(installed.get("languages")?.()).toEqual(["fr-FR", "fr"]);
  });

  it("does not invoke inherited array index setters for navigator.languages", () => {
    const installed = new Map<string, () => unknown>();
    let intercepted: unknown;
    let languages: unknown;

    installLocaleGetters(
      (property, getter) => {
        installed.set(property, getter);
      },
      {
        language: () => "pl-PL",
        languages: () => ["pl-PL", "pl"],
      },
    );

    Object.defineProperty(Array.prototype, "0", {
      configurable: true,
      set(value) {
        intercepted = value;
      },
    });
    try {
      languages = installed.get("languages")?.();
    } finally {
      delete (Array.prototype as unknown as Record<string, unknown>)["0"];
    }

    expect(intercepted).toBeUndefined();
    expect(languages).toEqual(["pl-PL", "pl"]);
    expect(Object.hasOwn(languages as object, "0")).toBe(true);
  });

  it("exports a literal worker inline source for locale getters", () => {
    expect(LOCALE_GETTERS_SOURCE).toContain(
      "const installLocaleGetters=(defineGetter,readers)=>{",
    );
    expect(LOCALE_GETTERS_SOURCE).toContain(
      'defineGetter("language",readers.language)',
    );
    expect(LOCALE_GETTERS_SOURCE).toContain(
      'defineGetter("languages",()=>cloneLocaleLanguages(readers.languages()))',
    );
    expect(LOCALE_GETTERS_SOURCE).not.toContain("__vite_ssr_import_");
  });
});
