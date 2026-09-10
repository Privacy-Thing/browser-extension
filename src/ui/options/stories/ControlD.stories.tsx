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
  locationMappings: [],
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
  warnings: [
    {
      code: "exact-pattern-broadened",
      message:
        "www.linkedin.com is exact in Privacy Thing but would include subdomains in Control D.",
      pattern: "www.linkedin.com",
    },
    {
      code: "exact-pattern-broadened",
      message:
        "github.com is exact in Privacy Thing but would include subdomains in Control D.",
      pattern: "github.com",
    },
    {
      code: "exact-pattern-broadened",
      message:
        "iteracja.elpassion.com is exact in Privacy Thing but would include subdomains in Control D.",
      pattern: "iteracja.elpassion.com",
    },
    {
      code: "exact-pattern-broadened",
      message:
        "test.pl is exact in Privacy Thing but would include subdomains in Control D.",
      pattern: "test.pl",
    },
  ],
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

const installBoundary = (
  state: ControlDPublicState,
  themeMode: ThemeMode = "light",
): void => {
  Reflect.set(globalThis, "chrome", {
    runtime: {
      id: "storybook-control-d",
      sendMessage: async (message: { type?: string }) => {
        if (message.type === CONTROL_D_COMMANDS.preview) {
          await Promise.resolve();
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
}: {
  state: ControlDPublicState;
  themeMode?: ThemeMode;
}) => {
  installBoundary(state, themeMode);
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
    await expect(canvas.getByText("Warsaw, Poland")).toBeVisible();
    await expect(canvas.getByText("Ottawa, Canada")).toBeVisible();
    await expect(canvas.getByText("Paris, France")).toBeVisible();
    await expect(canvas.queryAllByRole("combobox")).toHaveLength(0);
    await expect(canvas.queryByText("Folders to create")).not.toBeInTheDocument();
    await expect(canvas.getByText("Everything is up to date.")).toBeVisible();

    await userEvent.click(canvas.getAllByRole("button", { name: "Change" })[0]!);
    await expect(
      canvas.getByRole("combobox", { name: "Choose Control D exit for Warsaw" }),
    ).toHaveTextContent("Warsaw, Poland");

    await userEvent.click(canvas.getByRole("button", { name: "Review details" }));
    await expect(canvas.getByText(/www\.linkedin\.com is exact/)).toBeVisible();
    await expect(
      canvas.getByRole("link", { name: "Review source rules" }),
    ).toHaveAttribute("href", "#page-rules");
    await userEvent.click(canvas.getByRole("button", { name: "Cancel" }));
    await userEvent.click(canvas.getByRole("button", { name: "Hide details" }));
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
    await userEvent.click(
      await canvas.findByRole("button", { name: "Preview changes" }),
    );
    await expect(await canvas.findByText("Warsaw, Poland")).toBeVisible();
  },
};
