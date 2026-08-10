import { BRAND_DISPLAY_NAME } from "@/shared/brand";

export const common = {
  copyLinkTo: (section: string) => `Copy link to ${section}`,

  actions: {
    cancel: "Cancel",
    reset: "Reset",
    close: "Close",
    create: "Create",
    save: "Save",
    back: "Back",
    continue: "Continue",
    edit: "Edit",
    delete: "Delete",
    duplicate: "Duplicate",
    search: "Search",
    clear: "Clear",
    deleteSelected: "Delete selected",
    clearSelection: "Clear selection",
    openPrivacyPolicy: "Open privacy policy",
    allowOpenStreetMap: "Allow map access",
    notNow: "Not now",
    openPlayground: "Open Playground",
  },
  selectionCount: (count: number) => `${count} selected`,

  fields: {
    name: "Name",
    latitude: "Latitude",
    longitude: "Longitude",
    accuracy: "Accuracy",
    noiseRadius: "Max radius (m)",
    timeZone: "Time zone",
  },

  coordinateRandomization: {
    labelBefore: "Randomize coordinates within",
    labelAfter: "km.",
    radiusInputLabel: "Coordinate randomization radius in kilometers",
    readWhy: "Read why.",
    tooltipPrivacy: `${BRAND_DISPLAY_NAME} is privacy-focused. Presets should be easy to use, but reusing exact catalog or search coordinates could make ${BRAND_DISPLAY_NAME} users easier to recognize.`,
    tooltipExact: `Need a specific location? Turn this switch off and ${BRAND_DISPLAY_NAME} will use the exact coordinate. You can change the defaults in Options > Geolocation > Advanced.`,
  },
} as const;
