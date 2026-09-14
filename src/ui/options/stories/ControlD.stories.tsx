import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, within } from "storybook/test";

import {
  CONTROL_D_COMMANDS,
  type ControlDDiff,
  type ControlDPreparedSnapshot,
  type ControlDPublicState,
  type ControlDRecoveryCandidate,
} from "../../../experimental/control-d/contracts";
import { ControlDSubpage } from "../../../experimental/control-d/ui-entry";

import { EXTENSION_STORAGE_KEYS } from "@/shared/extension-contract";
import { DEFAULT_PREFERENCES } from "@/shared/settings-defaults";
import type { ThemeMode } from "@/shared/types";
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
const snapshot: ControlDPreparedSnapshot = { diff, proxies };
const firstSnapshot: ControlDPreparedSnapshot = {
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
): void => {
  Reflect.set(globalThis, "chrome", {
    runtime: {
      id: "storybook-control-d",
      sendMessage: async (message: { type?: string }) => {
        if (
          message.type === CONTROL_D_COMMANDS.discover ||
          message.type === CONTROL_D_COMMANDS.connect
        ) {
          return { ok: true, state, candidates: recoveryCandidates };
        }
        if (
          [
            CONTROL_D_COMMANDS.preview,
            CONTROL_D_COMMANDS.syncNow,
            CONTROL_D_COMMANDS.apply,
            CONTROL_D_COMMANDS.repair,
          ].includes(message.type as never)
        ) {
          return { ok: true, state, snapshot: preparedSnapshot };
        }
        return { ok: true, state };
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
          [EXTENSION_STORAGE_KEYS.preferences]: { ...DEFAULT_PREFERENCES, themeMode },
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
}: {
  state: ControlDPublicState;
  preparedSnapshot?: ControlDPreparedSnapshot;
  recoveryCandidates?: ControlDRecoveryCandidate[];
  themeMode?: ThemeMode;
}) => {
  installBoundary(state, preparedSnapshot, recoveryCandidates, themeMode);
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
    const progress = canvas.getByRole("list", {
      name: "Control D setup progress",
    });
    const columns = window.getComputedStyle(progress).gridTemplateColumns.split(" ");
    let expectedColumnCount = 1;
    if (window.innerWidth >= 1024) expectedColumnCount = 4;
    else if (window.innerWidth >= 640) expectedColumnCount = 2;
    await expect(columns).toHaveLength(expectedColumnCount);
    await expect(
      canvas.getByRole("button", { name: "API instructions" }),
    ).toBeVisible();
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
export const BrowserDns: Story = { render: () => <Surface state={dnsPending} /> };
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
      name: "Choose Control D exit for Rio de Janeiro",
    });
    await userEvent.click(select);
    await expect(
      await within(document.body).findByRole("option", { name: "Warsaw, Poland" }),
    ).toBeVisible();
    await userEvent.keyboard("{Escape}");
  },
};
