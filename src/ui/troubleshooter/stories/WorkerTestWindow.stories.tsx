import { buildDiagnosticReport } from "@privacy-brand/xray-protocol/diagnostic-report";
import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { expect, fn, userEvent, within } from "storybook/test";

import type { WorkerTestState, WorkerTestSession } from "@/shared/worker-test";
import { expectScrollHandle } from "@/ui/shared/scrollbar-assertion";
import type { WorkerTestAction } from "@/ui/shared/WorkerTroubleshooterView";
import { createXRayStoryState } from "@/ui/sidebar/stories/xray-story-fixtures";
import { WorkerTestWindowView } from "@/ui/troubleshooter/WorkerTestWindow";

const now = 1_800_000_000_000;
const xray = createXRayStoryState("active");
const before = buildDiagnosticReport({
  state: xray,
  generatedAt: now,
  collectionPending: false,
  extension: { version: "0.9.3.8", channel: "local" },
  browser: { family: "chromium", majorVersion: 140 },
});
type Phase = WorkerTestSession["phase"];
const makeSession = (phase: Phase): WorkerTestSession => ({
  id: "story-test",
  hostname: "maps.example.test",
  kind: "shared-worker",
  expiresAt: now + 10 * 60_000,
  phase,
  configurationFingerprint: "story-only",
  before,
  after: phase === "testing" ? null : before,
});
const Harness = ({ phase, onClose }: { phase: Phase | null; onClose: () => void }) => {
  const [finished, setFinished] = useState(phase === "saved");
  const [data, setData] = useState<WorkerTestState>(() => ({
    ok: true,
    session: phase ? makeSession(phase) : null,
    blocked: null,
    reloadRequired: false,
    candidates: [
      { kind: "service-worker", evidence: "missing" },
      { kind: "shared-worker", evidence: "observed" },
    ],
    ...(phase === "saved" ? { savedException: { sharedWorker: "native" } } : {}),
  }));
  const action = (value: WorkerTestAction) => {
    if (value === "save") setFinished(true);
    setData((current) => {
      if (value === "service-worker" || value === "shared-worker")
        return { ...current, session: { ...makeSession("testing"), kind: value } };
      if (!current.session || value === "reload") return current;
      const next =
        value === "save" ? "saved" : value === "cancel" ? "cancelled" : value;
      return { ...current, session: { ...current.session, phase: next } };
    });
  };
  return (
    <WorkerTestWindowView
      data={data}
      xray={xray}
      pending={false}
      error={null}
      now={now}
      finished={finished}
      onAction={action}
      onClose={onClose}
    />
  );
};
const meta = {
  title: "Troubleshooter/WorkerTestWindow",
  component: Harness,
  parameters: { privacyThing: { surface: "window" } },
  args: { phase: null, onClose: fn() },
} satisfies Meta<typeof Harness>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Ready: Story = {};
export const ReadyDark: Story = { globals: { theme: "dark" } };
export const Testing: Story = { args: { phase: "testing" } };
export const Helped: Story = { args: { phase: "helped" } };
export const Saved: Story = { args: { phase: "saved" } };
export const SavedDark: Story = { ...Saved, globals: { theme: "dark" } };
export const Cancelled: Story = { args: { phase: "cancelled" } };
export const SaveFinishesTheWindow: Story = {
  tags: ["!dev", "!autodocs"],
  play: async ({ args, canvasElement }) => {
    const view = canvasElement.querySelector("[data-worker-test-window]")!;
    const ui = within(canvasElement);
    await expect(ui.queryByRole("dialog")).toBeNull();
    await userEvent.click(
      view.querySelector('[data-worker-test-start="shared-worker"]')!,
    );
    await userEvent.click(view.querySelector("[data-worker-test-helped]")!);
    await userEvent.click(view.querySelector("[data-worker-test-save]")!);
    await expect(view).toHaveAttribute("data-worker-test-finished");
    await expect(view.querySelector("[data-worker-test-start]")).toBeNull();
    await expect(view.querySelector("[data-worker-test-result]")).not.toBeNull();
    await userEvent.click(view.querySelector("[data-worker-test-close]")!);
    await expect(args.onClose).toHaveBeenCalledTimes(1);
  },
};
// The window scrolls its document once the content outgrows the screen height.
export const ScrollHandle: Story = {
  tags: ["!dev", "!autodocs"],
  play: ({ canvasElement }) =>
    expectScrollHandle(canvasElement.ownerDocument.documentElement),
};
export const ScrollHandleDark: Story = {
  ...ScrollHandle,
  globals: { theme: "dark" },
};

/**
 * Pointing at the gutter beside the handle, and dragging it, widen the pill inside the
 * fixed gutter. The content box keeps its width: compare it at rest, with the pointer
 * in the gutter, and scrolled. The headless runner does not paint scrollbars, so the
 * widening itself is checked in headed captures and by the CSS contract test.
 */
export const HandleWidensNoReflow: Story = {
  tags: ["!dev", "!autodocs"],
  play: async ({ canvasElement }) => {
    const root = canvasElement.ownerDocument.documentElement;
    const content = canvasElement.ownerDocument.body;
    const measure = () => [root.clientWidth, content.getBoundingClientRect().width];
    const rest = measure();
    if (import.meta.env.MODE === "test") {
      const { userEvent } = await import("vitest/browser");
      // The gutter sits just past the body's end edge; force skips the hit-target check.
      await userEvent.hover(content, {
        position: { x: content.getBoundingClientRect().width + 5, y: 40 },
        force: true,
      });
      await expect(measure(), "content box with the pointer in the gutter").toEqual(
        rest,
      );
    }
    root.scrollTop = 200;
    await expect(measure(), "content box while scrolled").toEqual(rest);
    root.scrollTop = 0;
  },
};
