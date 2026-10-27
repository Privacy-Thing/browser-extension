import type { LocaleCatalog } from "./types";

import { about } from "./zh-CN-sections/about";
import { advanced } from "./zh-CN-sections/advanced";
import { common } from "./zh-CN-sections/common";
import { demo } from "./zh-CN-sections/demo";
import { firefoxContainers } from "./zh-CN-sections/firefox-containers";
import { locations } from "./zh-CN-sections/locations";
import { options, optionsPage } from "./zh-CN-sections/options";
import { osm } from "./zh-CN-sections/osm";
import { popup } from "./zh-CN-sections/popup";
import { rules } from "./zh-CN-sections/rules";
import { settingsImport } from "./zh-CN-sections/settings-import";
import { sidebar } from "./zh-CN-sections/sidebar";
import { trustedSites } from "./zh-CN-sections/trusted-sites";
import { welcome } from "./zh-CN-sections/welcome";

export const zhCN = {
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
