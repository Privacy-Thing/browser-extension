import { BUILD_BROWSER_TARGET } from "@/shared/build-flags";

export type BrowserTarget = "chromium" | "firefox";

export type BrowserCapabilities = {
  target: BrowserTarget;
  supportsContainers: boolean;
};

export const resolveCapabilities = (target: BrowserTarget): BrowserCapabilities => ({
  target,
  supportsContainers: target === "firefox",
});

export const getBrowserCapabilities = (): BrowserCapabilities =>
  resolveCapabilities(BUILD_BROWSER_TARGET);
