import { about } from "./uk-sections/about";
import { advanced } from "./uk-sections/advanced";
import { common } from "./uk-sections/common";
import { demo } from "./uk-sections/demo";
import { firefoxContainers } from "./uk-sections/firefox-containers";
import { locations } from "./uk-sections/locations";
import { options, optionsPage } from "./uk-sections/options";
import { osm } from "./uk-sections/osm";
import { popup } from "./uk-sections/popup";
import { rules } from "./uk-sections/rules";
import { sidebar } from "./uk-sections/sidebar";
import { trustedSites } from "./uk-sections/trusted-sites";
import { welcome } from "./uk-sections/welcome";

export const uk = {
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
