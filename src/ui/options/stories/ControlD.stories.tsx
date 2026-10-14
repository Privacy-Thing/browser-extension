import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within } from "storybook/test";

import {
  CONTROL_D_COMMANDS,
  CONTROL_D_NEEDS_REVIEW,
  type ControlDDiff,
  type ControlDPreparedSnapshot,
  type ControlDPublicState,
  type ControlDRecoveryCandidate,
} from "../../../experimental/control-d/contracts";
import {
  ControlDFeatureToggle,
  ControlDSubpage,
} from "../../../experimental/control-d/ui-entry";

import { BRAND_DISPLAY_NAME } from "@/shared/brand";
import { EXTENSION_STORAGE_KEYS } from "@/shared/extension-contract";
import { DEFAULT_PREFERENCES } from "@/shared/settings-defaults";
import type { ThemeMode } from "@/shared/types";
import { applyUiLocalePreference, type UiLocale } from "@/ui/i18n";
import { SETTINGS_SUBPAGE_ANCHORS } from "@/ui/options/navigation";
import { AppPageFrame } from "@/ui/shared/AppPageFrame";
import { ThemeProvider } from "@/ui/shared/ThemeProvider";

const baseState: ControlDPublicState = {
  enabled: true,
  connected: true,
  autoSyncEnabled: true,
  status: "ready",
  hasApiKey: true,
  setupStatus: "selected",
  resourceCode: "ABCDE-FGHJK",
  profileId: "profile-1",
  endpointId: "device-1",
  hasResolver: true,
  resolverDoh: "https://dns.controld.com/private-resolver-token",
  dnsStatus: "verified",
  dnsVerifiedAt: "2026-09-10T14:30:00.000Z",
  lastAttemptAt: "2026-09-10T14:28:00.000Z",
  lastSuccessAt: "2026-09-10T14:28:00.000Z",
  lastError: null,
};

const diff: ControlDDiff = {
  createProfile: false,
  createEndpoint: false,
  createFolders: 0,
  addRules: 0,
  updateRules: 0,
  deleteRules: 0,
  unchangedRules: 6,
  warnings: [],
  mappings: [
    {
      locationId: "warsaw",
      locationLabel: "Warsaw",
      ruleCount: 4,
      proxyPk: "WAW",
      status: "exact",
      confirmed: true,
    },
    {
      locationId: "ottawa",
      locationLabel: "Ottawa",
      ruleCount: 1,
      proxyPk: "YOW",
      status: "exact",
      confirmed: true,
    },
    {
      locationId: "paris",
      locationLabel: "Paris",
      ruleCount: 1,
      proxyPk: "PAR",
      status: "exact",
      confirmed: true,
    },
  ],
  requiresApproximationConfirmation: false,
};

const proxies = [
  {
    pk: "WAW",
    city: "Warsaw",
    countryCode: "PL",
    countryName: "Poland",
    latitude: 52.23,
    longitude: 21.01,
  },
  {
    pk: "PAR",
    city: "Paris",
    countryCode: "FR",
    countryName: "France",
    latitude: 48.86,
    longitude: 2.35,
  },
  {
    pk: "YOW",
    city: "Ottawa",
    countryCode: "CA",
    countryName: "Canada",
    latitude: 45.42,
    longitude: -75.7,
  },
];
const snapshot: ControlDPreparedSnapshot = { token: "story-preview", diff, proxies };
const firstSnapshot: ControlDPreparedSnapshot = {
  token: "first-preview",
  proxies,
  diff: {
    ...diff,
    createProfile: true,
    createEndpoint: true,
    createFolders: 2,
    addRules: 6,
    unchangedRules: 0,
  },
};
const approximateSnapshot: ControlDPreparedSnapshot = {
  token: "approximate-preview",
  proxies: [
    ...proxies,
    {
      pk: "GRU",
      city: "Sao Paulo",
      countryCode: "BR",
      countryName: "Brazil",
      latitude: -23.55,
      longitude: -46.63,
    },
  ],
  diff: {
    ...firstSnapshot.diff,
    warnings: [
      {
        code: "approximate-location",
        locationId: "rio",
        message: "Control D has no exit in Brazil; Rio maps to Sao Paulo.",
      },
    ],
    mappings: [
      {
        locationId: "rio",
        locationLabel: "Rio de Janeiro",
        ruleCount: 1,
        proxyPk: "GRU",
        status: "approximate",
        confirmed: false,
      },
    ],
    requiresApproximationConfirmation: true,
  },
};
const candidates: ControlDRecoveryCandidate[] = [
  {
    code: "ABCDE-FGHJK",
    profileId: "profile-1",
    profileName: "Privacy Thing ABCDE-FGHJK",
    endpointId: "device-1",
    endpointName: "PT Browser ABCDE-FGHJK",
    managedFolderCount: 3,
    compatibility: "ready",
    issue: null,
  },
  {
    code: "MNPQR-STVWX",
    profileId: "profile-2",
    profileName: "Privacy Thing MNPQR-STVWX",
    endpointId: null,
    endpointName: null,
    managedFolderCount: 2,
    compatibility: "profile-only",
    issue: null,
  },
];

