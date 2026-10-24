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
  // Header alignment and footer direction follow the window's sm breakpoint, so the
  // test window takes each story's width instead of only a narrower containing block.
  beforeEach: async ({ parameters }) => {
    if (import.meta.env.MODE !== "test") return;
    const { page } = await import("vitest/browser");
    const width = (parameters.dialogWindowWidth as number | undefined) ?? 1200;
    const previous = [window.innerWidth, window.innerHeight] as const;
    await page.viewport(width, 640);
    await expect(window.innerWidth).toBe(width);
    return async () => {
      await page.viewport(...previous);
    };
  },
  parameters: { privacyThing: { surface: "sidebar" } },
} satisfies Meta<typeof Harness>;
export default meta;
type Story = StoryObj<typeof meta>;

const body = (canvasElement: HTMLElement) => within(canvasElement.ownerDocument.body);

const expectLongTitlesClear: Story["play"] = async ({ canvasElement }) => {
  const dialog = body(canvasElement).getByRole("dialog");
  await waitFor(() => expect(dialog).toBeVisible());
  const title = within(dialog).getByRole("heading");
  for (const text of TITLES) {
    title.textContent = text;
    expectHeaderClearsClose(dialog);
  }
  expectFooterGap(dialog.querySelector<HTMLElement>("[data-dialog-footer]")!);
};

const expectFillingPanel: Story["play"] = async (context) => {
  await expectLongTitlesClear(context);
  expectDialogCoversPanel(body(context.canvasElement).getByRole("dialog"));
};

const expectCentered: Story["play"] = async (context) => {
  await expectLongTitlesClear(context);
  await expect(body(context.canvasElement).getByRole("dialog")).toHaveAttribute(
    "data-layout",
    "centered",
  );
};

/**
 * Sidebar dialogs fill the panel. Long and translated titles wrap beside the close
 * button, centred on a narrow window, and stacked actions keep the shared gap.
 */
export const LongTitlesSidebar360: Story = {
  tags: ["!dev", "!autodocs"],
  parameters: { dialogWindowWidth: 360 },
  play: expectFillingPanel,
};

export const LongTitlesSidebar360Dark: Story = {
  ...LongTitlesSidebar360,
  globals: { theme: "dark" },
};

/** Wide panels left-align the header and put the actions side by side. */
export const LongTitlesSidebar720: Story = {
  tags: ["!dev", "!autodocs"],
  parameters: { dialogWindowWidth: 720 },
  play: expectFillingPanel,
};

/** Popup and options dialogs stay centred and follow the same header and footer rules. */
export const LongTitlesCentered360: Story = {
  args: { layout: "centered" },
  tags: ["!dev", "!autodocs"],
  parameters: { dialogWindowWidth: 360 },
  play: expectCentered,
};

export const LongTitlesCentered720: Story = {
  ...LongTitlesCentered360,
  parameters: { dialogWindowWidth: 720 },
};
