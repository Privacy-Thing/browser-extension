import { slugifyToken } from "@/shared/slugify";
import type { DomainRule, Location } from "@/shared/types";
import type { SettingsTab } from "@/ui/options/utils";

const normalizeAnchorToken = (value: string): string => {
  const normalized = slugifyToken(value);

  return normalized || "item";
};

const hashAnchorToken = (value: string): string => {
  let hash = 5381;

  for (const char of value) {
    hash = (hash * 33) ^ char.charCodeAt(0);
  }

  return (hash >>> 0).toString(36);
};

const createDynamicAnchor = (prefix: string, value: string): string => {
  const normalizedValue = value.trim().toLowerCase();
  return `${prefix}-${normalizeAnchorToken(normalizedValue)}-${hashAnchorToken(normalizedValue)}`;
};

export const PAGE_ANCHORS: Record<SettingsTab, string> = {
  profiles: "page-locations",
  rules: "page-rules",
  "trusted-sites": "page-trusted-sites",
  playground: "page-playground",
  options: "page-options",
  containers: "page-containers",
  advanced: "page-advanced",
  about: "page-about",
};

export const SETTINGS_SUBPAGE_ANCHORS = {
  logs: "page-logs",
  privacyPolicy: "page-privacy-policy",
  thirdPartyNotices: "page-third-party-notices",
  license: "page-license",
} as const;

export type SettingsSubpageView = keyof typeof SETTINGS_SUBPAGE_ANCHORS | "none";

export const SECTION_ANCHORS = {
  profiles: {
    overview: "section-locations-overview",
    help: "section-locations-help",
  },
  rules: {
    overview: "section-rules-overview",
    globalFallback: "section-rules-global-fallback",
    help: "section-rules-help",
    inspector: "section-rules-inspector",
  },
  trustedSites: {
    overview: "section-trusted-sites-overview",
    help: "section-trusted-sites-help",
    inspector: "section-trusted-sites-inspector",
  },
  options: {
    overview: "section-options-overview",
    surfaces: "section-options-surfaces",
    fallback: "section-options-global-fallback",
    privacy: "section-advanced-privacy-controls",
    appearance: "section-advanced-display",
    help: "section-options-help",
  },
  containers: {
    overview: "section-containers-overview",
    help: "section-containers-help",
    settings: "section-containers-settings",
  },
  advanced: {
    runtime: "section-advanced-runtime",
    experimental: "section-advanced-experimental",
    danger: "section-advanced-danger-zone",
    help: "section-advanced-help",
  },
  about: {
    overview: "section-about-overview",
    terms: "section-about-terms",
    privacy: "section-about-privacy",
    limitations: "section-about-limitations",
    author: "section-about-author",
    license: "section-about-license",
    assets: "section-about-assets",
    usage: "section-about-how-to-use",
  },
} as const;

export const SETTING_ANCHORS = {
  options: {
    browserFingerprintSpoofing: "setting-options-browser-data-spoofing",
    activeSpoofing: "setting-options-active-spoofing",
    geolocation: "setting-options-geolocation-spoofing",
    timeLocale: "setting-options-time-locale-spoofing",
    canvas: "setting-options-canvas-spoofing",
    webGL: "setting-options-webgl-spoofing",
    audio: "setting-options-audio-spoofing",
    navigator: "setting-options-navigator-spoofing",
    screen: "setting-options-screen-spoofing",
    clientHints: "setting-options-client-hints-spoofing",
    battery: "setting-options-battery-spoofing",
    clientHintsVersionRotation: "setting-options-client-hints-version-rotation",
    webRTC: "setting-options-webrtc-spoofing",
    serviceWorker: "setting-options-service-worker-blocking",
    sharedWorkerHandlingMode: "setting-options-shared-worker-handling",
    language: "setting-options-language",
  },
  advanced: {
    defaultNoiseRadius: "setting-default-noise-radius",
    randomizeGeneratedLocationByDefault:
      "setting-randomize-generated-location-by-default",
    generatedLocationRandomizationRadius:
      "setting-generated-location-randomization-radius",
    themeMode: "setting-theme-mode",
    reduceMotion: "setting-reduce-motion",
    accentColor: "setting-theme-accent-color",
    watchPositionDelay: "setting-watch-position-delay-range",
    debugMode: "setting-debug-mode",
    temporalApi: "setting-temporal-api",
    panicMode: "setting-panic-mode",
    browserFingerprintSpoofing: "setting-browser-data-spoofing",
    sharedWorkerCompatibilityMode: "setting-shared-worker-compatibility-mode",
    osmConsent: "setting-allow-openstreetmap-search-and-map-requests",
    highContrastMode: "setting-high-contrast-mode",
    badgeQueryCount: "setting-badge-query-count",
    badgeDateCallCount: "setting-badge-date-call-count",
    exportSettings: "setting-export-settings",
    importSettings: "setting-import-settings",
    reloadSettings: "setting-reload-settings",
    resetSettings: "setting-reset-settings",
  },
} as const;

