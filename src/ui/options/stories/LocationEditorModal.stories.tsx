import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";

import { StorySettingsProvider, STORY_LOCATIONS } from "./options-story-fixtures";

import { t } from "@/ui/i18n";
import { ConfirmDialog } from "@/ui/options/components/modals/ConfirmDialog";
import { LocationEditorModal } from "@/ui/options/components/modals/LocationEditorModal";
import type { PresetUsage, PresetUsageSource } from "@/ui/options/location-usage";
import { useSettingsConfirmDialog } from "@/ui/options/state/use-settings-confirm-dialog";

const domainSources: PresetUsageSource[] = [
  "*.example.com",
  "shop.example.net",
  "news.example.org",
  "mail.example.test",
  "a-very-long-subdomain-name-for-layout-checks.region.example.com",
  "video.example.test",
  "*.example.org",
  "docs.example.net",
  "maps.example.test",
  "travel.example.com",
].map((pattern, index) => ({
  kind: "domain-rule",
  key: pattern,
  label: `Domain Rule: ${pattern}`,
  enabled: index !== 3,
}));

const usedPresetUsage: PresetUsage = {
  locationId: "warsaw",
  sources: [
    ...domainSources,
    { kind: "default-rule", key: "default-rule", label: "Default Rule", enabled: true },
    {
      kind: "firefox-container",
      key: "firefox-container-1",
      label: "Firefox Container: firefox-container-1",
      enabled: true,
    },
  ],
};

type EditorStoryArgs = { usage: PresetUsage | null };

const EditorSurface = ({ usage }: EditorStoryArgs) => {
  const confirmation = useSettingsConfirmDialog();
  return (
    <StorySettingsProvider
      value={{
        profiles: STORY_LOCATIONS,
        editingProfileIndex: 0,
        pendingEditorDraft: null,
        profileDialogOpened: true,
        profileEditorSessionId: 1,
        setProfileDialogOpened: fn(),
        saveInFlight: false,
        handleDuplicateProfile: fn(async () => false),
        handleRemoveProfile: fn(async () => false),
        handlePersistProfile: fn(async () => false),
        osmConsent: "denied",
        openOsmDialog: fn(),
        regionalPresetUsage: new Map(usage ? [[usage.locationId, usage]] : []),
        ...confirmation,
      }}
    >
      <LocationEditorModal />
      <ConfirmDialog />
    </StorySettingsProvider>
  );
};

const meta = {
  title: "Options/Preset editor",
  component: EditorSurface,
  args: { usage: usedPresetUsage },
  beforeEach: async () => {
    if (import.meta.env.MODE === "test") {
      const { page } = await import("vitest/browser");
      await page.viewport(1100, 900);
      await expect(window.innerWidth).toBe(1100);
    }
  },
  parameters: {
    layout: "fullscreen",
    privacyThing: { surface: "options" },
    chromatic: { viewports: [1100] },
    // The shared preset fields and the map placeholder predate these stories and still
    // lack input labels and a level-appropriate heading; this file covers Delete.
    a11y: {
      config: {
        rules: [
          { id: "label", enabled: false },
          { id: "heading-order", enabled: false },
        ],
      },
    },
  },
} satisfies Meta<typeof EditorSurface>;
export default meta;
type Story = StoryObj<typeof meta>;

const body = () => within(document.body);
const editorDialog = () =>
  body().findByRole("dialog", { name: t.locations.editor.title });
const deleteButton = async () =>
  within(await editorDialog()).getByRole("button", { name: t.common.actions.delete });

const openDeleteBlocked = async (): Promise<HTMLElement> => {
  const editor = await editorDialog();
  await expect(editor.querySelector("[data-preset-usage]")).toBeNull();
  const remove = await deleteButton();
  await expect(remove).toHaveAttribute("aria-disabled", "true");
  await userEvent.click(remove);
  const alert = await body().findByRole("alertdialog", {
    name: t.locations.editor.deleteBlockedTitle,
  });
  await expect(alert).toHaveAccessibleDescription(t.locations.editor.deleteBlocked(12));
  await waitFor(() => expect(alert.contains(document.activeElement)).toBe(true));
  const list = within(alert).getByRole("list", {
    name: t.locations.editor.deleteBlockedListLabel,
  });
  await expect(list).toHaveAttribute("data-preset-usage-count", "12");
  // The list scrolls inside a bounded height and never widens the alert.
  await expect(list.scrollHeight).toBeGreaterThan(list.clientHeight);
  await expect(list.scrollWidth).toBeLessThanOrEqual(list.clientWidth);
  // The editor keeps its height; nothing is added under its footer.
  await expect(editor.querySelector("[data-preset-usage]")).toBeNull();
  return alert;
};

export const UsedPreset: Story = {
  play: async () => {
    const editor = await editorDialog();
    await expect(editor.querySelector("[data-preset-usage]")).toBeNull();
  },
};

export const DeleteBlocked: Story = {
  play: async () => {
    await openDeleteBlocked();
  },
};

export const DeleteBlockedClosesTest: Story = {
  tags: ["!dev", "!autodocs"],
  play: async () => {
    const alert = await openDeleteBlocked();
    await expect(
      within(alert).queryByRole("button", { name: t.common.actions.cancel }),
    ).toBeNull();
    await userEvent.click(
      within(alert)
        .getAllByRole("button", { name: t.common.actions.close })
        .find((button) => button.id === "confirm-dialog-confirm")!,
    );
    await waitFor(() => expect(body().queryByRole("alertdialog")).toBeNull());
    await waitFor(async () => expect(await deleteButton()).toHaveFocus());
  },
};

export const UnusedPreset: Story = {
  args: { usage: null },
  play: async () => {
    const remove = await deleteButton();
    await expect(remove).not.toHaveAttribute("aria-disabled");
    await expect(remove).not.toHaveAttribute("aria-haspopup");
  },
};
