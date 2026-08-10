import { describe, expect, it, vi } from "vitest";

import {
  runToolbarAttentionPulse,
  shouldPulseToolbar,
} from "@/background/toolbar-attention-pulse";
import type { PopupNotification } from "@/shared/types";

const notification: PopupNotification = {
  id: "site:default:example.com:worker-csp-relaxation",
  kind: "worker-csp-relaxation",
  scope: "site",
  dedupeKey: "site:default:example.com:worker-csp-relaxation",
  severity: "needs-action",
  hostname: "example.com",
  createdAt: "2026-07-12T20:00:00.000Z",
  lastDetectedAt: "2026-07-12T20:00:00.000Z",
  generation: 1,
  readAt: null,
  resolvedAt: null,
  autoPresentedAt: null,
  pulseShownAt: null,
  actionTarget: "suggestion:worker-csp-relaxation",
};

describe("toolbar attention pulse", () => {
  it("runs one deterministic burst and restores the steady frame", async () => {
    const frames: string[] = [];
    const markShown = vi.fn(async () => undefined);

    const pulsed = await runToolbarAttentionPulse({
      notification,
      tabActive: true,
      reducedMotion: false,
      setFrame: async (frame) => {
        frames.push(frame);
      },
      markShown,
      wait: async () => undefined,
    });

    expect(pulsed).toBe(true);
    expect(markShown).toHaveBeenCalledOnce();
    expect(frames).toEqual(["attention-1", "attention-2", "attention-1", "attention"]);
  });

  it("uses only the steady state for reduced motion", async () => {
    const frames: string[] = [];
    const markShown = vi.fn(async () => undefined);

    await runToolbarAttentionPulse({
      notification,
      tabActive: true,
      reducedMotion: true,
      setFrame: async (frame) => {
        frames.push(frame);
      },
      markShown,
      wait: async () => undefined,
    });

    expect(frames).toEqual(["attention"]);
    expect(markShown).not.toHaveBeenCalled();
  });

  it("defers a background-tab warning until that tab becomes active", () => {
    expect(
      shouldPulseToolbar({
        notification,
        tabActive: false,
        reducedMotion: false,
      }),
    ).toBe(false);
  });

  it("never repeats after the generation was read or shown", () => {
    expect(
      shouldPulseToolbar({
        notification: { ...notification, pulseShownAt: "2026-07-12T20:00:01.000Z" },
        tabActive: true,
        reducedMotion: false,
      }),
    ).toBe(false);
    expect(
      shouldPulseToolbar({
        notification: { ...notification, readAt: "2026-07-12T20:00:01.000Z" },
        tabActive: true,
        reducedMotion: false,
      }),
    ).toBe(false);
  });
});
