import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  getThemeAccentTokens,
  isThemeAccentPreset,
  isThemeMode,
  resolveSystemTheme,
  resolveThemeMode,
} from "@/ui/shared/theme";

describe("theme helpers", () => {
  beforeEach(() => {
    vi.stubGlobal("window", {
      matchMedia: vi.fn().mockReturnValue({ matches: false }),
      localStorage: {
        getItem: vi.fn().mockReturnValue(null),
      },
    });
  });

  it("validates supported theme modes", () => {
    expect(isThemeMode("light")).toBe(true);
    expect(isThemeMode("dark")).toBe(true);
    expect(isThemeMode("system")).toBe(true);
    expect(isThemeMode("sepia")).toBe(false);
  });

  it("validates supported theme accent presets", () => {
    expect(isThemeAccentPreset("teal")).toBe(true);
    expect(isThemeAccentPreset("purple")).toBe(true);
    expect(isThemeAccentPreset("toolbar")).toBe(false);
  });

  it("resolves system and explicit theme modes", () => {
    expect(resolveThemeMode("light")).toBe("light");
    expect(resolveThemeMode("dark")).toBe("dark");
    expect(resolveThemeMode("system")).toBe("light");
  });

  it("reads the current system theme from matchMedia", () => {
    vi.stubGlobal("window", {
      matchMedia: vi.fn().mockReturnValue({ matches: true }),
      localStorage: {
        getItem: vi.fn().mockReturnValue(null),
      },
    });

    expect(resolveSystemTheme()).toBe("dark");
  });

  it("keeps accent tokens stable across high contrast mode", () => {
    expect(getThemeAccentTokens("orange", "light", false)).toEqual({
      primary: "30 92% 42%",
      primaryForeground: "0 0% 100%",
      ring: "30 92% 42%",
    });

    expect(getThemeAccentTokens("orange", "dark", true)).toEqual({
      primary: "28 100% 62%",
      primaryForeground: "240 10% 5%",
      ring: "28 100% 62%",
    });

    expect(getThemeAccentTokens("orange", "dark", true)).toEqual(
      getThemeAccentTokens("orange", "dark", false),
    );
  });
});
