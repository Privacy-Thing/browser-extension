import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, waitFor, within } from "storybook/test";

import {
  CONTROL_D_COMMANDS,
  type ControlDDiff,
  type ControlDPreparedSnapshot,
  type ControlDPublicState,
} from "../../../experimental/control-d/contracts";
import { ControlDPanel } from "../../../experimental/control-d/ui-entry";

import { EXTENSION_STORAGE_KEYS } from "@/shared/extension-contract";
import { DEFAULT_PREFERENCES } from "@/shared/settings-defaults";
import type { ThemeMode } from "@/shared/types";
import { ThemeProvider } from "@/ui/shared/ThemeProvider";

const baseState: ControlDPublicState = {
  enabled: true,
  connected: true,
  autoSyncEnabled: true,
  status: "ready",
  hasApiKey: true,
  profileId: "profile-1",
  endpointId: "device-1",
  hasResolver: true,
  resolverDoh: "https://dns.controld.com/private-resolver-token",
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

const installBoundary = (
  state: ControlDPublicState,
  themeMode: ThemeMode = "light",
  preparedSnapshot: ControlDPreparedSnapshot = snapshot,
): void => {
  Reflect.set(globalThis, "chrome", {
    runtime: {
      id: "storybook-control-d",
      sendMessage: async (message: { type?: string }) => {
        if (
          message.type === CONTROL_D_COMMANDS.preview ||
          message.type === CONTROL_D_COMMANDS.syncNow ||
          message.type === CONTROL_D_COMMANDS.apply ||
          message.type === CONTROL_D_COMMANDS.repair
        ) {
          await Promise.resolve();
          return { ok: true, state, snapshot: preparedSnapshot };
        }
        return { ok: true, state };
      },
      getManifest: () => ({
        optional_host_permissions: ["https://api.controld.com/*"],
      }),
    },
    permissions: {
      contains: async () => true,
      request: async () => true,
    },
    storage: {
      local: {
        get: async () => ({
          [EXTENSION_STORAGE_KEYS.preferences]: {
            ...DEFAULT_PREFERENCES,
            themeMode,
          },
        }),
        set: async () => undefined,
        remove: async () => undefined,
      },
      onChanged: {
        addListener: () => undefined,
        removeListener: () => undefined,
      },
    },
    tabs: { create: async () => undefined },
  });
};

const Surface = ({
  state,
  themeMode,
  preparedSnapshot,
}: {
  state: ControlDPublicState;
  themeMode?: ThemeMode;
  preparedSnapshot?: ControlDPreparedSnapshot;
}) => {
  installBoundary(state, themeMode, preparedSnapshot);
  return (
    <ThemeProvider>
      <main className="mx-auto w-full max-w-4xl p-6">
        <ControlDPanel />
      </main>
    </ThemeProvider>
  );
};

const meta = {
  title: "Options/Control D",
  component: ControlDPanel,
  parameters: { layout: "fullscreen", privacyThing: { surface: "options" } },
} satisfies Meta<typeof ControlDPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Disconnected: Story = {
  render: () => (
    <Surface
      state={{
        ...baseState,
        connected: false,
        autoSyncEnabled: false,
        status: "disconnected",
        hasApiKey: false,
        profileId: null,
        endpointId: null,
        hasResolver: false,
        resolverDoh: null,
        lastAttemptAt: null,
        lastSuccessAt: null,
      }}
    />
  ),
};

export const Ready: Story = {
  render: () => <Surface state={baseState} />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      await canvas.findByRole("button", { name: "Manage route overrides" }),
    ).toBeVisible();
    await expect(canvas.queryByText("Route overrides")).not.toBeInTheDocument();
    await expect(canvas.queryByText("Warsaw, Poland")).not.toBeInTheDocument();
    await expect(canvas.queryByText("Ottawa, Canada")).not.toBeInTheDocument();
    await expect(canvas.queryByText("Paris, France")).not.toBeInTheDocument();
    await expect(canvas.queryAllByRole("combobox")).toHaveLength(0);
    await expect(canvas.queryByText("Folders to create")).not.toBeInTheDocument();
    await expect(canvas.queryByText("Preview changes")).not.toBeInTheDocument();
    await expect(canvas.queryByText(/need review/i)).not.toBeInTheDocument();

    await userEvent.click(
      canvas.getByRole("button", { name: "Manage route overrides" }),
    );
    await expect(await canvas.findByText("Route overrides")).toBeVisible();
    await expect(canvas.getByText("Warsaw, Poland")).toBeVisible();
    await expect(canvas.getByText("Ottawa, Canada")).toBeVisible();
    await expect(canvas.getByText("Paris, France")).toBeVisible();
    await expect(canvas.queryAllByRole("combobox")).toHaveLength(0);
    await expect(canvas.getByText("Control D is up to date.")).toBeVisible();

    await userEvent.click(canvas.getAllByRole("button", { name: "Change" })[0]!);
    const exitSelect = canvas.getByRole("combobox", {
      name: "Choose Control D exit for Warsaw",
    });
    await expect(exitSelect).toHaveTextContent("Warsaw, Poland");
    await userEvent.click(exitSelect);
    await expect(
      await within(document.body).findByRole("option", { name: "Warsaw, Poland" }),
    ).toBeVisible();
    await userEvent.keyboard("{Escape}");

    await userEvent.click(canvas.getByRole("button", { name: "Cancel" }));
    await userEvent.click(canvas.getByRole("button", { name: "Sync now" }));
    await expect(canvas.getByText("Warsaw, Poland")).toBeVisible();
    await expect(
      canvas.queryByText("Control D exit unavailable"),
    ).not.toBeInTheDocument();
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
    ...diff,
    unchangedRules: 0,
    addRules: 1,
    warnings: [
      {
        code: "approximate-location",
        locationId: "rio",
        message: "Rio de Janeiro uses the nearest available exit in Sao Paulo.",
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

export const FirstSynchronization: Story = {
  render: () => (
    <Surface
      state={{
        ...baseState,
        autoSyncEnabled: false,
        lastAttemptAt: null,
        lastSuccessAt: null,
      }}
      preparedSnapshot={approximateSnapshot}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(await canvas.findByText("Sao Paulo, Brazil")).toBeVisible();
    await expect(
      canvas.getByText(
        "Nearest available exit; change it if you prefer another location.",
      ),
    ).toBeVisible();
    await expect(canvas.queryByText("Preview changes")).not.toBeInTheDocument();
    await expect(
      canvas.getByRole("button", { name: "Apply synchronization" }),
    ).toBeDisabled();
    await userEvent.click(
      canvas.getByText("I accept the cross-country fallback shown below."),
    );
    await expect(
      canvas.getByRole("button", { name: "Apply synchronization" }),
    ).toBeEnabled();
  },
};

export const Conflict: Story = {
  render: () => (
    <Surface
      state={{
        ...baseState,
        autoSyncEnabled: false,
        status: "conflict",
        lastError:
          "Managed Control D rules changed remotely. Review the diff before repairing them.",
      }}
    />
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await waitFor(() =>
      expect(
        canvas.getByRole("button", { name: "Repair managed rules" }),
      ).toBeVisible(),
    );
  },
};

export const Syncing: Story = {
  render: () => <Surface state={{ ...baseState, status: "syncing" }} />,
};

export const DarkReady: Story = {
  render: () => <Surface state={baseState} themeMode="dark" />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(
      await canvas.findByRole("button", { name: "Manage route overrides" }),
    ).toBeVisible();
    await expect(canvas.queryByText("Warsaw, Poland")).not.toBeInTheDocument();
  },
};
