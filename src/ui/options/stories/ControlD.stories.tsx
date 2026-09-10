import type { Meta, StoryObj } from "@storybook/react";
import { expect, userEvent, waitFor, within } from "storybook/test";

import {
  CONTROL_D_COMMANDS,
  type ControlDDiff,
  type ControlDPublicState,
} from "../../../experimental/control-d/contracts";
import { ControlDPanel } from "../../../experimental/control-d/ui-entry";

import { EXTENSION_STORAGE_KEYS } from "@/shared/extension-contract";
import { DEFAULT_PREFERENCES } from "@/shared/settings-defaults";
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
  locationMappings: [],
  lastAttemptAt: "2026-09-10T14:28:00.000Z",
  lastSuccessAt: "2026-09-10T14:28:00.000Z",
  lastError: null,
};

const diff: ControlDDiff = {
  createProfile: false,
  createEndpoint: false,
  createFolders: 2,
  addRules: 5,
  updateRules: 0,
  deleteRules: 0,
  unchangedRules: 3,
  warnings: [
    {
      code: "approximate-location",
      message: "Ottawa uses the nearest available Control D exit in Montreal.",
      locationId: "ottawa",
    },
  ],
  mappings: [
    {
      locationId: "warsaw",
      locationLabel: "Warsaw",
      ruleCount: 3,
      proxyPk: "WAW",
      status: "exact",
      confirmed: true,
    },
    {
      locationId: "paris",
      locationLabel: "Paris",
      ruleCount: 2,
      proxyPk: "PAR",
      status: "exact",
      confirmed: true,
    },
    {
      locationId: "ottawa",
      locationLabel: "Ottawa",
      ruleCount: 1,
      proxyPk: "YUL",
      status: "approximate",
      confirmed: false,
    },
  ],
  requiresApproximationConfirmation: true,
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
    pk: "YUL",
    city: "Montreal",
    countryCode: "CA",
    countryName: "Canada",
    latitude: 45.5,
    longitude: -73.57,
  },
];

const installBoundary = (state: ControlDPublicState): void => {
  Reflect.set(globalThis, "chrome", {
    runtime: {
      id: "storybook-control-d",
      sendMessage: async (message: { type?: string }) => {
        if (message.type === CONTROL_D_COMMANDS.preview) {
          return { ok: true, state, diff, proxies };
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
          [EXTENSION_STORAGE_KEYS.preferences]: DEFAULT_PREFERENCES,
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

const Surface = ({ state }: { state: ControlDPublicState }) => {
  installBoundary(state);
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
    await userEvent.click(
      await canvas.findByRole("button", { name: "Preview changes" }),
    );
    await expect(await canvas.findByText("Regional routes")).toBeVisible();
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