const installBoundary = (
  state: ControlDPublicState,
  preparedSnapshot: ControlDPreparedSnapshot,
  recoveryCandidates: ControlDRecoveryCandidate[],
  themeMode: ThemeMode,
  locale: UiLocale = "en",
): void => {
  let current = state;
  Reflect.set(globalThis, "__storyControlDApplyCommand", null);
  Reflect.set(globalThis, "chrome", {
    runtime: {
      id: "storybook-control-d",
      sendMessage: async (message: { type?: string }) => {
        if (
          message.type === CONTROL_D_COMMANDS.discover ||
          message.type === CONTROL_D_COMMANDS.connect
        ) {
          if (
            message.type === CONTROL_D_COMMANDS.connect &&
            current.status === "auth-error"
          ) {
            return { ok: false, error: "Invalid fake API key.", state: current };
          }
          if (message.type === CONTROL_D_COMMANDS.connect)
            current = { ...current, connected: true, status: "ready", hasApiKey: true };
          return { ok: true, state: current, candidates: recoveryCandidates };
        }
        if (
          [
            CONTROL_D_COMMANDS.preview,
            CONTROL_D_COMMANDS.syncNow,
            CONTROL_D_COMMANDS.apply,
            CONTROL_D_COMMANDS.repair,
          ].includes(message.type as never)
        ) {
          if (
            message.type === CONTROL_D_COMMANDS.apply ||
            message.type === CONTROL_D_COMMANDS.repair
          ) {
            Reflect.set(globalThis, "__storyControlDApplyCommand", message.type);
            current = {
              ...current,
              lastSuccessAt: baseState.lastSuccessAt,
              autoSyncEnabled: true,
              dnsStatus: "pending",
              resolverDoh: baseState.resolverDoh,
              profileId: baseState.profileId,
              endpointId: baseState.endpointId,
              hasResolver: true,
            };
          }
          return { ok: true, state: current, snapshot: preparedSnapshot };
        }
        if (
          message.type === CONTROL_D_COMMANDS.selectNew ||
          message.type === CONTROL_D_COMMANDS.adopt
        ) {
          current = {
            ...current,
            setupStatus: "selected",
            resourceCode: baseState.resourceCode,
          };
        }
        return { ok: true, state: current };
      },
      getManifest: () => ({
        optional_host_permissions: ["https://api.controld.com/*"],
      }),
      getURL: (path: string) => path,
    },
    permissions: { contains: async () => true, request: async () => true },
    storage: {
      local: {
        get: async () => ({
          [EXTENSION_STORAGE_KEYS.preferences]: {
            ...DEFAULT_PREFERENCES,
            themeMode,
            uiLocale: locale,
          },
        }),
        set: async () => undefined,
        remove: async () => undefined,
      },
      onChanged: { addListener: () => undefined, removeListener: () => undefined },
    },
    tabs: { create: async () => undefined },
  });
};

