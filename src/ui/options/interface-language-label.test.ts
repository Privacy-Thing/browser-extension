import { describe, expect, it } from "vitest";

import { languageOptionLabel } from "./interface-language-label";

describe("languageOptionLabel", () => {
  it("keeps the English interface on English names", () => {
    expect(languageOptionLabel("en", "Spanish", "Spanish")).toBe("Spanish");
    expect(languageOptionLabel("en", "Automatic", "Automatic")).toBe("Automatic");
  });

  it("shows the English name and the active translation", () => {
    expect(languageOptionLabel("es", "Spanish", "Español")).toBe("Spanish (Español)");
    expect(languageOptionLabel("uk", "Ukrainian", "Українська")).toBe(
      "Ukrainian (Українська)",
    );
    expect(languageOptionLabel("ru", "Automatic", "Автоматически")).toBe(
      "Automatic (Автоматически)",
    );
  });
});
