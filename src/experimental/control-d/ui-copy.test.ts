import { afterEach, describe, expect, it } from "vitest";

import {
  controlDEndpointName,
  controlDFolderName,
  controlDProfileName,
} from "./resource-names";
import { controlDText } from "./ui-copy";
import { controlDEn } from "./ui-copy-en";
import { controlDEs } from "./ui-copy-es";
import { controlDPt } from "./ui-copy-pt";
import { controlDRu } from "./ui-copy-ru";
import { controlDUk } from "./ui-copy-uk";

import { BRAND_DISPLAY_NAME } from "@/shared/brand";
import { applyUiLocalePreference } from "@/ui/i18n";

const catalogs = {
  en: controlDEn,
  es: controlDEs,
  pt: controlDPt,
  ru: controlDRu,
  uk: controlDUk,
};
afterEach(() => applyUiLocalePreference("en"));

describe("Control D introduction copy", () => {
  it.each(Object.entries(catalogs))(
    "%s discloses the names used by both browser targets",
    (_, catalog) => {
      const code = "ABCDE-FGHJK";
      const names = catalog.intro.names
        .replaceAll("XXXXX-XXXXX", code)
        .replace("<ROUTE>", "WAW");
      expect(names).toContain(controlDProfileName(code));
      expect(names).toContain(controlDEndpointName(code, "chromium"));
      expect(names).toContain(controlDEndpointName(code, "firefox"));
      expect(names).toContain(controlDFolderName(code, "WAW"));
      expect(catalog.ownPrivacyPolicy).toContain(BRAND_DISPLAY_NAME);
      expect(catalog.intro.data).toContain("no_log=1");
    },
  );

  it("updates a captured introduction when the UI language changes", () => {
    const intro = controlDText.intro;
    applyUiLocalePreference("ru");
    expect(intro.title).toBe(controlDRu.intro.title);
    applyUiLocalePreference("uk");
    expect(intro.data).toBe(controlDUk.intro.data);
    applyUiLocalePreference("en");
    expect(intro.title).toBe(controlDEn.intro.title);
  });
});
