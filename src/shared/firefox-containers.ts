export const FIREFOX_CONTAINER_COLORS = [
  "blue",
  "turquoise",
  "green",
  "yellow",
  "orange",
  "red",
  "pink",
  "purple",
  "toolbar",
] as const;

export type FirefoxContainerColor = (typeof FIREFOX_CONTAINER_COLORS)[number];

export const FIREFOX_CONTAINER_ICONS = [
  "fingerprint",
  "briefcase",
  "dollar",
  "cart",
  "circle",
  "gift",
  "vacation",
  "food",
  "fruit",
  "pet",
  "tree",
  "chill",
  "fence",
] as const;

export type FirefoxContainerIcon = (typeof FIREFOX_CONTAINER_ICONS)[number];

export const DEFAULT_CONTAINER_COLOR: FirefoxContainerColor = "blue";
export const DEFAULT_CONTAINER_ICON: FirefoxContainerIcon = "fingerprint";

// Firefox container colors are constrained by the contextualIdentities API.
// The swatches below mirror the browser UI closely enough for the editor chips
// while the saved values remain the canonical MDN-defined enum strings.
export const CONTAINER_COLOR_SWATCHES: Readonly<Record<FirefoxContainerColor, string>> =
  {
    blue: "#37adff",
    turquoise: "#00c79a",
    green: "#51cd00",
    yellow: "#ffcb00",
    orange: "#ff9f00",
    red: "#ff613d",
    pink: "#ff4ad8",
    purple: "#af51f5",
    toolbar: "#7c7c7d",
  };

const hexToHslTokens = (hex: string): string => {
  const normalized = hex.replace("#", "");
  const expanded =
    normalized.length === 3
      ? normalized
          .split("")
          .map((char) => `${char}${char}`)
          .join("")
      : normalized;
  const red = Number.parseInt(expanded.slice(0, 2), 16) / 255;
  const green = Number.parseInt(expanded.slice(2, 4), 16) / 255;
  const blue = Number.parseInt(expanded.slice(4, 6), 16) / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const lightness = (max + min) / 2;

  if (max === min) {
    return `0 0% ${Math.round(lightness * 100)}%`;
  }

  const delta = max - min;
  const saturationBase = lightness > 0.5 ? 2 - max - min : max + min;
  const saturation = delta / saturationBase;
  let rawHue = (red - green) / delta + 4;

  if (max === red) {
    rawHue = (green - blue) / delta + (green < blue ? 6 : 0);
  } else if (max === green) {
    rawHue = (blue - red) / delta + 2;
  }
  const hue = rawHue * 60;

  return `${Math.round(hue)} ${Math.round(saturation * 100)}% ${Math.round(lightness * 100)}%`;
};

export const CONTAINER_COLOR_TOKENS: Readonly<Record<FirefoxContainerColor, string>> =
  Object.fromEntries(
    FIREFOX_CONTAINER_COLORS.map((color) => [
      color,
      hexToHslTokens(CONTAINER_COLOR_SWATCHES[color]),
    ]),
  ) as Record<FirefoxContainerColor, string>;

export const isFirefoxContainerColor = (
  value: string,
): value is FirefoxContainerColor =>
  FIREFOX_CONTAINER_COLORS.includes(value as FirefoxContainerColor);

export const isFirefoxContainerIcon = (value: string): value is FirefoxContainerIcon =>
  FIREFOX_CONTAINER_ICONS.includes(value as FirefoxContainerIcon);

export const getContainerIconUrl = (icon: FirefoxContainerIcon): string =>
  `resource://usercontext-content/${icon}.svg`;
