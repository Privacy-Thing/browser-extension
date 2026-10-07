import { controlDEn, type ControlDMessages } from "./ui-copy-en";
import { controlDEs } from "./ui-copy-es";
import { controlDPt } from "./ui-copy-pt";
import { controlDRu } from "./ui-copy-ru";
import { controlDUk } from "./ui-copy-uk";

import { createMessagesProxy, getActiveUiLocale } from "@/ui/i18n";
const catalogs = {
  en: controlDEn,
  es: controlDEs,
  pt: controlDPt,
  ru: controlDRu,
  uk: controlDUk,
};
// Keep the experiment's catalogs inside its lazy module so release builds omit them.
export const controlDText = createMessagesProxy(
  () => catalogs[getActiveUiLocale()],
) as ControlDMessages;
