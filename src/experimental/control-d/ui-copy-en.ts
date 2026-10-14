import { BRAND_DISPLAY_NAME } from "@/shared/brand";
export const controlDEn = {
  title: "Control D",
  featureTitle: "Control D integration",
  featureDescription: "Sync regional rules to a separate Control D profile.",
  beta: "Beta",
  privacyPolicy: "Control D privacy policy",
  ownPrivacyPolicy: `${BRAND_DISPLAY_NAME} privacy policy`,
  intro: {
    title: "Before you connect",
    purpose:
      "Control D is a DNS and traffic-routing service. This integration syncs your regional rules to a separate Control D profile so those sites use matching exits. Sync is one-way, from this extension. You need your own Control D account and an API key with write access.",
    resources:
      "After you connect, a profile, a browser endpoint and rule folders (one per exit) are created. Service recognition can optionally create a lookup profile and endpoint. These resources remain in your Control D account after you disconnect, unless you choose to delete them while disconnecting.",
    namesTitle: "Random resource names",
    names: `Names use a random code, never your preset names: “${BRAND_DISPLAY_NAME} XXXXX-XXXXX”, “PT Browser XXXXX-XXXXX” (“PT Firefox XXXXX-XXXXX” on Firefox), “PT XXXXX-XXXXX <ROUTE>”. Optional lookup resources: “PT Lookup XXXXX-XXXXX”, “PT Probe XXXXX-XXXXX”.`,
    data: "Control D receives your domain-rule hostnames, their chosen exits and these resource names. Only with service recognition, a rule hostname is also sent as a DNS-over-HTTPS lookup asking not to be logged (no_log=1). Preset names and coordinates are not sent. Your API key stays in this installation, excluded from exports and browser sync.",
    limits:
      "This extension does not automatically change browser DNS or change your IP address by itself. You set Secure DNS yourself in a later step; Control D routes traffic only after you configure its resolver.",
  },
  open: "Open Control D",
  back: "Back to Advanced",
  lead: "Send regional rules to Control D. Changes go one way, from this extension.",
  progressLabel: "Setup progress",
  enableLabel: "Enable integration",
  status: {
    loading: "Loading",
    disconnected: "Not connected",
    authError: "Authorization failed",
    conflict: "Review required",
    syncError: "Sync error",
    syncing: "Synchronizing",
    chooseSetup: "Choose setup",
    review: "Ready to review",
    dnsPending: "Rules synced · Check DNS",
    active: "Active",
  },
  account: {
    consent:
      "Connecting creates a profile, browser endpoint and rule folders with random-coded names, or reuses a compatible setup. Created resources remain after disconnecting, unless you choose to delete them.",
    title: "Connect account",
    description:
      "Use an API key with write access. It stays in this installation and is excluded from exports and browser sync.",
    placeholder: "Control D API key",
    connect: "Connect",
    connectedTitle: "API access verified",
    connectedDescription:
      "Account access works. The Rules step shows synchronization changes.",
    docs: "API instructions",
    permissionDenied: "Control D API access was not granted.",
  },
  setup: {
    adopted: (name: string) => `Reconnected to ${name}.`,
    foreignReview:
      "This setup contains rules not created by this extension. Review the plan before applying.",
    title: "Choose setup",
    description: `Create a separate setup or reconnect one previously created by ${BRAND_DISPLAY_NAME}.`,
    none: "No compatible setups found.",
    existing: "Existing setups",
    missingEndpoint: "An endpoint will be created when you apply.",
    blocked: "Resolve this setup's conflicts in Control D first.",
    useExisting: "Use this setup",
    createNew: "Create new setup",
    confirmTitle: "Use this setup?",
    confirmDescription:
      "After you connect, straightforward changes are applied automatically. Decisions are shown for review.",
    folders: (count: number) => `Folders: ${count}`,
  },
  rules: {
    consentRequired:
      "New or changed approximate routes need your approval before synchronization can continue.",
    applyApproximate: "Apply with approximate routes",
    appliedAutomatically:
      "Rules were synchronized automatically. Configure browser DNS below.",
    applied: "Rules synchronized. Configure browser DNS below.",
    title: "Review changes",
    description: "Review this plan before changing managed resources.",
    preview: "Refresh preview",
    apply: "Apply changes",
    repair: "Repair rules",
    sync: "Sync now",
    routes: "Route overrides",
    showRoutes: "Review routes",
    hideRoutes: "Hide routes",
    acceptApproximate: "I accept the approximate routes in this preview.",
    upToDate: "Rules are up to date.",
    routeDescription: "Change an automatic choice only when you need another exit.",
  },
  dns: {
    title: "Configure browser DNS",
    description: `Set Secure DNS in your browser. ${BRAND_DISPLAY_NAME} cannot change or verify it automatically.`,
    copy: "Copy resolver",
    copied: "Copied",
    settings: "Open DNS settings",
    verify: "Check on Control D",
    guide: "Setup instructions",
    confirm: "I verified this resolver",
    verified: "DNS verified",
    verifiedDescription: "You confirmed this endpoint on the Control D status page.",
    verifiedState: "Verified",
    unverifiedState: "Not verified",
  },
  overview: {
    codeTitle: "Resource identification code",
    codeDescription:
      "This random code identifies the profile, endpoint and folders for reconnecting.",
    title: "Integration overview",
    account: "API access",
    rules: "Managed rules",
    dns: "Browser DNS",
    review: "Review changes",
    verify: "Check DNS again",
    setupLabel: (code: string) => `Setup ${code}`,
    syncedAt: (time: string) => `Synced ${time}`,
  },
  summary: {
    created: (p: number, e: number, f: number) =>
      `Created: profile ${p}, endpoint ${e}, folders ${f}`,
    willCreate: (p: number, e: number, f: number) =>
      `Will create: profile ${p}, endpoint ${e}, folders ${f}`,
    ruleChanges: (a: number, u: number, r: number) =>
      `Rules: add ${a}, update ${u}, remove ${r}`,
    profiles: "Profiles",
    endpoints: "Endpoints",
    folders: "Folders",
    add: "Add",
    update: "Update",
    remove: "Remove",
  },
  disconnect: {
    action: "Disconnect",
    title: "Disconnect Control D?",
    description:
      "Forget the API key and stop sync. Remote resources and browser DNS settings remain.",
    confirm: "Disconnect",
  },
  common: {
    dismiss: "Dismiss",
    cancel: "Cancel",
    continue: "Continue",
    notYet: "Not yet",
    working: "Working…",
    selected: "Selected",
    requestFailed: "Control D request failed.",
    copyFailed: "Could not copy the resolver.",
    applyFirst: "Apply changes to create an endpoint and resolver.",
    confirmedAt: (time: string) => `Confirmed ${time}`,
  },
  help: {
    account: {
      title: "Your key stays here",
      body: "Connect grants this extension access to Control D. The key stays in this browser.",
      note: "Write access is needed to create and update regional rules.",
    },
    setup: {
      title: "A separate setup",
      body: "Use a new setup or reconnect an existing one. Other setups keep their settings.",
      note: "After you connect, straightforward changes are applied automatically. Decisions are shown for review.",
    },
    rules: {
      title: "Review, then apply",
      body: "The preview shows planned additions, updates and removals.",
      note: "Changes affect this setup's managed resources.",
    },
    dns: {
      title: "Set DNS in your browser",
      body: "Copy the resolver and use it as Secure DNS in browser settings.",
      note: "Check the Control D status page, then confirm this resolver here.",
    },
    overview: {
      title: "Three separate checks",
      body: "Account access, rule sync and browser DNS are checked separately.",
      note: "Disconnect removes the key and stops sync. DNS and remote resources remain.",
    },
  },
  route: {
    notSynchronized: "Not synchronized",
    unavailable: "Exit unavailable",
    exact: "Nearest exit in the same country.",
    approximate: "Approximate exit. Choose another if needed.",
    skipped: "Excluded from sync.",
    change: "Change",
    choose: "Choose exit",
    skip: "Skip sync",
    ruleCount: (count: number) => `Rules: ${count}`,
    selectLabel: (location: string) => `Exit for ${location}`,
  },
  steps: ["Account", "Setup", "Rules", "DNS"],
} as const;
type MessageShape<T> = T extends string
  ? string
  : T extends (...args: never[]) => unknown
    ? T
    : T extends readonly string[]
      ? readonly string[]
      : { [K in keyof T]: MessageShape<T[K]> };
export type ControlDMessages = MessageShape<typeof controlDEn>;
