import { BUILD_BROWSER_TARGET } from "@/shared/build-flags";

type FirefoxWrappedWindowLike = {
  wrappedJSObject?: unknown;
};

const unwrapFirefoxWindowLike = (value: unknown): unknown => {
  if (
    BUILD_BROWSER_TARGET !== "firefox" ||
    typeof value !== "object" ||
    value === null
  ) {
    return value;
  }

  return (value as FirefoxWrappedWindowLike).wrappedJSObject ?? value;
};

export const isCurrentWindowSource = (source: MessageEventSource | null): boolean =>
  source === window ||
  (!!source &&
    typeof source === "object" &&
    unwrapFirefoxWindowLike(source) === unwrapFirefoxWindowLike(window));
