import { isUnreadAttention } from "@/shared/popup-notification-state";
import type { PopupNotification } from "@/shared/types";

export type ToolbarAttentionFrame = "attention-1" | "attention-2" | "attention";

const waitWithTimer = (delayMs: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, delayMs));

export const shouldPulseToolbar = ({
  notification,
  tabActive,
  reducedMotion,
}: {
  notification: PopupNotification;
  tabActive: boolean;
  reducedMotion: boolean;
}): boolean =>
  isUnreadAttention(notification) &&
  notification.pulseShownAt === null &&
  tabActive &&
  !reducedMotion;

export const runToolbarAttentionPulse = async ({
  notification,
  tabActive,
  reducedMotion,
  setFrame,
  markShown,
  wait = waitWithTimer,
}: {
  notification: PopupNotification;
  tabActive: boolean;
  reducedMotion: boolean;
  setFrame: (frame: ToolbarAttentionFrame) => Promise<void>;
  markShown: () => Promise<void>;
  wait?: (delayMs: number) => Promise<void>;
}): Promise<boolean> => {
  if (!shouldPulseToolbar({ notification, tabActive, reducedMotion })) {
    await setFrame("attention");
    return false;
  }

  // Claim the generation before the first frame so overlapping refreshes do
  // not start duplicate bursts. The final steady frame is always restored.
  await markShown();
  await setFrame("attention-1");
  await wait(180);
  await setFrame("attention-2");
  await wait(180);
  await setFrame("attention-1");
  await wait(180);
  await setFrame("attention");
  return true;
};
