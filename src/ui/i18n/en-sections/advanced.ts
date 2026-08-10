import { BRAND_DISPLAY_NAME } from "@/shared/brand";
import { externalMapConsentCopy } from "@/ui/i18n/en-sections/osm";

const TURN_OFF_PRODUCT = `Turn off ${BRAND_DISPLAY_NAME}`;

export const advanced = {
  runtimeTitle: "Advanced options",
  runtimeDescription: "Manage detailed runtime logging.",
  copyLinkRuntimeLabel: "advanced settings",
  copyLinkHelpLabel: "advanced help",

  noiseRadius: {
    title: "Default Max Coordinate Radius",
    description:
      "Set the default maximum coordinate radius, in meters, for newly created presets.",
    copyLinkLabel: "default max coordinate radius",
  },

  generatedLocationRandomization: {
    enabled: {
      title: "Randomize coordinates when creating new regional presets",
      description:
        "Use this as the default for generated presets. You can still turn it off on a per-operation basis when you need exact coordinates.",
      readWhy: "Read why.",
      tooltipPrivacy: `${BRAND_DISPLAY_NAME} is privacy-focused. Presets should be easy to use, but reusing exact catalog or search coordinates could make ${BRAND_DISPLAY_NAME} users easier to recognize.`,
      tooltipExact:
        "Need a specific location? Turn this switch off and the preset will use the exact coordinate.",
      copyLinkLabel: "new preset coordinate randomization",
    },
    radius: {
      title: "Default coordinate randomization radius",
      description:
        "Choose the default radius used when coordinate randomization is on. Enter a whole number from 1 to 99 km.",
      inputLabel: "Default coordinate randomization radius in kilometers",
      copyLinkLabel: "default coordinate randomization radius",
    },
  },

  themeMode: {
    title: "Theme",
    description: `Choose whether ${BRAND_DISPLAY_NAME} follows the system appearance or always uses a fixed light or dark theme.`,
    label: "Appearance",
    options: {
      system: "System",
      light: "Light",
      dark: "Dark",
    },
    copyLinkLabel: "theme",
  },

  watchPositionDelay: {
    title: "Watch Position Delay Range (s)",
    description:
      "Set the shortest and longest delay between location updates on websites.",
    copyLinkLabel: "watch position delay range",
  },

  debugMode: {
    title: "Debug Mode",
    description: `Log detailed runtime activity for ${BRAND_DISPLAY_NAME} in the browser developer console.`,
    copyLinkLabel: "debug mode",
  },

  privacy: {
    title: "Privacy",
    description: `${BRAND_DISPLAY_NAME} runs on your device and does not send your browsing data anywhere. The only optional network requests happen when you use location search or map previews while setting up regional presets.`,
    copyLinkLabel: "privacy",

    osmConsent: {
      title: externalMapConsentCopy.title,
      description: externalMapConsentCopy.description,
      stateUnknown: `You have not chosen this yet. ${BRAND_DISPLAY_NAME} will ask before it connects to an external map service.`,
      statePrefix: "External map access is",
      stateEnabled: "enabled — location search and map previews can load",
      stateDisabled: `disabled — ${BRAND_DISPLAY_NAME} will stay offline while you configure locations`,
      copyLinkLabel: "external map access",
    },
  },

  display: {
    title: "Appearance",
    description: "Adjust visual presentation and accessibility settings.",
    copyLinkLabel: "appearance",

    language: {
      title: "Language",
      description: `More languages are on the way. We’re working on new translations for ${BRAND_DISPLAY_NAME}.`,
      option: "English",
      soon: "SOON",
      copyLinkLabel: "language",
    },

    reduceMotion: {
      title: "Reduce motion",
      description: `Turn off interface animations across ${BRAND_DISPLAY_NAME}.`,
      systemOverride: "Reduced motion is enabled by your system accessibility setting.",
      copyLinkLabel: "reduce motion",
    },

    accentColor: {
      title: "Accent color",
      description: `Choose the primary ${BRAND_DISPLAY_NAME} accent from a preset palette inspired by Firefox container colors.`,
      copyLinkLabel: "accent color",
      optionAriaLabel: (label: string) => `Use ${label} as the accent color`,
      options: {
        teal: "Teal",
        blue: "Blue",
        green: "Green",
        yellow: "Yellow",
        orange: "Orange",
        red: "Red",
        pink: "Pink",
        purple: "Purple",
        gray: "Gray",
      },
    },

    highContrast: {
      title: "High contrast mode",
      description:
        "Increase text contrast and border visibility for improved readability.",
      copyLinkLabel: "high contrast mode",
    },
  },

  danger: {
    title: "Danger zone",
    description: `These actions can replace, delete, or restore your locally saved ${BRAND_DISPLAY_NAME} settings and data.`,
    copyLinkLabel: "danger zone",

    spoofing: {
      title: TURN_OFF_PRODUCT,
      description: `Turn off all ${BRAND_DISPLAY_NAME} protections until you turn them back on.`,
      copyLinkLabel: TURN_OFF_PRODUCT,
    },

    export: {
      title: "Export",
      description:
        "Download your current presets, rules, and related settings as a JSON backup.",
      button: "Export settings",
      copyLinkLabel: "export settings",
    },

    import: {
      title: "Import",
      description:
        "Replace current local settings with a previously exported JSON backup.",
      button: "Import settings",
      copyLinkLabel: "import settings",
    },

    reload: {
      title: "Reload",
      description:
        "Reload saved settings from extension storage and discard unsaved changes in the current view.",
      button: "Reload settings",
      copyLinkLabel: "reload settings",
    },

    reset: {
      title: "Reset",
      description: "Restore clean defaults and remove your custom presets and rules.",
      button: "Reset settings",
      copyLinkLabel: "reset settings",
      confirmTitle: "Reset settings?",
      confirmBody:
        "This permanently deletes your saved presets, rules, and custom settings. This can't be undone.",
      onboardingToggleLabel: "Run setup again after reset",
      onboardingToggleDescription:
        "Reopen the first-run setup guide once your settings are cleared.",
    },
  },

  help: {
    title: "Advanced",
    body1: `Use Advanced to fine-tune protections, temporarily turn ${BRAND_DISPLAY_NAME} off, or manage your locally saved settings and data.`,
    body2:
      "Import, export, reload, and reset help you move settings between browsers, recover from mistakes, or restore saved settings when something gets out of sync.",
  },
} as const;
