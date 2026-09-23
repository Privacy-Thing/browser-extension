import { about } from "./ru-sections/about";
import { advanced } from "./ru-sections/advanced";
import { common } from "./ru-sections/common";
import { demo } from "./ru-sections/demo";
import { firefoxContainers } from "./ru-sections/firefox-containers";
import { locations } from "./ru-sections/locations";
import { options, optionsPage } from "./ru-sections/options";
import { osm } from "./ru-sections/osm";
import { popup } from "./ru-sections/popup";
import { rules } from "./ru-sections/rules";
import { sidebar } from "./ru-sections/sidebar";
import { trustedSites } from "./ru-sections/trusted-sites";
import { welcome } from "./ru-sections/welcome";

export const ru = {
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
