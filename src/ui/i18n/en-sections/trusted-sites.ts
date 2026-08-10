import { BRAND_DISPLAY_NAME } from "@/shared/brand";

export const trustedSites = {
  title: "Trusted Sites",
  hint: `Sites where ${BRAND_DISPLAY_NAME} stays off even when a rule, container assignment, or the Default Rule would otherwise apply.`,
  patternLabel: "Domain Pattern",
  patternPlaceholder: "Enter a domain pattern",
  filterLabel: "Filter trusted sites",
  filterPlaceholder: "Search domain",
  addButton: "Add website",
  copyLinkLabel: "trusted sites",
  copyLinkHelpLabel: "trusted sites help",
  copyLinkInspectorLabel: "hostname inspector",
  tableHeadPattern: "Domain",
  tableHeadStatus: "Status",
  tableHeadActions: "Actions",
  empty: "No trusted sites yet.",
  filteredEmpty: "No trusted sites match the current filter.",
  inactiveBadge: "inactive",
  toggleSiteAriaLabel: (pattern: string, enabled: boolean) =>
    `${enabled ? "Disable" : "Enable"} trusted site ${pattern}`,
  deleteSiteAriaLabel: (pattern: string) => `Delete trusted site ${pattern}`,
  deleteSiteTitle: "Delete trusted site",
  duplicateWarning: "That trusted site already exists.",
  patternRequired: "Enter a domain pattern.",
  saved: "Trusted site saved.",
  updated: "Trusted site updated.",
  deleted: "Trusted site deleted.",
  help: {
    title: "When to use Trusted Sites",
    body1:
      "Use Trusted Sites for domains where spoofing gets in the way, such as banking, checkout, or account-recovery flows that treat browser changes as suspicious.",
    body2: `Trusted Sites override Domain Rules, Firefox container assignments, and the Default Rule. Use <code>example.com</code> for one exact host, <code>*example.com</code> for that host plus its subdomains, or <code>*.example.com</code> for subdomains only.`,
  },
  rulesCta: {
    title: "Protection on other sites",
    activeRulesOnly: (count: number) =>
      `${count} enabled Domain ${count === 1 ? "Rule applies" : "Rules apply"} outside Trusted Sites. Open Domain Rules to review where they are active.`,
    activeRulesWithDefault: (count: number) =>
      `${count} enabled Domain ${count === 1 ? "Rule applies" : "Rules apply"} outside Trusted Sites. The Default Rule also covers other unmatched sites.`,
    defaultRuleOnly: `The Default Rule still applies to unmatched sites. Trusted Sites disable ${BRAND_DISPLAY_NAME} only on matching hosts.`,
    openRules: "Open Domain Rules",
    openDefaultRule: "Open Default Rule",
  },
  dialog: {
    title: "Add website",
    description: `Keep ${BRAND_DISPLAY_NAME} off on matching pages when a site works better with your normal browser state.`,
    patternInfo:
      "Use <code>example.com</code> for one exact host. Use <code>*example.com</code> for that host and any subdomain, like <code>www.example.com</code>. Use <code>*.example.com</code> for subdomains only.",
    patternInfoAriaLabel: "Learn how trusted site patterns work",
    submit: "Add website",
  },
} as const;