const STATIC_ANCHOR_TO_TAB: Record<string, SettingsTab> = {
  [PAGE_ANCHORS.profiles]: "profiles",
  [PAGE_ANCHORS.rules]: "rules",
  [PAGE_ANCHORS["trusted-sites"]]: "trusted-sites",
  [PAGE_ANCHORS.playground]: "playground",
  [PAGE_ANCHORS.options]: "options",
  [PAGE_ANCHORS.containers]: "containers",
  [PAGE_ANCHORS.advanced]: "advanced",
  [PAGE_ANCHORS.about]: "about",
  [SETTINGS_SUBPAGE_ANCHORS.logs]: "advanced",
  [SETTINGS_SUBPAGE_ANCHORS.privacyPolicy]: "about",
  [SETTINGS_SUBPAGE_ANCHORS.thirdPartyNotices]: "about",
  [SETTINGS_SUBPAGE_ANCHORS.license]: "about",
  [SECTION_ANCHORS.profiles.overview]: "profiles",
  [SECTION_ANCHORS.profiles.help]: "profiles",
  [SECTION_ANCHORS.rules.overview]: "rules",
  [SECTION_ANCHORS.rules.globalFallback]: "rules",
  [SECTION_ANCHORS.rules.help]: "rules",
  [SECTION_ANCHORS.rules.inspector]: "rules",
  [SECTION_ANCHORS.trustedSites.overview]: "trusted-sites",
  [SECTION_ANCHORS.trustedSites.help]: "trusted-sites",
  [SECTION_ANCHORS.trustedSites.inspector]: "trusted-sites",
  [SECTION_ANCHORS.options.overview]: "options",
  [SECTION_ANCHORS.options.surfaces]: "options",
  [SECTION_ANCHORS.options.fallback]: "options",
  [SECTION_ANCHORS.options.privacy]: "options",
  [SECTION_ANCHORS.options.appearance]: "options",
  [SECTION_ANCHORS.options.help]: "options",
  [SECTION_ANCHORS.containers.overview]: "containers",
  [SECTION_ANCHORS.containers.help]: "containers",
  [SECTION_ANCHORS.containers.settings]: "containers",
  [SECTION_ANCHORS.advanced.runtime]: "advanced",
  [SECTION_ANCHORS.advanced.experimental]: "advanced",
  [SECTION_ANCHORS.advanced.danger]: "advanced",
  [SECTION_ANCHORS.advanced.help]: "advanced",
  [SECTION_ANCHORS.about.overview]: "about",
  [SECTION_ANCHORS.about.terms]: "about",
  [SECTION_ANCHORS.about.privacy]: "about",
  [SECTION_ANCHORS.about.limitations]: "about",
  [SECTION_ANCHORS.about.author]: "about",
  [SECTION_ANCHORS.about.license]: "about",
  [SECTION_ANCHORS.about.assets]: "about",
  [SECTION_ANCHORS.about.usage]: "about",
  [SETTING_ANCHORS.options.browserFingerprintSpoofing]: "options",
  [SETTING_ANCHORS.options.activeSpoofing]: "options",
  [SETTING_ANCHORS.options.geolocation]: "options",
  [SETTING_ANCHORS.options.timeLocale]: "options",
  [SETTING_ANCHORS.options.canvas]: "options",
  [SETTING_ANCHORS.options.webGL]: "options",
  [SETTING_ANCHORS.options.audio]: "options",
  [SETTING_ANCHORS.options.navigator]: "options",
  [SETTING_ANCHORS.options.screen]: "options",
  [SETTING_ANCHORS.options.clientHints]: "options",
  [SETTING_ANCHORS.options.battery]: "options",
  [SETTING_ANCHORS.options.clientHintsVersionRotation]: "options",
  [SETTING_ANCHORS.options.webRTC]: "options",
  [SETTING_ANCHORS.options.serviceWorker]: "options",
  [SETTING_ANCHORS.options.sharedWorkerHandlingMode]: "options",
  [SETTING_ANCHORS.options.language]: "options",
  [SETTING_ANCHORS.advanced.defaultNoiseRadius]: "options",
  [SETTING_ANCHORS.advanced.randomizeGeneratedLocationByDefault]: "options",
  [SETTING_ANCHORS.advanced.generatedLocationRandomizationRadius]: "options",
  [SETTING_ANCHORS.advanced.themeMode]: "options",
  [SETTING_ANCHORS.advanced.reduceMotion]: "options",
  [SETTING_ANCHORS.advanced.accentColor]: "options",
  [SETTING_ANCHORS.advanced.watchPositionDelay]: "options",
  [SETTING_ANCHORS.advanced.debugMode]: "advanced",
  [SETTING_ANCHORS.advanced.temporalApi]: "advanced",
  [SETTING_ANCHORS.advanced.panicMode]: "advanced",
  [SETTING_ANCHORS.advanced.browserFingerprintSpoofing]: "advanced",
  [SETTING_ANCHORS.advanced.sharedWorkerCompatibilityMode]: "options",
  [SETTING_ANCHORS.advanced.osmConsent]: "options",
  [SETTING_ANCHORS.advanced.exportSettings]: "advanced",
  [SETTING_ANCHORS.advanced.importSettings]: "advanced",
  [SETTING_ANCHORS.advanced.reloadSettings]: "advanced",
  [SETTING_ANCHORS.advanced.resetSettings]: "advanced",
  [SETTING_ANCHORS.advanced.highContrastMode]: "options",
  [SETTING_ANCHORS.advanced.badgeQueryCount]: "options",
};

