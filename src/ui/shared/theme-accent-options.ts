import { THEME_ACCENT_PRESETS, type ThemeAccentPreset } from "@/shared/types";
import { t } from "@/ui/i18n";

export type ThemeAccentOption = {
  preset: ThemeAccentPreset;
  label: string;
};

export const accentOptionLabel = (preset: ThemeAccentPreset): string => {
  switch (preset) {
    case "teal":
      return t.advanced.display.accentColor.options.teal;
    case "blue":
      return t.advanced.display.accentColor.options.blue;
    case "green":
      return t.advanced.display.accentColor.options.green;
    case "yellow":
      return t.advanced.display.accentColor.options.yellow;
    case "orange":
      return t.advanced.display.accentColor.options.orange;
    case "red":
      return t.advanced.display.accentColor.options.red;
    case "pink":
      return t.advanced.display.accentColor.options.pink;
    case "purple":
      return t.advanced.display.accentColor.options.purple;
    case "gray":
      return t.advanced.display.accentColor.options.gray;
  }
};

export const getThemeAccentOptions = (): ThemeAccentOption[] =>
  THEME_ACCENT_PRESETS.map((preset) => ({
    preset,
    label: accentOptionLabel(preset),
  }));
