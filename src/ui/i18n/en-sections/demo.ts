import { BRAND_DISPLAY_NAME } from "@/shared/brand";

const SPOOFED_PRODUCT = `Spoofed — ${BRAND_DISPLAY_NAME}`;

export const demo = {
  loadingSettings: "Loading settings…",
  noLocationsTitle: "No regional presets yet",
  noLocationsBody:
    "Create at least one regional preset in Settings to use the Playground.",
  openSettingsButton: "Open Settings",

  locationPreview: {
    title: "Preset preview",
    activeLocationLabel: "Active preset",
    activeLocationDescription:
      "Select a saved regional preset to preview its browser-facing values. Switching presets resets the route and applies the new geolocation preview.",
    activeLocationPlaceholder: "Choose a preset…",
    playgroundCadenceLabel: "Playground update timing",
    realSiteCadenceLabel: "Website update timing",
    configuredDelayLabel: "Watch Position Delay",
    callbackDelayLabel: "Callback delay",
    runtimeModeLabel: "Runtime mode",
    runtimeModeSimple: "Default timing",
    realLocationTitleIdle: "Compare with your current browser location",
    realLocationTitleLoading: "Requesting your current browser location",
    realLocationTitleGranted: "Current browser location is ready",
    realLocationTitleDenied: "Browser location permission denied",
    realLocationTitleUnavailable: "Browser location unavailable",
    realLocationDescription:
      "Request the browser's real geolocation once to compare it with the preset preview below.",
    realLocationGrantedDescription:
      "Your browser's current location is now available in the geolocation rows below for side-by-side comparison.",
    realLocationDeniedDescription:
      "The browser denied access to real geolocation. You can try again if permission changes.",
    realLocationUnavailable:
      "Real-location comparison is unavailable because this browser does not expose geolocation here.",
    realLocationRefresh: "Refresh real location",
  },

  localMachineTitle: "Local Machine",
  spoofedTitle: SPOOFED_PRODUCT,
  waitingForPermission: "Waiting for browser permission…",
  permissionDenied: "Permission denied by browser",
  geolocationUnavailable: "Geolocation not available",
  requestRealLocation: "Request real location",
  requestRealLocationHintTitle: "Real location not loaded yet",
  requestRealLocationTableHint:
    "Request your browser's real location above to compare it here.",
  waitingForFix: "Waiting for first fix…",
  selectLocationPrompt: "Select a regional preset above to see preview values.",

  comparison: {
    language: "navigator.language",
    languages: "navigator.languages",
    timeZone: "Intl…resolvedOptions().timeZone",
    acceptLanguage: "Accept-Language header",
    timeZoneOffset: "new Date().getTimezoneOffset()",
    dateToString: "new Date().toString()",
    dateToDateString: "new Date().toDateString()",
    dateToTimeString: "new Date().toTimeString()",
    dateLocaleString: "new Date().toLocaleString()",
    dateLocaleDateString: "new Date().toLocaleDateString()",
    dateLocaleTimeString: "new Date().toLocaleTimeString()",
    currentPosition: "navigator.geolocation.getCurrentPosition()",
    coords: "geolocation.coords",
    timestamp: "geolocation.timestamp",
    timestampInfoLabel: "About geolocation timestamp display",
    timestampTooltip: `${BRAND_DISPLAY_NAME} returns the raw Unix epoch timestamp in milliseconds. The human-readable date shown here is only for convenience and is formatted in the displayed column's timezone.`,
    userAgent: "navigator.userAgent",
    appVersion: "navigator.appVersion",
    vendor: "navigator.vendor",
    hardwareConcurrency: "navigator.hardwareConcurrency",
    deviceMemory: "navigator.deviceMemory",
    platform: "navigator.platform",
    pixelDepth: "screen.pixelDepth",
    screenMetrics: "screen.width/height/avail*/colorDepth",
    devicePixelRatio: "window.devicePixelRatio",
    canvas2d: "Canvas 2D probe summary",
    webglRenderer: "WebGL renderer probe",
    webglDebugExtension: "WEBGL_debug_renderer_info",
    webglReadPixels: "WebGL readPixels() probe",
    audioFingerprint: "AnalyserNode + AudioBuffer probe",
    clientHintBrands: "navigator.userAgentData.brands",
    clientHintPlatform: "navigator.userAgentData.platform",
    clientHintPlatformVersion: "navigator.userAgentData.platformVersion",
    clientHintArchitecture: "navigator.userAgentData.architecture",
    clientHintBitness: "navigator.userAgentData.bitness",
    clientHintModel: "navigator.userAgentData.model",
    clientHintMobile: "navigator.userAgentData.mobile",
    clientHintFullVersionList: "navigator.userAgentData.fullVersionList",
    secChUa: "Sec-CH-UA header",
    secChUaPlatform: "Sec-CH-UA-Platform header",
    secChUaMobile: "Sec-CH-UA-Mobile header",
    secChUaFullVersionList: "Sec-CH-UA-Full-Version-List header",
    webRTCIcePolicy: "RTCPeerConnection ICE policy",
    probePending: "Collecting…",
    notAvailable: "N/A",
    spoofedMatchesLocal: "The preview value matches your browser for this identity.",
    browserVersionNote: (versionToken: string) =>
      `${BRAND_DISPLAY_NAME} keeps normalized browser-version tokens and does not randomize placeholder variants like ${versionToken}.`,
  },

  previewSeed: {
    title: "Preview identity",
    description:
      "Choose the consistent browser identity shown in this Playground preview.",
    inputAriaLabel: "Preview identity code",
    placeholder: "Identity code",
    hint: "Use 6 lowercase letters or digits. Change the code to preview a different identity.",
    randomize: "Generate new identity",
  },

  sections: {
    localeDate: "Locale & Date",
    networkHeaders: "Network Headers",
    geolocation: "Geolocation",
    browserFingerprint: "Browser identity",
    webglCanvas: "Canvas & WebGL",
    screen: "Screen",
    audio: "Audio",
    webRTC: "WebRTC",
  },

  map: {
    title: "Map preview",
    noLocationTitle: "Select a preset first",
    noLocationDescription:
      "Choose a saved regional preset above to enable the map and waypoint controls.",
    osmRequired: "Map access required",
    osmRequiredDescription:
      "Allow external map access to preview the spoofed position on an interactive map.",
    demoIntervalLabel: "Demo interval (2–5 s)",
    clearButton: "Clear",
  },

  disclaimer: {
    title: "Preview mode, not a live website",
    body: `Use this page to inspect how ${BRAND_DISPLAY_NAME} would present the selected regional preset before you apply it on websites. Language, locale, time, headers, and similar values are shown as a <em>preview</em> from the same preset data. Geolocation uses the same movement and update behavior as protected websites. In the Playground, location updates refresh faster than on normal websites so changes are easier to see.`,
  },

  howItWorks: {
    title: "How to read this preview",
    body1:
      "<strong>Language, locale, and time</strong> — these rows show how the selected preset would present itself to websites, without changing this Playground page itself.",
    body2: `<strong>Geolocation</strong> — the map and location rows use the same movement and update behavior as protected websites, so you can preview timing and coordinate variation before assigning the preset.`,
    body3: `<strong>Browser values and headers</strong> — these comparisons place your current browser values next to the values ${BRAND_DISPLAY_NAME} would expose for the selected preset, following the same protection settings you use in Settings.`,
    body4:
      "The Playground updates faster than normal browsing, so changes are easier to spot while testing.",
  },
} as const;
