import { expect, type BrowserContext } from "@playwright/test";

import { EXTENSION_STORAGE_KEYS } from "../../src/shared/extension-contract";

const retiredNamespace = ["geo", "warp"].join("");
const dotKey = (suffix: string): string => `${retiredNamespace}.${suffix}`;
const snakeKey = (suffix: string): string => `${retiredNamespace}_${suffix}`;

export type HistoricalStorageSeed = {
  locations: unknown[];
  rules: unknown[];
  preferences: Record<string, unknown>;
  trustedSites?: unknown[];
  containerAssignments?: unknown[];
};

export const buildHistoricalEntries = ({
  locations,
  rules,
  preferences,
  trustedSites = [],
  containerAssignments = [],
}: HistoricalStorageSeed): Record<string, unknown> => ({
  [dotKey("locations")]: locations,
  [dotKey("rules")]: rules,
  [dotKey("preferences")]: preferences,
  [dotKey("trustedSites")]: trustedSites,
  [snakeKey("container_assignments")]: containerAssignments,
});

export const seedHistoricalStorage = async (
  context: BrowserContext,
  extensionId: string,
  entries: Record<string, unknown>,
): Promise<void> => {
  const worker =
    context.serviceWorkers()[0] ?? (await context.waitForEvent("serviceworker"));
  if (new URL(worker.url()).host !== extensionId) {
    throw new Error("Historical seed targeted an unexpected extension");
  }

  await expect
    .poll(() =>
      worker.evaluate(async (preferencesKey) => {
        const stored = await chrome.storage.local.get(preferencesKey);
        return Object.hasOwn(stored, preferencesKey);
      }, EXTENSION_STORAGE_KEYS.preferences),
    )
    .toBe(true);

  await worker.evaluate(async (historicalEntries) => {
    // The default preferences key proves first-install migration completed.
    // Seeding from the worker also avoids UI autosaves before the restart.
    await chrome.storage.local.clear();
    await chrome.storage.session.clear();
    await chrome.storage.local.set(historicalEntries);
  }, entries);
};