const ANCHOR_ALIASES: Record<string, string> = {
  [SETTING_ANCHORS.advanced.sharedWorkerCompatibilityMode]:
    SETTING_ANCHORS.options.sharedWorkerHandlingMode,
};

const SUBPAGE_VIEW_BY_ANCHOR: Partial<Record<string, SettingsSubpageView>> = {
  [SETTINGS_SUBPAGE_ANCHORS.logs]: "logs",
  [SETTINGS_SUBPAGE_ANCHORS.privacyPolicy]: "privacyPolicy",
  [SETTINGS_SUBPAGE_ANCHORS.thirdPartyNotices]: "thirdPartyNotices",
  [SETTINGS_SUBPAGE_ANCHORS.license]: "license",
};

export type ParsedSettingsHash = {
  activeTab: SettingsTab;
  settingsSubpageView: SettingsSubpageView;
  anchorId: string | null;
  isKnownAnchor: boolean;
  linkedRuleLocationId: string | null;
  logsHostFilter: string | null;
};

export const HASH_QUERY_KEYS = {
  linkedRuleLocationId: "rules-location",
  logsHostFilter: "host",
} as const;

export const FALLBACK_MODAL_ANCHOR = "global-fallback-rule-modal";

export const getTabAnchor = (tab: SettingsTab): string => PAGE_ANCHORS[tab];

export const getLocationAnchor = (locationId: string): string =>
  createDynamicAnchor("location", locationId);

export const getLocationModalAnchor = (locationId: string): string =>
  `${getLocationAnchor(locationId)}-modal`;

export const getRuleAnchor = (pattern: string): string =>
  createDynamicAnchor("rule", pattern);

export const getRuleModalAnchor = (pattern: string): string =>
  `${getRuleAnchor(pattern)}-modal`;

export const getTrustedSiteAnchor = (pattern: string): string =>
  createDynamicAnchor("trusted-site", pattern);

export const getFallbackModalAnchor = (): string => FALLBACK_MODAL_ANCHOR;

export const getContainerAnchor = (cookieStoreId: string): string =>
  createDynamicAnchor("container", cookieStoreId);

export const getContainerModalAnchor = (cookieStoreId: string): string =>
  `${getContainerAnchor(cookieStoreId)}-modal`;

export const getLocationAnchorIndex = (
  anchorId: string,
  locations: readonly Location[],
): number =>
  locations.findIndex((location) => getLocationAnchor(location.id) === anchorId);

export const getRuleForAnchor = (
  anchorId: string,
  rules: readonly DomainRule[],
): DomainRule | null =>
  rules.find(
    (rule) =>
      getRuleAnchor(rule.pattern) === anchorId ||
      getRuleModalAnchor(rule.pattern) === anchorId,
  ) ?? null;

export const isLocationAnchor = (anchorId: string): boolean =>
  anchorId.startsWith("location-");

