import type { UiLocale } from "@/shared/ui-locale";

/**
 * Interface languages that no native speaker has reviewed yet, each with a short notice
 * in that language. Remove a locale once a native speaker has reviewed its catalog.
 */
export const unreviewedLocaleNotices: Partial<Record<UiLocale, string>> = {
  "zh-CN": "此界面语言由机器翻译，尚未经过母语人士审校。",
  "zh-TW": "此介面語言由機器翻譯，尚未經過母語人士審校。",
};
