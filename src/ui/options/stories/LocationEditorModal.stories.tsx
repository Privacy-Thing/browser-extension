import type { Meta, StoryObj } from "@storybook/react";
import { expect, fn, userEvent, waitFor, within } from "storybook/test";

import { StorySettingsProvider, STORY_LOCATIONS } from "./options-story-fixtures";

import { t } from "@/ui/i18n";
import { LocationEditorModal } from "@/ui/options/components/modals/LocationEditorModal";
import type { PresetUsage, PresetUsageSource } from "@/ui/options/location-usage";

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

const EditorSurface = ({ usage }: EditorStoryArgs) => (
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
    }}
  >
    <LocationEditorModal />
  </StorySettingsProvider>
);

const meta = {
  title: "Options/Preset editor",
  component: EditorSurface,
  args: { usage: usedPresetUsage },
  beforeEach: async ({ parameters }) => {
    if (import.meta.env.MODE === "test") {
      const { page } = await import("vitest/browser");
      await page.viewport(parameters.editorWidth ?? 1100, 900);
      await expect(window.innerWidth).toBe(parameters.editorWidth ?? 1100);
    }
  },
  parameters: {
    layout: "fullscreen",
    privacyThing: { surface: "options" },
    // The shared preset fields and the map placeholder predate these stories and still
    // lack input labels and a level-appropriate heading; this file covers the footer.
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

const width360 = {
  editorWidth: 360,
  viewport: { defaultViewport: "mobile1" },
  chromatic: { viewports: [360] },
};

const body = () => within(document.body);
const editorDialog = () =>
  body().findByRole("dialog", { name: t.locations.editor.title });
const deleteButton = async () =>
  within(await editorDialog()).getByRole("button", { name: t.common.actions.delete });

const checkDeleteBlocked = async (): Promise<void> => {
  const dialog = await editorDialog();
  await expect(dialog.querySelector("[data-preset-usage]")).toBeNull();
  const remove = await deleteButton();
  await expect(remove).toHaveAttribute("aria-disabled", "true");
  await userEvent.click(remove);
  const notice = await waitFor(() => {
    const element = dialog.querySelector<HTMLElement>("[data-preset-usage]");
    if (!element) throw new Error("Usage notice did not open.");
    return element;
  });
  await expect(notice).toHaveFocus();
  await expect(notice).toHaveAttribute("data-preset-usage-count", "12");
  await expect(notice).toHaveTextContent(t.locations.editor.deleteBlocked(12));
  const list = within(notice).getByRole("list", {
    name: t.locations.editor.deleteBlockedListLabel,
  });
  // The list scrolls inside a bounded height instead of growing the footer.
  await expect(list.scrollHeight).toBeGreaterThan(list.clientHeight);
  await expect(notice.scrollWidth).toBeLessThanOrEqual(notice.clientWidth);
  await expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(
    window.innerWidth,
  );
};

const closeDeleteBlocked = async (): Promise<void> => {
  const dialog = await editorDialog();
  await userEvent.click(
    within(dialog).getAllByRole("button", { name: t.common.actions.close }).at(-1)!,
  );
  await expect(dialog.querySelector("[data-preset-usage]")).toBeNull();
  await expect(await deleteButton()).toHaveFocus();
};

export const UsedPreset: Story = {
  play: async () => {
    const dialog = await editorDialog();
    await expect(dialog.querySelector("[data-preset-usage]")).toBeNull();
  },
};

export const DeleteBlocked: Story = {
  play: checkDeleteBlocked,
};

export const DeleteBlockedClosesTest: Story = {
  tags: ["!dev", "!autodocs"],
  play: async () => {
    await checkDeleteBlocked();
    await closeDeleteBlocked();
  },
};

export const DeleteBlockedAt360: Story = {
  parameters: width360,
  play: checkDeleteBlocked,
};

export const UnusedPreset: Story = {
  args: { usage: null },
  play: async () => {
    const remove = await deleteButton();
    await expect(remove).not.toHaveAttribute("aria-disabled");
    await expect(remove).not.toHaveAttribute("aria-expanded");
  },
};
