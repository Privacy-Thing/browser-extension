import { about } from "./es-sections/about";
import { advanced } from "./es-sections/advanced";
import { common } from "./es-sections/common";
import { demo } from "./es-sections/demo";
import { firefoxContainers } from "./es-sections/firefox-containers";
import { locations } from "./es-sections/locations";
import { options, optionsPage } from "./es-sections/options";
import { osm } from "./es-sections/osm";
import { popup } from "./es-sections/popup";
import { rules } from "./es-sections/rules";
import { sidebar } from "./es-sections/sidebar";
import { trustedSites } from "./es-sections/trusted-sites";
import { welcome } from "./es-sections/welcome";

export const es = {
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
