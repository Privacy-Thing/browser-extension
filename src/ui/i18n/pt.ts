import { about } from "./pt-sections/about";
import { advanced } from "./pt-sections/advanced";
import { common } from "./pt-sections/common";
import { demo } from "./pt-sections/demo";
import { firefoxContainers } from "./pt-sections/firefox-containers";
import { locations } from "./pt-sections/locations";
import { options, optionsPage } from "./pt-sections/options";
import { osm } from "./pt-sections/osm";
import { popup } from "./pt-sections/popup";
import { rules } from "./pt-sections/rules";
import { sidebar } from "./pt-sections/sidebar";
import { trustedSites } from "./pt-sections/trusted-sites";
import { welcome } from "./pt-sections/welcome";

export const pt = {
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
