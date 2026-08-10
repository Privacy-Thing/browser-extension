import { BRAND_DISPLAY_NAME } from "@/shared/brand";
import { externalMapConsentCopy } from "@/ui/i18n/en-sections/osm";

const WELCOME_PRODUCT = `Welcome to ${BRAND_DISPLAY_NAME}`;

export const welcome = {
  title: WELCOME_PRODUCT,
  loading: "Loading setup...",
  progressLabel: "Setup progress",
  previous: "Previous",
  next: "Next",
  privacyPolicy: "Privacy policy",
  privacyDialog: {
    title: "Privacy Policy",
    description: `How ${BRAND_DISPLAY_NAME} handles settings, diagnostics, and network requests.`,
    close: "Close privacy policy",
  },
  saving: "Saving...",
  unexpectedError: "Something went wrong",
  importSuccess: "Settings imported",
  importError: "Couldn't import settings",
  importParseError: "Couldn't read the settings file",
  steps: {
    welcome: {
      title: "Thanks for installing this extension",
      description:
        "Choose what sites see instead of exposing your real location and browser identity. This short, optional guide walks you through the first setup choices — every one reversible — and saves them into the same Settings you can revisit anytime. Already have a configuration to reuse?",
      importInline: "Import settings instead",
      advancedTitle: "I know what I want",
      advancedDescription:
        "Skip the guide and open Settings with clean defaults. No regional presets or Domain Rules are added, the Default Rule stays off, and browser protections remain available for rules you create later.",
      guidedTitle: "Go to setup",
      guidedDescription:
        "Walk through the first decisions in order. The guide keeps the choices narrow, explains the tradeoffs, and saves everything into the same Settings screens you can edit later.",
      advancedCta: "Skip setup",
      guidedCta: "Start setup",
    },
    privacy: {
      title: "Your browsing stays local",
      description: `${BRAND_DISPLAY_NAME} stores rules and presets locally. This step is only about optional external map services: enable them if you want search and previews during setup, or leave them off and enter coordinates manually.`,
      descriptionBeforePolicy: `${BRAND_DISPLAY_NAME} stores rules and presets locally. Optional map search and previews use external services only after you allow them. Read the`,
      policyLink: "privacy policy",
      descriptionAfterPolicy: " before deciding whether those requests fit your setup.",
      consentTitle: externalMapConsentCopy.title,
      consentDescription: externalMapConsentCopy.description,
    },
    presets: {
      title: "Add regional presets",
      description:
        "Regional presets give you ready-made locations with matching language and time-zone settings, so a site sees a more coherent regional profile when you use that location. Select only the places you want in your starting library. The setup imports the selected presets at the end, and you can edit or delete each one later.",
      selectAll: "Select all",
      selectNone: "Clear all",
      selectedCount: (count: number) => `${count} selected`,
    },
    scope: {
      title: "Choose where protection starts",
      description:
        "The Default Rule applies when no more specific setting takes priority. Keep it off for a quieter start, or enable it to protect unmatched sites.",
      defaultRuleDescription:
        "If you assign a regional preset to the Default Rule, keep that preset selected so setup can import it before saving.",
      enableEverywhereTitle: `Use ${BRAND_DISPLAY_NAME} on all sites`,
      enableEverywhereDescription: `Turn on the Default Rule now if you want ${BRAND_DISPLAY_NAME} to be active on sites without their own rules. You can still narrow behavior later with Domain Rules, assign different presets to specific hosts, or exclude sensitive sites with Trusted Sites.`,
      editDefaultRuleTitle: "Default Rule settings",
      editDefaultRule: "Edit Default Rule",
      editDefaultRuleDescription:
        "Choose the Default Rule preset and custom protection settings before setup finishes.",
      defaultRuleDialogDescription:
        "During setup, this dialog can use the regional presets you selected even though they have not been imported yet. If you assign one here, keep it selected so setup can create it.",
      presetMismatch: (label: string) =>
        `Default Rule is assigned to ${label}, but that preset is not selected for import. Select the preset again or choose a different preset for the Default Rule.`,
    },
    chromium: {
      title: "Rotate Chromium build details",
      description: (count: number) =>
        `${BRAND_DISPLAY_NAME} can rotate the Chromium engine build and patch values exposed through Client Hints while keeping the major version aligned with your installed browser. The bundled catalog contains recent Chromium builds; for this browser version, ${BRAND_DISPLAY_NAME} can choose from ${count} matching ${count === 1 ? "entry" : "entries"}.`,
      switchTitle: "Rotate build and patch numbers",
      switchDescription:
        "Use recent Chromium build and patch values from the bundled catalog when Client Hints are spoofed. Turn this off if you want those minor version details to stay fixed.",
    },
    firefox: {
      title: "Firefox userScripts permission (optional)",
      description: `You can use ${BRAND_DISPLAY_NAME} in Firefox without this permission. If you grant userScripts, ${BRAND_DISPLAY_NAME} can apply spoofed values earlier on supported sites, improving protection during the first page load. You can skip it now and change this later in Settings.`,
      action: "Grant userScripts permission",
      granted: "Permission granted",
      skipped: `You can keep using ${BRAND_DISPLAY_NAME} without this permission.`,
    },
    appearance: {
      title: "Make it comfortable",
      description: `Choose how the extension interface should look before you start using it. These settings affect ${BRAND_DISPLAY_NAME} screens only; they do not change spoofing behavior on websites, regional presets, or rules. You can adjust the same display options later from Settings.`,
      themeTitle: "Theme",
      themeDescription: `Follow your system setting or choose a fixed light or dark interface for all ${BRAND_DISPLAY_NAME} screens.`,
      reduceMotionTitle: "Reduce motion",
      reduceMotionDescription: `Turn off interface animations across ${BRAND_DISPLAY_NAME}.`,
      reduceMotionSystemOverride:
        "Reduced motion is enabled by your system accessibility setting.",
      accentTitle: "Accent color",
      accentDescription:
        "Pick the highlight color used for controls, active states, focus accents, and selected items.",
      contrastTitle: "High contrast mode",
      contrastDescription:
        "Increase contrast for text, borders, and controls across the extension UI when the default skin feels too subtle.",
    },
    done: {
      title: "Setup is ready",
      description: `${BRAND_DISPLAY_NAME} will save these choices and open Settings. You can review imported presets, adjust the Default Rule, and change appearance or privacy settings there.`,
      cta: "Open Settings",
    },
  },
  presetNames: {
    spfWarsaw: "Warsaw",
    spfParis: "Paris",
    spfLondon: "London",
    spfOttawa: "Ottawa",
    spfNewYork: "New York",
    spfLasVegas: "Las Vegas",
    spfSanFrancisco: "San Francisco",
    spfSydney: "Sydney",
    spfBeijing: "Beijing",
    spfHongKong: "Hong Kong",
    spfNewDelhi: "New Delhi",
    spfCairo: "Cairo",
    spfLagos: "Lagos",
    spfKyiv: "Kyiv",
    spfKinshasa: "Kinshasa",
    spfSaoPaulo: "Sao Paulo",
    spfBuenosAires: "Buenos Aires",
    spfLima: "Lima",
    spfRioDeJaneiro: "Rio de Janeiro",
    spfCaracas: "Caracas",
    spfBerlin: "Berlin",
    spfMadrid: "Madrid",
  },
  themeOptions: {
    system: "System",
    light: "Light",
    dark: "Dark",
  },
} as const;
