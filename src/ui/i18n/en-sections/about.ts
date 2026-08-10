import { BRAND_DISPLAY_NAME } from "@/shared/brand";

const ABOUT_PRODUCT = `About ${BRAND_DISPLAY_NAME}`;
const ABOUT_PRODUCT_LOWER = `about ${BRAND_DISPLAY_NAME}`;
const HOW_TO_USE_PRODUCT = `How to use ${BRAND_DISPLAY_NAME}`;
const HOW_TO_USE_PRODUCT_LOWER = `how to use ${BRAND_DISPLAY_NAME}`;
const WHAT_PRODUCT_IS_NOT = `What ${BRAND_DISPLAY_NAME} is not`;
const PRODUCT_NOT_LOWER = `what ${BRAND_DISPLAY_NAME} is not`;
const TERMS_OF_USE = "Terms of Use";

export const about = {
  title: ABOUT_PRODUCT,
  description: `${BRAND_DISPLAY_NAME} helps you control how websites see your location, locale, time zone, and selected browser identity details.`,
  body1:
    "Each saved regional preset bundles coordinates, language preferences, and a target time zone into a reusable setup that you can apply across selected domains without rebuilding it every time.",
  body2: `Your changes are saved automatically. Updated presets and rules take effect on the next page load, so ${BRAND_DISPLAY_NAME} can apply the new setup from the start.`,
  body3Prefix: "You can find shared browser protection controls in the",
  body3LinkLabel: "Options tab",
  body3Suffix: ".",
  website: {
    prefix: "You can visit the ",
    linkLabel: `${BRAND_DISPLAY_NAME} website`,
    url: "https://privacything.com",
    suffix: " for project news, downloads, and more information.",
  },
  versionLabel: "Version",
  browserTargetLabel: "Browser target",
  releaseChannelLabel: "Release channel",
  copyLinkLabel: ABOUT_PRODUCT_LOWER,
  copyLinkTermsLabel: "terms of use",
  copyLinkPrivacyLabel: "about privacy",
  copyLinkLimitationsLabel: PRODUCT_NOT_LOWER,
  copyLinkLicenseLabel: "license",
  copyLinkAssetsLabel: "third-party assets",
  copyLinkUsageLabel: HOW_TO_USE_PRODUCT_LOWER,
  releaseChannels: {
    local: "Local",
    beta: "Beta",
    stable: "Stable",
  },

  support: {
    url: "https://webh.pl",
    logoLinkAriaLabel: "Open webh.pl",
    bodyPrefix: `${BRAND_DISPLAY_NAME} grows with support from `,
    linkLabel: "webh.pl",
    bodySuffix: " — fast, flexible infrastructure for ambitious projects.",
  },

  terms: {
    title: TERMS_OF_USE,
    body1: `${BRAND_DISPLAY_NAME} is provided “as is”, without warranty of any kind.`,
    body2: `${BRAND_DISPLAY_NAME} helps users locally control selected browser-exposed location, locale, time zone, and related data. It is not a VPN, proxy, anonymity tool, security product, or guarantee of undetectability.`,
    body3: `Use ${BRAND_DISPLAY_NAME} at your own risk. You are responsible for complying with applicable laws, website terms, workplace policies, and platform rules.`,
  },

  privacy: {
    title: "Privacy",
    body: `${BRAND_DISPLAY_NAME} stores your settings and saved configuration locally in your browser. External map requests are optional: OpenStreetMap Nominatim is used for location search and OpenFreeMap is used for interactive map previews after your consent.`,
    openPolicyButton: "Open privacy policy",
  },

  limitations: {
    title: WHAT_PRODUCT_IS_NOT,
    intro: `${BRAND_DISPLAY_NAME} changes browser-visible data such as geolocation, locale, time zone, and selected fingerprint details. It does not route your traffic through a different network.`,
    body1: "It does not hide or replace your IP address.",
    body2: "It does not replace a VPN, proxy, or DNS-based routing setup.",
    body3:
      "It does not make websites see your connection as coming from another country on its own.",
    outro: `Use ${BRAND_DISPLAY_NAME} for browser-level spoofing. Use VPN, proxy, or DNS tools when you need network-level location changes.`,
  },

  license: {
    title: "License",
    creatorPrefix: "This project was created by ",
    creatorLabel: "Tomasz Janusz",
    creatorUrl: "https://tomaszjanusz.dev",
    creatorSuffix: ".",
    copyright: "Copyright © 2025-present.",
    body: `${BRAND_DISPLAY_NAME} is available under the GNU Affero General Public License v3.0 or later, with additional terms.`,
    openLicenseButton: "Open license",
  },

  assets: {
    title: "Third-party assets",
    body: `Review the bundled third-party components and open the license texts shipped with ${BRAND_DISPLAY_NAME}.`,
    openNoticesButton: "Open third-party notices",
    fontAwesome: {
      label: "Font Awesome Free 7.2.0",
      url: "https://fontawesome.com",
      body: " by Font Awesome / Fonticons, Inc. is licensed under CC BY 4.0, SIL OFL 1.1, and MIT.",
    },
    mapLibre: {
      label: "MapLibre GL JS",
      url: "https://maplibre.org/maplibre-gl-js/docs/",
      body: " is bundled locally for vector map rendering.",
    },
    openFreeMap: {
      label: "OpenFreeMap",
      url: "https://openfreemap.org/",
    },
    openStreetMap: {
      label: "OpenStreetMap",
      url: "https://www.openstreetmap.org/copyright",
    },
    osmWikiCountryCodes: {
      label: "OpenStreetMap Wiki: Nominatim/Country Codes",
      url: "https://wiki.openstreetmap.org/wiki/Nominatim/Country_Codes",
      body: " provides the country-to-language defaults used during preset generation.",
      licenseLabel: "CC BY-SA 2.0",
      licenseUrl: "https://wiki.openstreetmap.org/wiki/Wiki_content_license",
      licenseBody: " applies to that wiki content and is attributed here accordingly.",
    },
    mapPreviewsPrefix: "Interactive map previews use ",
    mapPreviewsMiddle: " services with ",
    mapPreviewsSuffix: " contributor attribution shown on the map.",

    localData: {
      title: "Local datasets",
      body: `${BRAND_DISPLAY_NAME} ships with small local databases built from processed public data, so spoofed values stay statistically realistic. Nothing is fetched from the internet — these are locally bundled snapshots, refreshed with each extension update.`,
      steam: {
        label: "Steam Hardware & Software Survey",
        url: "https://store.steampowered.com/hwsurvey/",
        body: " (Valve) provides the Windows, Linux, and macOS screen-resolution, CPU-core, and RAM distributions used for local hardware profiles.",
      },
      chromiumDash: {
        label: "ChromiumDash",
        url: "https://chromiumdash.appspot.com/",
        body: " provides the real Chrome release versions used for User-Agent and Client Hints.",
      },
      localeCatalog: {
        prefix: "The ",
        mozilla: {
          label: "Mozilla",
          url: "https://github.com/mozilla-firefox/firefox/blob/main/intl/locale/language.properties",
        },
        middle: " and ",
        chromium: {
          label: "Chromium",
          url: "https://github.com/chromium/chromium/blob/main/ui/base/l10n/l10n_util.cc",
        },
        body: " locale catalogs provide language display names aligned with each browser engine.",
      },
    },
  },

  playground: {
    title: "Playground",
    description: `Preview how ${BRAND_DISPLAY_NAME} would present any saved regional preset on websites, including locale, time zone, date output, and coordinates.`,
    openButton: "Open Playground",
  },

  usage: {
    title: HOW_TO_USE_PRODUCT,
    body1:
      "Start by generating a regional preset from a searched place when you want a fast, realistic starting point.",
    body2: `Keep one saved regional preset per real-world place you want ${BRAND_DISPLAY_NAME} to imitate, then assign websites to the matching preset.`,
    body3:
      "Use the popup for quick domain assignment. Open Settings when you want the full control panel for presets and rules.",
    body4: `Explore Options and Advanced when you want more control over how ${BRAND_DISPLAY_NAME} behaves.`,
  },
} as const;
