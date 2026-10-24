import type { Meta, StoryObj } from "@storybook/react";
import { expect, waitFor, within } from "storybook/test";

import "@fortawesome/fontawesome-free/css/fontawesome.css";
import "@fortawesome/fontawesome-free/css/solid.css";

import { Button } from "@/ui/components/ui/button";
import {
  Dialog,
  DialogCloseButton,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  type DialogLayout,
  DialogTitle,
} from "@/ui/components/ui/dialog";
import { en } from "@/ui/i18n/en";
import { es } from "@/ui/i18n/es";
import { pt } from "@/ui/i18n/pt";
import { ru } from "@/ui/i18n/ru";
import { uk } from "@/ui/i18n/uk";
import {
  expectDialogCoversPanel,
  expectFooterGap,
  expectHeaderClearsClose,
} from "@/ui/shared/dialog-overflow-assertion";

/**
 * Dialog titles shown in the X-Ray sidebar and the import dialog, in every interface
 * language, plus a title longer than any of them.
 */
const TITLES = [
  ...[en, es, pt, ru, uk].flatMap((pack) => [
    pack.sidebar.report.title,
    pack.sidebar.troubleshooter.title,
    pack.settingsImport.title,
  ]),
  "Review the configuration import before it replaces this browser's settings",
];

const Harness = ({ layout }: { layout?: DialogLayout }) => (
  <Dialog open>
    <DialogContent className="max-w-lg p-4" {...(layout ? { layout } : {})}>
      <DialogCloseButton label="Close" />
      <DialogHeader>
        <DialogTitle>{TITLES.at(-1)}</DialogTitle>
        <DialogDescription>
          Review the changes before saving. Cancel keeps your current configuration.
        </DialogDescription>
      </DialogHeader>
      <p className="text-sm">One local copy is kept for 7 days.</p>
      <DialogFooter>
        <Button variant="secondary">Cancel</Button>
        <Button variant="outline">Refresh preview</Button>
        <Button>Confirm import</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

const meta = {
  title: "Sidebar/Dialog layout",
  component: Harness,
  parameters: { privacyThing: { surface: "sidebar" } },
} satisfies Meta<typeof Harness>;
export default meta;
type Story = StoryObj<typeof meta>;

const expectLongTitlesClear: Story["play"] = async ({ canvasElement }) => {
  const dialog = within(canvasElement.ownerDocument.body).getByRole("dialog");
  await waitFor(() => expect(dialog).toBeVisible());
  const title = within(dialog).getByRole("heading");
  for (const text of TITLES) {
    title.textContent = text;
    expectHeaderClearsClose(dialog);
  }
  expectFooterGap(dialog.querySelector<HTMLElement>("[data-dialog-footer]")!);
};

/** Sidebar dialogs fill the panel; long and translated titles wrap beside the close button. */
export const LongTitlesInSidebar: Story = {
  tags: ["!dev", "!autodocs"],
  play: async (context) => {
    await expectLongTitlesClear(context);
    expectDialogCoversPanel(
      within(context.canvasElement.ownerDocument.body).getByRole("dialog"),
    );
  },
};

/** Popup and options dialogs stay centred with the same header and footer rules. */
export const LongTitlesCentered: Story = {
  args: { layout: "centered" },
  tags: ["!dev", "!autodocs"],
  play: async (context) => {
    await expectLongTitlesClear(context);
    await expect(
      within(context.canvasElement.ownerDocument.body).getByRole("dialog"),
    ).toHaveAttribute("data-layout", "centered");
  },
};

export const LongTitlesInSidebarDark: Story = {
  ...LongTitlesInSidebar,
  globals: { theme: "dark" },
};
