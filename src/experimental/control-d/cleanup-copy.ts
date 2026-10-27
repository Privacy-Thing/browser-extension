import { cleanupEn, type CleanupMessages } from "./cleanup-copy-en";
import { cleanupEs } from "./cleanup-copy-es";
import { cleanupPt } from "./cleanup-copy-pt";
import { cleanupRu } from "./cleanup-copy-ru";
import { cleanupUk } from "./cleanup-copy-uk";
import { cleanupZhCN } from "./cleanup-copy-zh-CN";
import { cleanupZhTW } from "./cleanup-copy-zh-TW";

import { createMessagesProxy, getActiveUiLocale } from "@/ui/i18n";
const catalogs = {
  en: cleanupEn,
  es: cleanupEs,
  pt: cleanupPt,
  ru: cleanupRu,
  uk: cleanupUk,
  "zh-CN": cleanupZhCN,
  "zh-TW": cleanupZhTW,
};
export const cleanupText = createMessagesProxy(
  () => catalogs[getActiveUiLocale()],
) as CleanupMessages;
