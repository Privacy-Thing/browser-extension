import type { Meta, StoryObj } from "@storybook/react";
import { waitFor, within, expect } from "storybook/test";

import "@fortawesome/fontawesome-free/css/fontawesome.css";
import "@fortawesome/fontawesome-free/css/solid.css";

import "../sidebar.css";
import { createXRayStoryState } from "./xray-story-fixtures";

import type { WorkerTestState } from "@/shared/worker-test";
import {
  Dialog,
  DialogCloseButton,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/ui/components/ui/dialog";
import { t } from "@/ui/i18n";
import {
  expectDialogCoversPanel,
  expectHeaderClearsClose,
  expectNoSideScroll,
  expectVisibleDialogFrame,
} from "@/ui/shared/dialog-overflow-assertion";
import { WorkerTroubleshooterView } from "@/ui/shared/WorkerTroubleshooterView";

const now = 1_800_000_000_000;
const xray = createXRayStoryState("active");
const data: WorkerTestState = {
  ok: true,
  session: null,
  blocked: null,
  reloadRequired: false,
  candidates: [
    { kind: "service-worker", evidence: "observed" },
    { kind: "shared-worker", evidence: "missing" },
  ],
};

// Mirrors WorkerTroubleshooter in the sidebar: the header stays, the body scrolls.
const Harness = () => (
  <Dialog open>
    <DialogContent
      className="max-h-[92vh] max-w-lg min-w-0 grid-rows-[auto_minmax(0,1fr)] p-4"
      data-worker-troubleshooter
    >
      <DialogCloseButton label={t.common.actions.close} />
      <DialogHeader>
        <DialogTitle>{t.sidebar.troubleshooter.title}</DialogTitle>
        <DialogDescription>{t.sidebar.troubleshooter.intro}</DialogDescription>
      </DialogHeader>
      <div className="grid min-h-0 min-w-0 gap-4 overflow-y-auto">
        <WorkerTroubleshooterView
          data={data}
          xray={xray}
          now={now}
          pending={false}
          onAction={() => undefined}
        />
      </div>
    </DialogContent>
  </Dialog>
);

const meta = {
  title: "Sidebar/Dialog overflow",
  component: Harness,
  parameters: { privacyThing: { surface: "sidebar" } },
} satisfies Meta<typeof Harness>;
export default meta;
type Story = StoryObj<typeof meta>;

export const NoSideScroll: Story = {
  tags: ["!dev", "!autodocs"],
  play: async ({ canvasElement }) => {
    const dialog = within(canvasElement.ownerDocument.body).getByRole("dialog");
    await waitFor(() => expect(dialog).toBeVisible());
    expectNoSideScroll(dialog);
  },
};

const expectFrameFillingPanel: Story["play"] = async ({ canvasElement }) => {
  const dialog = within(canvasElement.ownerDocument.body).getByRole("dialog");
  await waitFor(() => expect(dialog).toBeVisible());
  expectVisibleDialogFrame(dialog);
  expectDialogCoversPanel(dialog);
  expectHeaderClearsClose(dialog);
};

export const FrameFillsPanel: Story = {
  tags: ["!dev", "!autodocs"],
  play: expectFrameFillingPanel,
};

export const FrameFillsPanelDark: Story = {
  tags: ["!dev", "!autodocs"],
  globals: { theme: "dark" },
  play: expectFrameFillingPanel,
};
