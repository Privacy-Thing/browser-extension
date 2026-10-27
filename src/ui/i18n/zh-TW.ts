import type { LocaleCatalog } from "./types";
import { about } from "./zh-TW-sections/about";
import { advanced } from "./zh-TW-sections/advanced";
import { common } from "./zh-TW-sections/common";
import { demo } from "./zh-TW-sections/demo";
import { firefoxContainers } from "./zh-TW-sections/firefox-containers";
import { locations } from "./zh-TW-sections/locations";
import { options, optionsPage } from "./zh-TW-sections/options";
import { osm } from "./zh-TW-sections/osm";
import { popup } from "./zh-TW-sections/popup";
import { rules } from "./zh-TW-sections/rules";
import { settingsImport } from "./zh-TW-sections/settings-import";
import { sidebar } from "./zh-TW-sections/sidebar";
import { trustedSites } from "./zh-TW-sections/trusted-sites";
import { welcome } from "./zh-TW-sections/welcome";

export const zhTW = {
  common,
  popup,
  options,
  optionsPage,
  locations,
  rules,
  trustedSites,
  advanced,
  about,
  osm,
  demo,
  firefoxContainers,
  sidebar,
  welcome,
  settingsImport,
} as const satisfies LocaleCatalog;
