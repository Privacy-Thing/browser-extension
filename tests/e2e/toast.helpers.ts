import type { Page } from "@playwright/test";

import { UI_DATA_ATTRIBUTES } from "../../src/shared/extension-contract";

import { expect } from "./fixtures";

const TOAST_READ_TIMEOUT_MS = 1_000;

export const expectToast = async (page: Page, message: string): Promise<void> => {
  await expect(
    page.locator(`[${UI_DATA_ATTRIBUTES.toast}]`).filter({ hasText: message }).last(),
  ).toBeVisible();
};

export const readToastProgress = async (page: Page): Promise<number> => {
  const progress = page.locator(`[${UI_DATA_ATTRIBUTES.toastProgress}]`).last();
  await progress.waitFor({
    state: "attached",
    timeout: TOAST_READ_TIMEOUT_MS,
  });
  const style = await progress.getAttribute("style", {
    timeout: TOAST_READ_TIMEOUT_MS,
  });
  const match = style?.match(/width:\s*([0-9.]+)%/);
  return match ? Number(match[1]) : 0;
};

export const waitForToastProgressDrop = async (
  page: Page,
  baseline: number,
  minDrop: number,
  timeout = 2_000,
): Promise<number> => {
  await expect
    .poll(async () => baseline - (await readToastProgress(page)), {
      timeout,
      message: `Toast progress did not drop by at least ${minDrop}%.`,
    })
    .toBeGreaterThanOrEqual(minDrop);

  return readToastProgress(page);
};
