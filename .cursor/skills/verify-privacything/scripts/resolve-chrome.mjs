import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

import { chromium } from "@playwright/test";

const MAC_CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const defaultPlaywrightCache = path.join(
  homedir(),
  "Library",
  "Caches",
  "ms-playwright",
);

const chromeForTestingBinary = (root, versionDir) =>
  [
    path.join(
      root,
      versionDir,
      "chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
    ),
    path.join(
      root,
      versionDir,
      "chrome-mac/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
    ),
  ].find((candidate) => existsSync(candidate));

const findCachedChromium = () => {
  if (!existsSync(defaultPlaywrightCache)) return null;
  const versions = readdirSync(defaultPlaywrightCache)
    .filter((entry) => /^chromium-\d+$/.test(entry))
    .sort((left, right) => Number(right.slice(10)) - Number(left.slice(10)));
  for (const versionDir of versions) {
    const binary = chromeForTestingBinary(defaultPlaywrightCache, versionDir);
    if (binary) return binary;
  }
  return null;
};

export const resolveChromeExecutable = () => {
  const fromEnv = process.env.CHROME_EXECUTABLE_PATH ?? process.env.PT_CHROME_BINARY;
  if (fromEnv && existsSync(fromEnv)) return fromEnv;

  const redirected = chromium.executablePath();
  if (existsSync(redirected)) return redirected;

  const cached = findCachedChromium();
  if (cached) return cached;

  if (existsSync(MAC_CHROME)) return MAC_CHROME;

  throw new Error(
    "No Chromium executable found. Set PT_CHROME_BINARY, install Google Chrome, or run pnpm exec playwright install chromium with PLAYWRIGHT_BROWSERS_PATH unset.",
  );
};