export const isRuleAnchor = (anchorId: string): boolean => anchorId.startsWith("rule-");

export const isTrustedSiteAnchor = (anchorId: string): boolean =>
  anchorId.startsWith("trusted-site-");

export const isContainerAnchor = (anchorId: string): boolean =>
  anchorId.startsWith("container-");

export const isPageAnchor = (anchorId: string): boolean =>
  Object.values(PAGE_ANCHORS).includes(anchorId) ||
  (Object.values(SETTINGS_SUBPAGE_ANCHORS) as readonly string[]).includes(anchorId);

export const toHashHref = (anchorId: string): string => `#${anchorId}`;

export const getRulesLocationHref = (locationId: string): string => {
  const params = new URLSearchParams();
  params.set(HASH_QUERY_KEYS.linkedRuleLocationId, locationId);
  return `#${PAGE_ANCHORS.rules}?${params.toString()}`;
};

export const getAnchorUrl = (anchorId: string): string => {
  const url = new URL(window.location.href);
  url.hash = toHashHref(anchorId);
  return url.toString();
};

export const getLogsPageUrl = (hostFilter?: string): string => {
  const base = `src/ui/options/index.html#${SETTINGS_SUBPAGE_ANCHORS.logs}`;
  if (!hostFilter) return base;
  const params = new URLSearchParams();
  params.set(HASH_QUERY_KEYS.logsHostFilter, hostFilter);
  return `${base}?${params.toString()}`;
};

export const parseSettingsHash = (hash: string): ParsedSettingsHash => {
  const rawHash = hash.replace(/^#/, "").trim();
  const [rawAnchorId, rawQuery = ""] = rawHash.split("?");
  const rawAnchor = rawAnchorId?.trim() ?? "";
  const anchorId = ANCHOR_ALIASES[rawAnchor] ?? rawAnchor;
  const params = new URLSearchParams(rawQuery);
  const linkedRuleLocationParam = params.get(HASH_QUERY_KEYS.linkedRuleLocationId);
  const linkedRuleLocationId = linkedRuleLocationParam?.trim() || null;
  const logsHostFilterParam = params.get(HASH_QUERY_KEYS.logsHostFilter);
  const logsHostFilter = logsHostFilterParam?.trim() || null;

  if (!anchorId) {
    return {
      activeTab: "rules",
      settingsSubpageView: "none",
      anchorId: null,
      isKnownAnchor: false,
      linkedRuleLocationId: null,
      logsHostFilter: null,
    };
  }

  const staticTab = STATIC_ANCHOR_TO_TAB[anchorId];
  if (staticTab) {
    const isLogsAnchor = anchorId === SETTINGS_SUBPAGE_ANCHORS.logs;
    return {
      activeTab: staticTab,
      settingsSubpageView: SUBPAGE_VIEW_BY_ANCHOR[anchorId] ?? "none",
      anchorId,
      isKnownAnchor: true,
      linkedRuleLocationId,
      logsHostFilter: isLogsAnchor ? logsHostFilter : null,
    };
  }

  if (isLocationAnchor(anchorId)) {
    return {
      activeTab: "profiles",
      settingsSubpageView: "none",
      anchorId,
      isKnownAnchor: true,
      linkedRuleLocationId,
      logsHostFilter: null,
    };
  }

  if (isRuleAnchor(anchorId)) {
    return {
      activeTab: "rules",
      settingsSubpageView: "none",
      anchorId,
      isKnownAnchor: true,
      linkedRuleLocationId,
      logsHostFilter: null,
    };
  }

  if (isTrustedSiteAnchor(anchorId)) {
    return {
      activeTab: "trusted-sites",
      settingsSubpageView: "none",
      anchorId,
      isKnownAnchor: true,
      linkedRuleLocationId,
      logsHostFilter: null,
    };
  }

  if (anchorId === FALLBACK_MODAL_ANCHOR) {
    return {
      activeTab: "rules",
      settingsSubpageView: "none",
      anchorId,
      isKnownAnchor: true,
      linkedRuleLocationId,
      logsHostFilter: null,
    };
  }

  if (isContainerAnchor(anchorId)) {
    return {
      activeTab: "containers",
      settingsSubpageView: "none",
      anchorId,
      isKnownAnchor: true,
      linkedRuleLocationId,
      logsHostFilter: null,
    };
  }

  return {
    activeTab: "rules",
    settingsSubpageView: "none",
    anchorId: null,
    isKnownAnchor: false,
    linkedRuleLocationId: null,
    logsHostFilter: null,
  };
};
