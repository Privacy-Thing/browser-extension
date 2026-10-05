import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";

import type { SettingsImportPreview } from "@/shared/settings-import";
import { SettingsImportDialogView } from "@/ui/options/components/modals/SettingsImportDialog";

const preview: SettingsImportPreview = {
  token: "storybook-preview",
  selection: { mode: "replace", locations: {}, rules: {}, containers: {} },
  source: { version: 3, exportedAt: "2026-10-02T09:00:00Z", locations: [], rules: [] },
  conflicts: { locations: [], rules: [] },
  localContainers: [],
  problems: [],
  changes: [
    {
      collection: "locations",
      key: "paris",
      kind: "added",
      after: {
        label: "Paris",
        timeZone: "Europe/Paris",
        latitude: 48.85,
        longitude: 2.35,
      },
    },
    {
      collection: "rules",
      key: "a-very-long-subdomain.example.com",
      kind: "changed",
      before: { enabled: false },
      after: { enabled: true, locationId: "paris" },
    },
    {
      collection: "settings",
      key: "themeMode",
      kind: "changed",
      before: "light",
      after: "dark",
    },
  ],
};
const meta = {
  title: "Options/Configuration import",
  component: SettingsImportDialogView,
  args: {
    preview,
    busy: false,
    error: null,
    saveInFlight: false,
    cancel: fn(),
    confirm: fn(),
    update: fn(),
  },
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof SettingsImportDialogView>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Preview: Story = {
  play: async ({ args }) => {
    const screen = within(document.body);
    const dialog = screen.getByRole("dialog");
    await waitFor(() => expect(dialog).toBeVisible());
    await userEvent.click(dialog.querySelector("summary")!);
    await expect(
      within(dialog).getByText("Europe/Paris", { exact: false }),
    ).toBeVisible();
    await userEvent.click(dialog.querySelector("#settings-import-confirm")!);
    await expect(args.confirm).toHaveBeenCalledOnce();
  },
};
export const UnresolvedConflict: Story = {
  args: {
    preview: { ...preview, problems: ["Choose how to resolve preset ID: paris"] },
  },
  play: async () => {
    const dialog = within(document.body).getByRole("dialog");
    await expect(dialog.querySelector("#settings-import-confirm")).toBeDisabled();
    await waitFor(() => expect(within(dialog).getByRole("alert")).toBeVisible());
  },
};
export const Saving: Story = {
  args: { busy: true },
  play: async () => {
    const dialog = within(document.body).getByRole("dialog");
    await expect(dialog.querySelector("#settings-import-confirm")).toBeDisabled();
    await expect(dialog.querySelector("#settings-import-cancel")).toBeDisabled();
  },
};
export const StalePreview: Story = {
  args: { error: "Settings changed after the preview. Review the import again." },
};
export const ForeignContainers: Story = {
  args: {
    preview: {
      ...preview,
      source: {
        ...preview.source,
        containerAssignments: [{ cookieStoreId: "firefox-container-42" }],
      },
      problems: ["Map or skip foreign container: firefox-container-42"],
      localContainers: [{ cookieStoreId: "firefox-container-1", name: "Personal" }],
    },
  },
};

export const RegionalPreview: Story = {
  args: {
    applyTimeZone: fn(),
    preview: {
      ...preview,
      source: {
        ...preview.source,
        locations: [
          {
            id: "paris",
            label: "Paris — English website preference",
            latitude: 48.85,
            longitude: 2.35,
            accuracy: 25,
            noiseRadius: 50,
            language: "fr-FR",
            languages: ["fr-FR", "fr", "en-US"],
            timeZone: "Asia/Tokyo",
            preferEnglishContent: true,
          },
        ],
      },
    },
  },
  play: async ({ args }) => {
    const dialog = within(document.body).getByRole("dialog");
    await waitFor(() => expect(dialog).toBeVisible());
    await expect(
      dialog.querySelector('[data-regional-warning="timeZone"]'),
    ).toBeVisible();
    await expect(dialog.querySelector("#settings-import-confirm")).toBeEnabled();
    await userEvent.click(dialog.querySelector("[data-regional-review] summary")!);
    await expect(dialog.querySelector("[data-regional-preview]")).toBeVisible();
    await userEvent.click(dialog.querySelector("[data-regional-apply-timezone]")!);
    await expect(args.applyTimeZone).toHaveBeenCalledWith("paris", "Europe/Paris");
  },
};