const Surface = ({
  state,
  preparedSnapshot = snapshot,
  recoveryCandidates = [],
  themeMode = "light",
  locale = "en",
}: {
  state: ControlDPublicState;
  preparedSnapshot?: ControlDPreparedSnapshot;
  recoveryCandidates?: ControlDRecoveryCandidate[];
  themeMode?: ThemeMode;
  locale?: UiLocale;
}) => {
  applyUiLocalePreference(locale);
  installBoundary(state, preparedSnapshot, recoveryCandidates, themeMode, locale);
  return (
    <ThemeProvider>
      <AppPageFrame
        title="Privacy Thing settings"
        hideTitle
        pageClassName="max-w-[1120px] px-4 sm:px-6"
      >
        <ControlDSubpage />
      </AppPageFrame>
    </ThemeProvider>
  );
};

const meta = {
  title: "Options/Control D",
  component: ControlDSubpage,
  parameters: { layout: "fullscreen", privacyThing: { surface: "options" } },
} satisfies Meta<typeof ControlDSubpage>;

export default meta;
type Story = StoryObj<typeof meta>;

const disconnected: ControlDPublicState = {
  ...baseState,
  connected: false,
  autoSyncEnabled: false,
  status: "disconnected",
  hasApiKey: false,
  setupStatus: "unselected",
  resourceCode: null,
  profileId: null,
  endpointId: null,
  hasResolver: false,
  resolverDoh: null,
  dnsStatus: "unavailable",
  dnsVerifiedAt: null,
  lastAttemptAt: null,
  lastSuccessAt: null,
};

const choosing: ControlDPublicState = {
  ...disconnected,
  connected: true,
  status: "ready",
  hasApiKey: true,
};
const firstSync: ControlDPublicState = {
  ...baseState,
  autoSyncEnabled: false,
  profileId: null,
  endpointId: null,
  hasResolver: false,
  resolverDoh: null,
  dnsStatus: "unavailable",
  dnsVerifiedAt: null,
  lastAttemptAt: null,
  lastSuccessAt: null,
};
const dnsPending: ControlDPublicState = {
  ...baseState,
  dnsStatus: "pending",
  dnsVerifiedAt: null,
};

export const Account: Story = {
  render: () => <Surface state={disconnected} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const progress = canvas.getByLabelText("Setup progress");
    await expect(progress.querySelectorAll("button")).toHaveLength(4);
    await expect(canvas.getByRole("button", { name: "Account" })).toBeEnabled();
    await expect(canvas.getByRole("button", { name: "Setup" })).toBeDisabled();
    await expect(
      canvas.getByRole("button", { name: "API instructions" }),
    ).toBeVisible();
    const intro = canvasElement.querySelector("[data-control-d-intro]");
    await expect(intro).toBeVisible();
    const key = canvasElement.querySelector("[data-control-d-api-key]");
    await expect(key).toHaveAttribute("type", "password");
    if (!intro || !key) throw new Error("Account introduction and key must render.");
    await expect(
      intro.compareDocumentPosition(key) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    const policies = canvas.getAllByRole("link", { name: "Control D privacy policy" });
    await expect(policies).toHaveLength(1);
    for (const link of policies) {
      await expect(link).toHaveAttribute("href", "https://controld.com/privacy");
      await expect(link).toHaveAttribute("target", "_blank");
      await expect(link).toHaveAttribute("rel", "noopener noreferrer");
    }
    await expect(
      canvas.getByRole("link", { name: `${BRAND_DISPLAY_NAME} privacy policy` }),
    ).toHaveAttribute("href", `#${SETTINGS_SUBPAGE_ANCHORS.privacyPolicy}`);
    await expect(canvas.getByText("Beta")).toBeVisible();
    await userEvent.click(canvas.getByText("Random resource names"));
    await expect(
      canvasElement.querySelector("[data-control-d-resource-names]"),
    ).toHaveAttribute("open");
    await userEvent.click(canvas.getByText("Random resource names"));
    await expect(
      canvasElement.querySelector("[data-control-d-resource-names]"),
    ).not.toHaveAttribute("open");
  },
};
export const NoExistingSetup: Story = { render: () => <Surface state={choosing} /> };
export const ExistingSetups: Story = {
  render: () => <Surface state={choosing} recoveryCandidates={candidates} />,
};
export const FirstSynchronization: Story = {
  render: () => <Surface state={firstSync} preparedSnapshot={firstSnapshot} />,
};
export const ApproximateRoute: Story = {
  render: () => <Surface state={firstSync} preparedSnapshot={approximateSnapshot} />,
};
export const BrowserDns: Story = {
  render: () => <Surface state={dnsPending} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const policy = await canvas.findByRole("link", {
      name: "Control D privacy policy",
    });
    await expect(policy).toHaveAttribute("href", "https://controld.com/privacy");
    await expect(policy).toHaveAttribute("target", "_blank");
    await expect(policy).toHaveAttribute("rel", "noopener noreferrer");
    await expect(canvasElement.querySelector("[data-control-d-intro]")).toBeNull();
    await userEvent.click(canvas.getByRole("button", { name: "Account" }));
    await expect(
      canvas.getByText(
        "Account access works. The Rules step shows synchronization changes.",
      ),
    ).toBeVisible();
    await expect(canvasElement.querySelector("[data-control-d-intro]")).toBeNull();
  },
};
export const Active: Story = { render: () => <Surface state={baseState} /> };
export const Conflict: Story = {
  render: () => (
    <Surface
      state={{
        ...firstSync,
        status: "conflict",
        profileId: "profile-1",
        endpointId: "device-1",
        lastError:
          "Managed rules changed remotely. Review the diff before repairing them.",
      }}
    />
  ),
};
export const Syncing: Story = {
  render: () => <Surface state={{ ...baseState, status: "syncing" }} />,
};
export const DarkActive: Story = {
  render: () => <Surface state={baseState} themeMode="dark" />,
};

