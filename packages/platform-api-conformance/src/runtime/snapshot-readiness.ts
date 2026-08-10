import type { BrowserContext, Page } from "@playwright/test";

const POLL_INTERVAL_MS = 100;
const POLL_MAX_ATTEMPTS = 50;
const READY_TIMEOUT_MS = POLL_MAX_ATTEMPTS * POLL_INTERVAL_MS;

export type SpoofingReadyOptions = {
  expectedLanguage: string;
  expectedLanguages: readonly string[];
  expectedTimeZone: string | undefined;
  page: Page;
  reloadOnTimeout: boolean;
};

const matchesSpoofing = async (
  page: Page,
  expected: { language: string; languages: string[]; timeZone?: string },
): Promise<boolean> =>
  page.evaluate((readiness) => {
    if (navigator.language !== readiness.language) return false;
    const languages = navigator.languages;
    if (languages.length !== readiness.languages.length) return false;
    if (
      !readiness.languages.every((language, index) => languages[index] === language)
    ) {
      return false;
    }
    return (
      !readiness.timeZone ||
      new Intl.DateTimeFormat().resolvedOptions().timeZone === readiness.timeZone
    );
  }, expected);

export const waitForSpoofingActive = async (
  options: SpoofingReadyOptions,
): Promise<void> => {
  const expected = {
    language: options.expectedLanguage,
    languages: [...options.expectedLanguages],
    ...(options.expectedTimeZone ? { timeZone: options.expectedTimeZone } : {}),
  };
  const poll = async (): Promise<boolean> => {
    for (let attempt = 0; attempt < POLL_MAX_ATTEMPTS; attempt += 1) {
      if (await matchesSpoofing(options.page, expected)) return true;
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    }
    return false;
  };

  if (await poll()) return;
  if (options.reloadOnTimeout) {
    await options.page.reload({ waitUntil: "load" });
    if (await poll()) return;
  }

  throw new Error(
    `Spoofing readiness not detected after ${READY_TIMEOUT_MS}ms` +
      `${options.reloadOnTimeout ? " (plus one reload retry)" : ""}. ` +
      `Expected navigator.language="${options.expectedLanguage}" with ` +
      `languages=[${options.expectedLanguages.join(", ")}]` +
      `${options.expectedTimeZone ? ` and timeZone="${options.expectedTimeZone}"` : ""}. ` +
      "Aborting: snapshot against un-spoofed runtime would produce misleading results.",
  );
};

export const warmUpExtension = async (
  context: BrowserContext,
  url: string,
): Promise<void> => {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const page = await context.newPage();
    try {
      await page.goto(url, { timeout: 5000 });
      await page.close();
      return;
    } catch {
      await page.close();
      if (attempt === 4) {
        throw new Error(`Extension warmup failed after 5 attempts (${url})`);
      }
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  }
};
