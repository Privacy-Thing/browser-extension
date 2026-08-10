export type ThemeMode = "light" | "dark" | "system";

export const THEME_ACCENT_PRESETS = [
  "teal",
  "blue",
  "green",
  "yellow",
  "orange",
  "red",
  "pink",
  "purple",
  "gray",
] as const;

export type ThemeAccentPreset = (typeof THEME_ACCENT_PRESETS)[number];

export const DEFAULT_ACCENT_PRESET: ThemeAccentPreset = "teal";
export const DEFAULT_THEME_MODE: ThemeMode = "system";

export const isThemeMode = (value: unknown): value is ThemeMode =>
  value === "light" || value === "dark" || value === "system";

export const isThemeAccentPreset = (value: unknown): value is ThemeAccentPreset =>
  typeof value === "string" &&
  THEME_ACCENT_PRESETS.includes(value as ThemeAccentPreset);