export const SelectInteraction: Story = {
  render: () => <Surface state={firstSync} preparedSnapshot={approximateSnapshot} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText("Sao Paulo, Brazil")).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Change" }));
    const select = canvas.getByRole("combobox", {
      name: "Exit for Rio de Janeiro",
    });
    await userEvent.click(select);
    await expect(
      await within(document.body).findByRole("option", { name: "Warsaw, Poland" }),
    ).toBeVisible();
    await userEvent.keyboard("{Escape}");
  },
};

const StatusSurface = ({
  state,
  locale,
}: {
  state: ControlDPublicState;
  locale: UiLocale;
}) => {
  applyUiLocalePreference(locale);
  installBoundary(state, snapshot, [], "light");
  return <ControlDFeatureToggle onEnabledChange={() => undefined} />;
};

const checkStatusTone =
  (tone: string, locale: "es" | "pt" | "ru" | "uk") =>
  async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    try {
      await expect(document.documentElement.lang).toBe(locale);
      const canvas = within(canvasElement);
      const badge = await canvas.findByText(
        (_, element) => element?.getAttribute("data-control-d-tone") === tone,
      );
      await expect(badge).toHaveClass(`text-tone-${tone}-text`);
    } finally {
      applyUiLocalePreference("en");
    }
  };

export const AuthErrorStatus: Story = {
  render: () => (
    <StatusSurface state={{ ...baseState, status: "auth-error" }} locale="ru" />
  ),
  play: checkStatusTone("error", "ru"),
};
export const SyncErrorStatus: Story = {
  render: () => <StatusSurface state={{ ...baseState, status: "error" }} locale="uk" />,
  play: checkStatusTone("error", "uk"),
};
export const ConflictStatus: Story = {
  render: () => (
    <StatusSurface state={{ ...baseState, status: "conflict" }} locale="pt" />
  ),
  play: checkStatusTone("warning", "pt"),
};
export const DnsPendingStatus: Story = {
  render: () => <StatusSurface state={dnsPending} locale="es" />,
  play: checkStatusTone("warning", "es"),
};

