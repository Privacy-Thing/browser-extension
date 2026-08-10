import { BRAND_DISPLAY_NAME } from "@/shared/brand";

const PRODUCT_NOT_LOWER = `what ${BRAND_DISPLAY_NAME} is not`;

export const rules = {
  title: "Domain Rules",
  hint: "Domain Rules map host patterns to regional presets.",
  addButton: "Add rule",
  filterLabel: "Filter rules",
  filterPlaceholder: "Search presets, domain patterns, warnings",
  locationFilterLabel: "Filter by preset",
  locationFilterPlaceholder: "All presets",
  assignLocationLabel: "Assign preset",
  tableHeadRule: "Rule",
  tableHeadProfile: "Preset",
  tableHeadActions: "Actions",
  selectAllAriaLabel: "Select all visible rules",
  selectMenuAriaLabel: "Open rule selection menu",
  selectRuleAriaLabel: (pattern: string) => `Select rule ${pattern}`,
  editRuleAriaLabel: (pattern: string) => `Edit rule ${pattern}`,
  editRuleTitle: "Edit rule",
  deleteRuleAriaLabel: (pattern: string) => `Delete rule ${pattern}`,
  deleteRuleTitle: "Delete rule",
  inactiveBadge: "inactive",
  selectionMenuAllVisible: "All visible",
  selectionMenuAll: "All",
  selectionMenuNone: "None",
  selectionMenuActive: "Active only",
  selectionMenuInactive: "Inactive only",
  noRulesFiltered: "No rules match the current filter.",
  noRulesEmpty: `No Domain Rules yet. Add one to choose how ${BRAND_DISPLAY_NAME} handles matching sites.`,
  copyLinkLabel: "domain rules",
  copyLinkHelpLabel: "domain rules help",
  copyLinkInspectorLabel: "hostname inspector",
  copyLinkRuleAriaLabel: (pattern: string) => `Copy link to rule ${pattern}`,

  help: {
    title: "Domain Rules",
    body1:
      "Use <code>example.com</code> for one exact host. Use <code>*example.com</code> for that host and any subdomain, like <code>www.example.com</code>. Use <code>*.example.com</code> for subdomains only.",
    body2: `The most specific matching pattern wins. If two rules overlap and point to different regional presets, ${BRAND_DISPLAY_NAME} warns about it.`,
  },

  globalFallback: {
    title: "Default Rule",
    description: `Set the default protections and optional preset ${BRAND_DISPLAY_NAME} uses when nothing more specific takes priority.`,
    copyLinkLabel: "Default Rule",
    overridesBadge: (count: number) =>
      `${count} custom setting${count === 1 ? "" : "s"}`,
    openInRules: "Edit in Domain Rules",
    editAriaLabel: "Edit Default Rule",
    editTitle: "Edit Default Rule",
    noPresetLabel: "No preset assigned",
    setupHint: "No preset or custom protection settings yet.",
    tableHint: "Default settings when nothing more specific applies.",
    dialog: {
      title: "Default Rule",
      description:
        "Set the protections and optional preset the Default Rule should use when nothing more specific takes priority.",
      identityDescription:
        "The Default Rule keeps its own fixed spoofing identity. It cannot be changed manually.",
      enabledLabel: "Enabled",
      enabledHint: "When disabled, this rule does not apply. Its settings stay saved.",
      enabledAriaLabel: "Toggle the Default Rule",
      locationProfileLabel: "Regional preset",
      locationProfileHint:
        "Choose the preset the Default Rule should use. Leave it unassigned to use only the protection settings below.",
      locationProfileWarningPrefix: `${BRAND_DISPLAY_NAME} does not replace VPN, proxy, or DNS tools. `,
      locationProfileWarningLinkLabel: `See ${PRODUCT_NOT_LOWER}`,
      locationProfileWarningSuffix: ".",
      locationLabel: "Preset",
      locationPlaceholder: "Choose preset",
      submit: "Save rule",
    },
  },

  inspector: {
    title: "Hostname inspector",
    hint: `Check how ${BRAND_DISPLAY_NAME} treats a hostname before you save changes. It shows whether the hostname matches a Domain Rule or Trusted Site, and which regional preset would apply.`,
    hostnameLabel: "Hostname",
    hostnameHint:
      "Use the exact host you want to inspect, for example shop.example.com.",
    hostnamePlaceholder: "e.g. shop.example.com",
    noMatchTitle: "No saved Domain Rule or Trusted Site matches this hostname",
    noMatchDescription:
      "No saved rule applies, and the Default Rule is off or unconfigured.",
    trustedSiteWinsTitle: "This hostname is disabled by Trusted Sites",
    trustedSiteWinsDescription: `It matches your Trusted Sites list, so ${BRAND_DISPLAY_NAME} stays off here until you remove or disable that entry.`,
    trustedSiteOverridesRuleTitle:
      "Trusted Sites are overriding a matching Domain Rule",
    trustedSiteOverridesRuleDescription: `This hostname matches both a Trusted Site and a Domain Rule. Trusted Sites take priority, so ${BRAND_DISPLAY_NAME} stays off and the Domain Rule below is ignored.`,
    fallbackWinsTitle: "Default Rule applies here",
    fallbackWinsDescription: `No Domain Rule or Trusted Site matched this hostname, so ${BRAND_DISPLAY_NAME} would fall back to the Default Rule here.`,
    ruleMatchTitle: (locationLabel: string) =>
      `${locationLabel} is the active preset here`,
    ruleMatchDescription: `This hostname matches the Domain Rule below, so ${BRAND_DISPLAY_NAME} would use this preset on the site.`,
    hostnameDetailLabel: "Hostname",
    trustedSiteDetailLabel: "Trusted Site",
    ruleDetailLabel: "Rule",
    defaultRuleDetailLabel: "Default Rule",
    ignoredRuleDetailLabel: "Ignored Rule",
    profileDetailLabel: "Regional preset",
    geolocationDetailLabel: "Geolocation",
    localeDetailLabel: "Locale",
    timeZoneDetailLabel: "Time zone",
    geolocationOn: "On",
    geolocationOff: "Off",
  },

  dialog: {
    titleAdd: "Add rule",
    titleEdit: "Edit rule",
    description:
      "Choose where this rule applies, then decide whether it should use a preset, custom protection settings, or both.",
    patternLabel: "Pattern",
    patternInfo:
      "Use <code>example.com</code> for one exact host. Use <code>*example.com</code> for that host and any subdomain, like <code>www.example.com</code>. Use <code>*.example.com</code> for subdomains only.",
    patternInfoAriaLabel: "Learn how rule patterns work",
    patternPlaceholder: "Enter a domain pattern",
    locationLabel: "Preset",
    locationProfileLabel: "Regional preset",
    locationProfileHint: `Choose the preset this rule should use. If none is assigned, ${BRAND_DISPLAY_NAME} uses the next available preset while keeping this rule's protection settings.`,
    bulkAssignSearchPlaceholder: "Search presets...",
    enabledLabel: "Enabled",
    enabledHint: "When disabled, this rule does not apply. Its settings stay saved.",
    enabledAriaLabel: (pattern: string) => `Toggle enabled state for rule ${pattern}`,
    advancedModal: {
      trigger: "Advanced",
      title: (pattern: string) => `Advanced settings for ${pattern}`,
      description: "These changes stay in the current draft until you save the rule.",
      confirm: "Ok",
      patternFallback: "this rule",
    },
    relaxCspLabel: "Relax CSP for worker spoofing",
    relaxCspHint: `Removes this site's Content Security Policy headers when they prevent ${BRAND_DISPLAY_NAME} from protecting workers.`,
    relaxCspRiskHint:
      "Security warning: this makes it easier for malicious scripts to run on the site. Enable it only for a site you trust and only when worker protection otherwise fails.",
    relaxCspAriaLabel: (pattern: string) => `Toggle CSP relaxation for rule ${pattern}`,
    surfaceOverrides: {
      title: "Protection settings",
      description:
        "Choose different protection settings for this rule. Leave a setting on Inherit to follow the global setting.",
      stateOn: "On",
      stateInherit: "Inherit",
      stateOff: "Off",
      stateNative: "Native",
      stateSpoof: "Spoof",
      stateStrict: "Strict",
      stateBlock: "Block",
      stateAllow: "Allow",
      helpAriaLabel: (label: string) => `Learn what ${label} controls`,
      geolocation: {
        label: "Geolocation",
        info: "Controls the Geolocation API. Turn it off when a site should read your real browser location, or on when this rule should spoof location lookups.",
      },
      timeLocale: {
        label: "Time & Locale",
        info: "Controls Date, Intl, navigator.language, navigator.languages, and language headers so sites see the region from your active preset.",
      },
      canvas: {
        label: "Canvas",
        info: "Controls the hidden image output sites use for canvas fingerprinting.",
      },
      webGL: {
        label: "WebGL",
        info: "Controls graphics details such as renderer, GPU clues, and related WebGL fingerprint data.",
      },
      audio: {
        label: "Audio",
        info: "Controls AudioContext output that sites can measure for audio fingerprinting.",
      },
      navigator: {
        label: "Navigator",
        info: "Controls browser identity fields like platform, hardware hints, and other navigator properties.",
      },
      screen: {
        label: "Screen",
        info: "Controls screen size, pixel ratio, and related display details.",
      },
      clientHints: {
        label: "Client Hints",
        info: "Controls browser and device details shared through Client Hints headers and APIs.",
      },
      battery: {
        label: "Battery",
        info: "Controls whether the site receives a fixed full-and-charging battery profile instead of the device's real battery state.",
      },
      webRTC: {
        label: "WebRTC",
        info: "Controls WebRTC IP-handling protection that can reduce local and public IP leaks.",
      },
      serviceWorker: {
        label: "Service Workers",
        info: "Controls whether this site can register Service Workers, which can run in the background and keep long-lived data. Block can break PWAs, offline mode, push, and background sync; Allow lets the browser handle registration normally; Inherit follows the global setting.",
      },
      sharedWorker: {
        label: "Dedicated & Shared Workers",
        info: "Overrides Dedicated and Shared Worker handling for this rule. Native leaves workers unchanged, Spoof attempts to apply spoofed values, and Strict blocks a worker when spoofing cannot be confirmed before startup.",
      },
    },
    identity: {
      sectionTitle: "Identity",
      sectionDescription:
        "This rule keeps its own spoofing identity. Rotate it only when you want a fresh fingerprint and a clean site state for this rule.",
      actionDescription:
        "Clears related site data and starts this rule with a fresh identity.",
      actionLabel: "New identity",
      confirmTitle: (pattern: string) => `New identity for ${pattern}?`,
      confirmDescription:
        "This clears cookies, storage, Service Workers, and caches for sites tied to this rule. Then it creates a new spoofing identity.",
      confirmDomainsLabel: `${BRAND_DISPLAY_NAME} will clear browser data for these domains:`,
      confirmNoDomains: `No browser data has been recorded for this rule yet. ${BRAND_DISPLAY_NAME} will still create a new spoofing identity.`,
      confirmLabel: "Create new identity",
      rotateSuccess: "Saved a new rule identity.",
      rotateError: "Creating a new rule identity failed.",
    },
    submitAdd: "Add rule",
    submitEdit: "Save",
    duplicateAlertTitle: "Overwrite existing rule?",
    duplicateAlertDescription: (pattern: string) =>
      `A rule for "${pattern}" already exists. Overwrite it with these settings?`,
    duplicateAlertConfirm: "Overwrite",
    duplicateAlertClose: "No",
    trustedSiteOverrideWarning: (pattern: string) =>
      `This domain matches the Trusted Sites entry "${pattern}". ${BRAND_DISPLAY_NAME} will remain off here regardless of these settings.`,
  },
} as const;
