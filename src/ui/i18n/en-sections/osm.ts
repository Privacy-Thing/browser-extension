import { BRAND_DISPLAY_NAME } from "@/shared/brand";

export const externalMapConsentCopy = {
  title: "Allow location search and map requests",
  description: `Allow ${BRAND_DISPLAY_NAME} to send search queries to OpenStreetMap Nominatim when you search for locations and request vector tiles and fonts from OpenFreeMap when map previews are displayed. Those services receive your search text, map and font requests, and your IP address, but not your saved rules, presets, or browsing history. Keep this off if you prefer to enter coordinates manually without making map-service requests during setup.`,
} as const;

export const osm = {
  modalTitle: "Allow external map and search requests?",
  body1: `External map access is optional. ${BRAND_DISPLAY_NAME} itself does not send your presets, rules, or browsing data to those services.`,
  body2: `If you allow this, ${BRAND_DISPLAY_NAME} may contact OpenStreetMap Nominatim for location search and OpenFreeMap for interactive map previews.`,
} as const;