export const NativeServicePreview: Story = {
  render: () => (
    <Surface
      state={{ ...firstSync, adoptionKind: "foreign" }}
      preparedSnapshot={{
        ...firstSnapshot,
        diff: {
          ...firstSnapshot.diff,
          addServices: 1,
          updateServices: 1,
          deleteServices: 0,
          unchangedServices: 2,
        },
      }}
    />
  ),
  play: async ({ canvasElement }) => {
    const section = canvasElement.querySelector("[data-control-d-service-diff]");
    await expect(section).not.toBeNull();
  },
};

export const NativeServiceConflict: Story = {
  render: () => (
    <Surface
      state={{ ...firstSync, adoptionKind: "foreign" }}
      preparedSnapshot={{
        ...firstSnapshot,
        diff: {
          ...firstSnapshot.diff,
          addServices: 1,
          updateServices: 0,
          deleteServices: 0,
          unchangedServices: 0,
          serviceErrors: [
            {
              code: "unowned-service",
              servicePk: "video",
              rulePattern: "video.example.com",
              message: "This service is configured independently of Privacy Thing.",
            },
          ],
        },
      }}
    />
  ),
};

export const AutomaticDomainMatching: Story = {
  render: () => <Surface state={baseState} />,
  play: async ({ canvasElement }) => {
    await expect(
      canvasElement.querySelector(
        "[data-control-d-help] [data-control-d-domain-matching]",
      ),
    ).not.toBeNull();
    await expect(
      within(canvasElement).queryByRole("button", { name: "Preview lookup setup" }),
    ).toBeNull();
  },
};

export const PresetSyncDeepLink: Story = {
  beforeEach: () => {
    const old = window.location.hash;
    window.history.replaceState(
      null,
      "",
      window.location.pathname +
        window.location.search +
        "#page-experimental-integration?section=routes&preset=warsaw",
    );
    return () =>
      window.history.replaceState(
        null,
        "",
        window.location.pathname + window.location.search + old,
      );
  },
  render: () => <Surface state={baseState} />,
  play: async ({ canvasElement }) => {
    const route = await within(canvasElement).findByRole("combobox", {
      name: "Exit for Warsaw",
    });
    await expect(route).toBeVisible();
  },
};

const checkLocalizedIntro =
  (locale: UiLocale) =>
  async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    await expect(document.documentElement.lang).toBe(locale);
    const canvas = within(canvasElement);
    const intro = await canvas.findByText(
      (_, element) => element?.hasAttribute("data-control-d-intro") === true,
    );
    await expect(intro).toBeVisible();
    await expect(intro.querySelectorAll("li")).toHaveLength(4);
    const details = intro.querySelector("details");
    const summary = details?.querySelector("summary");
    await expect(summary).toBeVisible();
    await userEvent.click(summary as HTMLElement);
    await expect(details).toHaveAttribute("open");
  };

export const RussianAccount: Story = {
  render: () => <Surface state={disconnected} locale="ru" />,
  play: checkLocalizedIntro("ru"),
};
export const UkrainianAccount: Story = {
  render: () => <Surface state={disconnected} locale="uk" />,
  play: checkLocalizedIntro("uk"),
};
export const BetaCard: Story = {
  render: () => <StatusSurface state={disconnected} locale="en" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText("Beta")).toBeVisible();
    await expect(
      await canvas.findByRole("button", { name: "Open Control D" }),
    ).toBeVisible();
  },
};

const connectInStory = async (canvasElement: HTMLElement) => {
  const canvas = within(canvasElement);
  await userEvent.type(await canvas.findByLabelText("Control D API key"), "fake-key");
  await userEvent.click(canvas.getByRole("button", { name: "Connect" }));
  return canvas;
};

