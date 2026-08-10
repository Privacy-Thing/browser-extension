import { BUILD_BROWSER_TARGET } from "@/shared/build-flags";
import { getLocaleOptions } from "@/shared/locale-catalog";

export const commonLocales = getLocaleOptions(BUILD_BROWSER_TARGET);
