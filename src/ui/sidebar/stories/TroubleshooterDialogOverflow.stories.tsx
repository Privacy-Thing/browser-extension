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
import { expectNoSideScroll } from "@/ui/shared/dialog-overflow-assertion";
import { expectHiddenScrollbar } from "@/ui/shared/scrollbar-assertion";
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

const Harness = () => (
  <Dialog open>
    <DialogContent
      className="max-h-[92vh] w-[calc(100%-1.5rem)] max-w-lg min-w-0 overflow-y-auto p-4"
      data-worker-troubleshooter
    >
      <DialogCloseButton label={t.common.actions.close} />
      <DialogHeader className="pr-7">
        <DialogTitle>{t.sidebar.troubleshooter.title}</DialogTitle>
        <DialogDescription>{t.sidebar.troubleshooter.intro}</DialogDescription>
      </DialogHeader>
      <WorkerTroubleshooterView
        data={data}
        xray={xray}
        now={now}
        pending={false}
        onAction={() => undefined}
      />
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

const expectDialogScrollbar: Story["play"] = async ({ canvasElement }) => {
  const dialog = within(canvasElement.ownerDocument.body).getByRole("dialog");
  await waitFor(() => expect(dialog).toBeVisible());
  expectHiddenScrollbar(dialog);
};

export const ScrollbarGutter: Story = {
  tags: ["!dev", "!autodocs"],
  play: expectDialogScrollbar,
};

export const ScrollbarGutterDark: Story = {
  tags: ["!dev", "!autodocs"],
  globals: { theme: "dark" },
  play: expectDialogScrollbar,
};
