import { about } from "./en-sections/about";
import { advanced } from "./en-sections/advanced";
import { common } from "./en-sections/common";
import { demo } from "./en-sections/demo";
import { firefoxContainers } from "./en-sections/firefox-containers";
import { locations } from "./en-sections/locations";
import { options, optionsPage } from "./en-sections/options";
import { osm } from "./en-sections/osm";
import { popup } from "./en-sections/popup";
import { rules } from "./en-sections/rules";
import { sidebar } from "./en-sections/sidebar";
import { trustedSites } from "./en-sections/trusted-sites";
import { welcome } from "./en-sections/welcome";

export const en = {
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
} as const;
