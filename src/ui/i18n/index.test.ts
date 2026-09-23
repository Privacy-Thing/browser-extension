import { describe, expect, it } from "vitest";

import { resolveUiLocale } from "./index";

describe("resolveUiLocale", () => {
  it.each(["es", "es-ES", "es-MX", "ES-ar"])("selects Spanish for %s", (language) => {
    expect(resolveUiLocale(language)).toBe("es");
  });

  it.each(["pt", "pt-BR", "pt-PT", "PT-ao"])(
    "selects Portuguese for %s",
    (language) => {
      expect(resolveUiLocale(language)).toBe("pt");
    },
  );

  it.each([undefined, "", "en", "en-US", "pl-PL"])(
    "falls back to English for %s",
    (language) => {
      expect(resolveUiLocale(language)).toBe("en");
    },
  );
});
