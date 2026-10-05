import { buildDiagnosticReport } from "@privacy-brand/xray-protocol/diagnostic-report";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, userEvent, within } from "storybook/test";

import "@fortawesome/fontawesome-free/css/fontawesome.css";
import "@fortawesome/fontawesome-free/css/solid.css";

import "../sidebar.css";
import { createXRayStoryState } from "./xray-story-fixtures";

import type { WorkerTestState, WorkerTestSession } from "@/shared/worker-test";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogCloseButton,
} from "@/ui/components/ui/dialog";
import { t } from "@/ui/i18n";
import {
  WorkerTroubleshooterView,
  type WorkerTestAction,
} from "@/ui/shared/WorkerTroubleshooterView";

const now = 1_800_000_000_000;
const xray = createXRayStoryState("active");
const before = buildDiagnosticReport({
  state: xray,
  generatedAt: now,
  collectionPending: false,
  extension: { version: "0.9.3.8", channel: "local" },
  browser: { family: "chromium", majorVersion: 140 },
});
const makeSession = (phase: WorkerTestSession["phase"]): WorkerTestSession => ({
  id: "story-test",
  hostname: "maps.example.test",
  kind: "service-worker",
  expiresAt: now + 10 * 60_000,
  phase,
  configurationFingerprint: "story-only",
  before,
  after: phase === "testing" ? null : before,
});
type Scenario =
  | "ready"
  | "testing"
  | "helped"
  | "failed"
  | "expired"
  | "trusted"
  | "paused"
  | "reload"
  | "missing";
const Harness = ({ scenario }: { scenario: Scenario }) => {
  const [data, setData] = useState<WorkerTestState>(() => ({
    ok: true,
    session: ["testing", "helped", "failed", "expired"].includes(scenario)
      ? makeSession(scenario as WorkerTestSession["phase"])
      : null,
    blocked:
      scenario === "trusted"
        ? "trusted"
        : scenario === "paused"
          ? "pause"
          : scenario === "reload"
            ? "reload"
            : null,
    reloadRequired: scenario === "reload",
    candidates: [
      {
        kind: "service-worker",
        evidence: scenario === "missing" ? "missing" : "observed",
      },
      { kind: "shared-worker", evidence: "missing" },
    ],
  }));
  const action = (value: WorkerTestAction) =>
    setData((current) => {
      if (value === "service-worker" || value === "shared-worker")
        return { ...current, session: { ...makeSession("testing"), kind: value } };
      if (value === "reload")
        return { ...current, blocked: null, reloadRequired: false };
      if (!current.session) return current;
      const phase =
        value === "save" ? "saved" : value === "cancel" ? "cancelled" : value;
      return { ...current, session: { ...current.session, phase, after: before } };
    });
  return (
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
          onAction={action}
        />
      </DialogContent>
    </Dialog>
  );
};
const meta = {
  title: "Sidebar/WorkerTroubleshooter",
  component: Harness,
  parameters: { privacyThing: { surface: "sidebar" } },
  args: { scenario: "ready" },
} satisfies Meta<typeof Harness>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Ready: Story = {};
export const MissingEvidence: Story = { args: { scenario: "missing" } };
export const MissingEvidenceDark: Story = {
  ...MissingEvidence,
  globals: { theme: "dark" },
};
export const Testing: Story = { args: { scenario: "testing" } };
export const Helped: Story = { args: { scenario: "helped" } };
export const Failed: Story = { args: { scenario: "failed" } };
export const Expired: Story = { args: { scenario: "expired" } };
export const TrustedSite: Story = { args: { scenario: "trusted" } };
export const Paused: Story = { args: { scenario: "paused" } };
export const ReloadRequired: Story = { args: { scenario: "reload" } };
export const Interaction: Story = {
  play: async ({ canvasElement }) => {
    const dialog = within(canvasElement.ownerDocument.body).getByRole("dialog");
    const ui = within(dialog);
    await userEvent.click(
      dialog.querySelector('[data-worker-test-start="service-worker"]')!,
    );
    await expect(dialog.querySelector("[data-worker-test-phase]")).toHaveAttribute(
      "data-worker-test-phase",
      "testing",
    );
    await userEvent.click(dialog.querySelector("[data-worker-test-helped]")!);
    await expect(dialog.querySelector("[data-worker-test-phase]")).toHaveAttribute(
      "data-worker-test-phase",
      "helped",
    );
    await expect(dialog.querySelector("[data-worker-test-save]")).toBeEnabled();
    await userEvent.click(dialog.querySelector("[data-worker-test-cancel]")!);
    await expect(dialog.querySelector("[data-worker-test-phase]")).toHaveAttribute(
      "data-worker-test-phase",
      "cancelled",
    );
    await userEvent.click(dialog.querySelector("[data-worker-test-report] summary")!);
    await expect(ui.getByRole("textbox")).not.toHaveValue(
      expect.stringContaining("maps.example.test"),
    );
  },
};
