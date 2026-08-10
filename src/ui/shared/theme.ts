import {
  DEFAULT_THEME_MODE,
  isThemeAccentPreset,
  isThemeMode,
} from "@/shared/theme-types";
import type { ThemeAccentPreset, ThemeMode } from "@/shared/types";

export { DEFAULT_THEME_MODE, isThemeAccentPreset, isThemeMode };

export type ResolvedTheme = "light" | "dark";
type ThemeAccentTokens = {
  primary: string;
  primaryForeground: string;
  ring: string;
};
type ThemeAccentTokenVariants = {
  swatch: string;
  light: ThemeAccentTokens;
  dark: ThemeAccentTokens;
};

const THEME_ACCENT_VARIANTS: Record<ThemeAccentPreset, ThemeAccentTokenVariants> = {
  teal: {
    swatch: "#00b894",
    light: {
      primary: "165 82% 28%",
      primaryForeground: "0 0% 100%",
      ring: "165 82% 28%",
    },
    dark: {
      primary: "168 70% 46%",
      primaryForeground: "240 10% 5%",
      ring: "168 70% 46%",
    },
  },
  blue: {
    swatch: "#37adff",
    light: {
      primary: "212 90% 45%",
      primaryForeground: "0 0% 100%",
      ring: "212 90% 45%",
    },
    dark: {
      primary: "212 100% 67%",
      primaryForeground: "240 10% 5%",
      ring: "212 100% 67%",
    },
  },
  green: {
    swatch: "#51cd00",
    light: {
      primary: "142 76% 32%",
      primaryForeground: "0 0% 100%",
      ring: "142 76% 32%",
    },
    dark: {
      primary: "142 70% 52%",
      primaryForeground: "240 10% 5%",
      ring: "142 70% 52%",
    },
  },
  yellow: {
    swatch: "#ffcb00",
    light: {
      primary: "45 96% 42%",
      primaryForeground: "240 10% 9%",
      ring: "45 96% 38%",
    },
    dark: {
      primary: "45 100% 60%",
      primaryForeground: "240 10% 5%",
      ring: "45 100% 60%",
    },
  },
  orange: {
    swatch: "#ff9f00",
    light: {
      primary: "30 92% 42%",
      primaryForeground: "0 0% 100%",
      ring: "30 92% 42%",
    },
    dark: {
      primary: "28 100% 62%",
      primaryForeground: "240 10% 5%",
      ring: "28 100% 62%",
    },
  },
  red: {
    swatch: "#ff613d",
    light: {
      primary: "4 78% 48%",
      primaryForeground: "0 0% 100%",
      ring: "4 78% 48%",
    },
    dark: {
      primary: "4 90% 66%",
      primaryForeground: "240 10% 5%",
      ring: "4 90% 66%",
    },
  },
  pink: {
    swatch: "#ff4ad8",
    light: {
      primary: "328 78% 46%",
      primaryForeground: "0 0% 100%",
      ring: "328 78% 46%",
    },
    dark: {
      primary: "328 88% 68%",
      primaryForeground: "240 10% 5%",
      ring: "328 88% 68%",
    },
  },
  purple: {
    swatch: "#af51f5",
    light: {
      primary: "267 74% 46%",
      primaryForeground: "0 0% 100%",
      ring: "267 74% 46%",
    },
    dark: {
      primary: "267 88% 72%",
      primaryForeground: "240 10% 5%",
      ring: "267 88% 72%",
    },
  },
  gray: {
    swatch: "#7c7c7d",
    light: {
      primary: "240 5% 32%",
      primaryForeground: "0 0% 100%",
      ring: "240 5% 32%",
    },
    dark: {
      primary: "240 5% 68%",
      primaryForeground: "240 10% 5%",
      ring: "240 5% 68%",
    },
  },
};

export const getThemeAccentSwatch = (themeAccentPreset: ThemeAccentPreset): string =>
  THEME_ACCENT_VARIANTS[themeAccentPreset].swatch;

export const getThemeAccentTokens = (
  themeAccentPreset: ThemeAccentPreset,
  theme: ResolvedTheme,
  _highContrast: boolean,
): ThemeAccentTokens => {
  const variants = THEME_ACCENT_VARIANTS[themeAccentPreset];

  return theme === "dark" ? variants.dark : variants.light;
};

export const resolveSystemTheme = (): ResolvedTheme =>
  window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";

export const resolveThemeMode = (themeMode: ThemeMode): ResolvedTheme =>
  themeMode === "system" ? resolveSystemTheme() : themeMode;
