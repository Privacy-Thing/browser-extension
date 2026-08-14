import { workerHandlingModeCopy } from "./shared-worker";

import { BRAND_DISPLAY_NAME } from "@/shared/brand";

export const options = {
  title: "Settings",
  tabsAriaLabel: "Settings sections",
  spoofingOffBannerTitle: "Spoofing is off",
  spoofingOffBannerBody: `${BRAND_DISPLAY_NAME} is not applying spoofed location or browser values right now.`,
  spoofingOffBannerAction: "Turn spoofing back on",
  spoofingTurnedOffToast: `${BRAND_DISPLAY_NAME} turned off.`,
  spoofingTurnedOnToast: `${BRAND_DISPLAY_NAME} turned on.`,

  tabs: {
    locations: "Regional Presets",
    rules: "Domain Rules",
    trustedSites: "Trusted Sites",
    playground: "Playground",
    options: "Options",
    advanced: "Advanced",
    about: "About",
  },
} as const;

export const optionsPage = {
  browserFingerprintSpoofing: {
    title: "Global protection settings",
    description: `Choose which browser protections ${BRAND_DISPLAY_NAME} uses by default. More specific settings can override individual protections, while Trusted Sites can disable them for matching sites.`,
    disabledNote: `Browser protections are off everywhere. Turn them back on to choose what ${BRAND_DISPLAY_NAME} should spoof by default.`,
    copyLinkLabel: "browser protections",
    items: {
      geolocation: {
        label: "Geolocation",
        description: `Controls the Geolocation API. When this is on, ${BRAND_DISPLAY_NAME} answers location requests with your active preset. Turn it off and sites get the browser's real geolocation result.`,
        advancedButton: "Advanced",
        advancedModal: {
          title: "Geolocation advanced settings",
          description: "Tune the default coordinate radius and location update timing.",
        },
      },
      timeLocale: {
        label: "Time & Locale",
        description: `Controls Date, Intl, navigator.language, navigator.languages, and language headers. When this is on, ${BRAND_DISPLAY_NAME} keeps these values aligned with your active preset. Turn it off and sites see your browser's real regional settings.`,
      },
      canvas: {
        label: "Canvas",
        description: `Sites can draw a hidden image and use tiny rendering differences to recognize your browser. When this is on, ${BRAND_DISPLAY_NAME} adds controlled noise so the result is harder to reuse as a fingerprint. Turn it off and sites get your real canvas output.`,
      },
      webGL: {
        label: "WebGL",
        description: `WebGL reveals graphics details such as your GPU model, renderer, and driver behavior. When this is on, ${BRAND_DISPLAY_NAME} replaces those clues with a consistent profile that fits your current platform. Turn it off and sites can read graphics data closer to your real machine.`,
      },
      audio: {
        label: "Audio",
        description: `Audio APIs produce tiny hardware-specific differences that sites can measure in the background. When this is on, ${BRAND_DISPLAY_NAME} slightly changes those values so they are less useful for tracking. Turn it off and audio output stays unchanged.`,
      },
      navigator: {
        label: "Navigator",
        description: `Navigator fields reveal details such as your platform, language setup, CPU hints, and other browser identity data. When this is on, ${BRAND_DISPLAY_NAME} masks selected identity fields while keeping them internally consistent. Turn it off and sites see more of your real browser identity.`,
      },
      screen: {
        label: "Screen",
        description: `Screen size, pixel ratio, and color depth help narrow you down to a small group of devices. When this is on, ${BRAND_DISPLAY_NAME} masks those exact display details. Turn it off and sites get your real screen properties.`,
      },
      clientHints: {
        label: "Client Hints",
        description: `Client Hints share browser version, platform, and device data through request headers and JavaScript APIs. When this is on, ${BRAND_DISPLAY_NAME} keeps those values consistent with your spoofed browser identity. Turn it off and sites get your real browser and platform details.`,
      },
      battery: {
        label: "Battery",
        description: `Battery status can reveal changing device information that sites may use to link visits. When this is on, ${BRAND_DISPLAY_NAME} reports a full, charging battery instead of the device's real state. Turn it off and sites can read the native Battery Status API.`,
      },
      clientHintsVersionRotation: {
        label: "Rotate build and patch numbers",
        description: (count: number) =>
          `Rotates the Chromium engine build and patch numbers exposed through Client Hints while keeping your installed browser's major version. ${BRAND_DISPLAY_NAME} ships with a catalog of recent Chromium builds; for this browser version, it can choose from ${count} matching ${count === 1 ? "entry" : "entries"}. The reduced User-Agent string stays at the browser's native privacy-preserving .0.0.0 format.`,
        hintPrefix: "e.g.:",
        hint: "139.0.[build].[patch]",
      },
      webRTC: {
        label: "WebRTC",
        description: `WebRTC can reveal local or public IP addresses, even when you use a VPN or proxy. When this is on, ${BRAND_DISPLAY_NAME} asks the browser to use its strictest IP-handling mode. Turn it off and WebRTC behaves normally, which can expose more network details.`,
      },
      serviceWorker: {
        label: "Service Workers",
        description: `Service Workers run in the background and can let sites keep long-lived data and identifiers. Turn this on when ${BRAND_DISPLAY_NAME} should block sites from registering Service Workers everywhere by default.`,
        warning:
          "Blocking Service Workers can break installable web apps (PWAs), offline mode, push notifications, and background sync. Some apps may also work more slowly or lose features.",
        defaultState:
          "Blocking is off by default — you can turn it on globally, then allow it for specific domains with a Domain Rule.",
        allow: "Allow",
        block: "Block",
      },
      sharedWorker: {
        label: "Dedicated & Shared Workers",
        descriptionLead:
          "Choose how Dedicated and Shared Workers run by default. Domain Rules and Firefox Containers can override this policy for matching sites.",
        copyLinkLabel: "Dedicated and Shared Worker handling",
        native: workerHandlingModeCopy.native.label,
        nativeDescription: workerHandlingModeCopy.native.description,
        spoof: workerHandlingModeCopy.spoof.label,
        spoofDescription: workerHandlingModeCopy.spoof.description,
        strict: workerHandlingModeCopy.strict.label,
        strictDescription: workerHandlingModeCopy.strict.description,
      },
    },
  },
  badgeQueryCount: {
    label: "Show call count on extension badge",
    description: `Show how many browser API calls ${BRAND_DISPLAY_NAME} handled on the extension badge instead of the text label.`,
    includeDateCalls: {
      label: "Include Date and Temporal API calls",
      description:
        "Include Date.* and Temporal.* calls in the badge number. Turn this off to keep frequent time checks from inflating the count.",
    },
  },
  copyLinkHelpLabel: "options help",
  help: {
    title: "Options",
    body1: `Browser protections let you choose which values ${BRAND_DISPLAY_NAME} spoofs by default. These settings affect every site unless a Domain Rule or Firefox Container says otherwise.`,
    body2: `Privacy controls cover the only optional network requests ${BRAND_DISPLAY_NAME} makes while you set up locations. Leave them off and ${BRAND_DISPLAY_NAME} still works — you will just add locations manually instead of using search or map previews.`,
  },
} as const;
