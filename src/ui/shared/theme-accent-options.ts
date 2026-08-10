import { THEME_ACCENT_PRESETS, type ThemeAccentPreset } from "@/shared/types";
import { t } from "@/ui/i18n";

export type ThemeAccentOption = {
  preset: ThemeAccentPreset;
  label: string;
};

export const ACCENT_OPTION_LABELS: Record<ThemeAccentPreset, string> = {
  teal: t.advanced.display.accentColor.options.teal,
  blue: t.advanced.display.accentColor.options.blue,
  green: t.advanced.display.accentColor.options.green,
  yellow: t.advanced.display.accentColor.options.yellow,
  orange: t.advanced.display.accentColor.options.orange,
  red: t.advanced.display.accentColor.options.red,
  pink: t.advanced.display.accentColor.options.pink,
  purple: t.advanced.display.accentColor.options.purple,
  gray: t.advanced.display.accentColor.options.gray,
};

export const THEME_ACCENT_OPTIONS: ThemeAccentOption[] = THEME_ACCENT_PRESETS.map(
  (preset) => ({
    preset,
    label: ACCENT_OPTION_LABELS[preset],
  }),
);
