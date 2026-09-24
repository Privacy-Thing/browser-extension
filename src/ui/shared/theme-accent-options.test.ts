import { describe, expect, it } from "vitest";

import { accentOptionLabel } from "./theme-accent-options";

import { applyUiLocalePreference } from "@/ui/i18n";

describe("accentOptionLabel", () => {
  it("follows the active interface language", () => {
    applyUiLocalePreference("en");
    expect(accentOptionLabel("teal")).toBe("Teal");

    applyUiLocalePreference("es");
    expect(accentOptionLabel("teal")).toBe("Verde azulado");
    expect(accentOptionLabel("purple")).toBe("Morado");

    applyUiLocalePreference("en");
  });
});
