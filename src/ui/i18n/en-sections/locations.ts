import { BRAND_DISPLAY_NAME } from "@/shared/brand";

const PRODUCT_NOT_LOWER = `what ${BRAND_DISPLAY_NAME} is not`;

export const locations = {
  title: "Regional Presets",
  description:
    "Regional presets bundle coordinates, locale, and time zone for spoofing.",
  addManualButton: "Add manually",
  actionsMenuLabel: "Preset actions",
  generateButton: "Generate preset",
  searchPlaceholder: "Search presets...",
  unused: "Unused",
  assigned: (count: number) => `${count} assigned`,
  viewAssignedRulesAriaLabel: (locationLabel: string, count: number) =>
    `Show ${count} domain rules assigned to ${locationLabel}`,
  copyLinkLabel: "regional presets",
  copyLinkHelpLabel: "regional presets help",

  playgroundCard: {
    title: "Playground",
    body1:
      "Preview a saved preset before assigning it to sites. The Playground shows its locale, time zone, date formatting, and spoofed coordinates using the same geolocation behavior as protected websites.",
    body2:
      "By default, the Playground refreshes spoofed geolocation every 2-5 seconds so movement is easy to inspect. Real sites use your configured Watch Position Delay instead.",
  },

  help: {
    title: "Regional Presets",
    body1:
      "A regional preset should describe one believable place. Keep its language, languages, and time zone aligned with the same region as the coordinates.",
    body2: `Changes save automatically. When you edit a field, ${BRAND_DISPLAY_NAME} writes the update after a short pause.`,
    body3:
      "A saved regional preset changes browser-level values such as geolocation, locale, and time zone. It does not change your IP address or where your traffic is routed.",
    privacyTitle: "Privacy",
    privacyBody: `Search and map previews are optional. ${BRAND_DISPLAY_NAME} only contacts OpenStreetMap Nominatim for search and OpenFreeMap for interactive map previews after you allow it.`,
    networkTitle: "Network limits",
    networkBodyPrefix:
      "Need network-level location changes? Use a VPN, proxy, or DNS tool. See ",
    networkBodyLinkLabel: PRODUCT_NOT_LOWER,
    networkBodySuffix: ".",
  },

  editor: {
    title: "Edit preset",
    description:
      "Update the saved regional preset, including coordinates, regional formats, and location reporting behavior.",
    deleteBlockedTitle: "This preset is still assigned",
    deleteBlockedDescription:
      "Change or remove every assignment below before deleting the preset.",
    deleteBlockedButtonTitle: "Remove every assignment before deleting this preset.",
    disabledDependencySuffix: "(off)",
    mapDisabledTitle: "Map disabled",
    mapDisabledBody:
      "Map preview is not loaded because you did not allow external map requests.",
    geolocationSectionTitle: "Geolocation",
    geolocationSectionDescription:
      "Coordinates, accuracy, and the maximum spread allowed for spoofed positions.",
    localeSectionTitle: "Time & language",
    localeSectionDescription:
      "Keep locale-facing values aligned with the same region as the saved coordinates.",
    primaryLocaleLabel: "Primary locale",
    languageDescription:
      "This is the preset's main regional format for dates, numbers, and other localized values.",
    languageBehaviorDescription:
      'When "Prefer English on websites" is off, websites also see this value as navigator.language. Even with English first, this locale still controls default date and number formatting.',
    preferredLanguagesLabel: "Preferred languages",
    languagesDescription:
      "Ordered list of browser language preferences for this preset.",
    languagesBehaviorDescription: `${BRAND_DISPLAY_NAME} exposes this order as navigator.languages and related language preferences. Keep the primary locale first, then add realistic alternate languages that a site could plausibly see for this preset.`,
    preferEnglishContentLabel: "Prefer English on websites",
    preferEnglishContentDescriptionPrefix: `${BRAND_DISPLAY_NAME} keeps the saved locale as your regional baseline, but exposes`,
    preferEnglishContentDescriptionSuffix:
      "first in the browser's language preferences so websites are more likely to stay in English.",
    preferEnglishContentLockedTagTitle: (locale: string) =>
      `${locale} is injected by the English browser-language preference and cannot be removed here.`,
    accuracyDescription:
      "Controls the accuracy value websites see in geolocation results.",
    noiseRadiusDescription:
      "Maximum distance allowed between spoofed coordinates and this preset's saved point.",
  },

  generator: {
    title: "Generate preset",
    searchStepDescription:
      "Search for a city, address, or place name to create a new preset.",
    resultStepDescription: `Choose the matching result before ${BRAND_DISPLAY_NAME} creates the preset.`,
    languageStepDescription:
      "Choose the browser language that should anchor this preset before you review the rest.",
    confirmStepDescription: "Confirm the preset on the map before adding it.",
    locationLabel: "Location",
    locationPlaceholder: "Warsaw, Poland",
    osmDisclaimer:
      "Search queries use the external OpenStreetMap Nominatim API. Interactive previews use OpenFreeMap vector tiles and fonts after consent.",
    resultSelectLabel: "Search result",
    resultStepBody:
      "OpenStreetMap returned more than one possible match. Pick the place you meant, then continue.",
    resultStepHint: "Choose a result to continue.",
    languageSelectLabel: "Browser language",
    languageStepBody:
      "More than one browser language is available for this place. Choose the one you want this preset to use.",
    languageStepHint:
      "If the language you want is not listed below, you can choose a different one in the next step.",
    resultPrefix: "Result: ",
  },
} as const;