export const AutoCreateExact: Story = {
  render: () => <Surface state={disconnected} preparedSnapshot={firstSnapshot} />,
  play: async ({ canvasElement }) => {
    const canvas = await connectInStory(canvasElement);
    await expect(
      await canvas.findByText(
        "Rules were synchronized automatically. Configure browser DNS below.",
      ),
    ).toBeVisible();
    await expect(
      canvas.getByRole("button", { name: "I verified this resolver" }),
    ).toBeVisible();
    await expect(canvas.queryByRole("button", { name: "Apply changes" })).toBeNull();
  },
};
export const AutoAdoptReady: Story = {
  render: () => <Surface state={disconnected} recoveryCandidates={[candidates[0]!]} />,
  play: async ({ canvasElement }) => {
    const canvas = await connectInStory(canvasElement);
    await expect(
      await canvas.findByText("Reconnected to Privacy Thing ABCDE-FGHJK."),
    ).toBeVisible();
    await userEvent.click(canvas.getByRole("button", { name: "Dismiss" }));
    await expect(
      canvasElement.querySelector("[data-control-d-success-notice]"),
    ).toBeNull();
  },
};
export const SingleApproximateConsent: Story = {
  render: () => <Surface state={disconnected} preparedSnapshot={approximateSnapshot} />,
  play: async ({ canvasElement }) => {
    const canvas = await connectInStory(canvasElement);
    const apply = await canvas.findByRole("button", {
      name: /Apply with approximate routes/,
    });
    await expect(apply).toHaveTextContent("Rio de Janeiro → Sao Paulo, Brazil");
    await expect(canvas.queryByRole("checkbox")).toBeNull();
    await expect(
      canvas.getByText("Will create: profile 1, endpoint 1, folders 2"),
    ).toBeVisible();
    await expect(canvas.getByText("Rules: add 6, update 0, remove 0")).toBeVisible();
    await expect(canvas.getByRole("button", { name: "Disconnect" })).toBeVisible();
    await userEvent.click(apply);
    await expect(
      await canvas.findByText("Rules synchronized. Configure browser DNS below."),
    ).toBeVisible();
  },
};
export const ForeignSetupReview: Story = {
  render: () => (
    <Surface
      state={{ ...firstSync, adoptionKind: "foreign" }}
      preparedSnapshot={firstSnapshot}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      await canvas.findByText(
        "This setup contains rules not created by this extension. Review the plan before applying.",
      ),
    ).toBeVisible();
  },
};
export const Active360: Story = {
  render: () => (
    <div style={{ width: 360 }}>
      <Surface state={baseState} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    for (const label of ["Account", "Setup", "Rules", "DNS"]) {
      await expect(await canvas.findByRole("button", { name: label })).toBeVisible();
    }
    const rail = canvasElement.querySelector("[data-control-d-step-rail]")!;
    await expect(rail.scrollWidth).toBeLessThanOrEqual(rail.clientWidth);
    await userEvent.click(canvas.getByRole("button", { name: "Review changes" }));
    await expect(canvas.getByRole("button", { name: "Disconnect" })).toBeVisible();
  },
};
export const Active1100: Story = {
  ...Active360,
  render: () => (
    <div style={{ width: 1100, maxWidth: "100%" }}>
      <Surface state={baseState} />
    </div>
  ),
};

export const AccountErrorWithoutShift: Story = {
  render: () => (
    <div style={{ width: 360 }}>
      <Surface state={{ ...disconnected, status: "auth-error" }} />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const key = await canvas.findByLabelText("Control D API key");
    const before = key.getBoundingClientRect().top + window.scrollY;
    await userEvent.type(key, "fake-key");
    await userEvent.click(canvas.getByRole("button", { name: "Connect" }));
    await expect(await canvas.findByRole("alert")).toHaveTextContent(
      "Invalid fake API key.",
    );
    await expect(key.getBoundingClientRect().top + window.scrollY).toBe(before);
  },
};

export const PendingReviewRussian: Story = {
  render: () => (
    <Surface
      state={{ ...firstSync, status: "conflict", lastError: CONTROL_D_NEEDS_REVIEW }}
      preparedSnapshot={approximateSnapshot}
      locale="ru"
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const alert = await canvas.findByRole("alert");
    await expect(alert).not.toHaveTextContent(CONTROL_D_NEEDS_REVIEW);
    await expect(alert).toHaveTextContent("Требуется проверка");
    await userEvent.click(
      canvasElement.querySelector("[data-control-d-apply]") as HTMLElement,
    );
    await expect(Reflect.get(globalThis, "__storyControlDApplyCommand")).toBe(
      CONTROL_D_COMMANDS.apply,
    );
  },
};
